

'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletDetails } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

interface PortfolioCompositionChartProps {
  walletDetails: WalletDetails | null;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--accent))',
];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Asset
              </span>
              <span className="font-bold text-muted-foreground">{data.name}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Value (USD)
              </span>
              <span className="font-bold">
                {formatCurrency(data.value)}
              </span>
            </div>
          </div>
        </div>
      );
    }
  
    return null;
};

export function PortfolioCompositionChart({ walletDetails }: PortfolioCompositionChartProps) {
    const chartData = useMemo(() => {
        if (!walletDetails) return [];

        const data = [];
        if (walletDetails.sol.valueUSD && walletDetails.sol.valueUSD > 0) {
            data.push({ name: 'SOL', value: walletDetails.sol.valueUSD });
        }

        walletDetails.tokens.forEach(token => {
            if (token.valueUSD && token.valueUSD > 1) { // Only include tokens with some value
                data.push({ name: token.symbol, value: token.valueUSD });
            }
        });
        
        return data.sort((a,b) => b.value - a.value);

    }, [walletDetails]);

    const totalValue = useMemo(() => chartData.reduce((sum, item) => sum + item.value, 0), [chartData]);
    
    if (!walletDetails) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Portfolio Composition</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="w-full h-[350px]" />
                </CardContent>
            </Card>
        )
    }

    if (chartData.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Portfolio Composition</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] flex items-center justify-center">
                    <p className="text-muted-foreground">No significant holdings to display.</p>
                </CardContent>
            </Card>
        )
    }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Composition</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={120}
                        innerRadius={80}
                        paddingAngle={2}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="hsl(var(--background))"
                        strokeWidth={4}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                     <Legend 
                        verticalAlign="middle" 
                        align="right" 
                        layout="vertical"
                        iconSize={10}
                        wrapperStyle={{
                            paddingLeft: '40px'
                        }}
                        formatter={(value, entry) => {
                            const { color, payload } = entry;
                            const percent = totalValue > 0 ? (payload.value / totalValue) * 100 : 0;
                            return (
                                <span style={{ color: 'hsl(var(--foreground))' }}>
                                    <span className="font-bold">{value}</span>
                                    <span className="text-muted-foreground ml-2">{percent.toFixed(1)}%</span>
                                </span>
                            );
                        }}
                     />
                </PieChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
