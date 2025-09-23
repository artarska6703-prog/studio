// src/lib/types.ts

export interface TokenHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;   // human-readable (decimals applied)
  decimals: number;
  valueUSD: number | null; // amount * price
  icon?: string;
  tokenStandard: any;
}

export interface WalletDetails {
  address: string;
  sol: {
    balance: number;   // in SOL (not lamports)
    price: number | null;     // USD per SOL
    valueUSD: number | null;  // balance * price
  };
  tokens: TokenHolding[];
}

/** Minimal shapes from Helius parse; expand if you have stricter types */
export interface ParsedTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  owner?: string;
  amount?: number;          // raw amount (lamports for SOL; integer for SPL)
  tokenAmount?: number;     // SPL: decimal-adjusted amount if present
  decimals?: number;        // SPL: token decimals if present
  mint?: string;            // SPL mint
}

export interface Transaction {
  signature: string;
  timestamp?: number;
  blockTime?: number;
  blockNumber?: number;
  fee?: number;
  feePayer: string;
  type: any;
  status?: string;
  instructions: Array<{ programId?: string }>;
  nativeTransfers?: ParsedTransfer[];
  tokenTransfers?: ParsedTransfer[];
  events?: any;
  // Properties added for mock data that need to be in the base type
  amount: number;
  valueUSD: number | null;
  symbol: string | null;
  mint: string | null;
  from: string | null;
  to: string | null;
  by: string;
  instruction: string;
  interactedWith: string[];
}

export interface FlattenedTransaction extends Transaction {
  blockTime: number;
  type: "received" | "sent" | "program_interaction";
  amount: number;           // signed (+in/-out)
  symbol: string | null;    // "SOL" or SPL symbol
  mint: string | null;      // SPL mint
  from: string | null;
  to: string | null;
  by: string;
  instruction: string;
  interactedWith: string[];
  valueUSD: number | null;         // always numeric (>= 0)
}
