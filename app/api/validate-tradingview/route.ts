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

/**
 * Check if a symbol exists on TradingView
 * Uses TradingView's symbol search API
 */
async function checkTradingViewSymbol(
  exchange: string,
  ticker: string
): Promise<boolean> {
  try {
    // TradingView symbol search endpoint
    const url = `https://symbol-search.tradingview.com/symbol_search/?text=${encodeURIComponent(ticker)}&type=stock&exchange=${encodeURIComponent(exchange)}`;

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

    // Check if we found an exact match for the ticker on this exchange
    if (Array.isArray(data) && data.length > 0) {
      return data.some(
        (item: { symbol: string; exchange: string }) =>
          item.symbol.toUpperCase() === ticker.toUpperCase() &&
          item.exchange.toUpperCase() === exchange.toUpperCase()
      );
    }

    return false;
  } catch (error) {
    console.error(
      `Error checking TradingView symbol ${exchange}:${ticker}:`,
      error
    );
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
