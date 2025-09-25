
'use client'
import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { DiagnosticData } from '@/components/wallet/wallet-relationship-graph';
import { getBalancedTxs, getWhaleTxs, getDegenTxs } from '@/components/wallet/mock-tx-data';
import { 
    PhysicsDiagnostic, 
    WalletCategorizationDiagnostic, 
    NetworkStructureDiagnostic,
    DataProcessingDiagnostic,
    VisualConfigurationDiagnostic,
    PerformanceAnalysisDiagnostic
} from '@/components/wallet/diagnostic-dashboard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { useMemo } from 'react';
import { processTransactions } from '@/components/wallet/wallet-relationship-graph-utils';

type MockScenario = 'balanced' | 'whale' | 'degen';

const WalletRelationshipDiagnosticDashboard = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const walletAddress = searchParams.get('address') || "So11111111111111111111111111111111111111112";
    const scenario = (searchParams.get('scenario') as MockScenario) || 'balanced';

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

    const transactions = getTransactionsForScenario(walletAddress, scenario);
    
    const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);

    useEffect(() => {
        if (transactions.length === 0) {
            setDiagnosticData(null);
            return;
        }

        // The default physics values are now dynamic, so we'll start with a representative set
        // for the initial render, and it would be updated from the graph page if this were
        // a real-time diagnostic dashboard connected to the graph state.
        const initialPhysics = {
            solver: "barnesHut",
            gravitationalConstant: -8000,
            centralGravity: 0.1,
            springLength: 120,
            springConstant: 0.08,
            damping: 0.09,
            avoidOverlap: 0.7,
        };

        const { nodes, links } = processTransactions(transactions, walletAddress, 5, null, {});
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
