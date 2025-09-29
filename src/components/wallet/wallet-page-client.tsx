// src/components/wallet/wallet-page-client.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionTable } from "@/components/wallet/transaction-table";
import { WalletHeader } from "@/components/wallet/wallet-header";
import type { WalletDetails, FlattenedTransaction, TokenHolding } from "@/lib/types";
import Loading from '@/app/wallet/[address]/loading';
import { TokenTable } from '@/components/wallet/token-table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, LineChart, X, Share } from 'lucide-react';
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
import { WalletNetworkGraphV2 } from "./wallet-relationship-graph-v2";
import { useToast } from "@/hooks/use-toast";
import { shortenAddress } from "@/lib/solana-utils";
import { useSearchParams } from "next/navigation";

const TXN_PAGE_SIZE = 100;

type MockScenario = 'balanced' | 'whale' | 'degen';

type WalletPageViewProps = {
  address: string;
};

type AddressNameAndTags = {
  name: string;
  tags: string[];
};

export function WalletPageView({ address }: WalletPageViewProps) {
  const searchParams = useSearchParams();
  const [walletDetails, setWalletDetails] = useState<WalletDetails | null>(null);
  const [allTransactions, setAllTransactions] = useState<FlattenedTransaction[]>([]);
  const [extraWalletBalances, setExtraWalletBalances] = useState<Record<string, number>>({});
  const [addressTags, setAddressTags] = useState<Record<string, AddressNameAndTags>>({});
  const [specificTokenBalances, setSpecificTokenBalances] = useState<Record<string, number>>({});
  const [nextSignature, setNextSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [mockScenario, setMockScenario] = useState<MockScenario>('balanced');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'portfolio');


  const fetchBalances = async (addresses: string[], tokenMint?: string) => {
    if (addresses.length === 0) return;
    try {
        const endpoint = tokenMint ? `/api/wallet/token-balances` : '/api/wallet/balances';
        const body = tokenMint ? { addresses, mint: tokenMint } : { addresses };
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            console.error(`Failed to fetch balances (token: ${!!tokenMint})`);
            return;
        }
        const { balances } = await res.json();
        if (tokenMint) {
            setSpecificTokenBalances(prev => ({...prev, ...balances}));
        } else {
            setExtraWalletBalances(prev => ({ ...prev, ...balances }));
        }
    } catch (e) {
        console.error('Error fetching balances', e);
    }
  };

  const fetchAddressNames = useCallback(async (addresses: string[]) => {
    if (addresses.length === 0) return;
    try {
      const res = await fetch('/api/wallet/names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses }),
      });
      if (!res.ok) {
        console.error('Failed to fetch address names/tags');
        return;
      }
      const { namesAndTags } = await res.json();
      setAddressTags((prev) => ({ ...prev, ...namesAndTags }));
    } catch (e) {
      console.error('Error fetching address names/tags', e);
    }
  }, []);


  const fetchTransactions = useCallback(async (before?: string) => {
    setIsFetchingMore(true);
    setError(null);
    try {
        const url = `/api/wallet/${address}/transactions?limit=${TXN_PAGE_SIZE}${before ? `&before=${before}`: ''}`;
        const res = await fetch(url);
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to fetch transactions');
        }
        const data = await res.json();
        
        setAllTransactions(prev => {
            const existingSigs = new Set(prev.map(tx => tx.signature));
            const newTxs = data.transactions.filter((tx: FlattenedTransaction) => !existingSigs.has(tx.signature));
            return [...prev, ...newTxs];
        });

        setNextSignature(data.nextCursor);

        // The transactions endpoint now returns prices
        if (data.prices) {
            setTokenPrices(prev => ({...prev, ...data.prices}));
        }

        const newAddresses = new Set<string>();
        data.transactions.forEach((tx: FlattenedTransaction) => {
            if (tx.from) newAddresses.add(tx.from);
            if (tx.to) newAddresses.add(tx.to);
        });
        
        const addressesToFetchBalances = Array.from(newAddresses).filter(addr => !(addr in extraWalletBalances));
        if (addressesToFetchBalances.length > 0) {
           await fetchBalances(addressesToFetchBalances);
        }
        
        const addressesToFetchNames = Array.from(newAddresses).filter(addr => !(addr in addressTags));
        if (addressesToFetchNames.length > 0) {
          await fetchAddressNames(addressesToFetchNames);
        }

    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsFetchingMore(false);
    }
  }, [address, extraWalletBalances, addressTags, fetchAddressNames]);
  
  useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoading(true);
        setError(null);
        setAllTransactions([]);
        setExtraWalletBalances({});
        setAddressTags({});
        setNextSignature(null);

        try {
            const detailsRes = await fetch(`/api/wallet/${address}/details`);
            if (!detailsRes.ok) {
                const errorData = await detailsRes.json();
                throw new Error(errorData.message || 'Failed to fetch wallet details');
            }
            const details = await detailsRes.json();
            setWalletDetails(details);
            await fetchAddressNames([address]);
            
            await fetchTransactions();

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
        setAllTransactions([]);
        setNextSignature(null);
        const MOCK_SOL_PRICE = 150;
        setWalletDetails({ address: address, sol: { balance: 1234.56, price: MOCK_SOL_PRICE, valueUSD: 1234.56 * MOCK_SOL_PRICE }, tokens: [
            { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC', amount: 500.50, decimals: 6, valueUSD: 500.50, price: 1, tokenStandard: 'Fungible' as any },
            { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK', amount: 1000000, decimals: 5, valueUSD: 25.30, price: 0.0000253, tokenStandard: 'Fungible' as any }
        ] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, useMockData, fetchAddressNames]);

  const liveTransactions = useMemo(() => {
    if (useMockData) {
        switch (mockScenario) {
            case 'whale': return getWhaleTxs(address);
            case 'degen': return getDegenTxs(address);
            case 'balanced': default: return getBalancedTxs(address);
        }
    }
    return allTransactions;
  }, [useMockData, allTransactions, mockScenario, address]);
  

  const filteredTransactions = useMemo(() => {
    if (!dateRange || !dateRange.from) return liveTransactions;
    
    return liveTransactions.filter(tx => {
      if (!tx.blockTime) return false;
      const txDate = new Date(tx.blockTime * 1000);
      return isWithinInterval(txDate, {
        start: startOfDay(dateRange.from!),
        end: endOfDay(dateRange.to || dateRange.from!),
      });
    });
  }, [liveTransactions, dateRange]);


  const handleLoadMore = () => {
    if (nextSignature && !isFetchingMore) {
        fetchTransactions(nextSignature);
    }
  }

  // Enriched token data with prices
  const enrichedTokens: TokenHolding[] = useMemo(() => {
      return (walletDetails?.tokens || []).map(token => {
          const price = tokenPrices[token.mint] ?? 0;
          return {
              ...token,
              price,
              valueUSD: token.amount * price,
          }
      });
  }, [walletDetails?.tokens, tokenPrices]);

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="graph">Graph</TabsTrigger>
                <TabsTrigger value="graph-v2">Graph V2</TabsTrigger>
            </TabsList>
            <TabsContent value="portfolio" className="mt-6 space-y-8">
                 <div className="grid gap-8 md:grid-cols-3">
                    {walletDetails ? (
                        <>
                          <BalanceCard
                              balance={walletDetails.sol.balance}
                              balanceUSD={walletDetails.sol.valueUSD}
                          />
                          <TokenTable tokens={enrichedTokens} className="md:col-span-2" />
                        </>
                    ) : isLoading ? (
                        <>
                          <div className="lg:col-span-1"><p>Loading Balance...</p></div>
                          <div className="md:col-span-2"><p>Loading Tokens...</p></div>
                        </>
                    ) : <p>No details to display.</p>}
                </div>
                {walletDetails ? <PortfolioCompositionChart solValue={walletDetails.sol.valueUSD} tokens={enrichedTokens} /> : <p>Loading Chart...</p>}
            </TabsContent>
            <TabsContent value="transactions" className="mt-6">
                 <TransactionTable 
                    transactions={filteredTransactions} 
                    allTokens={enrichedTokens}
                    walletAddress={address}
                    onLoadMore={handleLoadMore}
                    hasMore={!!nextSignature}
                    isLoadingMore={isFetchingMore}
                    totalTransactions={liveTransactions.length}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    useMockData={useMockData}
                 />
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
                    key={useMockData ? `mock-${mockScenario}` : `real-${address}-${walletDetails?.sol.price}`}
                    walletAddress={address}
                    transactions={liveTransactions}
                    walletDetails={walletDetails}
                    extraWalletBalances={extraWalletBalances}
                    addressTags={addressTags}
                    isLoading={isLoading}
                />
            </TabsContent>
            <TabsContent value="graph-v2" className="mt-6">
                <WalletNetworkGraphV2 
                    key={`real-v2-${address}-${walletDetails?.sol.price}`}
                    walletAddress={address}
                    transactions={liveTransactions}
                    walletDetails={walletDetails}
                    extraWalletBalances={extraWalletBalances}
                    specificTokenBalances={specificTokenBalances}
                    onFetchTokenBalances={fetchBalances}
                />
            </TabsContent>
        </Tabs>
        
      </main>
    </div>
  );
}
