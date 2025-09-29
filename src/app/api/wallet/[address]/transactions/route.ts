// src/app/api/wallet/[address]/transactions/route.ts
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { loadTokenMap } from "@/lib/token-list";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Convert raw Helius transactions into our FlattenedTransaction format
 */
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

    // Native SOL transfers
    if (tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        const involved =
          t.fromUserAccount === walletAddress ||
          t.toUserAccount === walletAddress;
        if (!involved) continue;

        const amount = (t.amount || 0) / 1e9;
        if (!amount) continue;

        const outgoing = t.fromUserAccount === walletAddress;
        const signedAmount = outgoing ? -amount : amount;
        const price = prices[SOL_MINT] ?? 0;

        const participants = [
          tx.feePayer,
          t.fromUserAccount,
          t.toUserAccount,
        ].filter(Boolean) as string[];

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
          interactedWith: Array.from(new Set(participants)).filter(
            (a) => a !== walletAddress
          ),
          valueUSD: Math.abs(signedAmount) * price,
        });
        isInteractionAdded = true;
      }
    }

    // SPL token transfers
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        const involved =
          t.fromUserAccount === walletAddress ||
          t.toUserAccount === walletAddress;
        if (!involved) continue;

        const tokenAmount =
          typeof t.tokenAmount === "number" ? t.tokenAmount : 0;
        if (!tokenAmount) continue;

        if (!t.mint) continue;

        const outgoing = t.fromUserAccount === walletAddress;
        const signedTokenAmount = outgoing ? -tokenAmount : tokenAmount;
        const price = prices[t.mint] ?? 0;
        const symbol =
          tokenMap.get(t.mint) || t.mint.slice(0, 4) + "...";
        const participants = [
          tx.feePayer,
          t.fromUserAccount,
          t.toUserAccount,
        ].filter(Boolean) as string[];

        out.push({
          ...tx,
          blockTime,
          type: signedTokenAmount > 0 ? "received" : "sent",
          amount: 0,
          symbol: null,
          mint: null,
          from: t.fromUserAccount || null,
          to: t.toUserAccount || null,
          by: tx.feePayer,
          instruction: tx.type,
          interactedWith: Array.from(
            new Set(participants)
          ).filter((a) => a !== walletAddress),
          valueUSD: Math.abs(signedTokenAmount) * price,
          tokenAmount: signedTokenAmount,
          tokenSymbol: symbol,
          tokenMint: t.mint,
        });
        isInteractionAdded = true;
      }
    }

    // General program interactions (if no transfers)
    if (!isInteractionAdded && tx.feePayer === walletAddress) {
      const programId =
        tx.instructions && tx.instructions.length > 0
          ? tx.instructions[0].programId
          : null;

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
        interactedWith: Array.from(
          new Set(
            tx.instructions?.map((i) => i.programId).filter(Boolean) as string[]
          )
        ),
        valueUSD: 0,
      });
    }
  }

  return out;
}

/**
 * API handler
 */
export async function GET(
  req: Request,
  { params }: { params?: { address?: string } }
) {
  if (!HELIUS_API_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: HELIUS_API_KEY missing" },
      { status: 500 }
    );
  }

  const address = params?.address || "";
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json(
      { error: "A valid wallet address must be provided." },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // ✅ REST endpoint (not SDK, no JSON-RPC)
    const heliusRes = await fetch(
      `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}${
        before ? `&before=${before}` : ""
      }`
    );

    if (!heliusRes.ok) {
      const errorData = await heliusRes.json();
      return NextResponse.json(
        { error: "Helius API error", details: errorData },
        { status: heliusRes.status }
      );
    }

    const txs = (await heliusRes.json()) as Transaction[];

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
    const flattened = toFlattened(txs, address, prices, tokenMap);

    const nextCursor =
      txs.length > 0 ? txs[txs.length - 1]?.signature || null : null;

    return NextResponse.json({ transactions: flattened, nextCursor, prices });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
