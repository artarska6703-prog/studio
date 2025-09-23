

import { Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Transaction, FlattenedTransaction } from '@/lib/types';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency } from '@/lib/utils';

export interface GraphNode extends Node {
    id: string;
    balance: number;
    transactionCount: number;
    type: string;
    notes: string;
}

export interface GraphLink extends Edge {
    from: string;
    to: string;
    value: number;
    width?: number;
    volume: number;
}

export interface PhysicsState {
  solver: string;
  gravitationalConstant: number;
  centralGravity: number;
  springLength: number;
  springConstant: number;
  damping: number;
  avoidOverlap: number;
}

const getNodeType = (address: string, balance: number): string => {
    const lowerAddress = address.toLowerCase();
    const keywords = {
        exchange: ['binance', 'coinbase', 'kraken', 'ftx', 'kucoin'],
        platform: ['jupiter', 'raydium', 'orca', 'pump', 'marinade', 'tensor', 'magiceden'],
        bridge: ['wormhole', 'portal']
    };

    for (const [type, keys] of Object.entries(keywords)) {
        for (const key of keys) {
            if (lowerAddress.includes(key)) return type;
        }
    }

    const solBalanceInUsd = balance * 150; // Approximate price

    if (solBalanceInUsd > 100000) return 'whale';
    if (solBalanceInUsd > 50000) return 'shark';
    if (solBalanceInUsd > 10000) return 'dolphin';
    if (solBalanceInUsd > 1000) return 'fish';
    return 'shrimp';
};

const getMass = (balance: number) => {
    const baseMass = Math.log1p(balance) || 1;
    const type = getNodeType('', balance); // Balance is now SOL amount, not USD
    if (type === 'exchange' || type === 'platform') return baseMass * 50;
    if (type === 'whale') return baseMass * 10;
    if (type === 'shark') return baseMass * 5;
    if (type === 'dolphin') return baseMass * 2;
    return baseMass;
}

const getNodeSize = (balance: number) => {
    const baseSize = 5 + Math.log1p(balance);
    const type = getNodeType('', balance); // Balance is now SOL amount, not USD
    if (type === 'exchange' || type === 'platform') return baseSize * 3.5;
    if (type === 'whale') return baseSize * 2.5;
    if (type === 'shark') return baseSize * 1.5;
    if (type === 'dolphin') return baseSize * 1.2;
    return baseSize;
}

const createTooltipElement = (data: { [key: string]: string | number | undefined }) => {
    const tooltip = document.createElement('div');
    // We must use inline styles as Vis.js tooltips are rendered outside the React tree
    // and do not inherit Tailwind styles or CSS variables properly.
    tooltip.style.background = 'hsl(222.2 84% 4.9%)'; // --popover
    tooltip.style.color = 'hsl(210 40% 98%)'; // --popover-foreground
    tooltip.style.border = '1px solid hsl(217.2 32.6% 17.5%)'; // --border
    tooltip.style.borderRadius = 'var(--radius)';
    tooltip.style.padding = '0.25rem'; // p-1
    tooltip.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
    tooltip.style.maxWidth = '224px'; // max-w-xs
    tooltip.style.fontSize = '0.75rem'; // text-xs

    let content = `
        <div style="padding: 0.25rem 0.5rem; border-bottom: 1px solid hsl(217.2 32.6% 17.5%);">
            <p style="font-weight: bold; text-transform: capitalize;">${data.type || 'Wallet'}</p>
            <p style="font-family: 'Fira Code', monospace; color: hsl(215 20.2% 65.1%); font-size: 0.75rem;">${shortenAddress(data.address as string, 10)}</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; padding: 0.5rem;">
    `;
    
    const stats: (keyof typeof data)[] = ['balance', 'interactionVolume', 'transactions', 'hops'];

    for (const key of stats) {
        const value = data[key];
         if(value !== undefined) {
             let formattedKey = key.replace(/([A-Z])/g, ' $1');
             content += `
                <div style="color: hsl(215 20.2% 65.1%); text-transform: capitalize;">${formattedKey}:</div>
                <div style="font-weight: 500; font-family: 'Fira Code', monospace; text-align: right;">${value}</div>
            `;
        }
    }

    content += '</div>';
    tooltip.innerHTML = content;
    return tooltip;
};


