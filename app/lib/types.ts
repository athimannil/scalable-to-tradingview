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
  exchCode: string; // Original OpenFIGI exchange code (e.g., 'GR', 'GF', 'GM')
  fullSymbol: string;
  yahooSymbol?: string; // Validated Yahoo Finance symbol (e.g., 'SAP.DE', 'SAP.F')
  tradingViewSymbol?: string; // Validated TradingView symbol (e.g., 'XETR:SAP', 'SWB:EWG2')
  securityType?: string; // OpenFIGI security type (e.g., 'ETP', 'Common Stock', 'ETF')
  securityType2?: string; // Additional security type from OpenFIGI
  marketSector?: string; // Market sector from OpenFIGI (e.g., 'Equity', 'Commodity')
}

/**
 * Yahoo Finance validation request
 */
export interface YahooValidationRequest {
  ticker: string;
  preferredSuffix?: string;
}

/**
 * Yahoo Finance validation response
 */
export interface YahooValidationResponse {
  ticker: string;
  validSymbol: string | null;
  testedSuffixes: string[];
}

/**
 * Yahoo Finance batch validation response
 */
export interface YahooBatchValidationResponse {
  results: YahooValidationResponse[];
}

/**
 * TradingView validation request
 */
export interface TradingViewValidationRequest {
  ticker: string;
  preferredExchange?: string;
}

/**
 * TradingView validation response
 */
export interface TradingViewValidationResponse {
  ticker: string;
  validSymbol: string | null;
  testedExchanges: string[];
}

/**
 * TradingView batch validation response
 */
export interface TradingViewBatchValidationResponse {
  results: TradingViewValidationResponse[];
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
  GS: 'SWB', // Stuttgart (Börse Stuttgart / EUWAX)
  GH: 'XHAM', // Hamburg (low coverage)
  QT: 'QUOTRIX', // Quotrix (usually not on TradingView)
} as const;

/**
 * TradingView exchange prefixes to try for validation
 * Ordered by likelihood of availability on TradingView
 */
export const TRADINGVIEW_EXCHANGES = [
  'SWB', // Stuttgart (Börse Stuttgart)
  'GETTEX',
  'XETR', // XETRA - most common
  'MUN', // Munich
  'FRA', // Frankfurt
  'DUS', // Düsseldorf
  'HAM', // Hamburg
  'BER', // Berlin
  'TRADEGATE',
] as const;

/**
 * Yahoo Finance suffix mappings for German exchanges
 * OpenFIGI exchCode -> Yahoo Finance suffix
 *
 * Yahoo Finance uses different suffixes than TradingView for German exchanges.
 * Reference: https://help.yahoo.com/kb/exchanges-data-providers-yahoo-finance-sln2310.html
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
export const YAHOO_FINANCE_SUFFIXES: Record<string, string> = {
  GR: '.DE', // XETRA -> .DE
  GF: '.F', // Frankfurt floor -> .F
  GM: '.MU', // Munich/Gettex -> .MU
  GT: '.DE', // Tradegate -> .DE (most liquid fallback)
  GS: '.SG', // Stuttgart -> .SG
  GH: '.HM', // Hamburg -> .HM
  QT: '.DE', // Quotrix -> .DE (fallback)
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
