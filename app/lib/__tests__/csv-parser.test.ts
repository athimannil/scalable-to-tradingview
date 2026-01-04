import { describe, it, expect } from 'vitest';

import { parseScalableCsv, extractUniqueIsins } from '@/app/lib/csv-parser';

describe('parseScalableCsv', () => {
  it('should parse valid semicolon-delimited CSV content', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2024-01-15;10:30:00;Executed;REF001;Test Stock;Security;Buy;IE0003Z9E2Y3;10;25,50;-255,00;0,99;0,00;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].isin).toBe('IE0003Z9E2Y3');
    expect(result.transactions[0].type).toBe('Buy');
    expect(result.transactions[0].price).toBe('25,50');
    expect(result.transactions[0].fee).toBe('0,99');
    expect(result.errors).toHaveLength(0);
  });

  it('should parse comma-delimited CSV content', () => {
    const csvContent = `date,time,status,reference,description,assetType,type,isin,shares,price,amount,fee,tax,currency
2024-01-15,10:30:00,Executed,REF001,Test Stock,Security,Buy,IE0003Z9E2Y3,10,25.50,-255.00,0.99,0.00,EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].isin).toBe('IE0003Z9E2Y3');
    expect(result.transactions[0].type).toBe('Buy');
  });

  it('should handle empty CSV', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(0);
  });

  it('should handle multiple transactions', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2024-01-15;10:30:00;Executed;REF001;Stock A;Security;Buy;IE0003Z9E2Y3;10;25,50;-255,00;0,99;0,00;EUR
2024-01-16;11:00:00;Executed;REF002;Stock B;Security;Sell;IE00063FT9K6;5;30,00;150,00;0,00;0,00;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].type).toBe('Buy');
    expect(result.transactions[1].type).toBe('Sell');
  });

  it('should handle quoted fields with special characters', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2024-01-15;10:30:00;Executed;"REF-001";"Test; Stock, Inc.";Security;Buy;IE0003Z9E2Y3;10;25,50;-255,00;0,99;0,00;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].reference).toBe('REF-001');
  });

  it('should handle security transfer transactions', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2025-12-06;01:00:00;Executed;SWITCH-101;Test Stock;Security;Security transfer;IE0003Z9E2Y3;125;44,89;5611,25;;;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].type).toBe('Security transfer');
    expect(result.transactions[0].fee).toBe('');
    expect(result.transactions[0].tax).toBe('');
  });

  it('should handle Distribution transactions', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2021-12-22;01:00:00;Executed;"WWEK 06138145";"Invesco S&P 500 High Dividend Low Volatility UCITS ETF Dist";Cash;Distribution;IE00BWTN6Y99;;;2,07;0,00;0,00;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].type).toBe('Distribution');
    expect(result.transactions[0].amount).toBe('2,07');
    expect(result.transactions[0].shares).toBe('');
  });

  it('should handle cancelled transactions', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2021-07-28;12:14:02;Cancelled;"SCALmopWFwxxqdT";"AUTO1 GROUP SE";Security;Buy;DE000A2LQ884;0;0,00;0,00;0,00;0,00;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].status).toBe('Cancelled');
    expect(result.transactions[0].shares).toBe('0');
  });

  it('should handle withdrawal with negative amount', () => {
    const csvContent = `date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency
2021-05-26;02:00:00;Executed;"2TUIECXWGBNBC8QMNHDTD5";"Scalable Capital Broker Auszahlung";Cash;Withdrawal;;;;-1.000,00;0,00;;EUR`;

    const result = parseScalableCsv(csvContent);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].type).toBe('Withdrawal');
    expect(result.transactions[0].amount).toBe('-1.000,00');
  });
});

describe('extractUniqueIsins', () => {
  it('should extract unique ISINs from transactions', () => {
    const transactions = [
      {
        date: '2024-01-15',
        time: '10:30:00',
        status: 'Executed',
        reference: 'REF001',
        description: 'Stock A',
        assetType: 'Security',
        type: 'Buy',
        isin: 'IE0003Z9E2Y3',
        shares: '10',
        price: '25,50',
        amount: '-255,00',
        fee: '0,99',
        tax: '0,00',
        currency: 'EUR',
      },
      {
        date: '2024-01-16',
        time: '10:30:00',
        status: 'Executed',
        reference: 'REF002',
        description: 'Stock A',
        assetType: 'Security',
        type: 'Buy',
        isin: 'IE0003Z9E2Y3',
        shares: '5',
        price: '26,00',
        amount: '-130,00',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
      {
        date: '2024-01-17',
        time: '10:30:00',
        status: 'Executed',
        reference: 'REF003',
        description: 'Stock B',
        assetType: 'Security',
        type: 'Sell',
        isin: 'US1234567890',
        shares: '20',
        price: '50,00',
        amount: '1000,00',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(2);
    expect(isins).toContain('IE0003Z9E2Y3');
    expect(isins).toContain('US1234567890');
  });

  it('should only extract ISINs for trade transactions', () => {
    const transactions = [
      {
        date: '2024-01-15',
        time: '10:30:00',
        status: 'Executed',
        reference: 'REF001',
        description: 'Stock A',
        assetType: 'Security',
        type: 'Buy',
        isin: 'IE0003Z9E2Y3',
        shares: '10',
        price: '25,50',
        amount: '-255,00',
        fee: '0,99',
        tax: '0,00',
        currency: 'EUR',
      },
      {
        date: '2024-01-16',
        time: '10:30:00',
        status: 'Executed',
        reference: 'REF002',
        description: 'Transfer',
        assetType: 'Security',
        type: 'Security transfer',
        isin: 'US9999999999',
        shares: '100',
        price: '10,00',
        amount: '1000,00',
        fee: '',
        tax: '',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(1);
    expect(isins).toContain('IE0003Z9E2Y3');
    expect(isins).not.toContain('US9999999999');
  });

  it('should handle empty ISIN fields', () => {
    const transactions = [
      {
        date: '2024-01-15',
        time: '10:30:00',
        status: 'Executed',
        reference: 'REF001',
        description: 'Deposit',
        assetType: '',
        type: 'Deposit',
        isin: '',
        shares: '',
        price: '',
        amount: '1000,00',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(0);
  });

  it('should extract ISINs for Distribution transactions', () => {
    const transactions = [
      {
        date: '2021-12-22',
        time: '01:00:00',
        status: 'Executed',
        reference: 'WWEK 06138145',
        description:
          'Invesco S&P 500 High Dividend Low Volatility UCITS ETF Dist',
        assetType: 'Cash',
        type: 'Distribution',
        isin: 'IE00BWTN6Y99',
        shares: '',
        price: '',
        amount: '2,07',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(1);
    expect(isins).toContain('IE00BWTN6Y99');
  });

  it('should skip cancelled transactions when extracting ISINs', () => {
    const transactions = [
      {
        date: '2021-07-28',
        time: '12:14:02',
        status: 'Cancelled',
        reference: 'SCALmopWFwxxqdT',
        description: 'AUTO1 GROUP SE',
        assetType: 'Security',
        type: 'Buy',
        isin: 'DE000A2LQ884',
        shares: '0',
        price: '0,00',
        amount: '0,00',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(0);
  });

  it('should skip rejected transactions when extracting ISINs', () => {
    const transactions = [
      {
        date: '2021-03-24',
        time: '11:37:53',
        status: 'Rejected',
        reference: 'SCALberrA5Tb9MN',
        description: 'Deutsche Lufthansa AG',
        assetType: 'Security',
        type: 'Buy',
        isin: 'DE0008232125',
        shares: '0',
        price: '0,00',
        amount: '0,00',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(0);
  });

  it('should extract ISINs for Savings plan transactions', () => {
    const transactions = [
      {
        date: '2021-12-01',
        time: '11:53:42',
        status: 'Executed',
        reference: 'SCALLsJMyhsdskZ',
        description:
          'Invesco S&P 500 High Dividend Low Volatility UCITS ETF Dist',
        assetType: 'Security',
        type: 'Savings plan',
        isin: 'IE00BWTN6Y99',
        shares: '0,879',
        price: '28,435',
        amount: '-24,9943',
        fee: '0,00',
        tax: '0,00',
        currency: 'EUR',
      },
    ];

    const isins = extractUniqueIsins(transactions);

    expect(isins).toHaveLength(1);
    expect(isins).toContain('IE00BWTN6Y99');
  });
});
