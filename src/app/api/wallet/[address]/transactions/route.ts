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

        // Amount (robust)
        const amt =
          isNative
            ? (t.amount || 0) / LAMPORTS_PER_SOL
            : (typeof t.tokenAmount === "number"
                ? t.tokenAmount
                : (t.amount && t.decimals
                    ? t.amount / Math.pow(10, t.decimals)
                    : 0));

        // skip zeros
        if (!amt) continue;

        hasRelevant = true;

        const outgoing =
          t.fromUserAccount === walletAddress ||
          (t.owner === walletAddress && t.fromUserAccount !== walletAddress);

        const finalAmount = outgoing ? -amt : amt;
        const mint = isNative
          ? "So11111111111111111111111111111111111111112"
          : t.mint;

        const price = prices[mint] ?? 0;            // always number
        const valueUSD = Math.abs(amt) * price;     // always number

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

export async function GET(req: Request, { params }: { params: { address: string } }) {
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

    // Helius parse expects an array of signatures in modern SDKs (or raw txs in older patterns)
    const sigs = signatures.map((s) => s.signature);
    const parsed = await helius.parseTransactions({ transactions: sigs });
    const txs: Transaction[] = Array.isArray(parsed) ? parsed : [];

    // gather all mints for pricing
    const mints = new Set<string>(["So11111111111111111111111111111111111111112"]);
    for (const tx of txs) {
      for (const t of tx.tokenTransfers ?? []) if (t.mint) mints.add(t.mint);
    }
    const prices = await getTokenPrices(Array.from(mints));

    // process
    const processed = processHeliusTransactions(txs, address, prices, tokenList);

    // (optional) balances for addresses you interacted with
    const addrs = new Set<string>();
    for (const t of processed) {
      if (t.from) addrs.add(t.from);
      if (t.to) addrs.add(t.to);
    }
    const addrArr = Array.from(addrs);
    const infos = addrArr.length
      ? await connection.getMultipleAccountsInfo(addrArr.map((a) => new PublicKey(a)))
      : [];
    const addressBalances: Record<string, number> = {};
    infos.forEach((acc, i) => {
      addressBalances[addrArr[i]] = acc ? acc.lamports / LAMPORTS_PER_SOL : 0;
    });

    const nextCursor = signatures[signatures.length - 1]?.signature || null;

    return NextResponse.json({ transactions: processed, nextCursor, addressBalances });
  } catch (err: any) {
    console.error("[transactions] error:", err);
    return NextResponse.json({ error: err?.message || "Unknown" }, { status: 500 });
  }
}
