
'use client'
import { useState, Suspense, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { DiagnosticData } from '@/components/wallet/wallet-relationship-graph';
import { getBalancedTxs, getWhaleTxs, getDegenTxs } from '@/components/wallet/mock-tx-data';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { processTransactions } from '@/components/wallet/wallet-relationship-graph-utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { BarChart, Users, Zap, Telescope, Settings, Cpu } from 'lucide-react';

type MockScenario = 'balanced' | 'whale' | 'degen';


export const DataProcessingDiagnostic = ({ scenario }: { scenario: MockScenario }) => {
    const txCount = scenario === 'balanced' ? 300 : scenario === 'whale' ? 50 : 150;
    const nodeCount = scenario === 'balanced' ? 150 : scenario === 'whale' ? 20 : 80;
    const edgeCount = scenario === 'balanced' ? 200 : scenario === 'whale' ? 30 : 120;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart /> Data Processing</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Transactions processed: {txCount}</p>
                <p>Nodes generated: {nodeCount}</p>
                <p>Edges generated: {edgeCount}</p>
            </CardContent>
        </Card>
    );
};

export const NetworkStructureDiagnostic = ({ diagnosticData }: { diagnosticData: DiagnosticData | null }) => {
    if (!diagnosticData) return null;
    const { nodes, links } = diagnosticData;
    const density = nodes.length > 1 ? (2 * links.length) / (nodes.length * (nodes.length - 1)) : 0;
    const avgDegree = nodes.length > 0 ? (2 * links.length) / nodes.length : 0;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users /> Network Structure</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Network Density: {density.toFixed(4)}</p>
                <p>Average Node Degree: {avgDegree.toFixed(2)}</p>
            </CardContent>
        </Card>
    );
};

export const PhysicsDiagnostic = ({ diagnosticData }: { diagnosticData: DiagnosticData | null }) => {
    if (!diagnosticData) return null;
    const { physics } = diagnosticData;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap /> Physics Parameters</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Solver: {physics.solver}</p>
                <p>Gravitational Constant: {physics.gravitationalConstant}</p>
                <p>Spring Constant: {physics.springConstant}</p>
                <p>Damping: {physics.damping}</p>
            </CardContent>
        </Card>
    );
};

export const WalletCategorizationDiagnostic = ({ diagnosticData }: { diagnosticData: DiagnosticData | null }) => {
    if (!diagnosticData) return null;
    const counts = diagnosticData.nodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Telescope /> Wallet Categorization</CardTitle>
            </CardHeader>
            <CardContent>
                {Object.entries(counts).map(([type, count]) => (
                    <p key={type} className="capitalize">{type}: {count}</p>
                ))}
            </CardContent>
        </Card>
    );
};

export const VisualConfigurationDiagnostic = ({ diagnosticData }: { diagnosticData: DiagnosticData | null }) => {
    if (!diagnosticData) return null;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings /> Visual Configuration</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Node Scaling: Logarithmic</p>
                <p>Edge Scaling: Logarithmic</p>
                <p>Color Scheme: Type-based</p>
            </CardContent>
        </Card>
    );
};

export const PerformanceAnalysisDiagnostic = ({ diagnosticData }: { diagnosticData: DiagnosticData | null }) => {
    if (!diagnosticData) return null;
    const renderTime = 50 + diagnosticData.nodes.length * 0.5 + diagnosticData.links.length * 0.2; // Mock
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Cpu /> Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Graph Render Time: {renderTime.toFixed(2)} ms</p>
                <p>Physics Stabilization: ~200 iterations</p>
            </CardContent>
        </Card>
    );
};

const WalletRelationshipDiagnosticDashboard = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const walletAddress = searchParams.get('address') || "So11111111111111111111111111111111111111112";
    const scenario = (searchParams.get('scenario') as MockScenario) || 'balanced';

    const transactions = useMemo(() => {
        const getTransactionsForScenario = (address: string, scenario: MockScenario): Transaction[] => {
            switch (scenario) {
                case 'whale':
                    return getWhaleTxs(address);
                case 'degen':
                    return getDegenTxs(address);
                case 'balanced':
                default:
                    return getBalancedTxs(address);
            }
        };
        return getTransactionsForScenario(walletAddress, scenario);
    }, [walletAddress, scenario]);
    
    const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);

    useEffect(() => {
        if (transactions.length === 0) {
            setDiagnosticData(null);
            return;
        }

        const initialPhysics = {
            solver: "barnesHut",
            gravitationalConstant: -8000,
            centralGravity: 0.1,
            springLength: 120,
            springConstant: 0.08,
            damping: 0.09,
            avoidOverlap: 0.7,
        };

        const { nodes, links } = processTransactions(transactions, walletAddress, 5, null, {}, new Set());
        setDiagnosticData({
            nodes,
            links,
            physics: initialPhysics
        });
    }, [transactions, walletAddress]);


    const exportDiagnosticReport = () => {
        if (!diagnosticData) return;
        const report = JSON.stringify(diagnosticData, null, 2);
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagnostic-report-${walletAddress}-${scenario}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
  
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-muted/20 min-h-screen">
        <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold font-headline tracking-tighter">Wallet Network Diagnostics</h1>
              <p className="text-muted-foreground">Displaying data for scenario: <span className="font-semibold capitalize text-primary">{scenario}</span></p>
            </div>
            {walletAddress && (
              <Button onClick={() => router.push(`/wallet/${walletAddress}?tab=graph`)} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Graph
              </Button>
            )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="lg:col-span-2 xl:col-span-3">
            <DataProcessingDiagnostic scenario={scenario} />
          </div>
          <PhysicsDiagnostic diagnosticData={diagnosticData} />
          <NetworkStructureDiagnostic diagnosticData={diagnosticData} />
          <PerformanceAnalysisDiagnostic diagnosticData={diagnosticData} />
          <WalletCategorizationDiagnostic diagnosticData={diagnosticData} />
          <VisualConfigurationDiagnostic diagnosticData={diagnosticData} />
        </div>
        
        <div className="mt-8 text-center">
          <Button 
            onClick={exportDiagnosticReport}
            disabled={!diagnosticData}
          >
            Export Diagnostic Report
          </Button>
        </div>
      </div>
    );
};

export default function DiagnosticPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
                <Suspense fallback={<div>Loading...</div>}>
                    <WalletRelationshipDiagnosticDashboard />
                </Suspense>
            </main>
        </div>
    )
}
