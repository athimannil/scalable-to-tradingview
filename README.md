# Scalable Capital to TradingView Converter

A Next.js web application that converts Scalable Capital transaction CSV exports to TradingView portfolio import format.

## Features

- **File Upload**: Upload your Scalable Capital CSV file directly in the browser
- **ISIN Resolution**: Automatically resolves ISINs to German exchange ticker symbols using the OpenFIGI API
- **Smart Conversion**: Maps transaction types (Buy, Sell, Dividend, etc.) to TradingView format
- **Preview**: Review converted transactions before downloading
- **Error Handling**: Clear reporting of skipped transactions and conversion errors
- **Privacy**: All CSV processing happens client-side (except ISIN resolution via API)

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
