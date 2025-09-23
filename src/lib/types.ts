
import type { EnrichedTransaction, TokenStandard, TransactionType } from "helius-sdk";

export interface TokenHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;
  decimals: number;
  valueUSD: number | null;
  icon?: string | null;
  tokenStandard?: TokenStandard;
}

export type FlattenedTransaction = Omit<EnrichedTransaction, 'type'> & {
    type: 'sent' | 'received' | 'program_interaction';
    amount: number;
    symbol: string | null;
    mint: string | null;
    from: string | null;
    to: string | null;
    by: string | null;
    instruction: TransactionType;
    interactedWith: string[];
    valueUSD: number | null;
    blockTime?: number; // Add blockTime here as well for consistency
};


export type Transaction = EnrichedTransaction & {
  blockTime?: number;
  timestamp?: number;
};

export interface WalletDetails {
  address: string;
  balance: number;
  balanceUSD: number | null;
  tokens: TokenHolding[];
}

export interface GraphNode {
  id: string;
  balance: number;
  transactionCount: number;
  type: string;
  notes: string;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

export type HistoricalBalanceData = {
    date: string;
    balance: number | null;
}
