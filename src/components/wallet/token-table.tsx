
// src/components/wallet/token-table.tsx
import type { TokenHolding } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

  const formatUSD = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD" });

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
                  <TableCell className="font-medium">{t.symbol}</TableCell>
                  <td className="px-4 py-2">{t.amount.toLocaleString()}</td>
                  <td className="px-4 py-2">${t.price.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{formatUSD(t.valueUSD)}</td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}
