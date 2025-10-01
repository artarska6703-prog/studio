'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DataSet, Network, Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { FlattenedTransaction, WalletDetails } from '@/lib/types';
import { GraphNode, GraphLink } from './wallet-relationship-graph-utils';
import { processTransactions, groupStyles, PhysicsState } from './wallet-relationship-graph-utils';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { WalletDetailSheet } from './wallet-detail-sheet';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';

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
    specificTokenBalances: Record<string, number>;
    onFetchTokenBalances: (addresses: string[], mint: string) => void;
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
        <div className="text-muted-foreground">Net Flow (USD):</div>
        <div className={cn("text-right font-mono", node.netFlow > 0 ? "text-green-500" : "text-red-500")}>
            {formatCurrency(node.netFlow)}
        </div>
      </div>
    </div>
  );
};

// Function to format large numbers into a compact representation (e.g., 1.5M)
function formatCompactNumber(num: number): string {
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(1);
}


export function WalletNetworkGraphV2({ walletAddress, transactions, walletDetails, extraWalletBalances, specificTokenBalances, onFetchTokenBalances }: WalletNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef(new DataSet<GraphNode>());
  const edgesDataSetRef = useRef(new DataSet<GraphLink>());
  const animationFrameRef = useRef<number>();
  
  const [minVolume, setMinVolume] = useState(0);
  const debouncedMinVolume = useDebounce(minVolume, 500);
  const [minTransactions, setMinTransactions] = useState(1);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(legendItems.map(i => i.key));
  const [expandedNodeIds, setExpandedNodeIds] = useState(new Set<string>());
  const [selectedNodeAddress, setSelectedNodeAddress] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tooltipData, setTooltipData] = useState<{ node: GraphNode | null; position: {x: number, y: number} | null; }>({ node: null, position: null });
  const [timelineValue, setTimelineValue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tokenFilter, setTokenFilter] = useState<string>('all');
  
  const timeRange = useMemo(() => {
    if (transactions.length === 0) return { min: 0, max: 0 };
    const blockTimes = transactions.map(tx => tx.blockTime).filter(t => t);
    if (blockTimes.length === 0) return { min: 0, max: 0 };
    const min = Math.min(...blockTimes);
    const max = Math.max(...blockTimes);
    return { min, max };
  }, [transactions]);

  useEffect(() => {
    // Set initial slider value to the max time
    setTimelineValue(timeRange.max);
  }, [timeRange.max]);

  const timeFilteredTransactions = useMemo(() => {
    if (timeRange.max === 0 || timelineValue === timeRange.max) {
      return transactions;
    }
    return transactions.filter(tx => tx.blockTime <= timelineValue);
  }, [transactions, timelineValue, timeRange.max]);

  const availableTokens = useMemo(() => {
    const tokens = new Map<string, string>();
    transactions.forEach(tx => {
      if (tx.tokenMint && tx.tokenSymbol) {
        if (!tokens.has(tx.tokenMint)) {
          tokens.set(tx.tokenMint, tx.tokenSymbol);
        }
      }
    });
    return Array.from(tokens.entries()).map(([mint, symbol]) => ({ mint, symbol }));
  }, [transactions]);

  const allGraphData = useMemo(() => {
    const filteredByToken = tokenFilter === 'all' 
        ? timeFilteredTransactions
        : timeFilteredTransactions.filter(tx => tx.tokenMint === tokenFilter || (tokenFilter === 'SOL' && tx.mint === 'So11111111111111111111111111111111111111112'));

    return processTransactions(filteredByToken, walletAddress, 7, walletDetails, extraWalletBalances, expandedNodeIds, specificTokenBalances);
  }, [timeFilteredTransactions, walletAddress, walletDetails, extraWalletBalances, expandedNodeIds, tokenFilter, specificTokenBalances]);

    useEffect(() => {
        if (tokenFilter !== 'all' && tokenFilter !== 'SOL') {
            const addressesInGraph = new Set<string>();
            allGraphData.nodes.forEach(node => addressesInGraph.add(node.id));
            onFetchTokenBalances(Array.from(addressesInGraph), tokenFilter);
        }
    }, [tokenFilter, allGraphData.nodes, onFetchTokenBalances]);

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

    const labeledLinks = filteredLinks.map(link => {
        if (tokenFilter !== 'all') {
            const tokenVolume = link.tokenVolumes.get(tokenFilter);
            if (tokenVolume) {
                return {
                    ...link,
                    label: `${formatCompactNumber(tokenVolume.amount)} ${tokenVolume.symbol}`
                };
            }
        }
        return link;
    });

    return { nodes: finalNodes, links: labeledLinks };
  }, [allGraphData, debouncedMinVolume, minTransactions, visibleNodeTypes, walletAddress, tokenFilter]);


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

  // Animation effect
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      setTimelineValue(currentValue => {
        if (currentValue >= timeRange.max) {
          setIsPlaying(false);
          return timeRange.max;
        }
        const totalDuration = timeRange.max - timeRange.min;
        const increment = (totalDuration / 30000) * deltaTime; // Animate over ~30 seconds
        return Math.min(currentValue + increment, timeRange.max);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, timeRange.min, timeRange.max]);

  const handleTimelineChange = (value: number[]) => {
    setIsPlaying(false);
    setTimelineValue(value[0]);
  };

  const handlePlayPause = () => {
    if (timelineValue >= timeRange.max) {
      setTimelineValue(timeRange.min);
    }
    setIsPlaying(prev => !prev);
  }

  const handleReset = () => {
    setIsPlaying(false);
    setTimelineValue(timeRange.max);
  }

  // Effect for updating data in the datasets
  useEffect(() => {
      if (!networkRef.current) return;

      const newNodes = new DataSet(nodes);
      const newEdges = new DataSet(links);

      const oldNodeIds = new Set(nodesDataSetRef.current.getIds());
      const newNodeIds = new Set(newNodes.getIds());

      const nodesToAdd = (newNodes.get() as GraphNode[]).filter(node => !oldNodeIds.has(node.id!));
      const nodesToUpdate = (newNodes.get() as GraphNode[]).filter(node => oldNodeIds.has(node.id!));
      const nodesToRemove = Array.from(oldNodeIds).filter(id => !newNodeIds.has(id));
      
      if (nodesToAdd.length > 0) nodesDataSetRef.current.add(nodesToAdd);
      if (nodesToUpdate.length > 0) nodesDataSetRef.current.update(nodesToUpdate);
      if (nodesToRemove.length > 0) nodesDataSetRef.current.remove(nodesToRemove);

      const oldEdgeIds = new Set(edgesDataSetRef.current.getIds());
      const newEdgeIds = new Set(newEdges.getIds());
      
      const edgesToAdd = (newEdges.get() as GraphLink[]).filter(edge => !oldEdgeIds.has(edge.id!));
      const edgesToUpdate = (newEdges.get() as GraphLink[]).filter(edge => oldEdgeIds.has(edge.id!));
      const edgesToRemove = Array.from(oldEdgeIds).filter(id => !newEdgeIds.has(id));

      if (edgesToAdd.length > 0) edgesDataSetRef.current.add(edgesToAdd);
      if (edgesToUpdate.length > 0) edgesDataSetRef.current.update(edgesToUpdate);
      if (edgesToRemove.length > 0) edgesDataSetRef.current.remove(edgesToRemove);
      
  }, [nodes, links]);


  // Effect for initializing the network instance once
  useEffect(() => {
    if (!containerRef.current || networkRef.current) return;
    
    const options: Options = {
        autoResize: true,
        height: '100%',
        width: '100%',
        layout: {
            hierarchical: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                nodeSpacing: 150,
                treeSpacing: 200,
                levelSeparation: 200,
            }
        },
        physics: {
            enabled: false,
        },
        nodes: {
            font: { size: 14, face: 'Inter', color: '#fff', strokeWidth: 3, strokeColor: '#252525' },
            scaling: { min: 10, max: 80, label: { enabled: true, min: 14, max: 30, drawThreshold: 12, maxVisible: 30 } },
            borderWidth: 2,
            shape: 'dot',
            shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10, x: 5, y: 5 }
        },
        edges: {
            smooth: { enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
            color: { color: 'rgba(255,255,255,0.2)', highlight: 'rgba(255,255,255,0.5)' },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            scaling: {
              min: 1,
              max: 15,
            },
            width: 0.5,
            font: {
              color: '#a1a1aa',
              size: 12,
              face: 'Inter',
              strokeWidth: 2,
              strokeColor: '#27272a',
              align: 'middle'
            }
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
            setExpandedNodeIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(clickedId)) {
                } else {
                    newSet.add(clickedId);
                }
                return newSet;
            });
        }
    });
    
    networkInstance.on('doubleClick', ({ nodes: dblClickedNodes }) => {
        if (dblClickedNodes.length > 0) {
            setSelectedNodeAddress(dblClickedNodes[0]);
            setIsSheetOpen(true);
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
      networkInstance.destroy();
      networkRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  return (
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-0 p-0">
        <div className="md:col-span-3 p-6 overflow-y-auto max-h-[800px]">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-4">Graph Filters</h4>
               <div className="space-y-4">
                  <Select value={tokenFilter} onValueChange={setTokenFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by token..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Tokens</SelectLabel>
                        <SelectItem value="all">All Tokens</SelectItem>
                        <SelectItem value="SOL">SOL</SelectItem>
                        {availableTokens.map(token => (
                          <SelectItem key={token.mint} value={token.mint}>
                            {token.symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div>
                    <Label>Min Interaction Volume (USD): ${minVolume}</Label>
                    <Slider value={[minVolume]} onValueChange={v => setMinVolume(v[0])} min={0} max={100000} step={1000} />
                  </div>
                  <div>
                    <Label>Min Transactions: {minTransactions}</Label>
                    <Slider value={[minTransactions]} onValueChange={v => setMinTransactions(v[0])} min={1} max={50} step={1} />
                  </div>
              </div>
            </div>
            <Separator />
             <div>
              <h4 className="font-semibold mb-4">Time Travel</h4>
              <Label>Date: {timelineValue > 0 ? format(new Date(timelineValue * 1000), 'PPp') : 'N/A'}</Label>
              <Slider 
                value={[timelineValue]} 
                onValueChange={handleTimelineChange} 
                min={timeRange.min} 
                max={timeRange.max} 
                step={3600} // 1 hour steps
                disabled={timeRange.max === 0}
              />
              <div className="flex items-center gap-2 mt-2">
                  <Button onClick={handlePlayPause} size="sm" variant="outline" disabled={timeRange.max === 0}>
                    {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button onClick={handleReset} size="sm" variant="outline" disabled={timeRange.max === 0}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-4">Filter by Type</h4>
              {legendItems.filter(i => i.key !== 'root').map(item => (
                <div key={item.key} className="flex items-center space-x-2 my-1">
                  <Checkbox 
                    id={`filter-${item.key}-v2`}
                    checked={visibleNodeTypes.includes(item.key)} 
                    onCheckedChange={checked => handleNodeTypeToggle(item.key, !!checked)} 
                   />
                  <Label htmlFor={`filter-${item.key}-v2`} className="text-sm font-normal">{item.label}</Label>
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