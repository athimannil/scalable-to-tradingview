/**
 * CSV Generator for TradingView portfolio import format
 */

import Papa from 'papaparse';

import {
  ScalableTransaction,
  TradingViewTransaction,
  TradingViewSide,
  ConversionResult,
  ConversionError,
  SkippedTransaction,
  ResolvedSymbol,
  ConversionMode,
  VALID_STATUSES,
  SKIP_STATUSES,
} from './types';

/**
 * Map Scalable Capital transaction types to TradingView sides
 */
const TYPE_MAPPING: Record<string, TradingViewSide | null> = {
  // Buy transactions
  buy: 'Buy',
  'savings plan': 'Buy', // Recurring purchases (Sparplan)
  sparplan: 'Buy', // German term for savings plan

  // Sell transactions
  sell: 'Sell',

  // Dividend/Distribution
  dividend: 'Dividend',
  distribution: 'Dividend', // ETF distributions
  interest: 'Dividend', // Interest income treated as dividend

  // Cash transactions
  withdrawal: 'Withdrawal',
  deposit: 'Deposit',

  // Tax and fees
  'taxes and fees': 'Taxes and fees',
  taxes: 'Taxes and fees', // Standalone tax payments
  tax: 'Taxes and fees',
  fee: 'Taxes and fees',

  // Skip these types - they don't represent actual trades
  'security transfer': null,
  transfer: null,
  'corporate action': null, // Stock splits, mergers, etc.
  'stock split': null,
  merger: null,
  spin: null,
  'spin-off': null,
};

/**
 * Map a Scalable Capital transaction type to TradingView side
 */
