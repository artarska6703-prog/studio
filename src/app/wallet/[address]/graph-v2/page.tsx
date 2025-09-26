
// src/components/wallet/wallet-page-client.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { WalletHeader } from "@/components/wallet/wallet-header";
import type { WalletDetails, FlattenedTransaction } from "@/lib/types";
import Loading from '@/app/wallet/[address]/loading';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { WalletNetworkGraphV2 } from '@/components/wallet/wallet-relationship-graph-v2';
import { getBalancedTxs } from '@/components/wallet/mock-tx-data';

const TXN_PAGE_SIZE = 100;

type WalletPageV2ViewProps = {
  params: {
    address: string;
  };
};

export default function WalletGraphV2Page({ params }: WalletPageV2ViewProps) {
  const { address } = params;
  const [walletDetails, setWalletDetails] = useState<WalletDetails | null>(null);
  const [allTransactions, setAllTransactions] = useState<FlattenedTransaction[]>([]);
  const [extraWalletBalances, setExtraWalletBalances] = useState<Record<string, number>>({});
  const [nextSignature, setNextSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const fetchBalances = async (addresses: string[]) => {
    if (addresses.length === 0) return;
    try {
        const res = await fetch('/api/wallet/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses }),
        });
        if (!res.ok) {
            console.error('Failed to fetch extra balances');
            return;
        }
        const { balances } = await res.json();
        setExtraWalletBalances(prev => ({ ...prev, ...balances }));
    } catch (e) {
        console.error('Error fetching extra balances', e);
    }
  };

  const fetchTransactions = useCallback(async (fetchAddress: string, before?: string) => {
    setIsFetchingMore(true);
    setError(null);
    try {
        const url = `/api/wallet/${fetchAddress}/transactions?limit=${TXN_PAGE_SIZE}${before ? `&before=${before}`: ''}`;
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

        const newAddresses = new Set<string>();
        data.transactions.forEach((tx: FlattenedTransaction) => {
            if (tx.from) newAddresses.add(tx.from);
            if (tx.to) newAddresses.add(tx.to);
        });
        
        const addressesToFetch = Array.from(newAddresses).filter(addr => !(addr in extraWalletBalances) && addr !== fetchAddress);
        if (addressesToFetch.length > 0) {
           await fetchBalances(addressesToFetch);
        }

    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsFetchingMore(false);
    }
  }, []);

  
  useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoading(true);
        setError(null);
        setAllTransactions([]);
        setExtraWalletBalances({});
        setNextSignature(null);

        try {
            const detailsRes = await fetch(`/api/wallet/${address}/details`);
            if (!detailsRes.ok) throw new Error((await detailsRes.json()).message || 'Failed to fetch wallet details');
            setWalletDetails(await detailsRes.json());
            
            await fetchTransactions(address);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    fetchInitialData();
  }, [address, fetchTransactions]);

  const liveTransactions = useMemo(() => {
    return allTransactions;
  }, [allTransactions]);
  

  const handleLoadMore = () => {
    if (nextSignature && !isFetchingMore) {
        fetchTransactions(address, nextSignature);
    }
  }

  if (isLoading) {
      return <Loading />;
  }

  if (error && !walletDetails) {
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
        
        <WalletNetworkGraphV2 
            key={`real-${address}-${walletDetails?.sol.price}`}
            walletAddress={address}
            transactions={liveTransactions}
            walletDetails={walletDetails}
            extraWalletBalances={extraWalletBalances}
        />
        
      </main>
    </div>
  );
}
