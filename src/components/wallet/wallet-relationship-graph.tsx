

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataSet, Network, Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { Transaction } from '@/lib/types';
import { WalletDetailSheet } from './wallet-detail-sheet';
import { GraphNode, GraphLink, PhysicsState } from './wallet-relationship-graph-utils';
import { processTransactions, groupStyles } from './wallet-relationship-graph-utils';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const legendItems = [
    { key: 'root', label: 'You' },
    { key: 'exchange', label: 'Exchange' },
    { key: 'platform', label: 'DEX/Platform' },
    { key: 'whale', label: 'Whale (>100k)' },
    { key: 'shark', label: 'Shark (50k-100k)' },
    { key: 'dolphin', label: 'Dolphin (10k-50k)' },
    { key: 'fish', label: 'Fish (1k-10k)' },
    { key: 'shrimp', label: 'Shrimp (<1k)' },
    { key: 'bridge', label: 'Bridge' },
];

const GraphLegend = () => {
    return (
        <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg border border-border/50">
            <h4 className="font-semibold text-foreground text-sm mb-3">Legend</h4>
            <div className="space-y-2">
                {legendItems.map(item => {
                    const styleKey = item.key as keyof typeof groupStyles;
                    const style = groupStyles?.[styleKey];
                    if (!style) return null;

                    const color = typeof style.color === 'string' ? style.color : style.color?.background ?? '#888';
                    
                    return (
                        <div key={item.key} className="flex items-center gap-2.5">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-muted-foreground capitalize">{item.label}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export interface DiagnosticData {
    nodes: GraphNode[];
    links: GraphLink[];
    physics: PhysicsState;
}
interface WalletNetworkGraphProps {
    walletAddress: string;
    transactions: Transaction[];
    onDiagnosticDataUpdate?: (data: DiagnosticData) => void;
}

const ALL_NODE_TYPES = legendItems.map(item => item.key);

export function WalletNetworkGraph({ walletAddress, transactions = [], onDiagnosticDataUpdate }: WalletNetworkGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const [maxDepth, setMaxDepth] = useState(5);
    const [minVolume, setMinVolume] = useState(0);
    const debouncedMinVolume = useDebounce(minVolume, 500);
    const [minTransactions, setMinTransactions] = useState(1);
    const [visibleNodeTypes, setVisibleNodeTypes] = useState<string[]>(ALL_NODE_TYPES);

    const handleNodeTypeToggle = (nodeType: string, checked: boolean) => {
        setVisibleNodeTypes(prev => 
            checked ? [...prev, nodeType] : prev.filter(t => t !== nodeType)
        );
    };
    
    const { nodes, links } = useMemo(() => {
        if (!transactions || transactions.length === 0) {
            return { nodes: [], links: [] };
        }
        
        const graphData = processTransactions(transactions, walletAddress, maxDepth);
        
        const nodesWithMinTx = graphData.nodes.filter(node => 
            node.balance >= debouncedMinVolume && 
            node.transactionCount >= minTransactions &&
            (visibleNodeTypes.includes(node.type) || node.type === 'root')
        );
        const nodeIds = new Set(nodesWithMinTx.map(n => n.id));

        const filteredLinks = graphData.links.filter(link => nodeIds.has(link.from) && nodeIds.has(link.to));

        return { nodes: nodesWithMinTx, links: filteredLinks };
    }, [transactions, walletAddress, debouncedMinVolume, minTransactions, maxDepth, visibleNodeTypes]);

    
    useEffect(() => {
        if (!containerRef.current) return;
        
        const nodesDataSet = new DataSet(nodes);
        const edgesDataSet = new DataSet(links);

        const data = { nodes: nodesDataSet, edges: edgesDataSet };

        const options: Options = {
            autoResize: true,
            height: '100%',
            width: '100%',
            physics: {
                solver: "barnesHut",
                barnesHut: {
                    gravitationalConstant: -8000,
                    centralGravity: 0.1,
                    springLength: 120,
                    springConstant: 0.08,
                    damping: 0.09,
                    avoidOverlap: 0.7
                },
                stabilization: {
                  enabled: true,
                  iterations: 1000
                },
            },
            nodes: {
                font: {
                    size: 14, 
                    face: 'Inter',
                    color: '#fff',
                    strokeWidth: 3,
                    strokeColor: '#252525'
                },
                scaling: {
                    min: 10,
                    max: 80,
                    label: { 
                        enabled: true, 
                        min: 14, 
                        max: 30,
                        drawThreshold: 12,
                        maxVisible: 30,
                    }
                },
                borderWidth: 2,
                shape: "dot",
                shapeProperties: {
                  interpolation: false 
                },
                 shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.5)',
                    size: 10,
                    x: 5,
                    y: 5,
                },
            },
            edges: {
                smooth: {
                    enabled: true,
                    type: "dynamic",
                    roundness: 0.5
                },
                color: {
                    color:'rgba(255,255,255,0.2)',
                    highlight:'rgba(255,255,255,0.5)'
                },
                arrows: { 
                    to: { 
                        enabled: true,
                        scaleFactor: 0.5
                    } 
                },
                width: 1
            },
            groups: groupStyles,
            interaction: {
                hover: true,
                tooltipDelay: 200,
                dragNodes: true,
                dragView: true,
                zoomView: true
            },
        };
        
        const networkInstance = new Network(containerRef.current, data, options);

        networkInstance.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const clickedNode = nodes.find(n => n.id === nodeId);
                if (clickedNode && !clickedNode.fixed) {
                    setSelectedNode(nodeId);
                    setIsSheetOpen(true);
                }
            }
        });
        
        networkInstance.on("stabilizationIterationsDone", () => {
            networkInstance.setOptions({ physics: false });
        });

        return () => { networkInstance.destroy(); };

    }, [nodes, links]);
    
    useEffect(() => {
        if (!isSheetOpen) {
            setSelectedNode(null);
        }
    }, [isSheetOpen]);

    return (
        <>
        <Card className="bg-transparent border-0 shadow-none">
            <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-0 p-0">
                <div className="md:col-span-3 lg:col-span-3 bg-background p-6 rounded-l-lg">
                    <div className="space-y-6">
                         <div>
                            <h4 className="font-semibold mb-4 text-foreground">Graph Controls</h4>
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm">Min Volume (USD): ${minVolume.toLocaleString()}</Label>
                                    <Slider value={[minVolume]} onValueChange={(v) => setMinVolume(v[0])} min={0} max={10000} step={100}/>
                                </div>
                                <div>
                                    <Label className="text-sm">Min Transactions: {minTransactions}</Label>
                                    <Slider value={[minTransactions]} onValueChange={(v) => setMinTransactions(v[0])} min={1} max={50} step={1}/>
                                </div>
                                <div>
                                    <Label className="text-sm">Max Depth: {maxDepth}</Label>
                                    <Slider value={[maxDepth]} onValueChange={(v) => setMaxDepth(v[0])} min={1} max={5} step={1} />
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold mb-4 text-foreground">Filter by Type</h4>
                            <div className="space-y-2">
                                {legendItems.filter(item => item.key !== 'root').map((item) => (
                                    <div key={item.key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`filter-${item.key}`}
                                            checked={visibleNodeTypes.includes(item.key)}
                                            onCheckedChange={(checked) => handleNodeTypeToggle(item.key, !!checked)}
                                        />
                                        <Label htmlFor={`filter-${item.key}`} className="text-sm font-normal">
                                            {item.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-9 lg:col-span-9 h-[800px] bg-gradient-to-br from-slate-900 to-slate-950 rounded-r-lg relative">
                    <div ref={containerRef} className="w-full h-full" />
                    <GraphLegend />
                </div>
            </CardContent>
        </Card>
        {selectedNode && (
            <WalletDetailSheet
                address={selectedNode}
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
            />
        )}
        </>
    );
}
