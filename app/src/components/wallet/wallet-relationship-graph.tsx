'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DataSet, Network, Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { WalletDetails, FlattenedTransaction } from '@/lib/types';
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
import { LocalTag } from '@/lib/tag-store';
import { Badge } from '../ui/badge';

export type DiagnosticData = {
  nodes: GraphNode[];
  links: GraphLink[];
  physics: PhysicsState;
}

interface WalletNetworkGraphProps {
    walletAddress: string;
    transactions: FlattenedTransaction[];
    walletDetails: WalletDetails | null;
    extraWalletBalances: Record<string, number>;
    addressTags: Record<string, LocalTag>;
    onDiagnosticDataUpdate?: (data: DiagnosticData) => void;
    isLoading: boolean;
    onTagUpdate: () => void;
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
        {node.label}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div className="text-muted-foreground">Type:</div>
        <div className="text-right font-mono">{node.type}</div>
        <div className="text-muted-foreground">Balance:</div>
        <div className="text-right font-mono">{node.balance.toFixed(2)} SOL</div>
        <div className="text-muted-foreground">Value (USD):</div>
        <div className="text-right font-mono">{node.balanceUSD !== null ? formatCurrency(node.balanceUSD) : 'N/A'}</div>
        <div className="text-muted-foreground">Transactions:</div>
        <div className="text-right font-mono">{node.transactionCount}</div>
      </div>
      {node.labels && node.labels.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
              <div className="text-muted-foreground text-xs mb-1">Behavioral Tags:</div>
              <div className="flex flex-wrap gap-1">
                  {node.labels.map(label => (
                      <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export function WalletNetworkGraph({ walletAddress, transactions, walletDetails, extraWalletBalances, addressTags, onDiagnosticDataUpdate, isLoading, onTagUpdate }: WalletNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef(new DataSet<GraphNode>());
  const edgesDataSetRef = useRef(new DataSet<GraphLink>());
  
  const [minVolume, setMinVolume] = useState(0);
  const debouncedMinVolume = useDebounce(minVolume, 500);
  const [minTransactions, setMinTransactions] = useState(1);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(legendItems.map(i => i.key));
  const [selectedNodeAddress, setSelectedNodeAddress] = useState<string | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<WalletDetails | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tooltipData, setTooltipData] = useState<{ node: GraphNode | null; position: {x: number, y: number} | null; }>({ node: null, position: null });
  const [physics, setPhysics] = useState<PhysicsState>({
    solver: 'barnesHut',
    gravitationalConstant: -30000,
    centralGravity: 0.9,
    springLength: 70,
    springConstant: 0.06,
    damping: 0.09,
    avoidOverlap: 0.8,
  });

  const allGraphData = useMemo(() => {
    return processTransactions(transactions, walletAddress, 5, walletDetails, extraWalletBalances, new Set(), {}, addressTags);
  }, [transactions, walletAddress, walletDetails, extraWalletBalances, addressTags]);


  const { nodes, links } = useMemo(() => {
    const nodesWithFilters = allGraphData.nodes.filter(node => {
        const isRoot = node.id === walletAddress;
        
        const passesFilters = 
            (node.balanceUSD ?? 0) >= debouncedMinVolume &&
            node.transactionCount >= minTransactions &&
            (visibleNodeTypes.includes(node.type) || groupStyles[node.type] === undefined || isRoot);

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
        onDiagnosticDataUpdate({ nodes, links, physics });
    }
  }, [nodes, links, physics, onDiagnosticDataUpdate]);

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
          ...physics
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
            smooth: { enabled: true, type: 'dynamic' },
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
    
    networkInstance.on('click', async ({ nodes: clickedNodes }) => {
        if (clickedNodes.length > 0) {
            setSelectedNodeAddress(clickedNodes[0]);
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
      if (networkInstance) {
          networkInstance.destroy();
          networkRef.current = null;
      }
    }
  }, [isLoading, physics, nodes, links]);


  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-0 p-0">
        <div className="md:col-span-3 p-6 overflow-y-auto max-h-[800px]">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Graph Filters</h4>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Settings className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Physics Controls</h4>
                                <p className="text-sm text-muted-foreground">
                                    Fine-tune the graph layout simulation.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="grav-const">Gravity</Label>
                                    <Slider
                                        id="grav-const"
                                        value={[physics.gravitationalConstant]}
                                        onValueChange={(v) => setPhysics(p => ({...p, gravitationalConstant: v[0]}))}
                                        min={-50000}
                                        max={0}
                                        step={1000}
                                        className="col-span-2"
                                    />
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="central-grav">Central Pull</Label>
                                    <Slider
                                        id="central-grav"
                                        value={[physics.centralGravity]}
                                        onValueChange={(v) => setPhysics(p => ({...p, centralGravity: v[0]}))}
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        className="col-span-2"
                                    />
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="spring-len">Spring Length</Label>
                                    <Slider
                                        id="spring-len"
                                        value={[physics.springLength]}
                                        onValueChange={(v) => setPhysics(p => ({...p, springLength: v[0]}))}
                                        min={50}
                                        max={500}
                                        step={10}
                                        className="col-span-2"
                                    />
                                </div>
                                 <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="spring-const">Spring Stiffness</Label>
                                    <Slider
                                        id="spring-const"
                                        value={[physics.springConstant]}
                                        onValueChange={(v) => setPhysics(p => ({...p, springConstant: v[0]}))}
                                        min={0.01}
                                        max={0.5}
                                        step={0.01}
                                        className="col-span-2"
                                    />
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="damping">Damping</Label>
                                    <Slider
                                        id="damping"
                                        value={[physics.damping]}
                                        onValueChange={(v) => setPhysics(p => ({...p, damping: v[0]}))}
                                        min={0.05}
                                        max={0.5}
                                        step={0.01}
                                        className="col-span-2"
                                    />
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
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
        <WalletDetailSheet
            address={selectedNodeAddress}
            open={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            onTagUpdate={onTagUpdate}
            details={selectedNodeDetails}
            enrichedTokens={selectedNodeDetails?.tokens ?? []}
        />
      )}
    </Card>
  );
}
