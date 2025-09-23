// src/lib/types.ts

export interface TokenHolding {
  mint: string;
  symbol: string;
  amount: number;   // human-readable (decimals applied)
  price: number;    // USD per token
  valueUSD: number; // amount * price
}

export interface WalletDetails {
  address: string;
  sol: {
    balance: number;   // in SOL (not lamports)
    price: number;     // USD per SOL
    valueUSD: number;  // balance * price
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
  signature?: string;
  timestamp?: number;
  blockTime?: number;
  feePayer?: string;
  type?: string;
  instructions?: Array<{ programId?: string }>;
  nativeTransfers?: ParsedTransfer[];
  tokenTransfers?: ParsedTransfer[];
}

export interface FlattenedTransaction extends Transaction {
  blockTime?: number;
  type: "received" | "sent" | "program_interaction";
  amount: number;           // signed (+in/-out)
  symbol: string | null;    // "SOL" or SPL symbol
  mint: string | null;      // SPL mint
  from?: string;
  to?: string;
  by?: string;
  interactedWith: string[];
  valueUSD: number;         // always numeric (>= 0)
}
