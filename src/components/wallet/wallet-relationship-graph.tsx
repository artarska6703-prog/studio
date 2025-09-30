// src/components/wallet/wallet-relationship-graph.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { DataSet, Network, Options } from "vis-network/standalone/esm/vis-network";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { Transaction, WalletDetails } from "@/lib/types";
import { GraphNode, GraphLink, processTransactions, groupStyles, AddressNameAndTags } from "./wallet-relationship-graph-utils";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { WalletDetailSheet } from "./wallet-detail-sheet";
import { shortenAddress } from "@/lib/solana-utils";
import { formatCurrency, cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

type WalletNetworkGraphProps = {
  walletAddress: string;
  transactions: Transaction[];
  walletDetails: WalletDetails | null;
  extraWalletBalances: Record<string, number>;
  addressTags: Record<string, AddressNameAndTags>;
  isLoading: boolean;
};

const CustomTooltip = ({ node, position }: { node: GraphNode | null; position: { x: number; y: number } | null }) => {
  if (!node || !position) return null;
  return (
    <div
      className={cn(
        "absolute p-3 rounded-lg shadow-lg text-xs w-64 z-10 pointer-events-none",
        "bg-popover text-popover-foreground border"
      )}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <div className="font-bold border-b border-border pb-1 mb-2 capitalize">
        {node.type}: {shortenAddress(node.id, 6)}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div className="text-muted-foreground">Balance:</div>
        <div className="text-right font-mono">{node.balance.toFixed(2)} SOL</div>
        <div className="text-muted-foreground">Value (USD):</div>
        <div className="text-right font-mono">{node.balanceUSD !== null ? formatCurrency(node.balanceUSD) : "N/A"}</div>
        <div className="text-muted-foreground">Transactions:</div>
        <div className="text-right font-mono">{node.transactionCount}</div>
      </div>
    </div>
  );
};

export function WalletNetworkGraph({
  walletAddress,
  transactions,
  walletDetails,
  extraWalletBalances,
  addressTags,
  isLoading,
}: WalletNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const allGraphData = useMemo(() => {
    return processTransactions(transactions, walletAddress, 5, walletDetails, extraWalletBalances, new Set(), {}, addressTags);
  }, [transactions, walletAddress, walletDetails, extraWalletBalances, addressTags]);

  const { nodes, links } = allGraphData;

  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const options: Options = {
      autoResize: true,
      height: "100%",
      width: "100%",
      physics: { enabled: true },
      nodes: {
        font: { size: 14, face: "Inter", color: "#fff", strokeWidth: 3, strokeColor: "#252525" },
        scaling: { min: 10, max: 80, label: { enabled: false } },
        borderWidth: 2,
        shape: "dot",
      },
      edges: {
        smooth: { enabled: true, type: "dynamic" },
        color: { color: "rgba(255,255,255,0.2)", highlight: "rgba(255,255,255,0.5)" },
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
      },
      groups: groupStyles,
      interaction: { hover: true },
    };

    // ✅ Deduplicate edges
    const seen = new Map<string, GraphLink>();
    for (const link of links) {
      if (seen.has(link.id)) {
        seen.get(link.id)!.value += link.value;
      } else {
        seen.set(link.id, { ...link });
      }
    }
    const dedupedLinks = Array.from(seen.values());

    const networkInstance = new Network(
      containerRef.current,
      { nodes: new DataSet(nodes), edges: new DataSet(dedupedLinks) },
      options
    );

    networkRef.current = networkInstance;

    return () => {
      networkInstance.destroy();
    };
  }, [nodes, links, isLoading]);

  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent>
        <div className="h-[800px] relative">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
              <Skeleton className="w-full h-full" />
            </div>
          ) : (
            <div ref={containerRef} className="w-full h-full" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
