
// src/components/wallet/token-table.tsx
import type { TokenHolding } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';

interface TokenTableProps {
  tokens: TokenHolding[];
  className?: string;
}

export function TokenTable({ tokens, className }: TokenTableProps) {
  if (!tokens?.length) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>Token Holdings</CardTitle></CardHeader>
        <CardContent><p>No other tokens found.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
          <CardTitle>Token Holdings</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Value (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.mint}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold relative overflow-hidden">
                           {t.icon ? <Image src={t.icon} alt={t.symbol} fill sizes="32px"/> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex flex-col">
                            <span>{t.symbol}</span>
                            <span className="text-xs text-muted-foreground">{t.name}</span>
                        </div>
                    </div>
                  </TableCell>
                  <td className="px-4 py-2 font-code">{t.amount.toLocaleString(undefined, { maximumFractionDigits: 4})}</td>
                  <td className="px-4 py-2 font-code">${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price > 0.01 ? 2 : 6 })}</td>
                  <td className="px-4 py-2 text-right font-code">{formatCurrency(t.valueUSD)}</td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}
