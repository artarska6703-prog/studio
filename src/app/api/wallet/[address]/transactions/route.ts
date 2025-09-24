// src/app/api/wallet/[address]/transactions/route.ts
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadTokenMap } from "@/lib/token-list";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_ENDPOINT = process.env.SYNDICA_RPC_URL!;
const SOL_MINT = "So11111111111111111111111111111111111111112";

function toFlattened(
  transactions: Transaction[],
  walletAddress: string,
  prices: Record<string, number>,
  tokenMap: Map<string, string>
): FlattenedTransaction[] {
  const out: FlattenedTransaction[] = [];
  if (!transactions?.length) return out;

  for (const tx of transactions) {
    let any = false;
    const blockTime = tx.timestamp || tx.blockTime;

    const handle = (arr: any[] | undefined, isNative: boolean) => {
      if (!arr) return;
      for (const t of arr) {
        const involved = t.fromUserAccount === walletAddress || t.toUserAccount === walletAddress;
        if (!involved) continue;

        const amount = isNative
          ? (t.amount || 0) / 1e9
          : (typeof t.tokenAmount === "number"
              ? t.tokenAmount
              : 0);

        if (!amount) continue;
        any = true;

        const outgoing = t.fromUserAccount === walletAddress;
        const signed = outgoing ? -amount : amount;

        const mint = isNative ? SOL_MINT : t.mint;
        const price = prices[mint] ?? 0;
        const symbol = isNative ? "SOL" : (tokenMap.get(mint) || (t.mint?.slice(0, 4) ?? "?"));

        out.push({
          ...tx,
          blockTime,
          type: signed > 0 ? "received" : "sent",
          amount: signed,
          symbol,
          mint,
          from: t.fromUserAccount,
          to: t.toUserAccount,
          by: tx.feePayer,
          instruction: tx.type,
          interactedWith: Array.from(new Set([tx.feePayer, t.fromUserAccount, t.toUserAccount].filter(Boolean))).filter(a => a !== walletAddress),
          valueUSD: Math.abs(signed) * price, // numeric, never null
        });
      }
    };

    handle(tx.nativeTransfers, true);
    handle(tx.tokenTransfers, false);

    if (!any && tx.feePayer === walletAddress) {
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
  if (!HELIUS_API_KEY || !RPC_ENDPOINT) {
    return NextResponse.json({ error: "Server configuration error: API keys are missing." }, { status: 500 });
  }
  const address = params?.address || "";
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ error: "A valid wallet address must be provided." }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY);
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const publicKey = new PublicKey(address);

    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const sigInfo = await connection.getSignaturesForAddress(publicKey, { limit, before });
    if (!sigInfo?.length) {
      return NextResponse.json({ transactions: [], nextCursor: null });
    }

    const sigs = sigInfo.map(s => s.signature);
    const parsed = await helius.parseTransactions({ transactions: sigs });
    const txs = Array.isArray(parsed) ? parsed as Transaction[] : [];

    const tokenMap = await loadTokenMap();

    const mints = new Set<string>([SOL_MINT]);
    for (const tx of txs) for (const t of tx.tokenTransfers ?? []) if (t.mint) mints.add(t.mint);

    const prices = await getTokenPrices(Array.from(mints));
    console.log("✅ [API TRANSACTIONS] Fetched prices object:", prices);

    const flattened = toFlattened(txs, address, prices, tokenMap);
    const nextCursor = sigInfo[sigInfo.length - 1]?.signature || null;

    return NextResponse.json({ transactions: flattened, nextCursor });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}
