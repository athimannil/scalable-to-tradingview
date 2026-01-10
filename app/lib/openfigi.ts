/**
 * OpenFIGI API client for resolving ISINs to ticker symbols
 *
 * This client is specifically designed for Scalable Capital users who trade
 * on German exchanges only. It resolves ISINs to German exchange ticker symbols.
 */

import {
  OpenFigiRequest,
  OpenFigiResponseItem,
  OpenFigiInstrument,
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
 * Determine the best TradingView exchange based on security type
 *
 * This function implements a deterministic algorithm that routes instruments
 * to the exchange where they are most likely to have valid TradingView data.
 *
 * Strategy:
 * 1. ETPs, ETNs, ETCs, Commodities → SWB (Stuttgart/EUWAX) - home exchange products
 * 2. Certificates, Warrants → SWB (Stuttgart specializes in derivatives)
 * 3. UCITS ETFs (IE/LU ISINs) → XETR (pan-European, most liquid on XETRA)
 * 4. German ETFs (DE ISINs) → XETR
 * 5. Everything else → Use the exchange where OpenFIGI found it (preserve original)
 *
 * This avoids forcing XETR for stocks that may not be available there on TradingView.
 *
 * @param isin - The ISIN being resolved
 * @param instrument - The OpenFIGI instrument data
 * @param exchCode - The original OpenFIGI exchange code where the instrument was found
 * @returns The selected TradingView exchange code and exchCode
 */
function selectTradingViewExchange(
  isin: string,
  instrument: OpenFigiInstrument,
  exchCode: string
): { exchange: string; exchCode: string } {
  const securityType = instrument.securityType?.toUpperCase() || '';
  const securityType2 = instrument.securityType2?.toUpperCase() || '';
  const marketSector = instrument.marketSector?.toUpperCase() || '';

  // Rule 1: ETPs, ETNs, ETCs → Stuttgart (EUWAX)
  // These are structured products that trade on their home exchange
  if (
    securityType === 'ETP' ||
    securityType === 'ETN' ||
    securityType === 'ETC' ||
    securityType2 === 'ETP' ||
    securityType2 === 'ETN' ||
    securityType2 === 'ETC' ||
    marketSector.includes('COMMODITY')
  ) {
    return { exchange: 'SWB', exchCode: 'GS' };
  }

  // Rule 2: Certificates, Warrants, Structured Products → Stuttgart
  if (
    securityType.includes('CERTIFICATE') ||
    securityType.includes('WARRANT') ||
    securityType.includes('STRUCTURED') ||
    securityType2?.includes('CERTIFICATE') ||
    securityType2?.includes('WARRANT')
  ) {
    return { exchange: 'SWB', exchCode: 'GS' };
  }

  // Rule 3: UCITS ETFs → XETRA
  // Irish/Luxembourg ETFs are pan-European and most liquid on XETRA
  if (
    (securityType === 'ETF' || securityType2 === 'ETF') &&
    (isin.startsWith('IE') || isin.startsWith('LU'))
  ) {
    return { exchange: 'XETR', exchCode: 'GR' };
  }

  // Rule 4: German ETFs (DE ISINs) → XETRA
  if (
    (securityType === 'ETF' || securityType2 === 'ETF') &&
    isin.startsWith('DE')
  ) {
    return { exchange: 'XETR', exchCode: 'GR' };
  }

  // Rule 5: Preserve the original exchange where OpenFIGI found the instrument
  // This is crucial for stocks like 3ZU0 that may not be on XETRA in TradingView
  const originalExchange = EXCHANGE_CODES[exchCode];
  if (originalExchange) {
    return { exchange: originalExchange, exchCode };
  }

  // Rule 6: Final fallback - use GETTEX as it has good TradingView coverage
  return { exchange: 'GETTEX', exchCode: 'GM' };
}

/**
 * Resolve a single ISIN to a ticker symbol by trying German exchanges only
 *
 * Scalable Capital only allows trading on German exchanges in EUR,
 * so we only try German exchange codes regardless of the ISIN country.
 * Even US stocks (like Apple) are traded via German exchanges (e.g., XETR:APC).
 *
 * This function uses OpenFIGI's security type metadata to intelligently route
 * instruments to the correct TradingView exchange for maximum compatibility.
 */
export async function resolveIsinToTicker(
  isin: string,
  apiKey?: string
): Promise<ResolvedSymbol | null> {
  // Always use German exchanges only - Scalable Capital trades everything on German exchanges
  // Even US stocks are traded via German exchanges (e.g., Apple as XETR:APC)
  const exchangesToTry = [...EXCHANGE_PRIORITY];

  for (const exchCode of exchangesToTry) {
    const result = await queryOpenFigi(isin, exchCode, apiKey);
    if (result?.data && result.data.length > 0) {
      const instrument = result.data[0];
      const ticker = instrument.ticker;

      // Use smart exchange selection based on security type
      const { exchange, exchCode: selectedExchCode } =
        selectTradingViewExchange(isin, instrument, exchCode);

      return {
        ticker,
        exchange,
        exchCode: selectedExchCode,
        fullSymbol: `${exchange}:${ticker}`,
        securityType: instrument.securityType,
        securityType2: instrument.securityType2,
        marketSector: instrument.marketSector,
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
