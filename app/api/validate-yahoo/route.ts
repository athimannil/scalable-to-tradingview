import { NextRequest, NextResponse } from 'next/server';

// Possible Yahoo Finance suffixes for German exchanges
const YAHOO_SUFFIXES = [
  '.DE',
  '.F',
  '.MU',
  '.SG',
  '.HM',
  '.DU',
  '.BE',
  '.HA',
  '.SW',
];

interface ValidationRequest {
  ticker: string;
  preferredSuffix?: string;
}

interface ValidationResponse {
  ticker: string;
  validSymbol: string | null;
  testedSuffixes: string[];
}

async function checkYahooSymbol(symbol: string): Promise<boolean> {
  try {
    // Use Yahoo Finance quote API to check if symbol exists
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    console.log('Checking Yahoo Finance URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    // Check if we got valid data (not an error response)
    if (data.chart?.error) {
      return false;
    }

    // Check if there's actual price data
    const result = data.chart?.result?.[0];
    if (!result || !result.meta?.regularMarketPrice) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker, preferredSuffix } = body as ValidationRequest;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      );
    }

    const testedSuffixes: string[] = [];

    // Build order of suffixes to try (preferred first)
    const suffixOrder = preferredSuffix
      ? [
          preferredSuffix,
          ...YAHOO_SUFFIXES.filter((s) => s !== preferredSuffix),
        ]
      : YAHOO_SUFFIXES;

    // Try each suffix
    for (const suffix of suffixOrder) {
      const symbol = `${ticker}${suffix}`;
      testedSuffixes.push(suffix);

      const isValid = await checkYahooSymbol(symbol);
      if (isValid) {
        return NextResponse.json({
          ticker,
          validSymbol: symbol,
          testedSuffixes,
        } as ValidationResponse);
      }
    }

    // No valid symbol found
    return NextResponse.json({
      ticker,
      validSymbol: null,
      testedSuffixes,
    } as ValidationResponse);
  } catch (error) {
    console.error('Yahoo validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate symbol' },
      { status: 500 }
    );
  }
}

// Batch validation endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body as { symbols: ValidationRequest[] };

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { error: 'Symbols array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (symbols.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 symbols per batch' },
        { status: 400 }
      );
    }

    const results: ValidationResponse[] = [];

    // Process symbols sequentially to avoid rate limiting
    for (const { ticker, preferredSuffix } of symbols) {
      const testedSuffixes: string[] = [];

      const suffixOrder = preferredSuffix
        ? [
            preferredSuffix,
            ...YAHOO_SUFFIXES.filter((s) => s !== preferredSuffix),
          ]
        : YAHOO_SUFFIXES;

      let validSymbol: string | null = null;

      for (const suffix of suffixOrder) {
        const symbol = `${ticker}${suffix}`;
        testedSuffixes.push(suffix);

        const isValid = await checkYahooSymbol(symbol);
        if (isValid) {
          validSymbol = symbol;
          break;
        }
      }

      results.push({
        ticker,
        validSymbol,
        testedSuffixes,
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Yahoo batch validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate symbols' },
      { status: 500 }
    );
  }
}
