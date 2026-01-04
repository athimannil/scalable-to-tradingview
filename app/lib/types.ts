/**
 * Types for Scalable Capital to TradingView CSV Converter
 */

/**
 * Represents a transaction from Scalable Capital CSV export
 */
export interface ScalableTransaction {
  date: string;
  time: string;
  status: string;
  reference: string;
  description: string;
  assetType: string;
  type: string;
  isin: string;
  shares: string;
  price: string;
  amount: string;
  fee: string;
  tax: string;
  currency: string;
}

/**
 * Transaction sides supported by TradingView
 */
export type TradingViewSide =
  | 'Buy'
  | 'Sell'
  | 'Dividend'
  | 'Withdrawal'
  | 'Deposit'
  | 'Taxes and fees';

/**
 * Represents a transaction in TradingView portfolio import format
 */
export interface TradingViewTransaction {
  Symbol: string;
  Side: TradingViewSide;
  Qty: string;
  'Fill Price': string;
  Commission: string;
  'Closing Time': string;
}

/**
 * Request body for OpenFIGI API
 */
export interface OpenFigiRequest {
  idType: string;
  idValue: string;
  exchCode: string;
}

/**
 * Single instrument data from OpenFIGI response
 */
export interface OpenFigiInstrument {
  figi: string;
  name: string;
  ticker: string;
  exchCode: string;
  compositeFIGI: string;
  securityType: string;
  marketSector: string;
  shareClassFIGI?: string;
  securityType2?: string;
  securityDescription: string;
}

/**
 * Single response item from OpenFIGI API
 */
export interface OpenFigiResponseItem {
  data?: OpenFigiInstrument[];
  error?: string;
}

/**
 * Resolved symbol information
 */
export interface ResolvedSymbol {
  ticker: string;
  exchange: string;
  fullSymbol: string;
}

/**
 * Error that occurred during conversion
 */
export interface ConversionError {
  row: number;
  isin: string;
  description: string;
  error: string;
}

/**
 * Transaction that was skipped during conversion
 */
export interface SkippedTransaction {
  row: number;
  type: string;
  description: string;
  reason: string;
}

/**
 * Result of the conversion process
 */
export interface ConversionResult {
  transactions: TradingViewTransaction[];
  errors: ConversionError[];
  skipped: SkippedTransaction[];
}

/**
 * Exchange code mappings from OpenFIGI to TradingView
 * OpenFIGI exchCode -> TradingView exchange prefix
 */
export const EXCHANGE_CODES: Record<string, string> = {
  GR: 'XETR', // Xetra (Frankfurt electronic)
  GF: 'FRA', // Frankfurt floor
  GT: 'TRADEGATE', // Tradegate
  GM: 'GETTEX', // Munich / Gettex
  GS: 'SWB', // Stuttgart
  GH: 'HAM', // Hamburg
  QT: 'QUOTRIX', // Quotrix
} as const;

/**
 * Priority order for trying exchanges when resolving ISINs
 */
export const EXCHANGE_PRIORITY = [
  'GR',
  'GT',
  'GM',
  'GF',
  'GS',
  'GH',
  'QT',
] as const;

export type ExchangeCode = (typeof EXCHANGE_PRIORITY)[number];

/**
 * Conversion mode options
 * - detailed: Each transaction is converted individually
 * - aggregated: Consecutive buy/sell transactions are averaged into single entries
 */
export type ConversionMode = 'detailed' | 'aggregated';
