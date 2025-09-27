'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataSet, Network, Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { Transaction, WalletDetails } from '@/lib/types';
import { GraphNode, GraphLink } from './wallet-relationship-graph-utils';
import { processTransactions, groupStyles, PhysicsState } from './wallet-relationship-graph-utils';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { WalletDetailSheet } from './wallet-detail-sheet';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency, cn } from '@/lib/utils';
import { Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export type DiagnosticData = {
  nodes: GraphNode[];
  links: GraphLink[];
  physics: PhysicsState;
}

interface WalletNetworkGraphProps {
  walletAddress: string;
  transactions: Transaction[];
  walletDetails: WalletDetails | null;
  extraWalletBalances: Record<string, number>;
  addressTags: Record<string, { name: string; tags: string[] }>;
  onDiagnosticDataUpdate?: (data: DiagnosticData) => void;
  isLoading: boolean;
}

export function WalletNetworkGraph({ walletAddress, transactions, walletDetails, extraWalletBalances, addressTags, onDiagnosticDataUpdate, isLoading }: WalletNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef(new DataSet<GraphNode>());
  const edgesDataSetRef = useRef(new DataSet<GraphLink>());

  const [minVolume, setMinVolume] = useState(0);
  const debouncedMinVolume = useDebounce(minVolume, 500);
  const [minTransactions, setMinTransactions] = useState(1);
  const [selectedNodeAddress, setSelectedNodeAddress] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const graphData = useMemo(() => {
    return processTransactions(transactions, walletAddress, 5, walletDetails, extraWalletBalances, new Set(), {}, addressTags);
  }, [transactions, walletAddress, walletDetails, extraWalletBalances, addressTags]);

  const { nodes, links } = useMemo(() => {
    const visibleNodes = graphData.nodes.filter(n => (n.balanceUSD ?? 0) >= debouncedMinVolume && n.transactionCount >= minTransactions);
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleLinks = graphData.links.filter(l => visibleNodeIds.has(l.from) && visibleNodeIds.has(l.to));
    return { nodes: visibleNodes, links: visibleLinks };
  }, [graphData, debouncedMinVolume, minTransactions]);

  useEffect(() => {
    if (onDiagnosticDataUpdate) {
      onDiagnosticDataUpdate({ nodes, links, physics: { solver: 'barnesHut', gravitationalConstant: -30000, centralGravity: 0.9, springLength: 70, springConstant: 0.06, damping: 0.09, avoidOverlap: 0.8 } });
    }
  }, [nodes, links, onDiagnosticDataUpdate]);

  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    nodesDataSetRef.current = new DataSet(nodes);
    edgesDataSetRef.current = new DataSet(links);

    const network = new Network(containerRef.current, {
      nodes: nodesDataSetRef.current,
      edges: edgesDataSetRef.current
    }, {
      autoResize: true,
      height: '100%',
      width: '100%',
      nodes: {
        shape: 'dot',
        font: { size: 14, face: 'Inter', color: '#fff', strokeWidth: 3, strokeColor: '#252525' },
        borderWidth: 2,
      },
      edges: {
        smooth: true,
        color: { color: '#aaa' },
        arrows: { to: { enabled: true } }
      },
      groups: groupStyles,
      interaction: { hover: true, tooltipDelay: 0 },
      physics: {
        enabled: true,
        solver: 'barnesHut',
        gravitationalConstant: -30000,
        centralGravity: 0.9,
        springLength: 70,
        springConstant: 0.06,
        damping: 0.09,
        avoidOverlap: 0.8
      }
    });

    network.on('click', ({ nodes: selected }) => {
      if (selected.length > 0) {
        setSelectedNodeAddress(selected[0]);
        setIsSheetOpen(true);
      }
    });

    networkRef.current = network;

    return () => network?.destroy();
  }, [nodes, links, isLoading]);

  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-0 p-0">
        <div className="md:col-span-3 p-6">
          <Label>Min Volume (USD): ${minVolume}</Label>
          <Slider value={[minVolume]} onValueChange={v => setMinVolume(v[0])} min={0} max={100000} step={1000} />
          <Label>Min Transactions: {minTransactions}</Label>
          <Slider value={[minTransactions]} onValueChange={v => setMinTransactions(v[0])} min={1} max={50} step={1} />
          <Separator className="my-4" />
        </div>
        <div className="md:col-span-9 h-[800px] relative">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <div ref={containerRef} className="w-full h-full" />
          )}
        </div>
      </CardContent>
      {selectedNodeAddress && (
        <WalletDetailSheet address={selectedNodeAddress} open={isSheetOpen} onOpenChange={setIsSheetOpen} />
      )}
    </Card>
  );
}
