
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useRouter } from 'next/navigation';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency, cn } from '@/lib/utils';
import { Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';

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
    onDiagnosticDataUpdate?: (data: DiagnosticData) => void;
}


const legendItems = [
  { key: 'root', label: 'You' },
  { key: 'exchange', label: 'Exchange' },
  { key: 'platform', label: 'DEX/Platform' },
  { key: 'whale', label: 'Whale (>$100k)' },
  { key: 'shark', label: 'Shark ($50k-$100k)' },
  { key: 'dolphin', label: 'Dolphin ($10k-$50k)' },
  { key: 'fish', label: 'Fish ($1k-$10k)' },
  { key: 'shrimp', label: 'Shrimp (<$1k)' },
  { key: 'bridge', label: 'Bridge' },
];

const GraphLegend = () => (
  <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg border border-border/50">
    <h4 className="font-semibold text-foreground text-sm mb-3">Legend</h4>
    <div className="space-y-2">
      {legendItems.map(item => {
        const style = groupStyles[item.key];
        const color = typeof style.color === 'string' ? style.color : style.color?.background ?? '#888';
        return (
          <div key={item.key} className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground capitalize">{item.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const CustomTooltip = ({ node, position }: { node: GraphNode | null, position: {x: number, y: number} | null }) => {
  if (!node || !position) return null;
  return (
    <div className={cn("absolute p-3 rounded-lg shadow-lg text-xs w-64 z-10 pointer-events-none", "bg-popover text-popover-foreground border")} style={{ left: `${position.x}px`, top: `${position.y}px` }}>
      <div className="font-bold border-b border-border pb-1 mb-2 capitalize">
        {node.type}: {shortenAddress(node.id, 6)}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div className="text-muted-foreground">Balance:</div>
        <div className="text-right font-mono">{node.balance.toFixed(2)} SOL</div>
        <div className="text-muted-foreground">Value (USD):</div>
        <div className="text-right font-mono">{node.balanceUSD !== null ? formatCurrency(node.balanceUSD) : 'N/A'}</div>
        <div className="text-muted-foreground">Transactions:</div>
        <div className="text-right font-mono">{node.transactionCount}</div>
      </div>
    </div>
  );
};

export function WalletNetworkGraph({ walletAddress, transactions, walletDetails, extraWalletBalances, onDiagnosticDataUpdate }: WalletNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef(new DataSet<GraphNode>());
  const edgesDataSetRef = useRef(new DataSet<GraphLink>());
  
  const [maxDepth, setMaxDepth] = useState(3);
  const [minVolume, setMinVolume] = useState(0);
  const debouncedMinVolume = useDebounce(minVolume, 500);
  const [minTransactions, setMinTransactions] = useState(1);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(legendItems.map(i => i.key));
  const [expandedNodeIds, setExpandedNodeIds] = useState(new Set<string>());
  const [physicsState, setPhysicsState] = useState<PhysicsState>({ solver: "barnesHut", gravitationalConstant: -8000, centralGravity: 0.1, springLength: 120, springConstant: 0.08, damping: 0.09, avoidOverlap: 0.7 });
  const [selectedNodeAddress, setSelectedNodeAddress] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tooltipData, setTooltipData] = useState<{ node: GraphNode | null; position: {x: number, y: number} | null; }>({ node: null, position: null });

  const allGraphData = useMemo(() => {
    return processTransactions(transactions, walletAddress, 5, walletDetails, extraWalletBalances, expandedNodeIds);
  }, [transactions, walletAddress, walletDetails, extraWalletBalances, expandedNodeIds]);


  const { nodes, links } = useMemo(() => {
    const nodesWithFilters = allGraphData.nodes.filter(node => {
        const isRoot = node.id === walletAddress;
        
        const passesFilters = 
            (node.balanceUSD ?? 0) >= debouncedMinVolume &&
            node.transactionCount >= minTransactions &&
            (visibleNodeTypes.includes(node.type) || isRoot);

        return passesFilters;
    });

    const visibleNodeIds = new Set(nodesWithFilters.map(n => n.id));

    // Filter links to only include those between visible nodes
    const filteredLinks = allGraphData.links.filter(link => 
        visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to)
    );
    
    // Determine the final set of nodes to display: all nodes that pass filters AND any nodes that are part of a visible link
    const nodesInVisibleLinks = new Set<string>();
    filteredLinks.forEach(link => {
        nodesInVisibleLinks.add(link.from);
        nodesInVisibleLinks.add(link.to);
    });

    const finalNodes = allGraphData.nodes.filter(node => nodesInVisibleLinks.has(node.id));

    return { nodes: finalNodes, links: filteredLinks };
  }, [allGraphData, debouncedMinVolume, minTransactions, visibleNodeTypes, walletAddress]);


  useEffect(() => {
    if (onDiagnosticDataUpdate) {
      onDiagnosticDataUpdate({ nodes, links, physics: physicsState });
    }
  }, [nodes, links, physicsState, onDiagnosticDataUpdate]);

  const handleNodeTypeToggle = (key: string, checked: boolean) => {
    setVisibleNodeTypes(prev => {
      const newSet = new Set(prev);
      if(checked) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return Array.from(newSet);
    })
  }

  // Effect for updating data in the datasets
  useEffect(() => {
    nodesDataSetRef.current.clear();
    edgesDataSetRef.current.clear();
    nodesDataSetRef.current.add(nodes);
    edgesDataSetRef.current.add(links);
  }, [nodes, links]);


  // Effect for initializing and managing the network instance
  useEffect(() => {
    if (!containerRef.current) return;
    
    const options: Options = {
        autoResize: true,
        height: '100%',
        width: '100%',
        physics: { ...physicsState, stabilization: { enabled: true, iterations: 1000, fit: true } },
        nodes: {
            font: { size: 14, face: 'Inter', color: '#fff', strokeWidth: 3, strokeColor: '#252525' },
            scaling: { min: 10, max: 80, label: { enabled: true, min: 14, max: 30, drawThreshold: 12, maxVisible: 30 } },
            borderWidth: 2,
            shape: 'dot',
            shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10, x: 5, y: 5 }
        },
        edges: {
            smooth: { enabled: true, type: 'dynamic', roundness: 0.5 },
            color: { color: 'rgba(255,255,255,0.2)', highlight: 'rgba(255,255,255,0.5)' },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        },
        groups: groupStyles,
        interaction: { hover: true, tooltipDelay: 0, dragNodes: true, dragView: true, zoomView: true }
    };

    const networkInstance = new Network(containerRef.current, {
      nodes: nodesDataSetRef.current,
      edges: edgesDataSetRef.current
    }, options);
    
    networkInstance.on('click', ({ nodes: clickedNodes }) => {
      if (clickedNodes.length > 0) {
        const clickedId = clickedNodes[0];
        setExpandedNodeIds(prev => new Set(prev).add(clickedId));
      }
    });

    networkInstance.on('doubleClick', ({ nodes: doubleClickedNodes }) => {
      if (doubleClickedNodes.length > 0) {
        setSelectedNodeAddress(doubleClickedNodes[0]);
        setIsSheetOpen(true);
      }
    });

    networkInstance.on('hoverNode', ({ node, event }) => {
      const foundNode = nodesDataSetRef.current.get(node);
      if (foundNode && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipData({ node: foundNode, position: { x: event.clientX - rect.left + 15, y: event.clientY - rect.top + 15 } });
      }
    });

    networkInstance.on('blurNode', () => setTooltipData({ node: null, position: null }));
    networkInstance.on('dragStart', () => setTooltipData({ node: null, position: null }));
    
    networkRef.current = networkInstance;

    return () => {
      networkInstance.destroy();
      networkRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicsState]); // Re-initialize only if physics change

  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-0 p-0">
        <div className="md:col-span-3 p-6 overflow-y-auto max-h-[800px]">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-4">Graph Filters</h4>
              <Label>Min Interaction Volume (USD): ${minVolume}</Label>
              <Slider value={[minVolume]} onValueChange={v => setMinVolume(v[0])} min={0} max={10000} step={100} />
              <Label>Min Transactions: {minTransactions}</Label>
              <Slider value={[minTransactions]} onValueChange={v => setMinTransactions(v[0])} min={1} max={50} step={1} />
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-4">Filter by Type</h4>
              {legendItems.filter(i => i.key !== 'root').map(item => (
                <div key={item.key} className="flex items-center space-x-2 my-1">
                  <Checkbox 
                    id={`filter-${item.key}`}
                    checked={visibleNodeTypes.includes(item.key)} 
                    onCheckedChange={checked => handleNodeTypeToggle(item.key, !!checked)} 
                   />
                  <Label htmlFor={`filter-${item.key}`} className="text-sm font-normal">{item.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-9 h-[800px] relative">
          <div ref={containerRef} className="w-full h-full" />
          <GraphLegend />
          <CustomTooltip node={tooltipData.node} position={tooltipData.position} />
        </div>
      </CardContent>
      {selectedNodeAddress && (
        <WalletDetailSheet address={selectedNodeAddress} open={isSheetOpen} onOpenChange={setIsSheetOpen} />
      )}
    </Card>
  );
}
