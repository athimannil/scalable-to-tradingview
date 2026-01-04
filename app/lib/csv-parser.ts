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
 * Detect the delimiter used in the CSV file
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0];
  if (firstLine.includes(';')) {
    return ';';
  }
  return ',';
}

/**
 * Parse a Scalable Capital CSV file content
 * Handles semicolon-delimited files with European number format
 */
export function parseScalableCsv(csvContent: string): ParseResult {
  const errors: string[] = [];
  const delimiter = detectDelimiter(csvContent);

  const result = Papa.parse<RawCsvRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      errors.push(`Row ${error.row}: ${error.message}`);
    });
  }

  // Transform raw rows to ScalableTransaction objects
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
 * Only extracts ISINs for Buy, Sell, and Dividend transactions
 */
export function extractUniqueIsins(
  transactions: ScalableTransaction[]
): string[] {
  const isins = transactions
    .filter((t) => {
      // Only extract ISINs for trade transactions (Buy, Sell, Dividend)
      const type = t.type.toLowerCase();
      const status = t.status.toLowerCase();

      // Skip cancelled/rejected/pending orders
      if (
        status.includes('cancelled') ||
        status.includes('rejected') ||
        status.includes('pending')
      ) {
        return false;
      }

      return (
        t.isin &&
        t.isin.trim() !== '' &&
        (type.includes('buy') ||
          type.includes('sell') ||
          type.includes('dividend') ||
          type.includes('distribution') ||
          type.includes('savings plan') ||
          type.includes('sparplan'))
      );
    })
    .map((t) => t.isin.trim());
  return [...new Set(isins)];
}
