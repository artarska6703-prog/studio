'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface BalanceCardProps {
  balance: number;
  balanceUSD: number;
  className?: string;
}

export function BalanceCard({ balance, balanceUSD, className }: BalanceCardProps) {
    const [displayBalance, setDisplayBalance] = useState(balance);

    useEffect(() => {
      setDisplayBalance(balance);
    }, [balance]);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-lg font-medium text-muted-foreground">
          SOL Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold font-headline fade-in-short" key={displayBalance}>
          {displayBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
          <span className="text-2xl text-muted-foreground ml-2">SOL</span>
        </div>
        <p className="text-lg text-muted-foreground mt-2">{formatCurrency(balanceUSD)}</p>
      </CardContent>
    </Card>
  );
}
