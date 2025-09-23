
// src/app/api/wallet/[address]/details/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import { getTokenPrices } from "@/lib/price-utils";
import type { WalletDetails, TokenHolding } from "@/lib/types";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL;

export async function GET(
  req: Request,
  { params }: { params: { address: string } }
) {
  const { address } = params || {};
  if (!address) {
    return NextResponse.json({ error: "No address param" }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY!);
    const connection = new Connection(SYNDICA_RPC_URL!, "confirmed");
    const pubkey = new PublicKey(address);

    const assets = await helius.rpc.getAssetsByOwner({
      ownerAddress: pubkey.toBase58(),
    });

    const tokenMints = [
      "So11111111111111111111111111111111111111112"
    ];

    const tokenPrices = await getTokenPrices(tokenMints);

    const tokens: TokenHolding[] = (assets.items || [])
      .filter((asset: any) => asset.interface === 'FungibleToken' && asset.content?.metadata)
      .filter((asset: any) => asset.price_info)
      .map((asset: any) => ({
        mint: asset.id,
        symbol: asset.content.metadata.symbol,
        amount: asset.token_info.balance / (10 ** asset.token_info.decimals),
        price: asset.price_info.price_per_token,
        valueUSD: asset.price_info.total_price,
      }));

    const lamports = await connection.getBalance(pubkey);
    const balance = lamports / LAMPORTS_PER_SOL;
    const solPrice = tokenPrices["So11111111111111111111111111111111111111112"];
    const balanceUSD = solPrice ? balance * solPrice : null;

    const response: WalletDetails = {
      address,
      balance,
      balanceUSD,
      tokens,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[details] error:", err);
    if (err.message && err.message.includes('could not find account')) {
         const walletDetails: WalletDetails = { address, balance: 0, balanceUSD: 0, tokens: [] };
         return NextResponse.json(walletDetails);
    }
    return NextResponse.json({ error: `Failed to fetch wallet details: ${err.message}` }, { status: 500 });
  }
}
