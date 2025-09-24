// src/lib/types.ts

export interface TokenHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;   // human-readable (decimals applied)
  decimals: number;
  valueUSD: number; // amount * price, never null
  icon?: string;
  tokenStandard: any;
}

export interface WalletDetails {
  address: string;
  sol: {
    balance: number;   // in SOL (not lamports)
    price: number;     // USD per SOL, never null
    valueUSD: number;  // balance * price, never null
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

// This more accurately reflects the raw Helius transaction type
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
  valueUSD: number;         // always numeric (>= 0), never null
}
