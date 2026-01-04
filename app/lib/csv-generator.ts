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
} from './types';

/**
 * Map Scalable Capital transaction types to TradingView sides
 */
const TYPE_MAPPING: Record<string, TradingViewSide | null> = {
  buy: 'Buy',
  sell: 'Sell',
  'savings plan': 'Buy', // Recurring purchases of fractional shares
  dividend: 'Dividend',
  withdrawal: 'Withdrawal',
  deposit: 'Deposit',
  'taxes and fees': 'Taxes and fees',
  tax: 'Taxes and fees',
  fee: 'Taxes and fees',
  // Skip these types
  'security transfer': null,
  transfer: null,
  'corporate action': null, // Stock splits, mergers, etc.
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
 * Format date and time for TradingView
 * Input: date="2024-01-15", time="14:30:00"
 * Output: "2024-01-15 14:30:00"
 */
function formatDateTime(date: string, time: string): string {
  if (!date) return '';

  const datePart = date.trim();
  const timePart = time?.trim() || '0:00:00';

  return `${datePart} ${timePart}`;
}

/**
 * Parse a European-format number string to a number
 * Handles formats like "1.234,56" (thousand separator: dot, decimal: comma)
 */
function parseEuropeanNumber(value: string): number {
  if (!value || value.trim() === '') return 0;

  // Remove thousand separators (dots) and replace comma with dot for decimal
  const normalized = value.replace(/\./g, '').replace(',', '.');

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

    // Skip if status is not "executed"
    const status = transaction.status.toLowerCase();
    if (status && !['executed', 'completed', 'done'].includes(status)) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: `Status: ${transaction.status}`,
      });
      return;
    }

    const side = mapTransactionType(transaction.type);

    // Skip security transfers and unmapped types
    if (side === null) {
      skipped.push({
        row: rowNumber,
        type: transaction.type,
        description: transaction.description,
        reason: 'Transaction type not supported (e.g., security transfer)',
      });
      return;
    }

    // Determine symbol based on transaction type
    let symbol = '';

    if (['Buy', 'Sell', 'Dividend'].includes(side)) {
      // For trades and dividends, we need a symbol from the ISIN
      if (!transaction.isin) {
        errors.push({
          row: rowNumber,
          isin: '',
          description: transaction.description,
          error: 'Missing ISIN for trade transaction',
        });
        return;
      }

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
      symbol = resolved.fullSymbol;
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

    // Determine quantity
    let qty = '';
    if (['Buy', 'Sell'].includes(side)) {
      qty = shares > 0 ? shares.toString() : '';
    } else if (side === 'Dividend') {
      // For dividends, the quantity might be the dividend amount
      qty = amount > 0 ? amount.toString() : '';
    } else if (['Deposit', 'Withdrawal', 'Taxes and fees'].includes(side)) {
      // For cash transactions, use the amount as quantity
      qty = amount > 0 ? amount.toString() : '';
    }

    // Build the TradingView transaction
    const tradingViewTx: TradingViewTransaction = {
      Symbol: symbol,
      Side: side,
      Qty: qty,
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
