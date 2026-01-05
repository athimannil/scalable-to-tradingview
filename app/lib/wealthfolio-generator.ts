/**
 * CSV Generator for Wealthfolio portfolio import format
 * Format: date,symbol,quantity,activityType,unitPrice,currency,fee,amount
 */

import Papa from 'papaparse';

import {
  ScalableTransaction,
  ResolvedSymbol,
  ConversionError,
  SkippedTransaction,
  ConversionMode,
  VALID_STATUSES,
  SKIP_STATUSES,
  YAHOO_FINANCE_SUFFIXES,
} from './types';

/**
 * Activity types supported by Wealthfolio
 */
export type WealthfolioActivityType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'INTEREST'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FEE'
  | 'TAX';

/**
 * Represents a transaction in Wealthfolio portfolio import format
 * Format: date,symbol,quantity,activityType,unitPrice,currency,fee,amount
 */
export interface WealthfolioTransaction {
  date: string;
  symbol: string;
  quantity: string;
  activityType: WealthfolioActivityType;
  unitPrice: string;
  currency: string;
  fee: string;
  amount: string;
}

/**
 * Result of the Wealthfolio conversion process
 */
export interface WealthfolioConversionResult {
  transactions: WealthfolioTransaction[];
  errors: ConversionError[];
  skipped: SkippedTransaction[];
}

/**
 * Map Scalable Capital transaction types to Wealthfolio activity types
 */
const TYPE_MAPPING: Record<string, WealthfolioActivityType | null> = {
  // Buy transactions
  buy: 'BUY',
  'savings plan': 'BUY',
  sparplan: 'BUY',

  // Sell transactions
  sell: 'SELL',

  // Dividend/Distribution
  dividend: 'DIVIDEND',
  distribution: 'DIVIDEND',

  // Interest (separate from dividend in Wealthfolio)
  interest: 'INTEREST',

  // Cash transactions
  withdrawal: 'WITHDRAWAL',
  deposit: 'DEPOSIT',

  // Tax and fees (separate in Wealthfolio)
  taxes: 'TAX',
  tax: 'TAX',
  fee: 'FEE',
  'taxes and fees': 'FEE',

  // Skip these types
  'security transfer': null,
  transfer: null,
  'corporate action': null,
  'stock split': null,
  merger: null,
  spin: null,
  'spin-off': null,
};

/**
 * Yahoo Finance suffix mapping for German exchanges
 * Wealthfolio uses Yahoo Finance for quotes, so symbols need these suffixes
 *
 * Note: Yahoo Finance often doesn't recognize German exchange tickers directly.
 * We use the ISIN with .DE suffix as Yahoo Finance supports ISIN-based lookups.
 *
 * German exchange suffixes:
 * - .DE  XETRA (main German exchange)
 * - .F   Frankfurt
 * - .SG  Stuttgart
 * - .MU  Munich
 * - .BE  Berlin
 * - .HM  Hamburg
 * - .DU  Düsseldorf
 */

/**
 * Convert a resolved symbol to Yahoo Finance format
 * Uses validated yahooSymbol if available, otherwise falls back to exchCode-based suffix
 *
 * Examples:
 * - { ticker: 'APC', exchCode: 'GR', yahooSymbol: 'APC.DE' } -> 'APC.DE' (validated)
 * - { ticker: '3ZU0', exchCode: 'GF', yahooSymbol: '3ZU0.F' } -> '3ZU0.F' (validated)
 * - { ticker: 'APC', exchCode: 'GM' } -> 'APC.MU' (fallback to suffix mapping)
 */
function convertToYahooSymbol(resolved: ResolvedSymbol): string {
  // Use validated Yahoo symbol if available
  if (resolved.yahooSymbol) {
    return resolved.yahooSymbol;
  }
  // Fallback to exchCode-based suffix
  const suffix = YAHOO_FINANCE_SUFFIXES[resolved.exchCode] || '.DE';
  return `${resolved.ticker}${suffix}`;
}

