/**
 * Tests for Yahoo Finance symbol validation in wealthfolio-generator
 */

import { describe, it, expect } from 'vitest';

import { ResolvedSymbol, YAHOO_FINANCE_SUFFIXES } from '../types';

// Test helper to simulate the convertToYahooSymbol logic
function convertToYahooSymbol(resolved: ResolvedSymbol): string {
  if (resolved.yahooSymbol) {
    return resolved.yahooSymbol;
  }
  const suffix = YAHOO_FINANCE_SUFFIXES[resolved.exchCode] || '.DE';
  return `${resolved.ticker}${suffix}`;
}

describe('Yahoo Symbol Validation', () => {
  describe('convertToYahooSymbol with validated yahooSymbol', () => {
    it('should use validated yahooSymbol when available', () => {
      const resolved: ResolvedSymbol = {
        ticker: '3ZU0',
        exchange: 'Frankfurt',
        exchCode: 'GF',
        fullSymbol: 'FRA:3ZU0',
        yahooSymbol: '3ZU0.F',
      };

      expect(convertToYahooSymbol(resolved)).toBe('3ZU0.F');
    });

    it('should use validated yahooSymbol even if different from expected suffix', () => {
      // Case where exchCode suggests .DE but validation found .F works
      const resolved: ResolvedSymbol = {
        ticker: 'A9L0',
        exchange: 'XETRA',
        exchCode: 'GR',
        fullSymbol: 'XETR:A9L0',
        yahooSymbol: 'A9L0.F', // Validated to work with .F instead of .DE
      };

      expect(convertToYahooSymbol(resolved)).toBe('A9L0.F');
    });

    it('should fallback to exchCode suffix when yahooSymbol is not available', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'XETRA',
        exchCode: 'GR',
        fullSymbol: 'XETR:SAP',
      };

      expect(convertToYahooSymbol(resolved)).toBe('SAP.DE');
    });

    it('should fallback to .DE when exchCode is unknown and no yahooSymbol', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'TEST',
        exchange: 'Unknown',
        exchCode: 'XX',
        fullSymbol: 'XX:TEST',
      };

      expect(convertToYahooSymbol(resolved)).toBe('TEST.DE');
    });
  });

  describe('Yahoo Finance suffix priorities', () => {
    const testCases: Array<{
      exchCode: string;
      expectedSuffix: string;
      description: string;
    }> = [
      { exchCode: 'GR', expectedSuffix: '.DE', description: 'XETRA' },
      { exchCode: 'GF', expectedSuffix: '.F', description: 'Frankfurt' },
      { exchCode: 'GM', expectedSuffix: '.MU', description: 'Munich/Gettex' },
      { exchCode: 'GS', expectedSuffix: '.SG', description: 'Stuttgart' },
      { exchCode: 'GH', expectedSuffix: '.HM', description: 'Hamburg' },
      { exchCode: 'GT', expectedSuffix: '.DE', description: 'Tradegate' },
      { exchCode: 'QT', expectedSuffix: '.DE', description: 'Quotrix' },
    ];

    testCases.forEach(({ exchCode, expectedSuffix, description }) => {
      it(`should use ${expectedSuffix} suffix for ${description} (${exchCode}) when no yahooSymbol`, () => {
        const resolved: ResolvedSymbol = {
          ticker: 'TEST',
          exchange: description,
          exchCode,
          fullSymbol: `${exchCode}:TEST`,
        };

        expect(convertToYahooSymbol(resolved)).toBe(`TEST${expectedSuffix}`);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty yahooSymbol as falsy', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'XETRA',
        exchCode: 'GR',
        fullSymbol: 'XETR:SAP',
        yahooSymbol: '',
      };

      // Empty string is falsy, should fallback
      expect(convertToYahooSymbol(resolved)).toBe('SAP.DE');
    });

    it('should handle undefined yahooSymbol', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'XETRA',
        exchCode: 'GR',
        fullSymbol: 'XETR:SAP',
        yahooSymbol: undefined,
      };

      expect(convertToYahooSymbol(resolved)).toBe('SAP.DE');
    });
  });
});
