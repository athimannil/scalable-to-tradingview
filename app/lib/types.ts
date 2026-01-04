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
 * German exchange code mappings from OpenFIGI to TradingView
 * OpenFIGI exchCode -> TradingView exchange prefix
 *
 * Scalable Capital only allows trading on German exchanges in EUR,
 * so we only support German exchange codes.
 */
export const EXCHANGE_CODES: Record<string, string> = {
  GM: 'GETTEX', // Gettex (Munich)
  GR: 'XETR', // XETRA
  GT: 'TRADEGATE', // Tradegate
  GF: 'FRA', // Frankfurt floor (FWB)
  GS: 'XSTU', // Stuttgart
  GH: 'XHAM', // Hamburg (low coverage)
  QT: 'QUOTRIX', // Quotrix (usually not on TradingView)
} as const;

/**
 * Priority order for trying German exchanges when resolving ISINs
 * Ordered by liquidity and preference for Scalable Capital users
 */
export const EXCHANGE_PRIORITY = [
  'GM', // Gettex
  'GR', // XETRA
  'GT', // Tradegate
  'GS', // Stuttgart
  'GF', // Frankfurt floor
  'GH', // Hamburg
  'QT', // Quotrix
] as const;

export type ExchangeCode = (typeof EXCHANGE_PRIORITY)[number];

/**
 * Conversion mode options
 */
export type ConversionMode = 'detailed' | 'aggregated';

/**
 * Valid transaction statuses that should be processed
 */
export const VALID_STATUSES = ['executed', 'completed', 'done'] as const;

/**
 * Transaction statuses that should be skipped
 */
export const SKIP_STATUSES = [
  'cancelled',
  'canceled', // American spelling variant
  'rejected',
  'pending',
  'failed',
] as const;
