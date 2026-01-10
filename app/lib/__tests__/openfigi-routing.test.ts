/**
 * Test for EUWAX Gold II (EWG2) routing
 * Verifies that ETPs are correctly routed to SWB instead of XETR
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resolveIsinToTicker } from '../openfigi';

// Mock global fetch
global.fetch = vi.fn();
const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

describe('EWG2 ETP Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route EUWAX Gold II (ETP) to SWB:EWG2', async () => {
    // Mock the exact OpenFIGI response from user's example
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              figi: 'BBG00HZ6DJ40',
              name: 'EUWAX GOLD II',
              ticker: 'EWG2',
              exchCode: 'GR',
              compositeFIGI: 'BBG00HZ6DJ40',
              securityType: 'ETP',
              marketSector: 'Equity',
              shareClassFIGI: 'BBG00HZ6DJL1',
              securityType2: 'Mutual Fund',
              securityDescription: 'EWG2',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE000EWG2LD7');

    expect(result).not.toBeNull();
    expect(result?.ticker).toBe('EWG2');
    expect(result?.exchange).toBe('SWB');
    expect(result?.fullSymbol).toBe('SWB:EWG2');
    expect(result?.securityType).toBe('ETP');
    expect(result?.exchCode).toBe('GS'); // Stuttgart exchange code
  });

  it('should route ETCs to SWB', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'GOLD',
              securityType: 'ETC',
              marketSector: 'Commodity',
              exchCode: 'GR',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE000EXAMPLE1');

    expect(result?.exchange).toBe('SWB');
    expect(result?.fullSymbol).toBe('SWB:GOLD');
  });

  it('should route ETNs to SWB', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'ETNS',
              securityType: 'ETN',
              marketSector: 'Equity',
              exchCode: 'GR',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE000EXAMPLE2');

    expect(result?.exchange).toBe('SWB');
    expect(result?.fullSymbol).toBe('SWB:ETNS');
  });

  it('should route UCITS ETFs to XETR', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'IWDA',
              securityType: 'ETF',
              marketSector: 'Equity',
              exchCode: 'GR',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('IE00B4L5Y983');

    expect(result?.exchange).toBe('XETR');
    expect(result?.fullSymbol).toBe('XETR:IWDA');
  });

  it('should preserve original exchange for common stocks (first found on GM -> GETTEX)', async () => {
    // The resolver tries exchanges in priority order: GM, GR, GT, GS, GF, GH, QT
    // If GM returns data, stock will be GETTEX
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'SAP',
              securityType: 'Common Stock',
              marketSector: 'Equity',
              exchCode: 'GM', // Found on Gettex (first in priority)
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE0007164600');

    // Stocks preserve the exchange where OpenFIGI found them
    // GM is first in priority, so stock is found on GETTEX
    expect(result?.exchange).toBe('GETTEX');
    expect(result?.fullSymbol).toBe('GETTEX:SAP');
  });

  it('should preserve original exchange for stocks on GETTEX (GM)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: '3ZU0',
              securityType: 'Common Stock',
              marketSector: 'Equity',
              exchCode: 'GM', // Found on Gettex
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('US1234567890');

    // Stocks preserve the exchange where OpenFIGI found them
    // GM maps to GETTEX in EXCHANGE_CODES
    expect(result?.exchange).toBe('GETTEX');
    expect(result?.fullSymbol).toBe('GETTEX:3ZU0');
    expect(result?.exchCode).toBe('GM');
  });

  it('should preserve original exchange for stocks found on Frankfurt (GF)', async () => {
    // Mock GM, GR, GT, GS returning no data, then GF returns data
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{}] }) // GM - no data
      .mockResolvedValueOnce({ ok: true, json: async () => [{}] }) // GR - no data
      .mockResolvedValueOnce({ ok: true, json: async () => [{}] }) // GT - no data
      .mockResolvedValueOnce({ ok: true, json: async () => [{}] }) // GS - no data
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            data: [
              {
                ticker: 'TEST',
                securityType: 'Common Stock',
                marketSector: 'Equity',
                exchCode: 'GF', // Found on Frankfurt
              },
            ],
          },
        ],
      });

    const result = await resolveIsinToTicker('US9876543210');

    // Stocks preserve the exchange where OpenFIGI found them
    // GF maps to FRA in EXCHANGE_CODES
    expect(result?.exchange).toBe('FRA');
    expect(result?.fullSymbol).toBe('FRA:TEST');
    expect(result?.exchCode).toBe('GF');
  });

  it('should route certificates to SWB', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'CERT1',
              securityType: 'Certificate',
              marketSector: 'Equity',
              exchCode: 'GR',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE000CERT123');

    expect(result?.exchange).toBe('SWB');
    expect(result?.fullSymbol).toBe('SWB:CERT1');
  });

  it('should detect ETP from securityType2 field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'TEST',
              securityType: 'Unknown',
              securityType2: 'ETP',
              marketSector: 'Equity',
              exchCode: 'GR',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE000TEST123');

    expect(result?.exchange).toBe('SWB');
  });

  it('should detect commodity products by marketSector', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          data: [
            {
              ticker: 'COMMOD',
              securityType: 'Other',
              marketSector: 'COMMODITY GOLD',
              exchCode: 'GR',
            },
          ],
        },
      ],
    });

    const result = await resolveIsinToTicker('DE000COMM123');

    expect(result?.exchange).toBe('SWB');
  });
});
