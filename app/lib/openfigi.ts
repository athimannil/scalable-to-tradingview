/**
 * OpenFIGI API client for resolving ISINs to ticker symbols
 */

import {
  OpenFigiRequest,
  OpenFigiResponseItem,
  ResolvedSymbol,
  EXCHANGE_CODES,
  EXCHANGE_PRIORITY,
} from './types';

const OPENFIGI_URL = 'https://api.openfigi.com/v3/mapping';

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Query OpenFIGI API for a single ISIN and exchange code
 */
async function queryOpenFigi(
  isin: string,
  exchCode: string,
  apiKey?: string
): Promise<OpenFigiResponseItem | null> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['X-OPENFIGI-APIKEY'] = apiKey;
  }

  const body: OpenFigiRequest[] = [
    {
      idType: 'ID_ISIN',
      idValue: isin,
      exchCode,
    },
  ];

  try {
    const response = await fetch(OPENFIGI_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited, wait and retry
        await delay(2000);
        return queryOpenFigi(isin, exchCode, apiKey);
      }
      return null;
    }

    const data = await response.json();
    return data[0] as OpenFigiResponseItem;
  } catch (error) {
    console.error(`Error querying OpenFIGI for ${isin}:`, error);
    return null;
  }
}

/**
 * Resolve a single ISIN to a ticker symbol by trying multiple exchanges
 */
export async function resolveIsinToTicker(
  isin: string,
  apiKey?: string
): Promise<ResolvedSymbol | null> {
  // Determine which exchanges to try based on ISIN country code
  const countryCode = isin.substring(0, 2).toUpperCase();

  // Prioritize exchanges based on ISIN country
  let exchangesToTry = [...EXCHANGE_PRIORITY];

  if (countryCode === 'US') {
    // For US stocks, try US exchanges first
    exchangesToTry = [
      'US',
      'UW',
      'UN',
      'UA',
      ...EXCHANGE_PRIORITY.filter((e) => !e.startsWith('U')),
    ];
  } else if (countryCode === 'DE') {
    // German stocks - default order is fine (starts with GR/Xetra)
  } else if (countryCode === 'IE') {
    // Irish-domiciled ETFs - commonly traded on German exchanges
    exchangesToTry = [
      'GR',
      'GT',
      'GM',
      ...EXCHANGE_PRIORITY.filter((e) => !['GR', 'GT', 'GM'].includes(e)),
    ];
  }

  for (const exchCode of exchangesToTry) {
    const result = await queryOpenFigi(isin, exchCode, apiKey);
    if (result?.data && result.data.length > 0) {
      const ticker = result.data[0].ticker;
      const exchange = EXCHANGE_CODES[exchCode] || exchCode;
      return {
        ticker,
        exchange,
        fullSymbol: `${exchange}:${ticker}`,
      };
    }
  }
  return null;
}

/**
 * Resolve multiple ISINs to ticker symbols with progress callback
 */
export async function resolveMultipleIsins(
  isins: string[],
  apiKey?: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ResolvedSymbol | null>> {
  const results = new Map<string, ResolvedSymbol | null>();
  const uniqueIsins = [...new Set(isins)];

  for (let i = 0; i < uniqueIsins.length; i++) {
    const isin = uniqueIsins[i];
    if (!isin || isin.trim() === '') {
      results.set(isin, null);
      continue;
    }

    const resolved = await resolveIsinToTicker(isin, apiKey);
    results.set(isin, resolved);

    onProgress?.(i + 1, uniqueIsins.length);

    // Rate limiting: wait between requests (150ms with API key, 1.2s without)
    if (i < uniqueIsins.length - 1) {
      await delay(apiKey ? 150 : 1200);
    }
  }

  return results;
}
