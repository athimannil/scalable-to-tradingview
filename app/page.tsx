import { CsvConverter } from './components/CsvConverter';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 dark:bg-zinc-950">
      <main className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Scalable Capital Portfolio Converter
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Convert your Scalable Capital transaction CSV to TradingView or
            Wealthfolio portfolio format
          </p>
        </div>
        <CsvConverter />
        <div className="mt-12 rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold">How to use</h2>
          <ol className="list-inside list-decimal space-y-2 text-zinc-600 dark:text-zinc-400">
            <li>
              Export your transaction history from Scalable Capital as CSV
            </li>
            <li>
              Optionally enter your OpenFIGI API key for higher rate limits
            </li>
            <li>Upload the CSV file using the form above</li>
            <li>Review the converted transactions in the preview tabs</li>
            <li>Download the TradingView CSV or Wealthfolio CSV as needed</li>
            <li>Import the file into your portfolio tracker</li>
          </ol>
          <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
              Note
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              Security transfers and corporate actions are automatically
              skipped. All ISINs are resolved to German exchange ticker symbols
              (XETR, TRADEGATE, GETTEX, etc.) since Scalable Capital only trades
              on German exchanges in EUR.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
