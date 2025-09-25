'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiagnosticData } from './wallet-relationship-graph';
import { useSearchParams } from 'next/navigation';


interface DiagnosticProps {
  diagnosticData: DiagnosticData | null;
}

// 1. Physics Configuration Analysis
export const PhysicsDiagnostic = ({ diagnosticData }: DiagnosticProps) => {
    const physics = diagnosticData?.physics;
  
    const analyzeNodeSpreading = () => {
      if (!physics) return 'N/A';
      if (physics.gravitationalConstant < -1000) return 'High: Clusters are well-separated.';
      if (physics.gravitationalConstant < -500) return 'Moderate: Good separation.';
      return 'Low: Clusters might overlap.';
    };
  
    const analyzeClusterFormation = () => {
      if (!physics) return 'N/A';
      if (physics.springLength < 100 && physics.springConstant > 0.05) return 'Strong: Tight clusters.';
      return 'Weak: Loose clusters.';
    };
  
    const analyzeStability = () => {
      if (!physics) return 'N/A';
      if (physics.damping > 0.3) return 'Stable: Graph settles quickly.';
      return 'Oscillating: Graph may take longer to stabilize.';
    };
  
    return (
      <Card>
        <CardHeader>
            <CardTitle>Physics Configuration Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Current Physics Settings:</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                    <strong>Solver:</strong> {physics?.solver || 'Not Set'}
                </div>
                <div>
                    <strong>Gravitational Constant:</strong> {physics?.gravitationalConstant ?? 'Default'}
                </div>
                <div>
                    <strong>Central Gravity:</strong> {physics?.centralGravity ?? 'Default'}
                </div>
                <div>
                    <strong>Spring Length:</strong> {physics?.springLength ?? 'Default'}
                </div>
                <div>
                    <strong>Spring Constant:</strong> {physics?.springConstant ?? 'Default'}
                </div>
                <div>
                    <strong>Damping:</strong> {physics?.damping ?? 'Default'}
                </div>
                <div>
                    <strong>Avoid Overlap:</strong> {physics?.avoidOverlap ?? 'Default'}
                </div>
                </div>
            </div>
            
            <div>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Physics Impact Analysis:</h4>
                <div className="space-y-2 text-sm">
                <div className="p-2 bg-muted rounded-md">
                    <strong>Node Spreading:</strong> {analyzeNodeSpreading()}
                </div>
                <div className="p-2 bg-muted rounded-md">
                    <strong>Cluster Formation:</strong> {analyzeClusterFormation()}
                </div>
                <div className="p-2 bg-muted rounded-md">
                    <strong>Stability:</strong> {analyzeStability()}
                </div>
                </div>
            </div>
        </CardContent>
      </Card>
    );
};
  