/**
 * Map a Scalable Capital transaction type to Wealthfolio activity type
 */
function mapTransactionType(type: string): WealthfolioActivityType | null {
  const normalizedType = type.toLowerCase().trim();

  if (TYPE_MAPPING[normalizedType] !== undefined) {
    return TYPE_MAPPING[normalizedType];
  }

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
  if (!normalizedStatus) return true;
  return VALID_STATUSES.some((s) => normalizedStatus.includes(s));
}

/**
 * Check if a transaction is an interest settlement (KKT-Abschluss)
 */
function isInterestSettlement(
  transaction: ScalableTransaction,
  parseNumber: (value: string) => number
): boolean {
  const type = transaction.type.toLowerCase().trim();
  if (type !== 'interest') return false;

  const descLower = transaction.description.toLowerCase();
  const amount = parseNumber(transaction.amount);

  const isKktAbschluss =
    descLower.includes('kkt') || descLower.includes('abschluss');

  return isKktAbschluss || amount < 0;
}

/**
 * Check if a transaction is a STORNO (reversal/cancellation)
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
 * Format date and time for Wealthfolio (ISO 8601 format)
 * Input: date="2024-01-15", time="14:30:00"
 * Output: "2024-01-15T14:30:00.000Z"
 */
function formatDateTime(date: string, time: string): string {
  if (!date) return '';

  const datePart = date.trim();
  let timePart = time?.trim() || '00:00:00';

  // Ensure time has seconds
  if (timePart.split(':').length === 2) {
    timePart += ':00';
  }

  return `${datePart}T${timePart}.000Z`;
}

/**
 * Parse a European-format number string to a number
 */
function parseEuropeanNumber(value: string): number {
  if (!value || value.trim() === '') return 0;

  let normalized = value.trim();

  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && commaCount > 0) {
    normalized = normalized.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    normalized = normalized.replace(',', '.');
  } else if (dotCount > 0 && commaCount === 0) {
    const parts = normalized.split('.');
    const isThousandSeparator = parts
      .slice(1)
      .every((part) => part.length === 3);

    if (isThousandSeparator && parts.length > 1) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  return parseFloat(normalized) || 0;
}

/**
 * Aggregate a group of transactions into a single transaction
 */
function aggregateGroup(
  group: WealthfolioTransaction[]
): WealthfolioTransaction {
  if (group.length === 0) {
    throw new Error('Cannot aggregate empty group');
  }

  if (group.length === 1) {
    return group[0];
  }

  let totalQty = 0;
  let totalValue = 0;
  let totalFee = 0;

  for (const tx of group) {
    const qty = parseFloat(tx.quantity) || 0;
    const price = parseFloat(tx.unitPrice) || 0;
    const fee = parseFloat(tx.fee) || 0;

    totalQty += qty;
    totalValue += qty * price;
    totalFee += fee;
  }

  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;
  const lastTx = group[group.length - 1];
  const totalAmount = totalQty * avgPrice;

  return {
    date: lastTx.date,
    symbol: group[0].symbol,
    quantity: totalQty > 0 ? totalQty.toString() : '0',
    activityType: group[0].activityType,
    unitPrice: avgPrice > 0 ? avgPrice.toString() : '0',
    currency: group[0].currency,
    fee: totalFee > 0 ? totalFee.toString() : '0',
    amount: totalAmount > 0 ? totalAmount.toString() : '',
  };
}

/**
 * Aggregate consecutive transactions of the same type and symbol
 */
