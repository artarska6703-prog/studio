// src/app/api/wallet/[address]/details/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius } from "helius-sdk";
import { NextResponse } from "next/server";
import { getTokenPrices } from "@/lib/price-utils";
import { loadTokenMap } from "@/lib/token-list";
import type { WalletDetails, TokenHolding } from "@/lib/types";

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

    if (assets && assets.items) {
        assets.items.forEach(asset => {
             if (asset.interface === 'FungibleToken' && asset.id && asset.token_info?.balance && asset.token_info.balance > 0) {
                 tokenMints.add(asset.id);
             }
        });
    }

    // 3) Fetch prices + token symbols
    const [prices, tokenMap] = await Promise.all([
      getTokenPrices(Array.from(tokenMints)),
      loadTokenMap(),
    ]);

    // 4) Compose tokens list
    let tokens: TokenHolding[] = [];
    if (assets && assets.items) {
         tokens = assets.items
            .filter(asset => asset.interface === 'FungibleToken' && asset.content?.metadata && asset.token_info?.balance)
            .map(asset => {
                const mint = asset.id as string;
                const price = prices[mint] ?? 0;
                const amount = asset.token_info.balance / (10 ** asset.token_info.decimals);
                const valueUSD = amount * price;

                return {
                    mint: asset.id,
                    name: asset.content.metadata.name || 'Unknown Token',
                    symbol: asset.content.metadata.symbol || '???',
                    amount: amount,
                    decimals: asset.token_info.decimals,
                    valueUSD: valueUSD,
                    icon: asset.content.files?.[0]?.uri,
                    tokenStandard: asset.token_info.token_program as any,
                    price: price,
                };
            })
            .filter(token => token.amount > 0);
    }

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
    return NextResponse.json({ message: `Failed to fetch wallet details: ${err.message}` }, { status: 500 });
  }
}
