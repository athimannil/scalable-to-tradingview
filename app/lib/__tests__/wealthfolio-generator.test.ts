import { describe, it, expect } from 'vitest';

import {
  convertToWealthfolio,
  generateWealthfolioCsv,
} from '@/app/lib/wealthfolio-generator';
import { ScalableTransaction, ResolvedSymbol } from '@/app/lib/types';

describe('convertToWealthfolio', () => {
  const createTransaction = (
    overrides: Partial<ScalableTransaction> = {}
  ): ScalableTransaction => ({
    date: '2024-01-15',
    time: '10:30:00',
    status: 'Executed',
    reference: 'REF001',
    description: 'Test Stock',
    assetType: 'Security',
    type: 'Buy',
    isin: 'IE0003Z9E2Y3',
    shares: '10',
    price: '25,50',
    amount: '-255,00',
    fee: '0,99',
    tax: '0,00',
    currency: 'EUR',
    ...overrides,
  });

  const symbolMap = new Map<string, ResolvedSymbol | null>([
    [
      'IE0003Z9E2Y3',
      {
        ticker: '4COP',
        exchange: 'XETR',
        exchCode: 'GR',
        fullSymbol: 'XETR:4COP',
      },
    ],
    [
      'IE00063FT9K6',
      {
        ticker: 'COPM',
        exchange: 'XETR',
        exchCode: 'GR',
        fullSymbol: 'XETR:COPM',
      },
    ],
    // Frankfurt floor exchange - should use .F suffix for Yahoo Finance
    [
      'DE0001234567',
      {
        ticker: '3ZU0',
        exchange: 'FRA',
        exchCode: 'GF',
        fullSymbol: 'FRA:3ZU0',
      },
    ],
    // Munich/Gettex exchange - should use .MU suffix for Yahoo Finance
    [
      'US0378331005',
      {
        ticker: 'APC',
        exchange: 'GETTEX',
        exchCode: 'GM',
        fullSymbol: 'GETTEX:APC',
      },
    ],
    // Stuttgart exchange - should use .SG suffix for Yahoo Finance
    [
      'DE0009876543',
      {
        ticker: 'TEST',
        exchange: 'XSTU',
        exchCode: 'GS',
        fullSymbol: 'XSTU:TEST',
      },
    ],
  ]);

  it('should convert buy transactions correctly', () => {
    const transactions = [createTransaction()];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('4COP.DE'); // Yahoo Finance format: ticker + German suffix
    expect(result.transactions[0].activityType).toBe('BUY');
    expect(result.transactions[0].quantity).toBe('10');
    expect(result.transactions[0].unitPrice).toBe('25.5');
    expect(result.transactions[0].fee).toBe('0.99');
    expect(result.transactions[0].currency).toBe('EUR');
    expect(result.transactions[0].date).toBe('2024-01-15T10:30:00.000Z');
    expect(result.transactions[0].amount).toBe('255');
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('should use .F suffix for Frankfurt floor stocks (Yahoo Finance)', () => {
    const transactions = [
      createTransaction({
        isin: 'DE0001234567',
        shares: '50',
        price: '10,00',
        amount: '-500,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('3ZU0.F');
    expect(result.transactions[0].activityType).toBe('BUY');
  });

  it('should use .MU suffix for Munich/Gettex stocks (Yahoo Finance)', () => {
    const transactions = [
      createTransaction({
        isin: 'US0378331005',
        shares: '5',
        price: '150,00',
        amount: '-750,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('APC.MU');
  });

  it('should use .SG suffix for Stuttgart stocks (Yahoo Finance)', () => {
    const transactions = [
      createTransaction({
        isin: 'DE0009876543',
        shares: '25',
        price: '20,00',
        amount: '-500,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('TEST.SG');
  });

  it('should convert sell transactions correctly', () => {
    const transactions = [
      createTransaction({
        type: 'Sell',
        isin: 'IE00063FT9K6',
        shares: '100',
        price: '7,682',
        amount: '768,20',
        fee: '0,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('COPM.DE');
    expect(result.transactions[0].activityType).toBe('SELL');
    expect(result.transactions[0].quantity).toBe('100');
    expect(result.transactions[0].unitPrice).toBe('7.682');
  });

  it('should convert savings plan transactions as BUY', () => {
    const transactions = [
      createTransaction({
        type: 'Savings plan',
        shares: '4,329',
        price: '23,10',
        amount: '-99,9999',
        fee: '0,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].activityType).toBe('BUY');
    expect(result.transactions[0].quantity).toBe('4.329');
    expect(result.transactions[0].unitPrice).toBe('23.1');
  });

  it('should skip security transfers', () => {
    const transactions = [
      createTransaction({
        type: 'Security transfer',
        shares: '10',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('Transaction type not supported');
  });

  it('should skip cancelled transactions', () => {
    const transactions = [
      createTransaction({
        status: 'Cancelled',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Status');
  });

  it('should convert deposit transactions correctly', () => {
    const transactions = [
      createTransaction({
        description: 'Bank Transfer',
        assetType: 'Cash',
        type: 'Deposit',
        isin: '',
        shares: '',
        price: '',
        amount: '1000,00',
        fee: '0,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('DEPOSIT');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('1000');
    expect(result.transactions[0].amount).toBe('1000');
  });

  it('should convert withdrawal transactions correctly', () => {
    const transactions = [
      createTransaction({
        description: 'Bank Transfer',
        assetType: 'Cash',
        type: 'Withdrawal',
        isin: '',
        shares: '',
        price: '',
        amount: '-500,00',
        fee: '0,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('WITHDRAWAL');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('500');
    expect(result.transactions[0].amount).toBe('500');
  });

  it('should convert dividend transactions correctly', () => {
    const transactions = [
      createTransaction({
        description: 'Dividend Payment',
        type: 'Dividend',
        shares: '',
        price: '',
        amount: '15,50',
        fee: '0,00',
        tax: '3,87',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('4COP.DE');
    expect(result.transactions[0].activityType).toBe('DIVIDEND');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('15.5');
    expect(result.transactions[0].amount).toBe('15.5');
    expect(result.transactions[0].fee).toBe('3.87');
  });

  it('should convert interest income as INTEREST', () => {
    const transactions = [
      createTransaction({
        description: 'Zinsen Q4 2023',
        assetType: 'Cash',
        type: 'Interest',
        isin: '',
        shares: '',
        price: '',
        amount: '50,00',
        fee: '0,00',
        tax: '0,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('INTEREST');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('50');
    expect(result.transactions[0].amount).toBe('50');
  });

  it('should handle KKT-Abschluss as separate TAX and FEE transactions', () => {
    const transactions = [
      createTransaction({
        description: 'KKT-Abschluss',
        assetType: 'Cash',
        type: 'Interest',
        isin: '',
        shares: '',
        price: '',
        amount: '-155,04',
        fee: '0,00',
        tax: '185,98',
      }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('TAX');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('185.98');
    expect(result.transactions[0].amount).toBe('185.98');
    expect(result.transactions[1].symbol).toBe('$CASH-EUR');
    expect(result.transactions[1].activityType).toBe('FEE');
    expect(result.transactions[1].quantity).toBe('1');
    expect(result.transactions[1].unitPrice).toBe('155.04');
    expect(result.transactions[1].amount).toBe('155.04');
  });

  it('should convert Fee transaction (subscription) as FEE', () => {
    const transactions = [
      createTransaction({
        description: 'PRIME+ subscription',
        assetType: 'Cash',
        type: 'Fee',
        isin: '',
        shares: '',
        price: '',
        amount: '-4,99',
        fee: '0,00',
        tax: '',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('FEE');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('4.99');
    expect(result.transactions[0].amount).toBe('4.99');
  });

  it('should convert Fee refund (positive amount) as DEPOSIT', () => {
    const transactions = [
      createTransaction({
        description: 'Refund: PRIME subscription',
        assetType: 'Cash',
        type: 'Fee',
        isin: '',
        shares: '',
        price: '',
        amount: '8,97',
        fee: '0,00',
        tax: '',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('DEPOSIT');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('8.97');
    expect(result.transactions[0].amount).toBe('8.97');
  });

  it('should convert STORNO (reversal) as DEPOSIT', () => {
    const transactions = [
      createTransaction({
        reference: 'CANCEL-52024004',
        description: 'STORNO KKT-Abschluss',
        assetType: 'Cash',
        type: 'Interest',
        isin: '',
        shares: '',
        price: '',
        amount: '367,04',
        fee: '0,00',
        tax: '0,00',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('DEPOSIT');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('367.04');
    expect(result.transactions[0].amount).toBe('367.04');
  });

  it('should convert standalone Taxes as TAX', () => {
    const transactions = [
      createTransaction({
        description: 'Steuerabrechnung',
        assetType: 'Cash',
        type: 'Taxes',
        isin: '',
        shares: '',
        price: '',
        amount: '33,16',
        fee: '0,00',
        tax: '',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].symbol).toBe('$CASH-EUR');
    expect(result.transactions[0].activityType).toBe('TAX');
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('33.16');
    expect(result.transactions[0].amount).toBe('33.16');
  });

  it('should aggregate consecutive buy transactions in aggregated mode', () => {
    const transactions = [
      createTransaction({ shares: '10', price: '20,00' }),
      createTransaction({ shares: '5', price: '22,00' }),
      createTransaction({ shares: '15', price: '21,00' }),
    ];

    const result = convertToWealthfolio(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].quantity).toBe('30');
    // Weighted average: (10*20 + 5*22 + 15*21) / 30 = (200 + 110 + 315) / 30 = 20.833...
    expect(parseFloat(result.transactions[0].unitPrice)).toBeCloseTo(20.833, 2);
  });

  it('should handle European number format with thousand separators', () => {
    const transactions = [
      createTransaction({
        description: 'Large deposit',
        assetType: 'Cash',
        type: 'Deposit',
        isin: '',
        shares: '',
        price: '',
        amount: '36.983,67',
        fee: '0,00',
        tax: '',
      }),
    ];

    const result = convertToWealthfolio(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].quantity).toBe('1');
    expect(result.transactions[0].unitPrice).toBe('36983.67');
    expect(result.transactions[0].amount).toBe('36983.67');
  });
});

describe('generateWealthfolioCsv', () => {
  it('should generate valid CSV with correct headers', () => {
    const transactions = [
      {
        date: '2024-01-15T10:30:00.000Z',
        symbol: '4COP.DE',
        quantity: '10',
        activityType: 'BUY' as const,
        unitPrice: '25.5',
        currency: 'EUR',
        fee: '0.99',
        amount: '255',
      },
    ];

    const csv = generateWealthfolioCsv(transactions);

    expect(csv).toContain(
      'date,symbol,quantity,activityType,unitPrice,currency,fee,amount'
    );
    expect(csv).toContain(
      '2024-01-15T10:30:00.000Z,4COP.DE,10,BUY,25.5,EUR,0.99,255'
    );
  });

  it('should handle empty transactions array', () => {
    const csv = generateWealthfolioCsv([]);

    // Empty array returns empty string from papaparse
    expect(csv).toBe('');
  });
});
