// src/components/wallet/portfolio-composition-chart.tsx
import type { TokenHolding } from "@/lib/types";

interface PortfolioCompositionChartProps {
  solValue: number;
  tokens: TokenHolding[];
}

export function PortfolioCompositionChart({ solValue, tokens }: PortfolioCompositionChartProps) {
  const data = [
    { name: "SOL", value: solValue },
    ...tokens.map((t) => ({ name: t.symbol, value: t.valueUSD })),
  ].filter((d) => d.value > 0);

  if (!data.length) {
    return <div className="p-4 rounded-lg bg-slate-800">No portfolio data to display.</div>;
  }

  const total = data.reduce((acc, d) => acc + d.value, 0);
  return (
    <div className="p-4 rounded-lg bg-slate-800 text-white space-y-2">
      <h3 className="font-bold">Portfolio Composition</h3>
      <ul className="space-y-1 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex justify-between">
            <span>{d.name}</span>
            <span>
              {(d.value / total * 100).toFixed(1)}% (${d.value.toLocaleString()})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}