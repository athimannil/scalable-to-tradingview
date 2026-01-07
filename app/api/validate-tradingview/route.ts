import { NextRequest, NextResponse } from 'next/server';

import { TRADINGVIEW_EXCHANGES } from '@/app/lib/types';

interface ValidationRequest {
  ticker: string;
  preferredExchange?: string;
}

interface ValidationResponse {
  ticker: string;
  validSymbol: string | null;
  testedExchanges: string[];
}

interface BatchValidationRequest {
  symbols: Array<{
    ticker: string;
    preferredExchange?: string;
  }>;
}

interface TradingViewSearchItem {
  symbol: string;
  exchange?: string;
  description?: string;
  type?: string;
}

/**
 * Check if a symbol exists on TradingView
 * Uses TradingView search API for reliable validation
 */
async function checkTradingViewSymbol(
  exchange: string,
  ticker: string
): Promise<boolean> {
  const symbol = `${exchange}:${ticker}`;

  try {
    // Use TradingView's search API which is more reliable
    const searchUrl = `https://www.tradingview.com/api/v1/search?q=${encodeURIComponent(ticker)}&type=stock&exchange=${encodeURIComponent(exchange)}&limit=5`;
    console.log('Checking TradingView search:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Referer: 'https://www.tradingview.com/',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Search results for', symbol, ':', data);

      // Check if we found an exact match
      if (Array.isArray(data)) {
        const exactMatch = data.find(
          (item: TradingViewSearchItem) =>
            item.symbol === symbol ||
            (item.symbol === ticker && item.exchange === exchange) ||
            item.symbol?.toUpperCase() === symbol.toUpperCase()
        );

        if (exactMatch) {
          console.log(`✓ ${symbol} found in search results`);
          return true;
        }
      }
    }

    // Fallback: Try direct symbol page check
    const pageUrl = `https://www.tradingview.com/symbols/${encodeURIComponent(symbol)}/`;
    console.log('Fallback: Checking symbol page:', pageUrl);

    const pageResponse = await fetch(pageUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (pageResponse.ok) {
      console.log(`✓ ${symbol} page exists`);
      return true;
    }

    console.log(`✗ ${symbol} not found`);
    return false;
  } catch (error) {
    console.warn(`Validation failed for ${symbol}, assuming invalid:`, error);
    // If we can't validate, assume invalid to be safe
    return false;
  }
}

/**
 * Single symbol validation endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker, preferredExchange } = body as ValidationRequest;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      );
    }

    const testedExchanges: string[] = [];

    // Build order of exchanges to try (preferred first)
    const exchangeOrder = preferredExchange
      ? [
          preferredExchange,
          ...TRADINGVIEW_EXCHANGES.filter((e) => e !== preferredExchange),
        ]
      : [...TRADINGVIEW_EXCHANGES];

    // Try each exchange
    for (const exchange of exchangeOrder) {
      testedExchanges.push(exchange);

      const isValid = await checkTradingViewSymbol(exchange, ticker);
      if (isValid) {
        return NextResponse.json({
          ticker,
          validSymbol: `${exchange}:${ticker}`,
          testedExchanges,
        } as ValidationResponse);
      }
    }

    // No valid symbol found
    return NextResponse.json({
      ticker,
      validSymbol: null,
      testedExchanges,
    } as ValidationResponse);
  } catch (error) {
    console.error('TradingView validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate symbol' },
      { status: 500 }
    );
  }
}

/**
 * Batch validation endpoint
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body as BatchValidationRequest;

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

    for (const { ticker, preferredExchange } of symbols) {
      const testedExchanges: string[] = [];
      let validSymbol: string | null = null;

      // Build order of exchanges to try
      const exchangeOrder = preferredExchange
        ? [
            preferredExchange,
            ...TRADINGVIEW_EXCHANGES.filter((e) => e !== preferredExchange),
          ]
        : [...TRADINGVIEW_EXCHANGES];

      for (const exchange of exchangeOrder) {
        testedExchanges.push(exchange);

        const isValid = await checkTradingViewSymbol(exchange, ticker);
        if (isValid) {
          validSymbol = `${exchange}:${ticker}`;
          break;
        }
      }

      results.push({
        ticker,
        validSymbol,
        testedExchanges,
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('TradingView batch validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate symbols' },
      { status: 500 }
    );
  }
}
