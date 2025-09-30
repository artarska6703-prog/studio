// src/components/wallet/wallet-relationship-graph-utils.ts
import { shortenAddress } from "@/lib/solana-utils";
import type { FlattenedTransaction, WalletDetails } from "@/lib/types";

export type AddressNameAndTags = { name: string; tags: string[] };

export type GraphNode = {
  id: string;
  label: string;
  type: string;
  balance: number;
  balanceUSD: number | null;
  transactionCount: number;
};

export type GraphLink = {
  id: string;
  from: string;
  to: string;
  value: number;
};

export const groupStyles: Record<string, any> = {
  root: { color: { background: "#4ade80" } },
  exchange: { color: { background: "#60a5fa" } },
  platform: { color: { background: "#f59e0b" } },
  bridge: { color: { background: "#a3a3a3" } },
  whale: { color: { background: "#9333ea" } },
  shark: { color: { background: "#0ea5e9" } },
  dolphin: { color: { background: "#14b8a6" } },
  fish: { color: { background: "#22c55e" } },
  shrimp: { color: { background: "#f43f5e" } },
};

function classifyNodeType(
  address: string,
  balanceUSD: number,
  addressTags: Record<string, AddressNameAndTags>,
  isRoot: boolean
): string {
  if (isRoot) return "root";

  const tags = addressTags[address]?.tags || [];
  if (tags.includes("exchange")) return "exchange";
  if (tags.includes("bridge")) return "bridge";
  if (tags.includes("platform")) return "platform";

  if (balanceUSD > 100_000) return "whale";
  if (balanceUSD > 50_000) return "shark";
  if (balanceUSD > 10_000) return "dolphin";
  if (balanceUSD > 1_000) return "fish";
  return "shrimp";
}

export function processTransactions(
  transactions: FlattenedTransaction[],
  walletAddress: string,
  depth: number,
  walletDetails: WalletDetails | null,
  extraWalletBalances: Record<string, number>,
  visited: Set<string>,
  cache: Record<string, any>,
  addressTags: Record<string, AddressNameAndTags>
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const txCounts: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.from) txCounts[tx.from] = (txCounts[tx.from] || 0) + 1;
    if (tx.to) txCounts[tx.to] = (txCounts[tx.to] || 0) + 1;

    if (tx.from && tx.to) {
      links.push({
        id: `${tx.from}-${tx.to}`,
        from: tx.from,
        to: tx.to,
        value: tx.amount ?? 1,
      });
    }
  }

  const addresses = new Set<string>();
  for (const tx of transactions) {
    if (tx.from) addresses.add(tx.from);
    if (tx.to) addresses.add(tx.to);
  }
  addresses.add(walletAddress);

  for (const address of addresses) {
    const isRoot = address === walletAddress;

    const balanceSOL = isRoot
      ? walletDetails?.sol.balance ?? 0
      : extraWalletBalances[address] ?? 0;

    const balanceUSD = isRoot ? walletDetails?.sol.valueUSD ?? null : null;

    const txCount = txCounts[address] || 0;
    const type = classifyNodeType(address, balanceUSD ?? 0, addressTags, isRoot);

    nodes.push({
      id: address,
      label: shortenAddress(address, 6),
      type,
      balance: balanceSOL,
      balanceUSD,
      transactionCount: txCount,
    });
  }

  return { nodes, links };
}
