/**
 * API Route for resolving ISINs to ticker symbols via OpenFIGI
 */

import { NextRequest, NextResponse } from 'next/server';

import { resolveMultipleIsins } from '@/app/lib/openfigi';
import { ResolvedSymbol } from '@/app/lib/types';

export interface ResolveIsinRequest {
  isins: string[];
  apiKey?: string;
}

export interface ResolveIsinResponse {
  results: Record<string, ResolvedSymbol | null>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveIsinRequest;
    const { isins, apiKey } = body;

    if (!isins || !Array.isArray(isins)) {
      return NextResponse.json(
        { error: 'Invalid request: isins array required' },
        { status: 400 }
      );
    }

    if (isins.length === 0) {
      return NextResponse.json({ results: {} });
    }

    // Limit the number of ISINs to prevent abuse
    if (isins.length > 100) {
      return NextResponse.json(
        { error: 'Too many ISINs. Maximum 100 allowed per request.' },
        { status: 400 }
      );
    }

    const results = await resolveMultipleIsins(isins, apiKey);

    // Convert Map to object for JSON serialization
    const resultsObject: Record<string, ResolvedSymbol | null> = {};
    results.forEach((value, key) => {
      resultsObject[key] = value;
    });

    return NextResponse.json({ results: resultsObject } as ResolveIsinResponse);
  } catch (error) {
    console.error('Error resolving ISINs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
