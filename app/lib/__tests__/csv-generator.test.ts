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

  it('should convert savings plan transactions as Buy', () => {
    const transactions = [
      createTransaction({
        type: 'Savings plan',
        shares: '4,329',
        price: '23,10',
        amount: '-99,9999',
        fee: '0,00',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Side).toBe('Buy');
    expect(result.transactions[0].Qty).toBe('4.329');
    expect(result.transactions[0]['Fill Price']).toBe('23.1');
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

  it('should skip corporate actions', () => {
    const transactions = [
      createTransaction({
        type: 'Corporate action',
        shares: '10',
        price: '0,00',
        amount: '0,00',
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

  it('should skip cancelled transactions', () => {
    const transactions = [createTransaction({ status: 'Cancelled' })];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Status: Cancelled');
  });

  it('should skip rejected transactions', () => {
    const transactions = [createTransaction({ status: 'Rejected' })];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Status: Rejected');
  });

  it('should convert Distribution transactions as Dividend', () => {
    const transactions = [
      createTransaction({
        type: 'Distribution',
        isin: 'IE0003Z9E2Y3',
        shares: '',
        price: '',
        amount: '2,07',
        fee: '0,00',
        tax: '0,00',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Side).toBe('Dividend');
    expect(result.transactions[0].Symbol).toBe('XETR:4COP');
    expect(result.transactions[0].Qty).toBe('2.07');
  });

  it('should handle Distribution with tax correctly', () => {
    const transactions = [
      createTransaction({
        type: 'Distribution',
        isin: 'IE0003Z9E2Y3',
        shares: '',
        price: '',
        amount: '0,81',
        fee: '0,00',
        tax: '0,34',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Side).toBe('Dividend');
    expect(result.transactions[0].Commission).toBe('0.34');
  });

  it('should handle withdrawals with thousand separators', () => {
    const transactions = [
      createTransaction({
        type: 'Withdrawal',
        isin: '',
        shares: '',
        price: '',
        amount: '-4.000,00',
        fee: '0,00',
        tax: '',
      }),
    ];

    const result = convertTransactions(transactions, new Map());

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Side).toBe('Withdrawal');
    expect(result.transactions[0].Qty).toBe('4000');
  });

  it('should handle fractional shares from savings plans', () => {
    const transactions = [
      createTransaction({
        type: 'Savings plan',
        shares: '0,879',
        price: '28,435',
        amount: '-24,9943',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Qty).toBe('0.879');
    expect(result.transactions[0]['Fill Price']).toBe('28.435');
  });

  it('should handle empty fee and tax fields', () => {
    const transactions = [
      createTransaction({
        fee: '',
        tax: '',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Commission).toBe('');
  });

  it('should skip transactions with zero shares', () => {
    const transactions = [
      createTransaction({
        status: 'Executed',
        shares: '0',
        price: '0,00',
        amount: '0,00',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('No shares');
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

describe('convertTransactions with aggregation mode', () => {
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

  it('should aggregate consecutive buy transactions', () => {
    const transactions = [
      createTransaction({ shares: '10', price: '5,00' }),
      createTransaction({ shares: '20', price: '6,00' }),
      createTransaction({ shares: '30', price: '7,00' }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Side).toBe('Buy');
    expect(result.transactions[0].Qty).toBe('60');
    // Weighted average: (10*5 + 20*6 + 30*7) / 60 = 380 / 60 = 6.333...
    expect(parseFloat(result.transactions[0]['Fill Price'])).toBeCloseTo(
      6.333,
      2
    );
  });

  it('should aggregate consecutive sell transactions', () => {
    const transactions = [
      createTransaction({ type: 'Sell', shares: '15', price: '8,00' }),
      createTransaction({ type: 'Sell', shares: '25', price: '9,00' }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].Side).toBe('Sell');
    expect(result.transactions[0].Qty).toBe('40');
    // Weighted average: (15*8 + 25*9) / 40 = 345 / 40 = 8.625
    expect(parseFloat(result.transactions[0]['Fill Price'])).toBeCloseTo(
      8.625,
      2
    );
  });

  it('should separate buy and sell sequences', () => {
    const transactions = [
      createTransaction({ shares: '10', price: '5,00', date: '2024-01-01' }),
      createTransaction({ shares: '20', price: '6,00', date: '2024-01-02' }),
      createTransaction({ shares: '30', price: '7,00', date: '2024-01-03' }),
      createTransaction({
        type: 'Sell',
        shares: '15',
        price: '8,00',
        date: '2024-01-04',
      }),
      createTransaction({
        type: 'Sell',
        shares: '25',
        price: '9,00',
        date: '2024-01-05',
      }),
      createTransaction({ shares: '10', price: '65,00', date: '2024-01-06' }),
      createTransaction({
        type: 'Sell',
        shares: '20',
        price: '8,50',
        date: '2024-01-07',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(4);

    // First aggregated buy (10@5 + 20@6 + 30@7)
    expect(result.transactions[0].Side).toBe('Buy');
    expect(result.transactions[0].Qty).toBe('60');
    expect(parseFloat(result.transactions[0]['Fill Price'])).toBeCloseTo(
      6.333,
      2
    );

    // First aggregated sell (15@8 + 25@9)
    expect(result.transactions[1].Side).toBe('Sell');
    expect(result.transactions[1].Qty).toBe('40');
    expect(parseFloat(result.transactions[1]['Fill Price'])).toBeCloseTo(
      8.625,
      2
    );

    // Single buy
    expect(result.transactions[2].Side).toBe('Buy');
    expect(result.transactions[2].Qty).toBe('10');
    expect(result.transactions[2]['Fill Price']).toBe('65');

    // Single sell
    expect(result.transactions[3].Side).toBe('Sell');
    expect(result.transactions[3].Qty).toBe('20');
    expect(result.transactions[3]['Fill Price']).toBe('8.5');
  });

  it('should not aggregate transactions for different symbols', () => {
    const transactions = [
      createTransaction({
        isin: 'IE0003Z9E2Y3',
        shares: '10',
        price: '5,00',
      }),
      createTransaction({
        isin: 'IE00063FT9K6',
        shares: '20',
        price: '6,00',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].Symbol).toBe('XETR:4COP');
    expect(result.transactions[1].Symbol).toBe('XETR:COPM');
  });

  it('should not aggregate non-tradeable transactions', () => {
    const transactions = [
      createTransaction({
        type: 'Deposit',
        isin: '',
        shares: '',
        price: '',
        amount: '1000,00',
      }),
      createTransaction({
        type: 'Deposit',
        isin: '',
        shares: '',
        price: '',
        amount: '2000,00',
      }),
    ];

    const result = convertTransactions(transactions, new Map(), 'aggregated');

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].Side).toBe('Deposit');
    expect(result.transactions[1].Side).toBe('Deposit');
  });

  it('should sum commissions when aggregating', () => {
    const transactions = [
      createTransaction({
        shares: '10',
        price: '5,00',
        fee: '1,00',
        tax: '0,50',
      }),
      createTransaction({
        shares: '20',
        price: '6,00',
        fee: '2,00',
        tax: '1,00',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(1);
    // Total commission: (1+0.5) + (2+1) = 4.5
    expect(result.transactions[0].Commission).toBe('4.5');
  });

  it('should return detailed transactions when mode is detailed', () => {
    const transactions = [
      createTransaction({ shares: '10', price: '5,00' }),
      createTransaction({ shares: '20', price: '6,00' }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'detailed');

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].Qty).toBe('10');
    expect(result.transactions[1].Qty).toBe('20');
  });

  it('should use last transaction closing time for aggregated group', () => {
    const transactions = [
      createTransaction({
        shares: '10',
        price: '5,00',
        date: '2024-01-01',
        time: '10:00:00',
      }),
      createTransaction({
        shares: '20',
        price: '6,00',
        date: '2024-01-02',
        time: '11:00:00',
      }),
      createTransaction({
        shares: '30',
        price: '7,00',
        date: '2024-01-03',
        time: '12:00:00',
      }),
    ];

    const result = convertTransactions(transactions, symbolMap, 'aggregated');

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]['Closing Time']).toBe('2024-01-03 12:00:00');
  });
});
