/**
 * CSV Parser for Scalable Capital transaction exports
 */

import Papa from 'papaparse';

import { ScalableTransaction } from './types';

/**
 * Result of parsing a Scalable Capital CSV file
 */
export interface ParseResult {
  transactions: ScalableTransaction[];
  errors: string[];
}

/**
 * Raw row from CSV before transformation
 */
interface RawCsvRow {
  date?: string;
  time?: string;
  status?: string;
  reference?: string;
  description?: string;
  assettype?: string;
  assetType?: string;
  type?: string;
  isin?: string;
  shares?: string;
  price?: string;
  amount?: string;
  fee?: string;
  tax?: string;
  currency?: string;
}

/**
 * Parse a Scalable Capital CSV file content
 * Handles semicolon-delimited files with European number format
 */
export function parseScalableCsv(csvContent: string): ParseResult {
  const errors: string[] = [];

  // Detect delimiter (Scalable Capital uses semicolon)
  const firstLine = csvContent.split('\n')[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  const result = Papa.parse<RawCsvRow>(csvContent, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      errors.push(`Row ${error.row}: ${error.message}`);
    });
  }

  const transactions: ScalableTransaction[] = result.data.map((row) => ({
    date: row.date?.trim() || '',
    time: row.time?.trim() || '',
    status: row.status?.trim() || '',
    reference: row.reference?.trim().replace(/^"|"$/g, '') || '',
    description: row.description?.trim().replace(/^"|"$/g, '') || '',
    assetType: row.assettype?.trim() || row.assetType?.trim() || '',
    type: row.type?.trim() || '',
    isin: row.isin?.trim() || '',
    shares: row.shares?.trim() || '',
    price: row.price?.trim() || '',
    amount: row.amount?.trim() || '',
    fee: row.fee?.trim() || '',
    tax: row.tax?.trim() || '',
    currency: row.currency?.trim() || '',
  }));

  return { transactions, errors };
}

/**
 * Extract unique ISINs from transactions that need symbol resolution
 */
export function extractUniqueIsins(
  transactions: ScalableTransaction[]
): string[] {
  const isins = transactions
    .filter((t) => {
      // Only extract ISINs for trade transactions (Buy, Sell, Dividend)
      const type = t.type.toLowerCase();
      return (
        t.isin &&
        t.isin.trim() !== '' &&
        (type.includes('buy') ||
          type.includes('sell') ||
          type.includes('dividend'))
      );
    })
    .map((t) => t.isin.trim());

  return [...new Set(isins)];
}
