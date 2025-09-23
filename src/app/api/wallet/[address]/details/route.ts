// src/app/api/wallet/[address]/details/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import { getTokenPrices } from "@/lib/price-utils";
import { loadTokenMap } from "@/lib/token-list";
import type { WalletDetails } from "@/lib/types";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL;

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
  const { address } = params || {};
  if (!address) {
    return NextResponse.json({ error: "No address param" }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY);
    const connection = new Connection(SYNDICA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(address);

    // 1) Fetch assets owned by wallet
    const assets = await helius.rpc.getAssetsByOwner({
      ownerAddress: pubkey.toBase58(),
    });

    // 2) Build set of mints (include SOL mint always)
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const tokenMints = new Set<string>([SOL_MINT]);

    for (const it of assets?.items ?? []) {
      if (it.interface === "FungibleToken" && it.id) {
        tokenMints.add(it.id);
      }
    }

    // 3) Fetch prices + token symbols
    const [prices, tokenMap] = await Promise.all([
      getTokenPrices(Array.from(tokenMints)),
      loadTokenMap(),
    ]);

    // 4) Compose tokens list
    const tokens = (assets?.items ?? [])
      .filter((a: any) => a.interface === "FungibleToken")
      .map((a: any) => {
        const mint = a.id as string;
        const symbol = tokenMap.get(mint) || mint.slice(0, 4);
        const amount =
          a.token_info?.balance ??
          a.token_info?.amount ??
          0;
        const price = prices[mint] ?? 0;
        const valueUSD = amount * price;
        return { mint, symbol, amount, price, valueUSD };
      });

    // 5) SOL balance/value
    const lamports = await connection.getBalance(pubkey);
    const solBalance = lamports / LAMPORTS_PER_SOL;
    const solPrice = prices[SOL_MINT] ?? 0;
    const solValueUSD = solBalance * solPrice;

    const response: WalletDetails = {
      address,
      sol: { balance: solBalance, price: solPrice, valueUSD: solValueUSD },
      tokens,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[details] error:", err);
    if (err.message && err.message.includes('could not find account')) {
        const walletDetails: WalletDetails = { 
          address, 
          sol: { balance: 0, price: 0, valueUSD: 0 }, 
          tokens: [] 
        };
        return NextResponse.json(walletDetails);
    }
    return NextResponse.json({ error: err?.message || "Unknown" }, { status: 500 });
  }
}