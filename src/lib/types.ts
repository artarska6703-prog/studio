
// src/lib/types.ts

export interface TokenHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;   // human-readable (decimals applied)
  decimals: number;
  price: number;
  valueUSD: number; // amount * price, never null, always a number
  icon?: string;
  tokenStandard: any;
}

export interface WalletDetails {
  address: string;
  sol: {
    balance: number;   // in SOL (not lamports)
    price: number;     // USD per SOL, never null, always a number
    valueUSD: number;  // balance * price, never null, always a number
  };
  tokens: TokenHolding[];
}

export interface ParsedTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  owner?: string;
  amount: number; // lamports or token units without decimals
  tokenAmount?: number;
  mint?: string;
}

export interface Transaction {
  signature: string;
  timestamp: number;
  blockTime?: number;
  blockNumber?: number;
  fee: number;
  feePayer: string;
  type: any;
  status?: string;
  instructions: Array<{ programId?: string, accounts: string[] }>;
  nativeTransfers?: ParsedTransfer[];
  tokenTransfers?: ParsedTransfer[];
  events?: any;
}

export interface FlattenedTransaction {
  signature: string;
  blockTime: number;
  timestamp: number;
  fee: number;
  feePayer: string;
  instructions: any[];
  type: "received" | "sent" | "program_interaction";
  amount: number;           // signed (+in/-out)
  symbol: string | null;    // "SOL" or SPL symbol - can be resolved on frontend
  mint: string | null;      // SPL mint
  from: string | null;
  to: string | null;
  by: string;
  instruction: string;
  interactedWith: string[];
  valueUSD: number;         // always numeric (>= 0), never null
}
