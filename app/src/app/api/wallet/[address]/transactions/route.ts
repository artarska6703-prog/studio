
// src/app/api/wallet/[address]/transactions/route.ts
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { loadTokenMap } from "@/lib/token-list";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const SOL_MINT = "So11111111111111111111111111111111111111112";

// This function now returns the raw enriched transactions for label processing on the client
function toFlattened(
  transactions: Transaction[],
  walletAddress: string,
  prices: Record<string, number>,
  tokenMap: Map<string, string>
): FlattenedTransaction[] {
  const out: FlattenedTransaction[] = [];
  if (!transactions?.length) return out;

  for (const tx of transactions) {
    const blockTime = tx.timestamp || tx.blockTime;
    if (!blockTime) continue;

    let isInteractionAdded = false;

    // Handle Native SOL Transfers
    if (tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        const involved = t.fromUserAccount === walletAddress || t.toUserAccount === walletAddress;
        if (!involved) continue;

        const amount = (t.amount || 0) / 1e9;
        if (!amount) continue;

        const outgoing = t.fromUserAccount === walletAddress;
        const signedAmount = outgoing ? -amount : amount;
        const price = prices[SOL_MINT] ?? 0;
        
        const participants = [tx.feePayer, t.fromUserAccount, t.toUserAccount].filter(Boolean) as string[];

        out.push({
          ...tx,
          blockTime,
          type: signedAmount > 0 ? "received" : "sent",
          amount: signedAmount,
          symbol: "SOL",
          mint: SOL_MINT,
          from: t.fromUserAccount || null,
          to: t.toUserAccount || null,
          by: tx.feePayer,
          instruction: tx.type,
          interactedWith: Array.from(new Set(participants)).filter(a => a !== walletAddress),
          valueUSD: Math.abs(signedAmount) * price,
        });
        isInteractionAdded = true;
      }
    }

    // Handle SPL Token Transfers
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        const involved = t.fromUserAccount === walletAddress || t.toUserAccount === walletAddress;
        if (!involved) continue;
        
        const tokenAmount = typeof t.tokenAmount === "number" ? t.tokenAmount : 0;
        if (!tokenAmount) continue;

        // CRITICAL FIX: Ensure mint exists before processing
        const mint = t.mint;
        if (!mint) continue;

        const outgoing = t.fromUserAccount === walletAddress;
        const signedTokenAmount = outgoing ? -tokenAmount : tokenAmount;
        const price = prices[mint] ?? 0;
        const symbol = tokenMap.get(mint) || (mint.slice(0, 4) + '...');
        const participants = [tx.feePayer, t.fromUserAccount, t.toUserAccount].filter(Boolean) as string[];

        out.push({
          ...tx,
          blockTime,
          type: signedTokenAmount > 0 ? "received" : "sent",
          amount: 0, // SOL amount is 0 for SPL transfer-focused entry
          symbol: null,
          mint: null,
          from: t.fromUserAccount || null,
          to: t.toUserAccount || null,
          by: tx.feePayer,
          instruction: tx.type,
          interactedWith: Array.from(new Set(participants)).filter(a => a !== walletAddress),
          valueUSD: Math.abs(signedTokenAmount) * price,
          tokenAmount: signedTokenAmount,
          tokenSymbol: symbol,
          tokenMint: mint,
        });
        isInteractionAdded = true;
      }
    }

    // Handle general program interactions if no specific transfer involved the wallet
    if (!isInteractionAdded && tx.feePayer === walletAddress) {
      const programId = (tx.instructions && tx.instructions.length > 0) ? tx.instructions[0].programId : null;
      out.push({
        ...tx,
        blockTime,
        type: "program_interaction",
        amount: 0,
        symbol: null,
        mint: null,
        from: tx.feePayer,
        to: programId,
        by: tx.feePayer,
        instruction: tx.type,
        interactedWith: Array.from(new Set(tx.instructions?.map(i => i.programId).filter(Boolean) as string[])),
        valueUSD: 0,
      });
    }
  }
  return out;
}

export async function GET(
  req: Request,
  { params }: { params?: { address?: string } }
) {
  if (!HELIUS_API_KEY) {
    return NextResponse.json({ error: "Server configuration error: API keys are missing." }, { status: 500 });
  }
  const address = params?.address || "";
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ error: "A valid wallet address must be provided." }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY);
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const txs = await helius.rpc.getTransactionsByOwner({
      ownerAddress: address,
      limit,
      before,
    });
    
    if (!txs?.length) {
      return NextResponse.json({ transactions: [], nextCursor: null, prices: {} });
    }

    const tokenMap = await loadTokenMap();

    const mints = new Set<string>([SOL_MINT]);
    for (const tx of txs) {
      if (tx.tokenTransfers) {
        for (const t of tx.tokenTransfers) {
          if (t.mint) mints.add(t.mint);
        }
      }
    }

    const prices = await getTokenPrices(Array.from(mints));

    const flattened = toFlattened(txs as Transaction[], address, prices, tokenMap);
    const nextCursor = txs.length > 0 ? txs[txs.length - 1].signature : null;

    return NextResponse.json({ transactions: flattened, nextCursor, prices });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}
