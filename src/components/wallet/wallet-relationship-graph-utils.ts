import { Edge, Options } from 'vis-network/standalone/esm/vis-network';
import type { Node } from 'vis-network/standalone/esm/vis-network';
import { Transaction, FlattenedTransaction, WalletDetails, AddressNameAndTags } from '@/lib/types';
import { shortenAddress } from '@/lib/solana-utils';
import { formatCurrency } from '@/lib/utils';
import { knownAddresses } from '@/lib/knownAddresses';

export interface GraphNode extends Node {
    id: string;
    balance: number;
    balanceUSD: number | null;
    transactionCount: number;
    netFlow: number;
    type: string;
    notes: string;
    tokenBalance?: number;
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

const getNodeType = (
    address: string, 
    balance: number, 
    balanceUSD: number | null, 
    tagsAndName?: AddressNameAndTags
): string => {
    // 0. Check static known addresses first
    if (knownAddresses[address]) {
        return knownAddresses[address];
    }

    const tags = tagsAndName?.tags || [];
    const lowerName = tagsAndName?.name?.toLowerCase() || "";

    // 1. Prioritize tags from Solscan / Dune
    if (tags.includes("exchange")) return "exchange";
    if (tags.includes("platform") || tags.includes("dex") || tags.includes("protocol")) return "platform";
    if (tags.includes("bridge")) return "bridge";
    if (tags.includes("dao")) return "dao";
    if (tags.includes("nft") || tags.includes("nft_project")) return "nft";

    // 2. Heuristic: detect Pump.fun or similar in name
    if (lowerName.includes("pumpfun") || lowerName.includes("pump.fun")) return "platform";

    // 3. Fallback keyword heuristics (from address string)
    const lowerAddress = address.toLowerCase();
    const keywords = {
        exchange: [
            "binance", "coinbase", "kraken", "ftx", "kucoin",
            "bybit", "okx", "gate", "huobi", "gemini", "bitfinex"
        ],
        platform: [
            "jupiter", "raydium", "orca", "meteora", "lifinity", "phoenix",
            "drift", "mango", "solend", "kamino", "marginfi", "port",
            "magiceden", "tensor", "opensea", "blur", "solanart",
            "pump", "moonshot",
            "marinade", "lido", "jito", "sanctum",
            "phantom", "backpack"
        ],
        bridge: [
            "wormhole", "portal", "allbridge", "synapse", "celer", "mayan"
        ]
    };

    for (const [type, keys] of Object.entries(keywords)) {
        for (const key of keys) {
            if (lowerAddress.includes(key)) return type;
        }
    }

    // 4. Fallback to balance-based classification
    const usd = balanceUSD || 0;
    if (usd > 100000) return "whale";
    if (usd > 50000) return "shark";
    if (usd > 10000) return "dolphin";
    if (usd > 1000) return "fish";
    if (balance > 100) return "fish";

    return "shrimp";
};

const getMass = (balance: number, balanceUSD: number | null, tokenBalance?: number) => {
    let value = 0;
    if (tokenBalance && tokenBalance > 0) {
        value = tokenBalance; 
    } else {
        value = balanceUSD !== null && balanceUSD > 0 ? balanceUSD : (balance * 150);
    }
    
    const baseMass = Math.log1p(value) || 1;
    const type = getNodeType('', balance, balanceUSD);

    if (type === 'exchange' || type === 'platform') return baseMass * 50;
    if (type === 'whale') return baseMass * 10;
    if (type === 'shark') return baseMass * 5;
    if (type === 'dolphin') return baseMass * 2;
    return baseMass;
}

const getNodeSize = (balance: number, balanceUSD: number | null, tokenBalance?: number) => {
    let value = 0;
    if (tokenBalance && tokenBalance > 0) {
        value = tokenBalance;
    } else {
        value = (balanceUSD !== null && balanceUSD > 0) ? balanceUSD : (balance * 150);
    }

    const baseSize = 5 + Math.log1p(value || 1);
    const type = getNodeType('', balance, balanceUSD);
    
    if (type === 'exchange' || type === 'platform') return baseSize * 3.5;
    if (type === 'whale') return baseSize * 2.5;
    if (type === 'shark') return baseSize * 1.5;
    if (type === 'dolphin') return baseSize * 1.2;
    return baseSize;
}

export const processTransactions = (
    transactions: (Transaction | FlattenedTransaction)[],
    rootAddress: string,
    maxDepth: number,
    walletDetails: WalletDetails | null,
    extraWalletBalances: Record<string, number>,
    expandedNodeIds: Set<string>,
    tokenBalances: Record<string, number> = {},
    addressTags: Record<string, AddressNameAndTags> = {}
): { nodes: GraphNode[], links: GraphLink[] } => {
    if (!transactions || transactions.length === 0) {
        return { nodes: [], links: [] };
    }

    const solPrice = walletDetails?.sol.price || 0;
    
    const addressBalances: Record<string, number> = { ...extraWalletBalances };
    if (walletDetails) {
        addressBalances[walletDetails.address] = walletDetails.sol.balance;
    }

    const addressData: { [key: string]: { txCount: number; interactionVolume: number; netFlow: number; } } = {};
    const allLinks: { [key: string]: GraphLink } = {};
    const adjacencyList: { [key: string]: string[] } = {};

    transactions.forEach(tx => {
        const from = 'from' in tx ? tx.from : tx.feePayer;
        const to = 'to' in tx ? tx.to : tx.instructions[0]?.programId;
        const value = 'valueUSD' in tx ? tx.valueUSD : ('events' in tx && tx.events?.nft ? tx.events.nft.amount : null) ?? 0;

        const participants = new Set([from, to].filter(Boolean) as string[]);
        
        participants.forEach(address => {
            if (!addressData[address]) {
                addressData[address] = { txCount: 0, interactionVolume: 0, netFlow: 0 };
            }
             if (!adjacencyList[address]) {
                adjacencyList[address] = [];
            }
            addressData[address].txCount++;
            
            if (value > 0) {
                 addressData[address].interactionVolume += value;
            }
        });

        if (from && value > 0) {
            addressData[from].netFlow -= value;
        }
        if (to && value > 0) {
            addressData[to].netFlow += value;
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
            const { txCount, netFlow } = addressData[address];
            const balance = addressBalances[address] || 0;
            const balanceUSD = solPrice ? balance * solPrice : null; 
            const tokenBalance = tokenBalances[address];
            let nodeType = getNodeType(address, balance, balanceUSD, addressTags[address]);
            let group = nodeType;
            let label = addressTags[address]?.name || shortenAddress(address, 4);
            let fixed = false;

            if (address === rootAddress) {
                group = 'root';
                nodeType = 'root';
                label = `YOU: ${shortenAddress(rootAddress, 4)}`;
                fixed = true;
            }

            const isSmartMoney = netFlow > SMART_MONEY_THRESHOLD_USD && group !== 'root';
            const nodeColor = isSmartMoney ? { 
                border: 'hsl(var(--accent))',
                background: groupStyles[group]?.color?.background,
                highlight: {
                  border: 'hsl(var(--accent))',
                  background: groupStyles[group]?.color?.highlight?.background,
                },
              } : undefined;

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
                value: getNodeSize(balance, balanceUSD, tokenBalance),
                mass: getMass(balance, balanceUSD, tokenBalance),
                group: group,
                fixed,
                x: fixed ? 0 : undefined,
                y: fixed ? 0 : undefined,
                title: undefined,
                color: nodeColor,
                borderWidth: isSmartMoney ? 4 : 2,
                tokenBalance: tokenBalance,
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
    bridge:   { color: { background: '#546e7a', border: '#445761' }, font: { color: '#fff' } },
    dao:      { color: { background: '#8e24aa', border: '#6a1b9a' }, font: { color: '#fff' } },
    nft:      { color: { background: '#f06292', border: '#c2185b' }, font: { color: '#fff' } },
    whale:    { color: { background: '#7b1fa2', border: '#581672' }, font: { color: '#fff', face: 'Inter', weight: 'bold' } },
    shark:    { color: { background: '#f57c00', border: '#c46300' }, font: { color: '#fff' } },
    dolphin:  { color: { background: '#0097a7', border: '#007984' }, font: { color: '#fff' } },
    fish:     { color: { background: '#fbc02d', border: '#c99a24' }, font: { color: '#000' } },
    shrimp:   { color: { background: '#388e3c', border: '#2a6b2d' }, font: { color: '#fff' } },
};