function aggregateTransactions(
  transactions: WealthfolioTransaction[]
): WealthfolioTransaction[] {
  if (transactions.length === 0) return [];

  const result: WealthfolioTransaction[] = [];
  let currentGroup: WealthfolioTransaction[] = [];
  let currentSymbol: string | null = null;
  let currentType: WealthfolioActivityType | null = null;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    if (currentGroup.length === 1) {
      result.push(currentGroup[0]);
    } else {
      const aggregated = aggregateGroup(currentGroup);
      result.push(aggregated);
    }
    currentGroup = [];
  };

  for (const tx of transactions) {
    const isTradeable = ['BUY', 'SELL'].includes(tx.activityType);

    if (isTradeable) {
      if (tx.symbol === currentSymbol && tx.activityType === currentType) {
        currentGroup.push(tx);
      } else {
        flushGroup();
        currentSymbol = tx.symbol;
        currentType = tx.activityType;
        currentGroup = [tx];
      }
    } else {
      flushGroup();
      currentSymbol = null;
      currentType = null;
      result.push(tx);
    }
  }

  flushGroup();

  return result;
}

/**
 * Convert Scalable Capital transactions to Wealthfolio format
 */
export function convertToWealthfolio(
  transactions: ScalableTransaction[],
  symbolMap: Map<string, ResolvedSymbol | null>,
  mode: ConversionMode = 'detailed'
): WealthfolioConversionResult {
  const result: WealthfolioTransaction[] = [];
  const errors: ConversionError[] = [];
  const skipped: SkippedTransaction[] = [];

  transactions.forEach((transaction, index) => {
    const rowNumber = index + 2;

    if (shouldSkipStatus(transaction.status)) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: `Status: ${transaction.status}`,
      });
      return;
    }

    if (!isValidStatus(transaction.status)) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: `Unknown status: ${transaction.status}`,
      });
      return;
    }

    const activityType = mapTransactionType(transaction.type);

    if (activityType === null) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: 'Transaction type not supported',
      });
      return;
    }

    const currency = transaction.currency || 'EUR';

    // Handle STORNO (reversal) transactions
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

      const wealthfolioTx: WealthfolioTransaction = {
        date: formatDateTime(transaction.date, transaction.time),
        symbol: `$CASH-${currency}`,
        quantity: '1',
        activityType: 'DEPOSIT',
        unitPrice: amount.toString(),
        currency,
        fee: '0',
        amount: amount.toString(),
      };

      result.push(wealthfolioTx);
      return;
    }

    // Handle Fee type transactions
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

      const wealthfolioTx: WealthfolioTransaction = {
        date: formatDateTime(transaction.date, transaction.time),
        symbol: `$CASH-${currency}`,
        quantity: '1',
        activityType: amount > 0 ? 'DEPOSIT' : 'FEE',
        unitPrice: absAmount.toString(),
        currency,
        fee: '0',
        amount: absAmount.toString(),
      };

      result.push(wealthfolioTx);
      return;
    }

    // Handle interest settlement (KKT-Abschluss)
    if (isInterestSettlement(transaction, parseEuropeanNumber)) {
      const tax = Math.abs(parseEuropeanNumber(transaction.tax));
      const amount = Math.abs(parseEuropeanNumber(transaction.amount));

      // Create separate TAX transaction if there's tax
      if (tax > 0) {
        const taxTx: WealthfolioTransaction = {
          date: formatDateTime(transaction.date, transaction.time),
          symbol: `$CASH-${currency}`,
          quantity: '1',
          activityType: 'TAX',
          unitPrice: tax.toString(),
          currency,
          fee: '0',
          amount: tax.toString(),
        };
        result.push(taxTx);
      }

      // Create FEE transaction for the amount
      if (amount > 0) {
        const feeTx: WealthfolioTransaction = {
          date: formatDateTime(transaction.date, transaction.time),
          symbol: `$CASH-${currency}`,
          quantity: '1',
          activityType: 'FEE',
          unitPrice: amount.toString(),
          currency,
          fee: '0',
          amount: amount.toString(),
        };
        result.push(feeTx);
      }

      if (tax <= 0 && amount <= 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Zero tax/fee amount in interest settlement',
        });
      }
      return;
    }

    // Handle standalone Taxes
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

      const wealthfolioTx: WealthfolioTransaction = {
        date: formatDateTime(transaction.date, transaction.time),
        symbol: `$CASH-${currency}`,
        quantity: '1',
        activityType: 'TAX',
        unitPrice: taxAmount.toString(),
        currency,
        fee: '0',
        amount: taxAmount.toString(),
      };

      result.push(wealthfolioTx);
      return;
    }

    // Determine symbol
    let symbol = '';

    if (['BUY', 'SELL', 'DIVIDEND'].includes(activityType)) {
      if (!transaction.isin) {
        if (activityType === 'DIVIDEND') {
          symbol = `$CASH-${currency}`;
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
        // Wealthfolio uses Yahoo Finance symbols with German exchange suffix
        symbol = convertToYahooSymbol(resolved);
      }
    } else if (activityType === 'INTEREST') {
      symbol = `$CASH-${currency}`;
    } else {
      symbol = `$CASH-${currency}`;
    }

    // Calculate values
    const fee = Math.abs(parseEuropeanNumber(transaction.fee));
    const tax = Math.abs(parseEuropeanNumber(transaction.tax));
    const totalFee = fee + tax;
    const price = parseEuropeanNumber(transaction.price);
    const shares = Math.abs(parseEuropeanNumber(transaction.shares));
    const amount = Math.abs(parseEuropeanNumber(transaction.amount));

    // Determine quantity, unitPrice, and amount based on activity type
    let qty = 0;
    let unitPrice = 0;
    let txAmount = 0;

    if (['BUY', 'SELL'].includes(activityType)) {
      qty = shares;
      unitPrice = price;
      txAmount = qty * unitPrice;
    } else if (activityType === 'DIVIDEND' || activityType === 'INTEREST') {
      // For dividends/interest: quantity=1, unitPrice=amount, amount=amount
      qty = 1;
      unitPrice = amount;
      txAmount = amount;
    } else if (['DEPOSIT', 'WITHDRAWAL'].includes(activityType)) {
      // For deposits/withdrawals: quantity=1, unitPrice=amount, amount=amount
      qty = 1;
      unitPrice = amount;
      txAmount = amount;
    }

    if (
      qty <= 0 ||
      (unitPrice <= 0 && !['BUY', 'SELL'].includes(activityType))
    ) {
      if (activityType === 'DIVIDEND' && totalFee > 0) {
        skipped.push({
          row: rowNumber,
          type: transaction.type,
          description: transaction.description,
          reason: 'Dividend fully withheld for tax (zero net amount)',
        });
        return;
      }

      if (['BUY', 'SELL'].includes(activityType)) {
        if (shares <= 0) {
          skipped.push({
            row: rowNumber,
            type: transaction.type,
            description: transaction.description,
            reason: 'No shares/quantity specified',
          });
          return;
        }
      }

      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: 'Zero quantity/amount',
      });
      return;
    }

    const wealthfolioTx: WealthfolioTransaction = {
      date: formatDateTime(transaction.date, transaction.time),
      symbol,
      quantity: qty.toString(),
      activityType,
      unitPrice: unitPrice > 0 ? unitPrice.toString() : '0',
      currency,
      fee: totalFee > 0 ? totalFee.toString() : '0',
      amount: txAmount > 0 ? txAmount.toString() : '',
    };

    result.push(wealthfolioTx);
  });

  const finalTransactions =
    mode === 'aggregated' ? aggregateTransactions(result) : result;

  return {
    transactions: finalTransactions,
    errors,
    skipped,
  };
}

/**
 * Generate a Wealthfolio-compatible CSV string from transactions
 */
export function generateWealthfolioCsv(
  transactions: WealthfolioTransaction[]
): string {
  return Papa.unparse(transactions, {
    quotes: false,
    header: true,
    columns: [
      'date',
      'symbol',
      'quantity',
      'activityType',
      'unitPrice',
      'currency',
      'fee',
      'amount',
    ],
  });
}