function mapTransactionType(type: string): TradingViewSide | null {
  const normalizedType = type.toLowerCase().trim();

  // Check for exact matches first
  if (TYPE_MAPPING[normalizedType] !== undefined) {
    return TYPE_MAPPING[normalizedType];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(TYPE_MAPPING)) {
    if (normalizedType.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Check if a transaction status should be skipped
 */
function shouldSkipStatus(status: string): boolean {
  const normalizedStatus = status.toLowerCase().trim();
  return SKIP_STATUSES.some((s) => normalizedStatus.includes(s));
}

/**
 * Check if a transaction status is valid for processing
 */
function isValidStatus(status: string): boolean {
  const normalizedStatus = status.toLowerCase().trim();
  // If status is empty, assume it's valid
  if (!normalizedStatus) return true;
  return VALID_STATUSES.some((s) => normalizedStatus.includes(s));
}

/**
 * Check if a transaction is an interest settlement (KKT-Abschluss)
 * These have negative amount (fee/settlement) and may have positive tax
 */
function isInterestSettlement(
  transaction: ScalableTransaction,
  parseNumber: (value: string) => number
): boolean {
  const type = transaction.type.toLowerCase().trim();
  if (type !== 'interest') return false;

  const amount = parseNumber(transaction.amount);
  const tax = parseNumber(transaction.tax);

  // Check for KKT-Abschluss in description
  const descLower = transaction.description.toLowerCase();
  const isKktAbschluss =
    descLower.includes('kkt') || descLower.includes('abschluss');

  // Interest settlements:
  // 1. KKT-Abschluss with positive tax (and typically negative amount)
  // 2. Negative interest (fee charged) regardless of tax
  // 3. KKT description with zero amount but positive tax
  return isKktAbschluss || amount < 0 || (isKktAbschluss && tax > 0);
}

/**
 * Check if a transaction is a STORNO (reversal/cancellation)
 * STORNO transactions reverse previous transactions and are treated as deposits
 */
function isStornoTransaction(transaction: ScalableTransaction): boolean {
  const descLower = transaction.description.toLowerCase();
  const refLower = transaction.reference.toLowerCase();

  return (
    descLower.includes('storno') ||
    refLower.includes('cancel') ||
    refLower.includes('storno')
  );
}

/**
 * Format date and time for TradingView
 * Input: date="2024-01-15", time="14:30:00"
 * Output: "2024-01-15 14:30:00"
 */
function formatDateTime(date: string, time: string): string {
  if (!date) return '';

  const datePart = date.trim();
  // Handle time formats like "01:00:00" or empty
  let timePart = time?.trim() || '00:00:00';

  // Ensure time has seconds
  if (timePart.split(':').length === 2) {
    timePart += ':00';
  }

  return `${datePart} ${timePart}`;
}

/**
 * Parse a European-format number string to a number
 * Handles formats like "1.234,56" (thousand separator: dot, decimal: comma)
 * Also handles US format "1,234.56"
 *
 * Scalable Capital uses European format:
 * - Comma for decimal separator: 28,435 = 28.435
 * - Dot for thousand separator: 1.000,00 = 1000.00
 * - Whole thousands with dot only: 1.000 = 1000 (not 1.0)
 */
function parseEuropeanNumber(value: string): number {
  if (!value || value.trim() === '') return 0;

  let normalized = value.trim();

  // Count dots and commas to determine format
  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European format with decimal: 1.234,56 or just 25,50
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && commaCount > 0) {
    // US format: 1,234.56
    normalized = normalized.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    // Only comma, treat as decimal separator: 25,50 -> 25.50
    normalized = normalized.replace(',', '.');
  } else if (dotCount > 0 && commaCount === 0) {
    // Only dots - check if it's thousand separator (European) or decimal (US)
    // European thousand separator pattern: digits.3digits (e.g., 1.000, 10.000.000)
    // If the part after the dot is exactly 3 digits, treat as thousand separator
    const parts = normalized.split('.');
    const isThousandSeparator = parts
      .slice(1)
      .every((part) => part.length === 3);

    if (isThousandSeparator && parts.length > 1) {
      // European format: 1.000 = 1000, 1.000.000 = 1000000
      normalized = normalized.replace(/\./g, '');
    }
    // Otherwise keep as-is (US decimal format)
  }

  return parseFloat(normalized) || 0;
}

/**
 * Aggregate a group of transactions into a single transaction
 * Uses weighted average for price based on quantity
 */
function aggregateGroup(
  group: TradingViewTransaction[]
): TradingViewTransaction {
  if (group.length === 0) {
    throw new Error('Cannot aggregate empty group');
  }

  if (group.length === 1) {
    return group[0];
  }

  let totalQty = 0;
  let totalValue = 0;
  let totalCommission = 0;

  for (const tx of group) {
    const qty = parseFloat(tx.Qty) || 0;
    const price = parseFloat(tx['Fill Price']) || 0;
    const commission = parseFloat(tx.Commission) || 0;

    totalQty += qty;
    totalValue += qty * price;
    totalCommission += commission;
  }

  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;

  // Use the last transaction's closing time
  const lastTx = group[group.length - 1];

  return {
    Symbol: group[0].Symbol,
    Side: group[0].Side,
    Qty: totalQty > 0 ? totalQty.toString() : '',
    'Fill Price': avgPrice > 0 ? avgPrice.toString() : '',
    Commission: totalCommission > 0 ? totalCommission.toString() : '',
    'Closing Time': lastTx['Closing Time'],
  };
}

/**
 * Aggregate consecutive transactions of the same type and symbol
 * Takes the average price weighted by quantity
 */
function aggregateTransactions(
  transactions: TradingViewTransaction[]
): TradingViewTransaction[] {
  if (transactions.length === 0) return [];

  const result: TradingViewTransaction[] = [];
  let currentGroup: TradingViewTransaction[] = [];
  let currentSymbol: string | null = null;
  let currentSide: TradingViewSide | null = null;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    if (currentGroup.length === 1) {
      result.push(currentGroup[0]);
    } else {
      // Aggregate the group
      const aggregated = aggregateGroup(currentGroup);
      result.push(aggregated);
    }
    currentGroup = [];
  };

  for (const tx of transactions) {
    const isTradeable = ['Buy', 'Sell'].includes(tx.Side);

    if (isTradeable) {
      // Check if this transaction belongs to the current group
      if (tx.Symbol === currentSymbol && tx.Side === currentSide) {
        currentGroup.push(tx);
      } else {
        // Flush the previous group and start a new one
        flushGroup();
        currentSymbol = tx.Symbol;
        currentSide = tx.Side;
        currentGroup = [tx];
      }
    } else {
      // Non-tradeable transactions (Deposit, Withdrawal, Dividend, etc.)
      // Flush any existing group and add this transaction directly
      flushGroup();
      currentSymbol = null;
      currentSide = null;
      result.push(tx);
    }
  }

  // Flush any remaining group
  flushGroup();

  return result;
}

/**
 * Get the TradingView symbol from a resolved symbol
 * Uses validated tradingViewSymbol if available, otherwise falls back to fullSymbol
 */
function getTradingViewSymbol(resolved: ResolvedSymbol): string {
  // Use validated TradingView symbol if available
  if (resolved.tradingViewSymbol) {
    return resolved.tradingViewSymbol;
  }
  // Fallback to the original fullSymbol from OpenFIGI
  return resolved.fullSymbol;
}

/**
 * Convert Scalable Capital transactions to TradingView format
 */
export function convertTransactions(
  transactions: ScalableTransaction[],
  symbolMap: Map<string, ResolvedSymbol | null>,
  mode: ConversionMode = 'detailed'
): ConversionResult {
  const result: TradingViewTransaction[] = [];
  const errors: ConversionError[] = [];
  const skipped: SkippedTransaction[] = [];

  transactions.forEach((transaction, index) => {
    const rowNumber = index + 2; // Account for header row and 0-indexing

    // Skip cancelled, rejected, or pending transactions
    if (shouldSkipStatus(transaction.status)) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: `Status: ${transaction.status}`,
      });
      return;
    }

    // Skip if status is not valid (executed, completed, done)
    if (!isValidStatus(transaction.status)) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: `Unknown status: ${transaction.status}`,
      });
      return;
    }

    const side = mapTransactionType(transaction.type);

    // Skip unmapped transaction types
    if (side === null) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: 'Transaction type not supported',
      });
      return;
    }

    // Handle STORNO (reversal) transactions as deposits (refunds)
    if (isStornoTransaction(transaction)) {
      const amount = Math.abs(parseEuropeanNumber(transaction.amount));
      if (amount <= 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Zero amount STORNO transaction',
        });
        return;
      }

      // STORNO with positive amount is a refund (deposit)
      const tradingViewTx: TradingViewTransaction = {
        Symbol: '$CASH',
        Side: 'Deposit',
        Qty: amount.toString(),
        'Fill Price': '',
        Commission: '',
        'Closing Time': formatDateTime(transaction.date, transaction.time),
      };

      result.push(tradingViewTx);
      return;
    }

    // Handle Fee type transactions (subscription fees like PRIME)
    if (transaction.type.toLowerCase() === 'fee') {
      const amount = parseEuropeanNumber(transaction.amount);
      const absAmount = Math.abs(amount);

      if (absAmount <= 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Zero fee amount',
        });
        return;
      }

      // Positive amount = refund (deposit), Negative amount = fee payment
      const tradingViewTx: TradingViewTransaction = {
        Symbol: '$CASH',
        Side: amount > 0 ? 'Deposit' : 'Taxes and fees',
        Qty: absAmount.toString(),
        'Fill Price': '',
        Commission: '',
        'Closing Time': formatDateTime(transaction.date, transaction.time),
      };

      result.push(tradingViewTx);
      return;
    }

    // Handle interest settlement (KKT-Abschluss) as a tax payment
    if (isInterestSettlement(transaction, parseEuropeanNumber)) {
      const tax = Math.abs(parseEuropeanNumber(transaction.tax));
      const amount = Math.abs(parseEuropeanNumber(transaction.amount));
      const totalTaxPayment = tax + amount; // Both are payments to tax authority

      if (totalTaxPayment <= 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Zero tax/fee amount in interest settlement',
        });
        return;
      }

      const tradingViewTx: TradingViewTransaction = {
        Symbol: '$CASH',
        Side: 'Taxes and fees',
        Qty: totalTaxPayment.toString(),
        'Fill Price': '',
        Commission: '',
        'Closing Time': formatDateTime(transaction.date, transaction.time),
      };

      result.push(tradingViewTx);
      return;
    }

    // Handle standalone "Taxes" type transactions
    if (transaction.type.toLowerCase() === 'taxes') {
      const taxAmount = Math.abs(parseEuropeanNumber(transaction.amount));
      if (taxAmount <= 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Zero tax amount',
        });
        return;
      }

      const tradingViewTx: TradingViewTransaction = {
        Symbol: '$CASH',
        Side: 'Taxes and fees',
        Qty: taxAmount.toString(),
        'Fill Price': '',
        Commission: '',
        'Closing Time': formatDateTime(transaction.date, transaction.time),
      };

      result.push(tradingViewTx);
      return;
    }

    // Determine symbol based on transaction type
    let symbol = '';

    if (['Buy', 'Sell', 'Dividend'].includes(side)) {
      // For trades and dividends, we need a symbol from the ISIN
      if (!transaction.isin) {
        // For dividends without ISIN, use $CASH
        if (side === 'Dividend') {
          symbol = '$CASH';
        } else {
          errors.push({
            row: rowNumber,
            isin: '',
            description: transaction.description,
            error: 'Missing ISIN for trade transaction',
          });
          return;
        }
      } else {
        const resolved = symbolMap.get(transaction.isin);
        if (!resolved) {
          errors.push({
            row: rowNumber,
            isin: transaction.isin,
            description: transaction.description,
            error: 'Could not resolve ISIN to ticker symbol',
          });
          return;
        }
        // Use validated TradingView symbol if available
        symbol = getTradingViewSymbol(resolved);
      }
    } else {
      // For cash transactions (Deposit, Withdrawal, Taxes and fees)
      symbol = '$CASH';
    }

    // Calculate values
    const fee = parseEuropeanNumber(transaction.fee);
    const tax = parseEuropeanNumber(transaction.tax);
    const commission = Math.abs(fee) + Math.abs(tax);
    const price = parseEuropeanNumber(transaction.price);
    const shares = Math.abs(parseEuropeanNumber(transaction.shares));
    const amount = Math.abs(parseEuropeanNumber(transaction.amount));

    // Determine quantity based on transaction type
    let qty = 0;
    if (['Buy', 'Sell'].includes(side)) {
      // For trades, use shares
      qty = shares;
    } else if (side === 'Dividend') {
      // For dividends, use the amount received
      qty = amount;
    } else if (['Deposit', 'Withdrawal', 'Taxes and fees'].includes(side)) {
      // For cash transactions, use the amount
      qty = amount;
    }

    // Skip transactions with no quantity
    if (qty <= 0) {
      // For dividends with zero amount but with tax, it means fully withheld
      if (side === 'Dividend' && commission > 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Dividend fully withheld for tax (zero net amount)',
        });
        return;
      }

      // For trades with no shares
      if (['Buy', 'Sell'].includes(side)) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'No shares/quantity specified',
        });
        return;
      }

      // For other zero-quantity transactions
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: 'Zero quantity/amount',
      });
      return;
    }

    // Build the TradingView transaction
    const tradingViewTx: TradingViewTransaction = {
      Symbol: symbol,
      Side: side,
      Qty: qty.toString(),
      'Fill Price': price > 0 ? price.toString() : '',
      Commission: commission > 0 ? commission.toString() : '',
      'Closing Time': formatDateTime(transaction.date, transaction.time),
    };

    result.push(tradingViewTx);
  });

  // Apply aggregation if mode is 'aggregated'
  const finalTransactions =
    mode === 'aggregated' ? aggregateTransactions(result) : result;

  return {
    transactions: finalTransactions,
    errors,
    skipped,
  };
}

/**
 * Generate a TradingView-compatible CSV string from transactions
 */
export function generateTradingViewCsv(
  transactions: TradingViewTransaction[]
): string {
  return Papa.unparse(transactions, {
    quotes: false,
    header: true,
    columns: [
      'Symbol',
      'Side',
      'Qty',
      'Fill Price',
      'Commission',
      'Closing Time',
    ],
  });
}
