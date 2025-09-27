// src/app/wallet/[address]/page.tsx

'use client';

import { useEffect, useState } from 'react';

interface WalletPageProps {
  params: {
    address: string;
  };
}

export default function WalletPage({ params }: WalletPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch(`/api/wallet/${params.address}/transactions`);
        if (!res.ok) throw new Error("Failed to load transactions");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [params.address]);

  if (loading) return <div className="p-4 text-white">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Wallet: {params.address}</h1>

      {data.transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <ul className="space-y-4">
          {data.transactions.map((tx: any, index: number) => (
            <li key={index} className="border-b border-gray-700 pb-2">
              <p>Signature: {tx.signature}</p>
              <p>Type: {tx.type}</p>
              <p>Amount: {tx.amount ?? tx.tokenAmount} {tx.symbol ?? tx.tokenSymbol}</p>
              <p>Time: {new Date(tx.blockTime * 1000).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
