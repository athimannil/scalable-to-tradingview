import { CsvConverter } from './components/CsvConverter';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 dark:bg-zinc-950">
      <main className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Scalable Capital to TradingView Converter
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Convert your Scalable Capital transaction CSV to TradingView
            portfolio format
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
            <li>Review the converted transactions in the preview table</li>
            <li>Download the TradingView-compatible CSV file</li>
            <li>Import the file into your TradingView portfolio</li>
          </ol>
          <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
              Note
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              Security transfers are automatically skipped as they don&apos;t
              represent actual trades. The converter will attempt to resolve
              ISINs to German exchange ticker symbols (XETR, TRADEGATE, GETTEX).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
