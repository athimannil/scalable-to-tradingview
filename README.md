# Scalable Capital to TradingView Converter

A Next.js web application that converts Scalable Capital transaction CSV exports to TradingView portfolio import format.

## Features

- **File Upload**: Upload your Scalable Capital CSV file directly in the browser
- **ISIN Resolution**: Automatically resolves ISINs to German exchange ticker symbols using the OpenFIGI API
- **Smart Conversion**: Maps transaction types (Buy, Sell, Dividend, etc.) to TradingView format
- **Conversion Modes**: Choose between detailed (individual transactions) or aggregated (averaged consecutive transactions)
- **Preview**: Review converted transactions before downloading
- **Error Handling**: Clear reporting of skipped transactions and conversion errors
- **Privacy**: All CSV processing happens client-side (except ISIN resolution via API)

## Conversion Modes

### Detailed Mode (Default)

Each transaction from Scalable Capital is converted to a corresponding TradingView transaction individually. This preserves all transaction details and timestamps.

### Aggregated Mode

Consecutive buy or sell transactions for the same symbol are combined into a single transaction with:

- **Quantity**: Sum of all quantities in the group
- **Price**: Weighted average price based on quantity
- **Commission**: Sum of all commissions
- **Closing Time**: Last transaction's closing time

**Example:**

```
Original:
  Buy 10 @ €5
  Buy 20 @ €6
  Buy 30 @ €7
  Sell 15 @ €8
  Sell 25 @ €9
  Buy 10 @ €65
  Sell 20 @ €8.5

Aggregated:
  Buy 60 @ €6.33 (weighted average of first three buys)
  Sell 40 @ €8.63 (weighted average of first two sells)
  Buy 10 @ €65 (single buy remains as-is)
  Sell 20 @ €8.5 (single sell remains as-is)
```

This mode is useful for reducing the number of transactions when importing large portfolios into TradingView.

## Supported Exchanges

The converter attempts to resolve ISINs to the following German exchanges in order:

1. XETR (Xetra)
2. TRADEGATE
3. GETTEX (Munich)
4. FRA (Frankfurt)
5. SWB (Stuttgart)
6. HAM (Hamburg)
7. QUOTRIX

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

### Testing

```bash
npm test           # Run tests in watch mode
npm run test:run   # Run tests once
npm run test:coverage  # Run tests with coverage
```

### Build

```bash
npm run build
```

## Usage

1. Export your transaction history from Scalable Capital as CSV
2. (Optional) Enter your [OpenFIGI API key](https://www.openfigi.com/api) for higher rate limits
3. Upload the CSV file
4. Review the converted transactions in the preview table
5. Download the TradingView-compatible CSV file
6. Import the file into your TradingView portfolio

## API Rate Limits

- **Without API key**: ~20 requests per minute
- **With API key**: ~250 requests per minute

Get a free API key at [OpenFIGI](https://www.openfigi.com/api).

## Transaction Type Mapping

| Scalable Capital  | TradingView    |
| ----------------- | -------------- |
| Buy               | Buy            |
| Sell              | Sell           |
| Dividend          | Dividend       |
| Deposit           | Deposit        |
| Withdrawal        | Withdrawal     |
| Tax/Fee           | Taxes and fees |
| Security Transfer | _Skipped_      |

## TradingView CSV Format

The generated CSV follows TradingView's portfolio import format:

```
Symbol,Side,Qty,Fill Price,Commission,Closing Time
XETR:4COP,Buy,10,48.33,0.99,2025-12-30 13:41:40
XETR:COPM,Sell,100,7.682,,2025-12-22 14:14:58
$CASH,Deposit,5000,,,2024-08-24 0:00:00
```

## Tech Stack

- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [PapaParse](https://www.papaparse.com/) for CSV parsing
- [OpenFIGI API](https://www.openfigi.com/) for ISIN resolution
- [Vitest](https://vitest.dev/) for testing

## Project Structure

```
app/
├── api/
│   └── resolve-isin/
│       └── route.ts          # API route for ISIN resolution
├── components/
│   └── CsvConverter.tsx      # Main converter UI component
├── lib/
│   ├── __tests__/            # Unit tests
│   ├── csv-generator.ts      # TradingView CSV generation
│   ├── csv-parser.ts         # Scalable Capital CSV parsing
│   ├── openfigi.ts           # OpenFIGI API client
│   └── types.ts              # TypeScript type definitions
├── page.tsx                  # Main page
└── layout.tsx                # App layout
```

## License

MIT
