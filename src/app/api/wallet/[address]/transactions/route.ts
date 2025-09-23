
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
        to: tx.instructions?.[0]?.programId,
        by: tx.feePayer,
        interactedWith: tx.instructions?.map((i) => i.programId),
        valueUSD: 0,
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
  const { address } = params;
  if (!address) {
    return NextResponse.json({ error: "No address param" }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY!);
    const connection = new Connection(SYNDICA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const before = searchParams.get("before") || undefined;
    
    const [signatures, tokenList] = await Promise.all([
      connection.getSignaturesForAddress(pubkey, { limit, before }),
      loadTokenMap(),
    ]);

    if (!signatures || signatures.length === 0) {
      return NextResponse.json({ transactions: [], addressBalances: {}, nextCursor: null });
    }

    const sigs = signatures.map((s) => s.signature);
    const parsedTxs = await helius.rpc.parseTransactions({transactions: sigs});

    const txs: Transaction[] = Array.isArray(parsedTxs) ? parsedTxs : [];

    const mints = new Set<string>();
    mints.add("So11111111111111111111111111111111111111112"); // SOL
    for (const tx of txs) {
      for (const t of tx.tokenTransfers ?? []) {
        if(t.mint) mints.add(t.mint);
      }
    }
    const prices = await getTokenPrices(Array.from(mints));

    const processed = processHeliusTransactions(txs, address, prices, tokenList);

    const addrSet = new Set<string>();
    for (const t of processed) {
      if (t.from) addrSet.add(t.from);
      if (t.to) addrSet.add(t.to);
    }
    const addrArr = Array.from(addrSet);
    const infos = await connection.getMultipleAccountsInfo(addrArr.map(a => new PublicKey(a)));
    
    const addressBalances: Record<string, number> = {};
    infos.forEach((acc, i) => {
        addressBalances[addrArr[i]] = acc ? acc.lamports / LAMPORTS_PER_SOL : 0;
    });
    
    const nextCursor = signatures.length === limit ? signatures[signatures.length - 1].signature : null;

    return NextResponse.json({ transactions: processed, addressBalances, nextCursor });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json({ error: err.message || "Unknown" }, { status: 500 });
  }
}
