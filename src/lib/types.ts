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

export interface ParsedTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  owner?: string;
  amount?: number;
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
