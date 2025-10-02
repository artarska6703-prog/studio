'use client';

import { Button } from '../ui/button';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataSet, Network, Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { FlattenedTransaction, WalletDetails, AddressNameAndTags } from '@/lib/types';
import { GraphNode, GraphLink } from './wallet-relationship-graph-utils';
import { processTransactions, groupStyles } from './wallet-relationship-graph-utils';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { WalletDetailSheet } from './wallet-detail-sheet';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency, cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

export type DiagnosticData = {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface WalletNetworkGraphProps {
  walletAddress: string;
  transactions: FlattenedTransaction[];
  walletDetails: WalletDetails | null;
  extraWalletBalances: Record<string, number>;
  addressTags: Record<string, AddressNameAndTags>;
  onDiagnosticDataUpdate?: (data: DiagnosticData) => void;
  isLoading: boolean;
  onFetchBalances?: (addresses: string[]) => Promise<void>;
  onFetchAddressNames?: (addresses: string[]) => Promise<void>;
  allTransactions?: FlattenedTransaction[];
  setAllTransactions?: React.Dispatch<React.SetStateAction<FlattenedTransaction[]>>;
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

const CustomTooltip = ({ 
  node, 
  position
}: { 
  node: GraphNode | null; 
  position: {x: number, y: number} | null;
}) => {
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
        <div className="text-right font-mono">
          {node.balanceUSD !== null ? formatCurrency(node.balanceUSD) : 'N/A'}
        </div>
        <div className="text-muted-foreground">Transactions:</div>
        <div className="text-right font-mono">{node.transactionCount}</div>
      </div>
      {node.type !== 'root' && (
        <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground text-center">
          💡 Double-click to expand network
        </div>
      )}
    </div>
  );
};

export function WalletNetworkGraph({ 
  walletAddress, 
  transactions, 
  walletDetails, 
  extraWalletBalances, 
  addressTags, 
  onDiagnosticDataUpdate, 
  isLoading,
  onFetchBalances,
  onFetchAddressNames,
  allTransactions,
  setAllTransactions
}: WalletNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef(new DataSet<GraphNode>());
  const edgesDataSetRef = useRef(new DataSet<GraphLink>());
  
  const [minVolume, setMinVolume] = useState(0);
  const debouncedMinVolume = useDebounce(minVolume, 500);
  const [minTransactions, setMinTransactions] = useState(1);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(legendItems.map(i => i.key));
  const [selectedNodeAddress, setSelectedNodeAddress] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tooltipData, setTooltipData] = useState<{ node: GraphNode | null; position: {x: number, y: number} | null; }>({ node: null, position: null });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [isExpanding, setIsExpanding] = useState(false);
  const originalTransactionsRef = useRef<Set<string>>(new Set());

  const expandNode = async (nodeAddress: string) => {
    if (expandedNodeIds.has(nodeAddress) || nodeAddress === walletAddress) {
      return;
    }
    
    setIsExpanding(true);
    try {
      const res = await fetch(`/api/wallet/${nodeAddress}/transactions?limit=100`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      
      const data = await res.json();
      console.log(`[EXPAND] Fetched ${data.transactions.length} transactions for ${shortenAddress(nodeAddress, 4)}`);
      
      // Merge transactions
      if (setAllTransactions) {
        setAllTransactions(prev => {
          const existingSigs = new Set(prev.map(tx => tx.signature));
          const newTxs = data.transactions.filter((tx: FlattenedTransaction) => 
            !existingSigs.has(tx.signature)
          );
          console.log(`[EXPAND] Adding ${newTxs.length} new transactions`);
          return [...prev, ...newTxs];
        });
      }
      
      setExpandedNodeIds(prev => new Set([...prev, nodeAddress]));
      
      // Fetch balances
      const newAddresses = new Set<string>();
      data.transactions.forEach((tx: FlattenedTransaction) => {
        if (tx.from) newAddresses.add(tx.from);
        if (tx.to) newAddresses.add(tx.to);
      });
      
      const addressesToFetch = Array.from(newAddresses).filter(
        addr => !(addr in extraWalletBalances) && addr !== walletAddress
      );
      
      if (addressesToFetch.length > 0 && onFetchBalances) {
        await onFetchBalances(addressesToFetch);
      }
      
      if (onFetchAddressNames) {
        const addressesToFetchTags = Array.from(newAddresses).filter(
          addr => !(addr in addressTags)
        );
        if (addressesToFetchTags.length > 0) {
          await onFetchAddressNames(addressesToFetchTags);
        }
      }
    } catch (e) {
      console.error('[EXPAND] Error:', e);
    } finally {
      setIsExpanding(false);
    }
  };

const allGraphData = useMemo(() => {
  const txs = allTransactions || transactions;
  
  if (originalTransactionsRef.current.size === 0) {
    originalTransactionsRef.current = new Set(txs.map(tx => tx.signature));
  }
  
  const data = processTransactions(
    txs, 
    walletAddress, 
    5, 
    walletDetails, 
    extraWalletBalances, 
    expandedNodeIds, 
    {}, 
    addressTags
  );
  
 const nodesWithExpandedIndicator = data.nodes.map(node => ({
  ...node,
  borderWidth: expandedNodeIds.has(node.id) ? 5 : 2,
  color: expandedNodeIds.has(node.id) 
    ? (typeof node.color === 'string' 
        ? { background: node.color, border: '#10b981', highlight: { border: '#10b981', background: node.color } }
        : { ...node.color, border: '#10b981', highlight: { border: '#10b981', background: node.color?.background || '#888' } }
      )
    : node.color,
  shadow: expandedNodeIds.has(node.id)
    ? { enabled: true, color: '#10b981', size: 25, x: 0, y: 0 }
    : { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10, x: 5, y: 5 }
}));
  
  return { nodes: nodesWithExpandedIndicator, links: data.links };
}, [allTransactions, transactions, walletAddress, walletDetails, extraWalletBalances, expandedNodeIds, addressTags]);

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

    const filteredLinks = allGraphData.links.filter(link => 
        visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to)
    );
    
    const nodesInVisibleLinks = new Set<string>();
    filteredLinks.forEach(link => {
        nodesInVisibleLinks.add(link.from);
        nodesInVisibleLinks.add(link.to);
    });
    
    nodesInVisibleLinks.add(walletAddress);

    const finalNodes = allGraphData.nodes.filter(node => nodesInVisibleLinks.has(node.id));

    return { nodes: finalNodes, links: filteredLinks };
  }, [allGraphData, debouncedMinVolume, minTransactions, visibleNodeTypes, walletAddress]);

  useEffect(() => {
    if (onDiagnosticDataUpdate) {
        onDiagnosticDataUpdate({ nodes, links });
    }
  }, [nodes, links, onDiagnosticDataUpdate]);

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

  useEffect(() => {
      if (!networkRef.current) return;

      const currentNodes = nodesDataSetRef.current.get({ returnType: 'Object' });
      const nodesToAdd = [];
      const nodesToUpdate = [];
      const nodesToRemove = new Set(Object.keys(currentNodes));

      for (const node of nodes) {
        if (currentNodes[node.id]) {
            nodesToUpdate.push(node);
        } else {
            nodesToAdd.push(node);
        }
        nodesToRemove.delete(node.id);
      }
      
      if(nodesToAdd.length > 0) nodesDataSetRef.current.add(nodesToAdd);
      if(nodesToUpdate.length > 0) nodesDataSetRef.current.update(nodesToUpdate);
      if(nodesToRemove.size > 0) nodesDataSetRef.current.remove(Array.from(nodesToRemove));
      
      const currentEdges = edgesDataSetRef.current.get({ returnType: 'Object' });
      const edgesToAdd = [];
      const edgesToUpdate = [];
      const edgesToRemove = new Set(Object.keys(currentEdges));

      for (const link of links) {
        const edgeId = `${link.from}-${link.to}`;
        if (currentEdges[edgeId]) {
            edgesToUpdate.push({id: edgeId, ...link});
        } else {
            edgesToAdd.push({id: edgeId, ...link});
        }
        edgesToRemove.delete(edgeId);
      }
      
      if(edgesToAdd.length > 0) edgesDataSetRef.current.add(edgesToAdd);
      if(edgesToUpdate.length > 0) edgesDataSetRef.current.update(edgesToUpdate);
      if(edgesToRemove.size > 0) edgesDataSetRef.current.remove(Array.from(edgesToRemove));

      if (nodesToAdd.length > 0 || nodesToRemove.size > 0) {
        networkRef.current.setOptions({ physics: { enabled: true } });
        networkRef.current.stabilize(200);
      }
  }, [nodes, links]);

  useEffect(() => {
    if (!containerRef.current || isLoading) {
      return;
    }
    
    const options: Options = {
        autoResize: true,
        height: '100%',
        width: '100%',
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -30000,
            centralGravity: 0.3,
            springLength: 95,
            springConstant: 0.04,
            damping: 0.09,
            avoidOverlap: 0.5
          }
        },
        nodes: {
            font: { size: 14, face: 'Inter', color: '#fff', strokeWidth: 3, strokeColor: '#252525' },
            scaling: { 
              min: 10, 
              max: 80, 
              label: { enabled: false }
            },
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
    
    nodesDataSetRef.current = new DataSet(nodes);
    edgesDataSetRef.current = new DataSet(links);

    const networkInstance = new Network(containerRef.current, {
      nodes: nodesDataSetRef.current,
      edges: edgesDataSetRef.current
    }, options);

    networkInstance.on('stabilizationIterationsDone', () => {
      networkInstance.setOptions({ physics: false });
    });
    
let clickTimeout: NodeJS.Timeout | null = null;

networkInstance.on('click', ({ nodes: clickedNodes }) => {
    if (clickedNodes.length > 0) {
        // Delay single-click to allow double-click to be detected
        clickTimeout = setTimeout(() => {
            setSelectedNodeAddress(clickedNodes[0]);
            setIsSheetOpen(true);
        }, 250);
    }
});

networkInstance.on('doubleClick', ({ nodes: clickedNodes }) => {
    // Cancel the single-click if double-click happens
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
    
    if (clickedNodes.length > 0 && clickedNodes[0] !== walletAddress) {
        console.log(`[EXPAND] Double-clicked node: ${shortenAddress(clickedNodes[0], 4)}`);
        expandNode(clickedNodes[0]);
    }
});

    networkInstance.on('hoverNode', ({ node, event }) => {
      const result = nodesDataSetRef.current.get(node);
      const foundNode = Array.isArray(result) ? result[0] : result;
      if (foundNode && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipData({ node: foundNode as GraphNode, position: { x: event.clientX - rect.left + 15, y: event.clientY - rect.top + 15 } });
      }
    });

    networkInstance.on('blurNode', () => setTooltipData({ node: null, position: null }));
    networkInstance.on('dragStart', () => setTooltipData({ node: null, position: null }));
    
    networkRef.current = networkInstance;

    return () => {
      if (networkInstance) {
          networkInstance.destroy();
          networkRef.current = null;
      }
    }
  }, [isLoading, nodes, links, walletAddress]);

  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-0 p-0">
        <div className="md:col-span-3 p-6 overflow-y-auto max-h-[800px]">
          <div className="space-y-6">
            <h4 className="font-semibold">Graph Filters</h4>
            <Label>Min Interaction Volume (USD): ${minVolume}</Label>
            <Slider value={[minVolume]} onValueChange={v => setMinVolume(v[0])} min={0} max={100000} step={1000} />
            <Label>Min Transactions: {minTransactions}</Label>
            <Slider value={[minTransactions]} onValueChange={v => setMinTransactions(v[0])} min={1} max={50} step={1} />
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
            
            <Separator />
            {expandedNodeIds.size > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Expanded Nodes</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {expandedNodeIds.size} node{expandedNodeIds.size !== 1 ? 's' : ''} expanded
                </p>
                <Button
  onClick={() => {
    setExpandedNodeIds(new Set());
    if (setAllTransactions) {
      setAllTransactions(prev => 
        prev.filter(tx => originalTransactionsRef.current.has(tx.signature))
      );
    }
  }}
  variant="outline"
  size="sm"
  className="w-full"
>
  Collapse All
</Button>
              </div>
            )}
            
          </div>
        </div>
        <div className="md:col-span-9 h-[800px] relative">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
                <Skeleton className="w-full h-full" />
            </div>
          ) : (
            <div ref={containerRef} className="w-full h-full" />
          )}
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