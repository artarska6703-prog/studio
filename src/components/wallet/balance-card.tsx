// src/components/wallet/balance-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface BalanceCardProps {
  balance: number;
  balanceUSD: number;
}

export function BalanceCard({ balance, balanceUSD }: BalanceCardProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium text-muted-foreground">
          SOL Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold font-headline">
          {balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
          <span className="text-2xl text-muted-foreground ml-2">SOL</span>
        </div>
        <p className="text-lg text-muted-foreground mt-2">{formatCurrency(balanceUSD)}</p>
      </CardContent>
    </Card>
  );
}
