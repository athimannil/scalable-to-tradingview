'use client';

import { useState, useCallback } from 'react';
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { parseScalableCsv, extractUniqueIsins } from '@/app/lib/csv-parser';
import {
  convertTransactions,
  generateTradingViewCsv,
} from '@/app/lib/csv-generator';
import {
  ScalableTransaction,
  TradingViewTransaction,
  ConversionError,
  SkippedTransaction,
  ResolvedSymbol,
} from '@/app/lib/types';

type ConversionStatus =
  | 'idle'
  | 'parsing'
  | 'resolving'
  | 'converting'
  | 'done'
  | 'error';

export function CsvConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const [, setOriginalTransactions] = useState<ScalableTransaction[]>([]);
  const [convertedTransactions, setConvertedTransactions] = useState<
    TradingViewTransaction[]
  >([]);
  const [conversionErrors, setConversionErrors] = useState<ConversionError[]>(
    []
  );
  const [skippedTransactions, setSkippedTransactions] = useState<
    SkippedTransaction[]
  >([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setStatus('idle');
        setConvertedTransactions([]);
        setConversionErrors([]);
        setSkippedTransactions([]);
        setParseErrors([]);
      }
    },
    []
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;

    try {
      // Step 1: Parse CSV
      setStatus('parsing');
      setProgress(10);
      setProgressMessage('Parsing CSV file...');

      const content = await file.text();
      const { transactions, errors: pErrors } = parseScalableCsv(content);

      if (pErrors.length > 0) {
        setParseErrors(pErrors);
      }

      setOriginalTransactions(transactions);
      setProgress(20);

      if (transactions.length === 0) {
        setStatus('error');
        setParseErrors(['No valid transactions found in the CSV file']);
        return;
      }

      // Step 2: Extract and resolve ISINs
      setStatus('resolving');
      setProgressMessage('Resolving ISINs to ticker symbols...');

      const uniqueIsins = extractUniqueIsins(transactions);
      setProgress(30);

      const symbolMap = new Map<string, ResolvedSymbol | null>();

      if (uniqueIsins.length > 0) {
        // Call API to resolve ISINs
        const response = await fetch('/api/resolve-isin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isins: uniqueIsins,
            apiKey: apiKey || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || 'Failed to resolve ISINs');
        }

        const { results } = (await response.json()) as {
          results: Record<string, ResolvedSymbol | null>;
        };

        // Convert results object back to Map
        Object.entries(results).forEach(([key, value]) => {
          symbolMap.set(key, value as ResolvedSymbol | null);
        });
      }

      setProgress(70);

      // Step 3: Convert transactions
      setStatus('converting');
      setProgressMessage('Converting transactions...');

      const conversionResult = convertTransactions(transactions, symbolMap);

      setConvertedTransactions(conversionResult.transactions);
      setConversionErrors(conversionResult.errors);
      setSkippedTransactions(conversionResult.skipped);

      setProgress(100);
      setStatus('done');
      setProgressMessage('Conversion complete!');
    } catch (error) {
      setStatus('error');
      setParseErrors([
        error instanceof Error ? error.message : 'An unexpected error occurred',
      ]);
    }
  }, [file, apiKey]);

  const handleDownload = useCallback(() => {
    if (convertedTransactions.length === 0) return;

    const csvContent = generateTradingViewCsv(convertedTransactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'tradingview_portfolio.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [convertedTransactions]);

  const isProcessing = ['parsing', 'resolving', 'converting'].includes(status);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Upload your Scalable Capital transaction export CSV file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Scalable Capital CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">OpenFIGI API Key (Optional)</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your OpenFIGI API key for higher rate limits"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isProcessing}
            />
            <p className="text-sm text-zinc-500">
              Without an API key, requests are limited to ~20/min.{' '}
              <a
                href="https://www.openfigi.com/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Get a free API key
              </a>
            </p>
          </div>

          <Button
            onClick={handleConvert}
            disabled={!file || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Convert to TradingView Format
              </>
            )}
          </Button>

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-center text-sm text-zinc-600">
                {progressMessage}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Errors Section */}
      {parseErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errors</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc">
              {parseErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {status === 'done' && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Conversion Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Badge variant="default" className="text-sm">
                  {convertedTransactions.length} Converted
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  {skippedTransactions.length} Skipped
                </Badge>
                {conversionErrors.length > 0 && (
                  <Badge variant="destructive" className="text-sm">
                    {conversionErrors.length} Errors
                  </Badge>
                )}
              </div>

              <Button onClick={handleDownload} className="mt-4">
                <Download className="mr-2 h-4 w-4" />
                Download TradingView CSV
              </Button>
            </CardContent>
          </Card>

          {/* Tabs for Preview */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="converted">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="converted">
                    Converted ({convertedTransactions.length})
                  </TabsTrigger>
                  <TabsTrigger value="skipped">
                    Skipped ({skippedTransactions.length})
                  </TabsTrigger>
                  <TabsTrigger value="errors">
                    Errors ({conversionErrors.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="converted" className="mt-4">
                  <div className="max-h-96 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Fill Price</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Closing Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {convertedTransactions.slice(0, 50).map((tx, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">
                              {tx.Symbol || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  tx.Side === 'Buy'
                                    ? 'default'
                                    : tx.Side === 'Sell'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {tx.Side}
                              </Badge>
                            </TableCell>
                            <TableCell>{tx.Qty || '-'}</TableCell>
                            <TableCell>{tx['Fill Price'] || '-'}</TableCell>
                            <TableCell>{tx.Commission || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {tx['Closing Time']}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {convertedTransactions.length > 50 && (
                      <p className="p-4 text-center text-sm text-zinc-500">
                        Showing first 50 of {convertedTransactions.length}{' '}
                        transactions
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="skipped" className="mt-4">
                  {skippedTransactions.length === 0 ? (
                    <p className="py-8 text-center text-zinc-500">
                      No transactions were skipped
                    </p>
                  ) : (
                    <div className="max-h-96 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {skippedTransactions.map((tx, index) => (
                            <TableRow key={index}>
                              <TableCell>{tx.row}</TableCell>
                              <TableCell>{tx.type}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {tx.description}
                              </TableCell>
                              <TableCell>{tx.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="errors" className="mt-4">
                  {conversionErrors.length === 0 ? (
                    <p className="py-8 text-center text-zinc-500">
                      No errors occurred during conversion
                    </p>
                  ) : (
                    <div className="max-h-96 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>ISIN</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conversionErrors.map((error, index) => (
                            <TableRow key={index}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {error.isin || '-'}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {error.description}
                              </TableCell>
                              <TableCell className="text-red-600">
                                {error.error}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
