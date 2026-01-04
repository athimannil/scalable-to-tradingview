import { describe, it, expect } from 'vitest';

import {
  convertTransactions,
  generateTradingViewCsv,
} from '@/app/lib/csv-generator';
import { ScalableTransaction, ResolvedSymbol } from '@/app/lib/types';

describe('convertTransactions', () => {
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
      { ticker: '4COP', exchange: 'XETR', fullSymbol: 'XETR:4COP' },
    ],
    [
      'IE00063FT9K6',
      { ticker: 'COPM', exchange: 'XETR', fullSymbol: 'XETR:COPM' },
    ],
  ]);

  it('should convert buy transactions correctly', () => {
    const transactions = [createTransaction()];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Symbol).toBe('XETR:4COP');
    expect(result.transactions[0].Side).toBe('Buy');
    expect(result.transactions[0].Qty).toBe('10');
    expect(result.transactions[0]['Fill Price']).toBe('25.5');
    expect(result.transactions[0].Commission).toBe('0.99');
    expect(result.transactions[0]['Closing Time']).toBe('2024-01-15 10:30:00');
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
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

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Symbol).toBe('XETR:COPM');
    expect(result.transactions[0].Side).toBe('Sell');
    expect(result.transactions[0].Qty).toBe('100');
    expect(result.transactions[0]['Fill Price']).toBe('7.682');
  });

  it('should skip security transfers', () => {
    const transactions = [
      createTransaction({
        type: 'Security transfer',
        fee: '',
        tax: '',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('not supported');
  });

  it('should skip non-executed transactions', () => {
    const transactions = [createTransaction({ status: 'Pending' })];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Status: Pending');
  });

  it('should handle deposits as $CASH transactions', () => {
    const transactions = [
      createTransaction({
        type: 'Deposit',
        isin: '',
        shares: '',
        price: '',
        amount: '5000,00',
        fee: '0,00',
        tax: '0,00',
      }),
    ];

    const result = convertTransactions(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Symbol).toBe('$CASH');
    expect(result.transactions[0].Side).toBe('Deposit');
    expect(result.transactions[0].Qty).toBe('5000');
  });

  it('should handle withdrawals as $CASH transactions', () => {
    const transactions = [
      createTransaction({
        type: 'Withdrawal',
        isin: '',
        shares: '',
        price: '',
        amount: '-2000,00',
        fee: '0,00',
        tax: '0,00',
      }),
    ];

    const result = convertTransactions(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Symbol).toBe('$CASH');
    expect(result.transactions[0].Side).toBe('Withdrawal');
    expect(result.transactions[0].Qty).toBe('2000');
  });

  it('should add errors for unresolved ISINs', () => {
    const transactions = [createTransaction({ isin: 'UNKNOWN123456' })];

    const result = convertTransactions(transactions, new Map());

    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].isin).toBe('UNKNOWN123456');
    expect(result.errors[0].error).toContain('Could not resolve ISIN');
  });

  it('should add errors for missing ISIN on trade transactions', () => {
    const transactions = [createTransaction({ isin: '' })];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Missing ISIN');
  });

  it('should calculate commission from fee and tax', () => {
    const transactions = [
      createTransaction({
        fee: '1,50',
        tax: '0,75',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions[0].Commission).toBe('2.25');
  });

  it('should handle European number format correctly', () => {
    const transactions = [
      createTransaction({
        shares: '1.000',
        price: '1.234,56',
        amount: '-1.234.560,00',
        fee: '10,50',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions[0].Qty).toBe('1000');
    expect(result.transactions[0]['Fill Price']).toBe('1234.56');
    expect(result.transactions[0].Commission).toBe('10.5');
  });
});

describe('generateTradingViewCsv', () => {
  it('should generate valid CSV output with correct headers', () => {
    const transactions = [
      {
        Symbol: 'XETR:4COP',
        Side: 'Buy' as const,
        Qty: '10',
        'Fill Price': '25.5',
        Commission: '0.99',
        'Closing Time': '2024-01-15 10:30:00',
      },
    ];

    const csv = generateTradingViewCsv(transactions);

    expect(csv).toContain('Symbol,Side,Qty,Fill Price,Commission,Closing Time');
    expect(csv).toContain('XETR:4COP,Buy,10,25.5,0.99,2024-01-15 10:30:00');
  });

  it('should handle multiple transactions', () => {
    const transactions = [
      {
        Symbol: 'XETR:4COP',
        Side: 'Buy' as const,
        Qty: '10',
        'Fill Price': '25.5',
        Commission: '0.99',
        'Closing Time': '2024-01-15 10:30:00',
      },
      {
        Symbol: 'XETR:COPM',
        Side: 'Sell' as const,
        Qty: '100',
        'Fill Price': '7.682',
        Commission: '',
        'Closing Time': '2024-01-16 14:00:00',
      },
    ];

    const csv = generateTradingViewCsv(transactions);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain('XETR:4COP');
    expect(lines[2]).toContain('XETR:COPM');
  });

  it('should handle cash transactions', () => {
    const transactions = [
      {
        Symbol: '$CASH',
        Side: 'Deposit' as const,
        Qty: '5000',
        'Fill Price': '',
        Commission: '',
        'Closing Time': '2024-01-15 0:00:00',
      },
    ];

    const csv = generateTradingViewCsv(transactions);

    expect(csv).toContain('$CASH,Deposit,5000');
  });

  it('should match expected output format', () => {
    const transactions = [
      {
        Symbol: 'XETR:4COP',
        Side: 'Buy' as const,
        Qty: '10',
        'Fill Price': '217',
        Commission: '0',
        'Closing Time': '2024-09-17 0:00:00',
      },
    ];

    const csv = generateTradingViewCsv(transactions);

    // Should match format: Symbol,Side,Qty,Fill Price,Commission,Closing Time
    expect(csv).toContain('XETR:4COP,Buy,10,217,0,2024-09-17 0:00:00');
  });
});
