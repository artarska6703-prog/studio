
"use client";

import { useEffect, useState } from "react";
import type { FlattenedTransaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { shortenAddress } from "@/lib/solana-utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "../ui/card";
import { Loader2 } from "lucide-react";

interface TransactionsPageClientProps {
  address: string;
}

export default function TransactionsPageClient({ address }: TransactionsPageClientProps) {
  const [txs, setTxs] = useState<FlattenedTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchPage = async (before?: string) => {
    setLoading(true);
    setErr(null);
    try {
      const url = new URL(`/api/wallet/${address}/transactions`, window.location.origin);
      if (before) url.searchParams.set("before", before);
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setTxs((prev) => [...prev, ...(data.transactions || [])]);
      setCursor(data.nextCursor || null);
    } catch (e: any) {
      console.error("[TransactionsPageClient] error:", e);
      setErr(e.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTxs([]); 
    setCursor(null);
    if (address) {
      fetchPage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);


  return (
    <div className="space-y-4">
      {txs.length === 0 && loading && <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin"/></div>}
      {err && <p className="text-red-500">Error: {err}</p>}

      {txs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Value (USD)</TableHead>
                  <TableHead>From → To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t, index) => (
                  <TableRow key={`${t.signature}-${index}`}>
                    <TableCell>
                      {t.blockTime ? new Date(t.blockTime * 1000).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell>{t.symbol ?? (t.mint ? shortenAddress(t.mint, 4): "—")}</TableCell>
                    <TableCell className={t.amount < 0 ? 'text-red-400' : 'text-green-400'}>{t.amount.toLocaleString()}</TableCell>
                    <TableCell>{t.valueUSD ? formatCurrency(t.valueUSD) : 'N/A'}</TableCell>
                    <TableCell className="font-code text-xs">
                      {(t.from ? shortenAddress(t.from, 4) : "—")} → {(t.to ? shortenAddress(t.to, 4) : "—")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {cursor && (
        <div className="text-center">
            <Button
                variant="outline"
                onClick={() => fetchPage(cursor!)}
                disabled={loading}
            >
            {loading ? "Loading…" : "Load more"}
            </Button>
        </div>
      )}
    </div>
  );
}