# Scalable Portfolio Converter

A Next.js web application that converts Scalable Capital transaction CSV exports to multiple portfolio tracker formats.

## Supported Export Formats

- **TradingView** - For TradingView's portfolio import feature
- **Wealthfolio** - For Wealthfolio desktop application (uses Yahoo Finance symbols)

## Features

- **File Upload**: Upload your Scalable Capital CSV file directly in the browser
- **ISIN Resolution**: Automatically resolves ISINs to ticker symbols using the OpenFIGI API
- **Symbol Validation**: Validates symbols exist on target platforms (TradingView, Yahoo Finance)
- **Smart Conversion**: Maps transaction types (Buy, Sell, Dividend, etc.) to target formats
- **Conversion Modes**: Choose between detailed (individual transactions) or aggregated (averaged consecutive transactions)
- **Preview**: Review converted transactions before downloading
- **Error Handling**: Clear reporting of skipped transactions and conversion errors
- **Privacy**: All CSV processing happens client-side (except ISIN resolution via API)

## Conversion Modes

### Detailed Mode (Default)

Each transaction from Scalable Capital is converted individually. This preserves all transaction details and timestamps.

### Aggregated Mode

Consecutive buy or sell transactions for the same symbol are combined into a single transaction with:

- **Quantity**: Sum of all quantities in the group
- **Price**: Weighted average price based on quantity
- **Commission/Fee**: Sum of all commissions/fees
- **Time**: Last transaction's closing time

**Example:**

```
Original:
  Buy 10 @ €5
  Buy 20 @ €6
  Buy 30 @ €7

Aggregated:
  Buy 60 @ €6.33 (weighted average)
```

This mode is useful for reducing the number of transactions when importing large portfolios.

## Supported Exchanges

The converter resolves ISINs to German exchange symbols since Scalable Capital only trades on German exchanges in EUR:

| Exchange   | TradingView Prefix | Yahoo Finance Suffix |
| ---------- | ------------------ | -------------------- |
| XETRA      | XETR:              | .DE                  |
| Gettex     | GETTEX:            | .MU                  |
| Tradegate  | TRADEGATE:         | .DE                  |
| Frankfurt  | FRA:               | .F                   |
| Stuttgart  | SWB:               | .SG                  |
| Hamburg    | HAM:               | .HM                  |
| Düsseldorf | DUS:               | .DU                  |

**Note**: The converter validates that symbols exist on the target platform and automatically tries alternative exchanges if the primary one is unavailable.

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
4. Choose conversion mode (Detailed or Aggregated)
5. Review the converted transactions in the preview tabs
6. Download the CSV for your target platform:
   - **TradingView CSV** - For TradingView portfolio import
   - **Wealthfolio CSV** - For Wealthfolio desktop app

## API Rate Limits

- **Without API key**: ~20 requests per minute
- **With API key**: ~250 requests per minute

Get a free API key at [OpenFIGI](https://www.openfigi.com/api).

## Transaction Type Mapping

| Scalable Capital  | TradingView    | Wealthfolio |
| ----------------- | -------------- | ----------- |
| Buy               | Buy            | BUY         |
| Sell              | Sell           | SELL        |
| Savings Plan      | Buy            | BUY         |
| Dividend          | Dividend       | DIVIDEND    |
| Distribution      | Dividend       | DIVIDEND    |
| Interest          | Dividend       | INTEREST    |
| Deposit           | Deposit        | DEPOSIT     |
| Withdrawal        | Withdrawal     | WITHDRAWAL  |
| Tax/Fee           | Taxes and fees | TAX/FEE     |
| Security Transfer | _Skipped_      | _Skipped_   |
| Corporate Action  | _Skipped_      | _Skipped_   |

## Output Formats

### TradingView CSV Format

```csv
Symbol,Side,Qty,Fill Price,Commission,Closing Time
XETR:SAP,Buy,10,150.50,0.99,2024-01-15 10:30:00
SWB:EWG2,Buy,5,58.20,0,2024-01-16 14:00:00
$CASH,Deposit,5000,,,2024-01-10 0:00:00
```

### Wealthfolio CSV Format

```csv
date,symbol,quantity,activityType,unitPrice,currency,fee,amount
2024-01-15T10:30:00.000Z,SAP.DE,10,BUY,150.50,EUR,0.99,1505
2024-01-16T14:00:00.000Z,EWG2.SG,5,BUY,58.20,EUR,0,291
2024-01-10T00:00:00.000Z,$CASH-EUR,1,DEPOSIT,5000,EUR,0,5000
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
│   ├── resolve-isin/         # ISIN to ticker resolution
│   ├── validate-yahoo/       # Yahoo Finance symbol validation
│   └── validate-tradingview/ # TradingView symbol validation
├── components/
│   └── CsvConverter.tsx      # Main converter UI component
├── lib/
│   ├── __tests__/            # Unit tests
│   ├── csv-generator.ts      # TradingView CSV generation
│   ├── csv-parser.ts         # Scalable Capital CSV parsing
│   ├── wealthfolio-generator.ts  # Wealthfolio CSV generation
│   ├── openfigi.ts           # OpenFIGI API client
│   └── types.ts              # TypeScript type definitions
├── page.tsx                  # Main page
└── layout.tsx                # App layout
components/
└── ui/                       # shadcn/ui components
```

## License

MIT
