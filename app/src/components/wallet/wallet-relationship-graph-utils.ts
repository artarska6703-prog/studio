import { Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { FlattenedTransaction, WalletDetails } from '@/lib/types';
import { shortenAddress } from '@/lib/solana-utils';
import { LocalTag } from '@/lib/tag-store';

export interface GraphNode extends Node {
    id: string;
    balance: number;
    balanceUSD: number | null;
    transactionCount: number;
    netFlow: number;
    type: string;
    notes: string;
    tokenBalance?: number;
    labels?: string[]; // Added for behavioral labels
}

export interface GraphLink extends Edge {
    from: string;
    to: string;
    value: number;
    width?: number;
    volume: number;
    tokenVolumes: Map<string, { amount: number, symbol: string }>;
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

export type AddressTagInfo = {
    name: string;
    type: string;
};

function getLabelsFromTransactions(transactions: FlattenedTransaction[]): string[] {
  const labels = new Set<string>();
  if (!transactions) return [];

  for (const tx of transactions) {
    const programName = tx.programInfo?.name?.toLowerCase();

    if (programName?.includes('magic eden')) labels.add('NFT Trader');
    if (programName?.includes('tensor')) labels.add('NFT Trader');
    if (programName?.includes('jupiter')) labels.add('DEX User');
    if (programName?.includes('raydium')) labels.add('DEX User');
    if (programName?.includes('orca')) labels.add('DEX User');
    if (tx.events?.nft) labels.add('NFT Collector');
    if (tx.type === 'program_interaction' && tx.instruction?.toLowerCase() === 'swap') labels.add('DeFi User');
    if (tx.instruction?.toLowerCase().includes('stake')) labels.add('Staker');
  }

  return Array.from(labels);
}


const getNodeType = (
    address: string, 
    balance: number, 
    balanceUSD: number | null, 
    localTag?: LocalTag
    ): string => {
    
    // 1. Prioritize local manual tags
    if (localTag && localTag.type) {
        const type = localTag.type.toLowerCase();
        // Check if the manual tag type matches one of our defined groups
        if (Object.keys(groupStyles).includes(type)) {
            return type;
        }
        return localTag.type;
    }
    
    // 2. Fallback to keyword matching on address
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

    // 3. Fallback to balance-based classification
    const usd = balanceUSD || 0;
    if (usd > 100000) return 'whale';
    if (usd > 50000) return 'shark';
    if (usd > 10000) return 'dolphin';
    if (usd > 1000) return 'fish';
    
    if (balance > 100) return 'fish';
    
    return 'shrimp';
};

const getMass = (balance: number, balanceUSD: number | null, localTag?: LocalTag, tokenBalance?: number) => {
    let value = 0;
    if (tokenBalance && tokenBalance > 0) {
        value = tokenBalance; 
    } else {
        value = balanceUSD !== null && balanceUSD > 0 ? balanceUSD : (balance * 150);
    }
    
    const baseMass = Math.log1p(value) || 1;
    const type = getNodeType('', balance, balanceUSD, localTag);

    if (type === 'exchange' || type === 'platform') return baseMass * 50;
    if (type === 'whale') return baseMass * 10;
    if (type === 'shark') return baseMass * 5;
    if (type === 'dolphin') return baseMass * 2;
    return baseMass;
}

const getNodeSize = (balance: number, balanceUSD: number | null, localTag?: LocalTag, tokenBalance?: number) => {
    let value = 0;
    if (tokenBalance && tokenBalance > 0) {
        value = tokenBalance;
    } else {
        value = (balanceUSD !== null && balanceUSD > 0) ? balanceUSD : (balance * 150);
    }

    const baseSize = 5 + Math.log1p(value || 1);
    const type = getNodeType('', balance, balanceUSD, localTag);
    
    if (type === 'exchange' || type === 'platform') return baseSize * 3.5;
    if (type === 'whale') return baseSize * 2.5;
    if (type === 'shark') return baseSize * 1.5;
    if (type === 'dolphin') return baseSize * 1.2;
    return baseSize;
}

export const processTransactions = (
    transactions: FlattenedTransaction[],
    rootAddress: string,
    maxDepth: number,
    walletDetails: WalletDetails | null,
    extraWalletBalances: Record<string, number>,
    expandedNodeIds: Set<string>,
    tokenBalances: Record<string, number> = {},
    addressTags: Record<string, LocalTag> = {}
): { nodes: GraphNode[], links: GraphLink[] } => {
    if (!transactions || transactions.length === 0) {
        return { nodes: [], links: [] };
    }

    const solPrice = walletDetails?.sol.price || 0;
    
    const addressBalances: Record<string, number> = { ...extraWalletBalances };
    if (walletDetails) {
        addressBalances[walletDetails.address] = walletDetails.sol.balance;
    }

    const addressData: { [key: string]: { txCount: number; interactionVolume: number; netFlow: number; transactions: FlattenedTransaction[] } } = {};
    const allLinks: { [key: string]: GraphLink } = {};
    const adjacencyList: { [key: string]: string[] } = {};

    transactions.forEach(tx => {
        const from = tx.from;
        const to = tx.to;
        const value = tx.valueUSD ?? 0;

        const participants = new Set([from, to, tx.feePayer].filter(Boolean) as string[]);
        
        participants.forEach(address => {
            if (!addressData[address]) {
                addressData[address] = { txCount: 0, interactionVolume: 0, netFlow: 0, transactions: [] };
            }
             if (!adjacencyList[address]) {
                adjacencyList[address] = [];
            }
            addressData[address].txCount++;
            addressData[address].transactions.push(tx);
            
            if (value > 0) {
                 addressData[address].interactionVolume += value;
            }
        });

        if (from && to) {
            if (from === rootAddress) addressData[to].netFlow += value;
            if (to === rootAddress) addressData[from].netFlow -= value;
        }
        
        if (from && to && from !== to) {
            if (!adjacencyList[from]) adjacencyList[from] = [];
            if (!adjacencyList[to]) adjacencyList[to] = [];
            if (!adjacencyList[from].includes(to)) adjacencyList[from].push(to);
            if (!adjacencyList[to].includes(from)) adjacencyList[to].push(from);

            const linkId = [from, to].sort().join('-');

            if (!allLinks[linkId]) {
                allLinks[linkId] = { from, to, value: 0, volume: 0, tokenVolumes: new Map() };
            }
            allLinks[linkId].value += 1;
            if (value) {
                allLinks[linkId].volume += Math.abs(value);
            }

            if ('tokenMint' in tx && tx.tokenMint && tx.tokenSymbol && tx.tokenAmount) {
                const tokenMint = tx.tokenMint;
                const current = allLinks[linkId].tokenVolumes.get(tokenMint) || { amount: 0, symbol: tx.tokenSymbol };
                current.amount += Math.abs(tx.tokenAmount);
                allLinks[linkId].tokenVolumes.set(tokenMint, current);
            }

            allLinks[linkId].width = Math.log2(allLinks[linkId].volume + 1);
        }
    });
    
    const visibleNodes = new Set<string>();

    if (Object.keys(addressData).includes(rootAddress)) {
      const queue: [string, number][] = [[rootAddress, 0]];
      const visited = new Set<string>([rootAddress]);
      
      let head = 0;
      while(head < queue.length) {
          const [currentAddress, depth] = queue[head++];
          visibleNodes.add(currentAddress);

          if (depth >= maxDepth && !expandedNodeIds.has(currentAddress)) continue;

          const neighbors = adjacencyList[currentAddress] || [];
          for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                  visited.add(neighbor);
                  queue.push([neighbor, depth + 1]);
              }
          }
      }
    }

    expandedNodeIds.forEach(expandedId => {
        if (!adjacencyList[expandedId]) return;
        visibleNodes.add(expandedId); 
        const neighbors = adjacencyList[expandedId];
        for (const neighbor of neighbors) {
            visibleNodes.add(neighbor);
        }
    });
    
    
    if(visibleNodes.size === 0 && Object.keys(addressData).length > 0) {
        Object.keys(addressData).forEach(id => visibleNodes.add(id));
    }

    const SMART_MONEY_THRESHOLD_USD = 50000;
    
    const nodes: GraphNode[] = Object.keys(addressData)
        .filter(address => visibleNodes.has(address))
        .map(address => {
            const { txCount, netFlow, transactions: nodeTxs } = addressData[address];
            const balance = addressBalances[address] || 0;
            const balanceUSD = solPrice ? balance * solPrice : null; 
            const tokenBalance = tokenBalances[address];
            const localTag = addressTags[address];
            
            let nodeType = getNodeType(address, balance, balanceUSD, localTag);
            let group = groupStyles[nodeType] ? nodeType : 'shrimp'; // Fallback to shrimp if type is custom
            let label = localTag?.name || shortenAddress(address, 4);
            let fixed = false;
            const labels = getLabelsFromTransactions(nodeTxs);

            if (address === rootAddress) {
                group = 'root';
                nodeType = 'root';
                label = `YOU: ${shortenAddress(rootAddress, 4)}`;
                fixed = true;
            }

            const isSmartMoney = netFlow > SMART_MONEY_THRESHOLD_USD && group !== 'root';
            const finalGroupStyle = groupStyles[group];
            const nodeColor = isSmartMoney ? { 
                border: 'hsl(var(--accent))',
                background: finalGroupStyle?.color?.background,
                highlight: {
                  border: 'hsl(var(--accent))',
                  background: finalGroupStyle?.color?.highlight?.background,
                },
              } : finalGroupStyle?.color;

            return {
                id: address,
                label: label,
                balance: balance,
                balanceUSD: balanceUSD,
                transactionCount: txCount,
                netFlow: netFlow,
                type: nodeType,
                notes: '',
                shape: 'dot',
                value: getNodeSize(balance, balanceUSD, localTag, tokenBalance),
                mass: getMass(balance, balanceUSD, localTag, tokenBalance),
                group: group,
                fixed,
                x: fixed ? 0 : undefined,
                y: fixed ? 0 : undefined,
                title: undefined,
                color: nodeColor as any,
                borderWidth: isSmartMoney ? 4 : 2,
                tokenBalance: tokenBalance,
                labels,
            };
        });

    const finalNodeIds = new Set(nodes.map(n => n.id));
    const links = Object.values(allLinks).filter(link => 
        finalNodeIds.has(link.from) && finalNodeIds.has(link.to)
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
