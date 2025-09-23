
// src/lib/types.ts

export interface TokenHolding {
  mint: string;
  symbol: string;
  amount: number;
  price: number;
  valueUSD: number;
}

export interface WalletDetails {
  address: string;
  balance: number; // in SOL (not lamports)
  balanceUSD: number | null; // balance * solPrice
  tokens: TokenHolding[];
}

/** Minimal shapes from Helius parse; expand if you have stricter types */
export interface ParsedTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  owner?: string;
  amount: number;
  mint?: string;
}

export interface Transaction {
  signature: string;
  timestamp: number;
  feePayer: string;
  type: string;
  instructions: Array<{ programId: string }>;
  nativeTransfers?: ParsedTransfer[];
  tokenTransfers?: ParsedTransfer[];
}

export interface FlattenedTransaction extends Transaction {
  type: "received" | "sent" | "program_interaction";
  amount: number; // signed (+in/-out)
  symbol: string | null;
  mint: string | null;
  from?: string;
  to?: string;
  by?: string;
  interactedWith?: string[];
  valueUSD: number | null;
}
