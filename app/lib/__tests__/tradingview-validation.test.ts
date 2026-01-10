/**
 * Tests for TradingView symbol validation in csv-generator
 */

import { describe, it, expect } from 'vitest';

import {
  ResolvedSymbol,
  EXCHANGE_CODES,
  TRADINGVIEW_EXCHANGES,
} from '../types';

// Test helper to simulate the getTradingViewSymbol logic
function getTradingViewSymbol(resolved: ResolvedSymbol): string {
  if (resolved.tradingViewSymbol) {
    return resolved.tradingViewSymbol;
  }
  return resolved.fullSymbol;
}

describe('TradingView Symbol Validation', () => {
  describe('getTradingViewSymbol with validated tradingViewSymbol', () => {
    it('should use validated tradingViewSymbol when available', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'EWG2',
        exchange: 'GETTEX',
        exchCode: 'GM',
        fullSymbol: 'GETTEX:EWG2',
        tradingViewSymbol: 'SWB:EWG2', // Validated to work on Stuttgart
      };

      expect(getTradingViewSymbol(resolved)).toBe('SWB:EWG2');
    });

    it('should use validated tradingViewSymbol even if different from original exchange', () => {
      // Case where GETTEX doesn't work but MUN does
      const resolved: ResolvedSymbol = {
        ticker: 'EWG2',
        exchange: 'GETTEX',
        exchCode: 'GM',
        fullSymbol: 'GETTEX:EWG2',
        tradingViewSymbol: 'MUN:EWG2', // Munich works instead
      };

      expect(getTradingViewSymbol(resolved)).toBe('MUN:EWG2');
    });

    it('should fallback to fullSymbol when tradingViewSymbol is not available', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'XETR',
        exchCode: 'GR',
        fullSymbol: 'XETR:SAP',
      };

      expect(getTradingViewSymbol(resolved)).toBe('XETR:SAP');
    });

    it('should handle empty tradingViewSymbol as falsy', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'XETRA',
        exchCode: 'GR',
        fullSymbol: 'XETR:SAP',
        tradingViewSymbol: '',
      };

      // Empty string is falsy, should fallback
      expect(getTradingViewSymbol(resolved)).toBe('XETR:SAP');
    });

    it('should handle undefined tradingViewSymbol', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'XETRA',
        exchCode: 'GR',
        fullSymbol: 'XETR:SAP',
        tradingViewSymbol: undefined,
      };

      expect(getTradingViewSymbol(resolved)).toBe('XETR:SAP');
    });
  });

  describe('Exchange code mappings', () => {
    it('should have correct TradingView exchange prefixes', () => {
      expect(EXCHANGE_CODES['GR']).toBe('XETR');
      expect(EXCHANGE_CODES['GF']).toBe('FRA');
      expect(EXCHANGE_CODES['GM']).toBe('GETTEX');
      expect(EXCHANGE_CODES['GS']).toBe('SWB');
      expect(EXCHANGE_CODES['GH']).toBe('XHAM');
      expect(EXCHANGE_CODES['GT']).toBe('TRADEGATE');
    });

    it('should have TRADINGVIEW_EXCHANGES for validation', () => {
      expect(TRADINGVIEW_EXCHANGES).toContain('XETR');
      expect(TRADINGVIEW_EXCHANGES).toContain('SWB');
      expect(TRADINGVIEW_EXCHANGES).toContain('MUN');
      expect(TRADINGVIEW_EXCHANGES).toContain('FRA');
      expect(TRADINGVIEW_EXCHANGES).toContain('DUS');
      expect(TRADINGVIEW_EXCHANGES).toContain('HAM');
    });
  });

  describe('Real-world examples', () => {
    it('should handle EUWAX Gold II (EWG2) correctly with validated symbol', () => {
      // EWG2 is not available on GETTEX in TradingView, but is on SWB
      const resolved: ResolvedSymbol = {
        ticker: 'EWG2',
        exchange: 'GETTEX',
        exchCode: 'GM',
        fullSymbol: 'GETTEX:EWG2',
        tradingViewSymbol: 'SWB:EWG2', // After validation
        yahooSymbol: 'EWG2.SG', // Yahoo uses Stuttgart suffix
      };

      expect(getTradingViewSymbol(resolved)).toBe('SWB:EWG2');
    });

    it('should handle symbols with both Yahoo and TradingView validation', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'A9L0',
        exchange: 'XETR',
        exchCode: 'GR',
        fullSymbol: 'XETR:A9L0',
        tradingViewSymbol: 'XETR:A9L0', // Works on XETR for TradingView
        yahooSymbol: 'A9L0.F', // Yahoo uses .F (Frankfurt) instead of .DE
      };

      expect(getTradingViewSymbol(resolved)).toBe('XETR:A9L0');
    });

    it('should handle symbols available on multiple exchanges', () => {
      // EWG2 is available on MUN, DUS, HAM, SWB but not GETTEX or XETR
      const resolved: ResolvedSymbol = {
        ticker: 'EWG2',
        exchange: 'GETTEX',
        exchCode: 'GM',
        fullSymbol: 'GETTEX:EWG2',
        tradingViewSymbol: 'MUN:EWG2', // Validation picked MUN
      };

      expect(getTradingViewSymbol(resolved)).toBe('MUN:EWG2');
    });
  });

  describe('Edge cases', () => {
    it('should handle unknown exchange codes gracefully', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'TEST',
        exchange: 'UNKNOWN',
        exchCode: 'XX',
        fullSymbol: 'UNKNOWN:TEST',
      };

      // No validation, falls back to fullSymbol
      expect(getTradingViewSymbol(resolved)).toBe('UNKNOWN:TEST');
    });

    it('should prefer validated symbol over fullSymbol even for common stocks', () => {
      const resolved: ResolvedSymbol = {
        ticker: 'SAP',
        exchange: 'GETTEX',
        exchCode: 'GM',
        fullSymbol: 'GETTEX:SAP',
        tradingViewSymbol: 'XETR:SAP', // XETR is more common
      };

      expect(getTradingViewSymbol(resolved)).toBe('XETR:SAP');
    });
  });
});
