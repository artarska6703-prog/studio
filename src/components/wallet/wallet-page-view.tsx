
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from "@/components/layout/header";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionTable } from "@/components/wallet/transaction-table";
import { WalletHeader } from "@/components/wallet/wallet-header";
import type { WalletDetails, FlattenedTransaction } from "@/lib/types";
import Loading from '../../app/wallet/[address]/loading';
import { TokenTable } from '@/components/wallet/token-table';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Terminal, LineChart } from 'lucide-react';
import { WalletNetworkGraph } from './wallet-relationship-graph';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBalancedTxs, getWhaleTxs, getDegenTxs } from './mock-tx-data';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PortfolioCompositionChart } from './portfolio-composition-chart';
import { processTransactions } from './wallet-relationship-graph-utils';

const TXN_PAGE_SIZE = 50;

type MockScenario = 'balanced' | 'whale' | 'degen';

type WalletPageViewProps = {
  address: string;
};

export function WalletPageView({ address }: WalletPageViewProps) {
  const [walletDetails, setWalletDetails] = useState<WalletDetails | null>(null);
  const [transactions, setTransactions] = useState<FlattenedTransaction[]>([]);
  const [nextSignature, setNextSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [mockScenario, setMockScenario] = useState<MockScenario>('balanced');
  
    const fetchMoreTransactions = useCallback(async () => {
        if (!nextSignature || isFetchingMore || useMockData) {
            return;
        }

        setIsFetchingMore(true);
        try {
            const url = `/api/wallet/${address}/transactions?limit=${TXN_PAGE_SIZE}&before=${nextSignature}`;
            const txRes = await fetch(url);
            
            if (!txRes.ok) {
              const errorData = await txRes.json();
              throw new Error(`API failed: ${errorData.error || txRes.statusText}`);
            }
            
            const txData = await txRes.json();
             if (txData.error) {
              throw new Error(txData.error);
            }
            
            setTransactions(prev => [...prev, ...(txData.transactions || [])]);
            setNextSignature(txData.nextCursor);

        } catch (e: any) {
            setError(e.message);
            setNextSignature(null); // Stop fetching on error
        } finally {
            setIsFetchingMore(false);
        }
    }, [address, isFetchingMore, nextSignature, useMockData]);

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTransactions([]);
        setNextSignature(null);
        try {
            const [detailsRes, txRes] = await Promise.all([
                fetch(`/api/wallet/${address}/details`),
                fetch(`/api/wallet/${address}/transactions?limit=${TXN_PAGE_SIZE}`)
            ]);

            if (!detailsRes.ok) {
                 const errorData = await detailsRes.json();
                 throw new Error(errorData.message || 'Failed to fetch wallet details');
            }
            const detailsData = await detailsRes.json();
            setWalletDetails(detailsData);
            
            if (!txRes.ok) {
                const errorData = await txRes.json();
                throw new Error(`Failed to fetch transactions: ${errorData.error || txRes.statusText}`);
            }
            
            const txData = await txRes.json();

            if (txData.error) {
              throw new Error(`Failed to fetch transactions: ${txData.error}`);
            }
            
            setTransactions(txData.transactions || []);
            setNextSignature(txData.nextCursor);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    // Initial data fetch
    useEffect(() => {
        if (!useMockData) {
            fetchInitialData();
        } else {
          setIsLoading(false);
          setError(null);
        }
    }, [fetchInitialData, useMockData]);
  
  const handleToggleDataSource = (checked: boolean) => {
    setUseMockData(checked);
  }

  const handleScenarioChange = (value: string) => {
    setMockScenario(value as MockScenario);
  }

  const liveTransactions = useMemo(() => {
    if (useMockData) {
        const rawMockTxs = (() => {
             switch (mockScenario) {
                case 'whale':
                    return getWhaleTxs(address);
                case 'degen':
                    return getDegenTxs(address);
                case 'balanced':
                default:
                    return getBalancedTxs(address);
            }
        })();
        // The mock data needs the same processing as the real data.
        const { nodes } = processTransactions(rawMockTxs, address, 5);
        const balances = new Map(nodes.map(n => [n.id, n.balance]));
        
        return rawMockTxs.map(tx => ({
            ...tx,
            type: tx.amount > 0 ? 'received' : 'sent',
            by: tx.by,
            interactedWith: tx.interactedWith,
            valueUSD: tx.valueUSD ?? (balances.get(tx.to!) || balances.get(tx.from!)) // simplified logic
        }));
    }
    return transactions;
  }, [useMockData, transactions, mockScenario, address]);

  if (isLoading && !useMockData) {
      return <Loading />;
  }

  if (error && !walletDetails && !useMockData) { // Only show full-page error if initial data fails
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center text-center">
                <Alert variant="destructive" className="max-w-lg">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Something went wrong!</AlertTitle>
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
                <Button onClick={fetchInitialData} className="mt-6">Try again</Button>
            </main>
        </div>
    )
  }

  if (!walletDetails && !useMockData) {
    return <Loading />; // Should be covered by isLoading but as a fallback
  }

  const displayedDetails = useMockData 
    ? { address, balance: 1234.56, balanceUSD: 1234.56 * 150, tokens: [] } // Fake details for mock
    : walletDetails;

  return (
    <div className="flex flex-col min-h-screen bg-muted/20">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <WalletHeader address={address} />
        
         {error && !isLoading && ( // Show non-critical errors without blocking the UI
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>An error occurred while fetching data</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="graph">Graph</TabsTrigger>
            </TabsList>
            <TabsContent value="portfolio" className="mt-6 space-y-8">
                 <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {displayedDetails && (
                        <BalanceCard
                            balance={displayedDetails.balance}
                            balanceUSD={displayedDetails.balanceUSD}
                            className="lg:col-span-1"
                        />
                    )}
                    {displayedDetails && <TokenTable tokens={displayedDetails.tokens} className="md:col-span-2" />}
                </div>
                <PortfolioCompositionChart walletDetails={displayedDetails} />
            </TabsContent>
            <TabsContent value="transactions" className="mt-6">
                <TransactionTable 
                    transactions={liveTransactions as FlattenedTransaction[]} 
                    allTokens={displayedDetails?.tokens || []}
                    walletAddress={address}
                    onLoadMore={fetchMoreTransactions}
                    hasMore={useMockData ? false : !!nextSignature}
                    isLoadingMore={isFetchingMore}
                    totalTransactions={liveTransactions.length}
                />
            </TabsContent>
            <TabsContent value="graph" className="mt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                          id="data-source-toggle"
                          checked={useMockData}
                          onCheckedChange={handleToggleDataSource}
                          aria-label="Toggle between real and mock data"
                        />
                        <Label htmlFor="data-source-toggle">
                          {useMockData ? 'Using Mock Data' : 'Using Real Data'}
                        </Label>
                    </div>

                    {useMockData && (
                        <Select onValueChange={handleScenarioChange} defaultValue={mockScenario}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select scenario" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="balanced">Balanced</SelectItem>
                                <SelectItem value="whale">Whale Activity</SelectItem>
                                <SelectItem value="degen">Degen Trader</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/diagnostic?address=${address}&scenario=${useMockData ? mockScenario : 'real'}`}>
                      <LineChart className="mr-2 h-4 w-4"/>
                      View Diagnostics
                    </Link>
                  </Button>
                </div>
                <WalletNetworkGraph 
                    key={useMockData ? `mock-${mockScenario}-${address}` : `real-${address}`}
                    walletAddress={address}
                    transactions={liveTransactions}
                />
            </TabsContent>
        </Tabs>
        
      </main>
    </div>
  );
}