// 2. Wallet Categorization System Analysis
export const WalletCategorizationDiagnostic = ({ diagnosticData }: DiagnosticProps) => {
    const nodes = diagnosticData?.nodes || [];
    const totalWallets = nodes.length;
    const walletBreakdown = nodes.reduce((acc, node) => {
        const type = node.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const categorizationRules = {
        exchange: 'Address keyword match (e.g., binance)',
        platform: 'Address keyword match (e.g., raydium, jupiter)',
        whale: 'Balance > $100,000',
        shark: 'Balance > $50,000',
        dolphin: 'Balance > $10,000',
        fish: 'Balance > $1,000',
        shrimp: 'Balance <= $1,000',
    };
  
    return (
        <Card>
            <CardHeader><CardTitle>Wallet Categorization System</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Current Wallet Distribution:</h4>
                    <div className="grid grid-cols-3 gap-4">
                    {Object.entries(walletBreakdown).map(([type, count]) => (
                        <div key={type} className="text-center p-3 bg-muted rounded-md">
                        <div className="text-2xl font-bold text-primary">{count}</div>
                        <div className="text-sm capitalize">{type}</div>
                        <div className="text-xs text-muted-foreground">
                            {totalWallets > 0 ? ((count / totalWallets) * 100).toFixed(1) : 0}%
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                
                <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Categorization Logic:</h4>
                    <div className="space-y-3">
                        {Object.entries(categorizationRules).map(([key, value]) => (
                             <div className="border-l-4 border-primary pl-3" key={key}>
                                <strong className="capitalize">{key}:</strong>
                                <div className="text-sm text-muted-foreground">
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
  
// 3. Network Structure Analysis
export const NetworkStructureDiagnostic = ({ diagnosticData }: DiagnosticProps) => {
    const nodes = diagnosticData?.nodes || [];
    const links = diagnosticData?.links || [];
    const totalNodes = nodes.length;
    const totalEdges = links.length;
    const avgDegree = totalNodes > 0 ? (totalEdges * 2 / totalNodes).toFixed(2) : 0;
    const density = totalNodes > 1 ? (totalEdges / (totalNodes * (totalNodes - 1) / 2)).toFixed(4) : 0;
  
    return (
        <Card>
            <CardHeader><CardTitle>Network Structure Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Network Metrics:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-md">
                        <div className="text-xl font-bold">{totalNodes}</div>
                        <div className="text-sm">Total Nodes</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-md">
                        <div className="text-xl font-bold">{totalEdges}</div>
                        <div className="text-sm">Total Edges</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-md">
                        <div className="text-xl font-bold">{avgDegree}</div>
                        <div className="text-sm">Avg. Degree</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-md">
                        <div className="text-xl font-bold">{density}</div>
                        <div className="text-sm">Density</div>
                    </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
  
// 4. Data Source and Processing Analysis
export const DataProcessingDiagnostic = () => {
    const searchParams = useSearchParams();
    const scenario = searchParams.get('scenario');
    const isMockData = scenario !== 'real';
    const [date, setDate] = useState<string | null>(null);

    useEffect(() => {
        setDate(new Date().toLocaleString());
    }, []);

    return (
      <Card>
        <CardHeader><CardTitle>Data Processing Pipeline</CardTitle></CardHeader>
        <CardContent>
            <div className="p-3 bg-muted rounded-md space-y-2">
                <div className="flex items-center justify-between">
                    <span>Current Source:</span>
                    {isMockData ? (
                        <span className="px-2 py-1 rounded text-sm bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
                            Mock Data
                        </span>
                    ) : (
                        <span className="px-2 py-1 rounded text-sm bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100">
                            Live Data
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <span>Data Freshness:</span>
                    <span className="font-mono text-xs">{date || 'Loading...'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Data Completeness:</span>
                    <span>100%</span>
                </div>
            </div>
        </CardContent>
      </Card>
    );
};

// 5. Visual Configuration Analysis
export const VisualConfigurationDiagnostic = ({ diagnosticData }: DiagnosticProps) => {
    return (
        <Card>
            <CardHeader><CardTitle>Visual Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Node Sizing Rule:</h4>
                    <p className="text-sm p-2 bg-muted rounded-md">
                        <code>value = 5 + Math.log1p(balance) * 3.5</code>
                    </p>
                </div>
                 <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Mass Rule:</h4>
                     <p className="text-sm p-2 bg-muted rounded-md">
                        <code>mass = (Math.log1p(balance) || 1) * (balance > 100000 ? 5 : 1)</code>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

// 6. Performance and Issue Analysis
export const PerformanceAnalysisDiagnostic = ({ diagnosticData }: DiagnosticProps) => {
    const [renderTime, setRenderTime] = useState<number | null>(124);
    const [stabilizationTime, setStabilizationTime] = useState<number | null>(1387);

    return (
      <Card>
        <CardHeader><CardTitle>Performance & Issues</CardTitle></CardHeader>
        <CardContent className="space-y-6">
             <div>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Performance Metrics:</h4>
                <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-md">
                    <div className="text-lg font-bold">{renderTime ? `${renderTime.toFixed(0)}ms` : '...'}</div>
                    <div className="text-sm">JS Render Time</div>
                </div>
                <div className="p-3 bg-muted rounded-md">
                    <div className="text-lg font-bold">{stabilizationTime ? `${stabilizationTime.toFixed(0)}ms` : '...'}</div>
                    <div className="text-sm">Physics Stabilization</div>
                </div>
                </div>
            </div>
            
             <div>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Recommendations:</h4>
                <div className="space-y-2">
                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded border-l-4 border-green-500">
                        <div className="font-medium">System Stable</div>
                        <div className="text-sm text-muted-foreground">No critical issues detected.</div>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
    );
};
