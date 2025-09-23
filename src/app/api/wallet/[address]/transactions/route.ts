
// src/app/api/wallet/[address]/transactions/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

function processHeliusTransactions(
  transactions: Transaction[],
  walletAddress: string,
  prices: Record<string, number>
): FlattenedTransaction[] {
  const out: FlattenedTransaction[] = [];
  if (!transactions || !transactions.length) return out;

  for (const tx of transactions) {
    let hasRelevant = false;

    const handle = (transfers: any[] | undefined, isNative: boolean) => {
      if (!transfers) return;
      for (const t of transfers) {
        if (
          t.fromUserAccount !== walletAddress &&
          t.toUserAccount !== walletAddress
        )
          continue;

        hasRelevant = true;
        const finalAmount =
          t.fromUserAccount === walletAddress ? -t.amount : t.amount;
        const mint = isNative
          ? "So11111111111111111111111111111111111111112"
          : t.mint;
        
        const price = prices[mint];
        const valueUSD = price ? Math.abs(t.amount) * price : null;

        out.push({
          ...tx,
          type: finalAmount > 0 ? "received" : "sent",
          amount: finalAmount,
          symbol: isNative ? "SOL" : mint.slice(0, 4),
          mint: isNative ? null : t.mint,
          from: t.fromUserAccount,
          to: t.toUserAccount,
          by: tx.feePayer,
          interactedWith: [tx.feePayer, t.fromUserAccount, t.toUserAccount].filter(
            (a) => a && a !== walletAddress
          ),
          valueUSD,
        });
      }
    };

    handle(tx.nativeTransfers, true);
    handle(tx.tokenTransfers, false);

    if (!hasRelevant && tx.feePayer === walletAddress) {
      out.push({
        ...tx,
        type: "program_interaction",
        amount: 0,
        symbol: null,
        mint: null,
        from: tx.feePayer,
        to: tx.instructions?.[0]?.programId,
        by: tx.feePayer,
        interactedWith: tx.instructions?.map((i) => i.programId),
        valueUSD: null,
      });
    }
  }
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: { address: string } }
) {
  const { address } = params;
  if (!address) {
    return NextResponse.json({ error: "No address param" }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY!);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const parsed = await helius.rpc.getTransactions({
      address: address,
      limit: limit,
    });
    const txs: Transaction[] = parsed.map(tx => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        feePayer: tx.feePayer,
        type: tx.type,
        nativeTransfers: tx.nativeTransfers,
        tokenTransfers: tx.tokenTransfers,
        instructions: tx.instructions.map(i => ({programId: i.programId})),
    }));

    const mints = new Set<string>();
    mints.add("So11111111111111111111111111111111111111112"); // SOL
    for (const tx of txs) {
      for (const t of tx.tokenTransfers ?? []) {
        mints.add(t.mint!);
      }
    }
    const prices = await getTokenPrices(Array.from(mints));

    const processed = processHeliusTransactions(txs, address, prices);

    const addrSet = new Set<string>();
    for (const t of processed) {
      if (t.from) addrSet.add(t.from);
      if (t.to) addrSet.add(t.to);
    }
    const addrArr = Array.from(addrSet);
    const connection = new Connection(process.env.SYNDICA_RPC_URL!);
    const infos = await connection.getMultipleAccountsInfo(addrArr.map(a => new PublicKey(a)));
    
    const addressBalances: Record<string, number> = {};
    infos.forEach((acc, i) => {
        addressBalances[addrArr[i]] = acc ? acc.lamports / LAMPORTS_PER_SOL : 0;
    });

    return NextResponse.json({ transactions: processed, addressBalances });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json({ error: err.message || "Unknown" }, { status: 500 });
  }
}
