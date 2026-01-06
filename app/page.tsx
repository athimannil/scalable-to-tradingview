import { CsvConverter } from './components/CsvConverter';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 dark:bg-zinc-950">
      <main className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Scalable Portfolio Converter
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
            <li>Choose conversion mode (Detailed or Aggregated)</li>
            <li>Review the converted transactions in the preview tabs</li>
            <li>Download the CSV for your target platform</li>
          </ol>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h3 className="font-medium text-blue-800 dark:text-blue-200">
                TradingView
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Uses exchange-prefixed symbols (e.g., XETR:SAP, SWB:EWG2).
                Symbols are validated to ensure they exist on TradingView.
              </p>
            </div>
            <div className="rounded border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <h3 className="font-medium text-purple-800 dark:text-purple-200">
                Wealthfolio
              </h3>
              <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
                Uses Yahoo Finance symbols with German exchange suffixes (e.g.,
                SAP.DE, EWG2.SG). Symbols are validated against Yahoo Finance.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
              Note
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              Security transfers and corporate actions are automatically
              skipped. All ISINs are resolved to German exchange symbols since
              Scalable Capital only trades on German exchanges in EUR.
            </p>
          </div>
        </div>

        <footer className="mt-8 text-center text-sm text-zinc-500">
          <p>
            Open source on{' '}
            <a
              href="https://github.com/kukkudachi/scalable-portfolio-converter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              GitHub
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