export const processTransactions = (transactions: (Transaction | FlattenedTransaction)[], rootAddress: string, maxDepth: number, addressBalances: { [key: string]: number }): { nodes: GraphNode[], links: GraphLink[] } => {
    if (!transactions || transactions.length === 0) {
        return { nodes: [], links: [] };
    }

    const addressData: { [key: string]: { txCount: number; interactionVolume: number } } = {};
    const allLinks: { [key: string]: GraphLink } = {};
    const adjacencyList: { [key: string]: string[] } = {};

    transactions.forEach(tx => {
        const from = 'from' in tx ? tx.from : tx.feePayer;
        const to = 'to' in tx ? tx.to : tx.instructions[0]?.programId;

        const participants = new Set([from, to].filter(Boolean) as string[]);
        
        participants.forEach(address => {
            if (!addressData[address]) {
                addressData[address] = { txCount: 0, interactionVolume: 0 };
            }
             if (!adjacencyList[address]) {
                adjacencyList[address] = [];
            }
            addressData[address].txCount++;
            const value = 'valueUSD' in tx ? tx.valueUSD : tx.events?.nft?.amount;
            if (value && value > 0) {
                 addressData[address].interactionVolume += value;
            }
        });

        if (from && to && from !== to) {
            if (!adjacencyList[from]) adjacencyList[from] = [];
            if (!adjacencyList[to]) adjacencyList[to] = [];
            if (!adjacencyList[from].includes(to)) adjacencyList[from].push(to);
            if (!adjacencyList[to].includes(from)) adjacencyList[to].push(from);

            const linkId = [from, to].sort().join('-');
            const value = 'valueUSD' in tx ? tx.valueUSD : tx.events?.nft?.amount;

            if (!allLinks[linkId]) {
                allLinks[linkId] = { from: from, to: to, value: 0, volume: 0, title: '0 interactions' };
            }
            allLinks[linkId].value += 1;
            if (value) {
                allLinks[linkId].volume += Math.abs(value);
            }
            allLinks[linkId].title = `${allLinks[linkId].value} interactions<br>Volume: ${formatCurrency(allLinks[linkId].volume)}`;
            allLinks[linkId].width = Math.log2(allLinks[linkId].value + 1) * 2;
        }
    });

    const nodeDepths = new Map<string, number>();
    if (Object.keys(addressData).includes(rootAddress)) {
      const queue: [string, number][] = [[rootAddress, 0]];
      const visited = new Set<string>([rootAddress]);
      nodeDepths.set(rootAddress, 0);

      let head = 0;
      while(head < queue.length) {
          const [currentAddress, depth] = queue[head++];

          if (depth >= maxDepth) continue;

          const neighbors = adjacencyList[currentAddress] || [];
          for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                  visited.add(neighbor);
                  nodeDepths.set(neighbor, depth + 1);
                  queue.push([neighbor, depth + 1]);
              }
          }
      }
    }
    
    const filteredNodeIds = new Set(Array.from(nodeDepths.keys()));
    if(filteredNodeIds.size === 0 && Object.keys(addressData).length > 0) {
        // Fallback if root address not in data, show all.
        Object.keys(addressData).forEach(id => filteredNodeIds.add(id));
    }
    
    const nodes: GraphNode[] = Object.keys(addressData)
        .filter(address => filteredNodeIds.has(address))
        .map(address => {
            const { txCount, interactionVolume } = addressData[address];
            const balance = addressBalances[address] || 0;
            let nodeType = getNodeType(address, balance);
            let group = nodeType;
            let label = shortenAddress(address, 4);
            let fixed = false;

            if (address === rootAddress) {
                group = 'root';
                nodeType = 'root';
                label = `YOU: ${shortenAddress(rootAddress, 4)}`;
                fixed = true;
            }

            const tooltipData = {
                address: address,
                balance: `${balance.toFixed(2)} SOL`,
                interactionVolume: formatCurrency(interactionVolume),
                transactions: txCount,
                type: nodeType,
                hops: nodeDepths.get(address) ?? 'N/A'
            };

            return {
                id: address,
                label: label,
                balance: balance,
                transactionCount: txCount,
                type: nodeType,
                notes: '',
                shape: 'dot',
                value: getNodeSize(balance),
                mass: getMass(balance),
                group: group,
                fixed,
                x: fixed ? 0 : undefined,
                y: fixed ? 0 : undefined,
                title: createTooltipElement(tooltipData)
            };
        });

    const links = Object.values(allLinks).filter(link => 
        filteredNodeIds.has(link.from) && filteredNodeIds.has(link.to)
    );

    return { nodes, links };
};


export const groupStyles: Options['groups'] = {
    root:     { color: { background: '#2563EB', border: '#1D4ED8' }, font: { color: '#fff', face: 'Inter', weight: 'bold' } },
    exchange: { color: { background: '#c00000', border: '#a00000' }, font: { color: '#fff', face: 'Inter', weight: 'bold' } },
    platform: { color: { background: '#1e88e5', border: '#155fa0' }, font: { color: '#fff', face: 'Inter', weight: 'bold' } },
    whale:    { color: { background: '#7b1fa2', border: '#581672' }, font: { color: '#fff', face: 'Inter', weight: 'bold' } },
    shark:    { color: { background: '#f57c00', border: '#c46300' }, font: { color: '#fff' } },
    dolphin:  { color: { background: '#0097a7', border: '#007984' }, font: { color: '#fff' } },
    fish:     { color: { background: '#fbc02d', border: '#c99a24' }, font: { color: '#000' } },
    shrimp:   { color: { background: '#388e3c', border: '#2a6b2d' }, font: { color: '#fff' } },
    bridge:   { color: { background: '#546e7a', border: '#445761' }, font: { color: '#fff' } },
};


    
