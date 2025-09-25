
import { Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Transaction, FlattenedTransaction, WalletDetails } from '@/lib/types';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency } from '@/lib/utils';

export interface GraphNode extends Node {
    id: string;
    balance: number;
    balanceUSD: number | null;
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

const getNodeType = (address: string, balance: number, balanceUSD: number | null): string => {
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

    const usd = balanceUSD || 0;
    if (usd > 100000) return 'whale';
    if (usd > 50000) return 'shark';
    if (usd > 10000) return 'dolphin';
    if (usd > 1000) return 'fish';
    
    // Fallback to SOL balance if USD value is low or unavailable
    if (balance > 100) return 'fish';
    
    return 'shrimp';
};

const getMass = (balance: number, balanceUSD: number | null) => {
    // Prioritize USD for mass calculation, but fall back to SOL balance if USD is not available.
    const value = balanceUSD !== null && balanceUSD > 0 ? balanceUSD : (balance * 150); // Use a default price for scaling if no live price
    const baseMass = Math.log1p(value) || 1;
    const type = getNodeType('', balance, balanceUSD);

    if (type === 'exchange' || type === 'platform') return baseMass * 50;
    if (type === 'whale') return baseMass * 10;
    if (type === 'shark') return baseMass * 5;
    if (type === 'dolphin') return baseMass * 2;
    return baseMass;
}

const getNodeSize = (balance: number, balanceUSD: number | null) => {
    // Prioritize USD for size calculation, but fall back to SOL balance if USD is not available.
    const value = (balanceUSD !== null && balanceUSD > 0) ? balanceUSD : (balance * 150); // Use a default price for scaling
    // Add a fallback for value to prevent Math.log1p(0) which is 0.
    const baseSize = 5 + Math.log1p(value || 1);
    const type = getNodeType('', balance, balanceUSD);
    
    if (type === 'exchange' || type === 'platform') return baseSize * 3.5;
    if (type === 'whale') return baseSize * 2.5;
    if (type === 'shark') return baseSize * 1.5;
    if (type === 'dolphin') return baseSize * 1.2;
    return baseSize;
}

export const processTransactions = (transactions: (Transaction | FlattenedTransaction)[], rootAddress: string, maxDepth: number, walletDetails: WalletDetails | null): { nodes: GraphNode[], links: GraphLink[] } => {
    if (!transactions || transactions.length === 0) {
        return { nodes: [], links: [] };
    }

    const solPrice = walletDetails?.sol.price || 0;

    // Start with the authoritative balance for the root wallet
    const addressBalances: { [key: string]: number } = {};
    if (walletDetails && walletDetails.address === rootAddress) {
        addressBalances[rootAddress] = walletDetails.sol.balance;
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
            const value = 'valueUSD' in tx ? tx.valueUSD : ('events' in tx && tx.events?.nft ? tx.events.nft.amount : null);
            if (value && value > 0) {
                 addressData[address].interactionVolume += value;
            }
        });

        // Simulate balance changes for non-root wallets
        if ('from' in tx && tx.from && tx.from !== rootAddress && tx.amount < 0 && tx.mint === 'So11111111111111111111111111111111111111112') {
             if (!addressBalances[tx.from]) addressBalances[tx.from] = 1000;
             addressBalances[tx.from] += tx.amount;
        }
        if ('to' in tx && tx.to && tx.to !== rootAddress && tx.amount > 0 && tx.mint === 'So11111111111111111111111111111111111111112') {
            if (!addressBalances[tx.to]) addressBalances[tx.to] = 0;
            addressBalances[tx.to] += tx.amount;
        }

        if (from && to && from !== to) {
            if (!adjacencyList[from]) adjacencyList[from] = [];
            if (!adjacencyList[to]) adjacencyList[to] = [];
            if (!adjacencyList[from].includes(to)) adjacencyList[from].push(to);
            if (!adjacencyList[to].includes(from)) adjacencyList[to].push(from);

            const linkId = [from, to].sort().join('-');
            const value = 'valueUSD' in tx ? tx.valueUSD : ('events' in tx && tx.events?.nft ? tx.events.nft.amount : null);

            if (!allLinks[linkId]) {
                allLinks[linkId] = { from: from, to: to, value: 0, volume: 0 };
            }
            allLinks[linkId].value += 1;
            if (value) {
                allLinks[linkId].volume += Math.abs(value);
            }
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
            const { txCount } = addressData[address];
            const balance = addressBalances[address] || 0;
            const balanceUSD = solPrice ? balance * solPrice : null; 
            let nodeType = getNodeType(address, balance, balanceUSD);
            let group = nodeType;
            let label = shortenAddress(address, 4);
            let fixed = false;

            if (address === rootAddress) {
                group = 'root';
                nodeType = 'root';
                label = `YOU: ${shortenAddress(rootAddress, 4)}`;
                fixed = true;
            }

            return {
                id: address,
                label: label,
                balance: balance,
                balanceUSD: balanceUSD,
                transactionCount: txCount,
                type: nodeType,
                notes: '',
                shape: 'dot',
                value: getNodeSize(balance, balanceUSD),
                mass: getMass(balance, balanceUSD),
                group: group,
                fixed,
                x: fixed ? 0 : undefined,
                y: fixed ? 0 : undefined,
                title: undefined // Remove title to prevent default tooltip
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
