// src/app/api/wallet/[address]/transactions/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";
import { loadTokenMap } from "@/lib/token-list";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL;

function processHeliusTransactions(
  transactions: Transaction[],
  walletAddress: string,
  prices: Record<string, number>,
  tokenList: Map<string, string>
): FlattenedTransaction[] {
  const out: FlattenedTransaction[] = [];
  if (!transactions?.length) return out;

  for (const tx of transactions) {
    let hasRelevant = false;
    const blockTime = tx.timestamp || tx.blockTime;

    const handle = (transfers: any[] | undefined, isNative: boolean) => {
      if (!transfers) return;
      for (const t of transfers) {
        const involved =
          t.fromUserAccount === walletAddress ||
          t.toUserAccount === walletAddress ||
          t.owner === walletAddress;
        if (!involved) continue;

        // amount normalization (robust)
        const amt = isNative
          ? (t.amount || 0) / LAMPORTS_PER_SOL
          : (typeof t.tokenAmount === "number"
              ? t.tokenAmount
              : (t.amount && t.decimals
                  ? t.amount / Math.pow(10, t.decimals)
                  : 0));

        if (!amt) continue;

        hasRelevant = true;

        const outgoing =
          t.fromUserAccount === walletAddress ||
          (t.owner === walletAddress && t.fromUserAccount !== walletAddress);

        const finalAmount = outgoing ? -amt : amt;
        const mint = isNative
          ? "So11111111111111111111111111111111111111112"
          : t.mint;

        const price = prices[mint] ?? 0;
        const valueUSD = Math.abs(amt) * price;

        out.push({
          ...tx,
          blockTime,
          type: finalAmount > 0 ? "received" : "sent",
          amount: finalAmount,
          symbol: isNative ? "SOL" : (tokenList.get(mint) || mint.slice(0, 4)),
          mint,
          from: t.fromUserAccount,
          to: t.toUserAccount,
          by: tx.feePayer,
          instruction: tx.type,
          interactedWith: Array.from(
            new Set([tx.feePayer, t.fromUserAccount, t.toUserAccount].filter(Boolean))
          ).filter((a) => a !== walletAddress),
          valueUSD,
        });
      }
    };

    handle(tx.nativeTransfers, true);
    handle(tx.tokenTransfers, false);

    if (!hasRelevant && tx.feePayer === walletAddress) {
      out.push({
        ...tx,
        blockTime,
        type: "program_interaction",
        amount: 0,
        symbol: null,
        mint: null,
        from: tx.feePayer,
        to: tx.instructions?.[0]?.programId || null,
        by: tx.feePayer,
        instruction: tx.type,
        interactedWith: Array.from(
          new Set(tx.instructions?.map((i: any) => i.programId).filter(Boolean))
        ),
        valueUSD: 0, // never null
      });
    }
  }
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: { address: string } }
) {
  if (!HELIUS_API_KEY) {
    return NextResponse.json({ error: "HELIUS_API_KEY missing" }, { status: 500 });
  }
  if (!SYNDICA_RPC_URL) {
    return NextResponse.json({ error: "SYNDICA_RPC_URL missing" }, { status: 500 });
  }
  const address = params?.address;
  if (!address) return NextResponse.json({ error: "No address param" }, { status: 400 });

  try {
    const helius = new Helius(HELIUS_API_KEY);
    const connection = new Connection(SYNDICA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const before = searchParams.get("before") || undefined;

    const [signatures, tokenList] = await Promise.all([
      connection.getSignaturesForAddress(pubkey, { limit, before }),
      loadTokenMap(),
    ]);

    if (!Array.isArray(signatures) || signatures.length === 0) {
      return NextResponse.json({ transactions: [], nextCursor: null, addressBalances: {} });
    }

    const sigs = signatures.map((s) => s.signature);
    const parsed = await helius.rpc.parseTransactions({ transactions: sigs });
    const txs: Transaction[] = Array.isArray(parsed) ? parsed : [];

    // gather mints for pricing
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const mints = new Set<string>([SOL_MINT]);
    for (const tx of txs) {
      for (const t of tx.tokenTransfers ?? []) if (t.mint) mints.add(t.mint);
    }
    const prices = await getTokenPrices(Array.from(mints));

    const processed = processHeliusTransactions(txs, address, prices, tokenList);

    const nextCursor = signatures.length === limit ? signatures[signatures.length - 1].signature : null;

    return NextResponse.json({ transactions: processed, nextCursor });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json({ error: err?.message || "Unknown" }, { status: 500 });
  }
}