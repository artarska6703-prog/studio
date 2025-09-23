
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from "@/components/layout/header";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionTable } from "@/components/wallet/transaction-table";
import { WalletHeader } from "@/components/wallet/wallet-header";
import type { WalletDetails, FlattenedTransaction, Transaction } from "@/lib/types";
import Loading from '@/app/wallet/[address]/loading';
import { TokenTable } from '@/components/wallet/token-table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, LineChart } from 'lucide-react';
import { WalletNetworkGraph } from '@/components/wallet/wallet-relationship-graph';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBalancedTxs, getWhaleTxs, getDegenTxs } from '@/components/wallet/mock-tx-data';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortfolioCompositionChart } from '@/components/wallet/portfolio-composition-chart';
import { processTransactions } from '@/components/wallet/wallet-relationship-graph-utils';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

const TXN_PAGE_SIZE = 50;

type MockScenario = 'balanced' | 'whale' | 'degen';

type WalletPageClientProps = {
  address: string;
};

export default function WalletPageClient({ address }: WalletPageClientProps) {
  const [walletDetails, setWalletDetails] = useState<WalletDetails | null>(null);
  const [transactions, setTransactions] = useState<FlattenedTransaction[]>([]);
  const [addressBalances, setAddressBalances] = useState<{ [key: string]: number }>({});
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set([address]));
  const [isExpanding, setIsExpanding] = useState<boolean>(false);
  const [nextSignature, setNextSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [mockScenario, setMockScenario] = useState<MockScenario>('balanced');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchTransactionsForAddress = useCallback(async (wallet: string) => {
    const url = `/api/wallet/${wallet}/transactions?limit=${TXN_PAGE_SIZE}`;
    const res = await fetch(url);
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to fetch transactions for ${wallet}: ${errorData.error || res.statusText}`);
    }
    const data = await res.json();
    if (data.error) {
        throw new Error(`Failed to fetch transactions for ${wallet}: ${data.error}`);
    }
    return data;
  }, []);
  
  // Effect for initial load and for fetching data for newly expanded wallets
  useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const detailsRes = await fetch(`/api/wallet/${address}/details`);
            if (!detailsRes.ok) throw new Error((await detailsRes.json()).message || 'Failed to fetch wallet details');
            setWalletDetails(await detailsRes.json());

            const rootTxData = await fetchTransactionsForAddress(address);
            setTransactions(rootTxData.transactions || []);
            setAddressBalances(rootTxData.addressBalances || {});
            setNextSignature(rootTxData.nextCursor);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!useMockData) {
        fetchInitialData();
    } else {
        setIsLoading(false);
        setError(null);
        setTransactions([]);
        setAddressBalances({});
        setNextSignature(null);
    }
    // This effect should only run when the root address changes or when we toggle mock data
  }, [address, useMockData, fetchTransactionsForAddress]);


  const handleExpandNode = useCallback(async (nodeAddress: string) => {
    if (useMockData || expandedWallets.has(nodeAddress) || isExpanding) return;

    setIsExpanding(true);
    setError(null);
    try {
        const newData = await fetchTransactionsForAddress(nodeAddress);
        
        // Merge new data without causing a full reload
        setTransactions(prev => {
            const existingSignatures = new Set(prev.map(tx => tx.signature));
            const newUniqueTxs = (newData.transactions || []).filter((tx: Transaction) => !existingSignatures.has(tx.signature));
            return [...prev, ...newUniqueTxs];
        });

        setAddressBalances(prev => ({ ...prev, ...(newData.addressBalances || {}) }));
        
        // Add the newly fetched address to the expanded set
        setExpandedWallets(prev => new Set(prev).add(nodeAddress));

    } catch (e: any) {
        setError(`Failed to expand ${nodeAddress}: ${e.message}`);
    } finally {
        setIsExpanding(false);
    }
  }, [useMockData, expandedWallets, isExpanding, fetchTransactionsForAddress]);


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
        setAddressBalances(prev => ({ ...prev, ...txData.addressBalances }));
        setNextSignature(txData.nextCursor);

    } catch (e: any) {
        setError(e.message);
        setNextSignature(null); // Stop fetching on error
    } finally {
        setIsFetchingMore(false);
    }
  }, [address, isFetchingMore, nextSignature, useMockData]);

  const handleToggleDataSource = (checked: boolean) => {
    setUseMockData(checked);
    setExpandedWallets(new Set([address])); // Reset expanded wallets when toggling
  };

  const handleScenarioChange = (value: string) => {
    setMockScenario(value as MockScenario);
  };
  
  const liveTransactions = useMemo(() => {
    let allTransactions: (FlattenedTransaction | Transaction)[] = [];
    if (useMockData) {
        return (() => {
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
    } else {
      allTransactions = transactions;
    }
    
    // Apply date range filter to all transactions
    if (dateRange?.from) {
      return allTransactions.filter(tx => 
        tx.blockTime ? isWithinInterval(new Date(tx.blockTime * 1000), { 
            start: startOfDay(dateRange.from!), 
            end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!)
        }) : true
      );
    }
    
    return allTransactions;

  }, [useMockData, transactions, mockScenario, address, dateRange]);

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
                <Button onClick={() => window.location.reload()} className="mt-6">Try again</Button>
            </main>
        </div>
    )
  }

  if (!walletDetails && !useMockData) {
    return <Loading />; // Should be covered by isLoading but as a fallback
  }

  const displayedDetails = useMockData 
    ? { address: address, balance: 1234.56, balanceUSD: 1234.56 * 150, tokens: [] } // Fake details for mock
    : walletDetails;

  const solPrice = displayedDetails?.balanceUSD && displayedDetails?.balance ? displayedDetails.balanceUSD / displayedDetails.balance : null;

  return (
    <div className="flex flex-col min-h-screen bg-muted/20">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <WalletHeader address={address} />
        
         {error && ( // Show non-critical errors without blocking the UI
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>An error occurred</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="graph" className="w-full">
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
                    dateRange={dateRange}
                    setDateRange={setDateRange}
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
                   <div className="flex items-center gap-2">
                      <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                      {dateRange && <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>Clear</Button>}
                      <Button asChild variant="outline">
                        <Link href={`/diagnostic?address=${address}&scenario=${useMockData ? mockScenario : 'real'}`}>
                          <LineChart className="mr-2 h-4 w-4"/>
                          View Diagnostics
                        </Link>
                      </Button>
                  </div>
                </div>
                <WalletNetworkGraph 
                    key={useMockData ? `mock-${mockScenario}` : `real-${address}-${expandedWallets.size}`}
                    walletAddress={address}
                    transactions={liveTransactions}
                    addressBalances={addressBalances}
                    solPrice={solPrice}
                    onNodeClick={handleExpandNode}
                />
            </TabsContent>
        </Tabs>
        
      </main>
    </div>
  );
}
