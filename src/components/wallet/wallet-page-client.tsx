// src/components/wallet/wallet-page-client.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionTable } from "@/components/wallet/transaction-table";
import { WalletHeader } from "@/components/wallet/wallet-header";
import type { WalletDetails, FlattenedTransaction, Transaction } from "@/lib/types";
import Loading from '@/app/wallet/[address]/loading';
import { TokenTable } from '@/components/wallet/token-table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, LineChart, X } from 'lucide-react';
import { WalletNetworkGraph } from '@/components/wallet/wallet-relationship-graph';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBalancedTxs, getWhaleTxs, getDegenTxs } from '@/components/wallet/mock-tx-data';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortfolioCompositionChart } from '@/components/wallet/portfolio-composition-chart';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import TransactionsPageClient from './transactions-page-client';

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

            // We are using a different component for transactions now so we don't need to fetch them here initially.
            // This simplifies the initial load.
            // const rootTxData = await fetchTransactionsForAddress(address);
            // setTransactions(rootTxData.transactions || []);
            // setAddressBalances(rootTxData.addressBalances || {});
            // setNextSignature(rootTxData.nextCursor);

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
  }, [address, useMockData]);


  const handleExpandNode = useCallback(async (nodeAddress: string) => {
    if (useMockData || expandedWallets.has(nodeAddress) || isExpanding) return;

    setIsExpanding(true);
    setError(null);
    try {
        const newData = await fetchTransactionsForAddress(nodeAddress);
        
        setTransactions(prev => {
            const existingSignatures = new Set(prev.map(tx => tx.signature));
            const newUniqueTxs = (newData.transactions || []).filter((tx: Transaction) => !existingSignatures.has(tx.signature));
            return [...prev, ...newUniqueTxs];
        });

        setAddressBalances(prev => ({ ...prev, ...(newData.addressBalances || {}) }));
        
        setExpandedWallets(prev => new Set(prev).add(nodeAddress));

    } catch (e: any) {
        setError(`Failed to expand ${nodeAddress}: ${e.message}`);
    } finally {
        setIsExpanding(false);
    }
  }, [useMockData, expandedWallets, isExpanding, fetchTransactionsForAddress]);


  const displayedDetails = useMemo(() => {
    if (useMockData) {
      // Create some mock details for the graph to use
      const MOCK_SOL_PRICE = 150;
      return { address: address, sol: { balance: 1234.56, price: MOCK_SOL_PRICE, valueUSD: 1234.56 * MOCK_SOL_PRICE }, tokens: [] };
    }
    return walletDetails;
  }, [useMockData, walletDetails, address]);
  
  const solPrice = useMemo(() => {
    if (!displayedDetails) return null;
    return displayedDetails.sol.price;
  }, [displayedDetails]);

  const liveTransactions = useMemo(() => {
    if (useMockData) {
        switch (mockScenario) {
            case 'whale': return getWhaleTxs(address);
            case 'degen': return getDegenTxs(address);
            case 'balanced': default: return getBalancedTxs(address);
        }
    }
    return transactions;
  }, [useMockData, transactions, mockScenario, address]);

  if (isLoading && !useMockData) {
      return <Loading />;
  }

  if (error && !walletDetails && !useMockData) {
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

  return (
    <div className="flex flex-col min-h-screen bg-muted/20">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <WalletHeader address={address} />
        
         {error && !isLoading && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>An error occurred</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="portfolio" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="graph">Graph</TabsTrigger>
            </TabsList>
            <TabsContent value="portfolio" className="mt-6 space-y-8">
                 <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {displayedDetails ? (
                        <>
                          <BalanceCard
                              balance={displayedDetails.sol.balance}
                              balanceUSD={displayedDetails.sol.valueUSD}
                              className="lg:col-span-1"
                          />
                          <TokenTable tokens={displayedDetails.tokens} className="md:col-span-2" />
                        </>
                    ) : isLoading ? (
                        <>
                          <div className="lg:col-span-1"><p>Loading Balance...</p></div>
                          <div className="md:col-span-2"><p>Loading Tokens...</p></div>
                        </>
                    ) : <p>No details to display.</p>}
                </div>
                {displayedDetails ? <PortfolioCompositionChart walletDetails={displayedDetails} /> : <p>Loading Chart...</p>}
            </TabsContent>
            <TabsContent value="transactions" className="mt-6">
                <TransactionsPageClient address={address} />
            </TabsContent>
            <TabsContent value="graph" className="mt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                          id="data-source-toggle"
                          checked={useMockData}
                          onCheckedChange={setUseMockData}
                          aria-label="Toggle between real and mock data"
                        />
                        <Label htmlFor="data-source-toggle">
                          {useMockData ? 'Using Mock Data' : 'Using Real Data'}
                        </Label>
                    </div>

                    {useMockData && (
                        <Select onValueChange={(v) => setMockScenario(v as MockScenario)} defaultValue={mockScenario}>
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
                      <div className="relative">
                        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        {dateRange && 
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDateRange(undefined)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                          >
                            <span className="sr-only">Clear date range</span>
                            <X className="h-4 w-4" />
                          </Button>
                        }
                      </div>
                      <Button asChild variant="outline">
                        <Link href={`/diagnostic?address=${address}&scenario=${useMockData ? mockScenario : 'real'}`}>
                          <LineChart className="mr-2 h-4 w-4"/>
                          View Diagnostics
                        </Link>
                      </Button>
                  </div>
                </div>
                <WalletNetworkGraph 
                    key={useMockData ? `mock-${mockScenario}` : `real-${address}-${solPrice}`}
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
