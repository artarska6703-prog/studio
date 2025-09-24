
// src/app/api/wallet/[address]/details/route.ts
import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL, PublicKey, Connection } from "@solana/web3.js";
import type { TokenHolding, WalletDetails } from "@/lib/types";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { Helius } from "helius-sdk";
import { getTokenPrices } from "@/lib/price-utils";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_ENDPOINT = process.env.SYNDICA_RPC_URL!;
const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!HELIUS_API_KEY || !RPC_ENDPOINT) {
    return NextResponse.json({ message: "Server configuration error: API keys are missing." }, { status: 500 });
  }
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ message: "Invalid Solana address format." }, { status: 400 });
  }

  try {
    const helius = new Helius(HELIUS_API_KEY);
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const pubkey = new PublicKey(address);

    // SOL balance
    let lamports = 0;
    try {
      lamports = await connection.getBalance(pubkey);
    } catch (e: any) {
      if (!String(e?.message || "").includes("could not find account")) throw e;
    }
    const solAmount = lamports / LAMPORTS_PER_SOL;

    // Assets
    const assets = await helius.rpc.getAssetsByOwner({
      ownerAddress: address,
      page: 1,
      limit: 1000,
    });

    // Collect mints (always include SOL)
    const mints: string[] = [SOL_MINT];
    for (const a of assets?.items ?? []) {
      if (a.interface === "FungibleToken" && a.token_info?.balance) {
        mints.push(a.id);
      }
    }

    const prices = await getTokenPrices(mints);
    const solPrice = prices[SOL_MINT] ?? 0;
    const solValueUSD = solAmount * solPrice;

    // Build tokens list (no USD filter)
    const tokens: TokenHolding[] = (assets?.items ?? [])
      .filter(a => a.interface === "FungibleToken" && a.token_info?.balance)
      .map(a => {
        const decimals = a.token_info?.decimals ?? 0;
        const raw = a.token_info?.balance ?? 0; // could be raw units
        const amount = raw / Math.pow(10, decimals);
        const price = prices[a.id] ?? 0;
        return {
          mint: a.id,
          name: a.content?.metadata?.name || "Unknown Token",
          symbol: a.content?.metadata?.symbol || "???",
          amount,
          decimals,
          price,
          valueUSD: amount * price,
          icon: a.content?.files?.[0]?.uri,
          tokenStandard: a.token_info?.token_program as any,
        };
      });

    console.log("🔍 Prices:", prices);
    console.log("💰 Tokens:", tokens);

    const body: WalletDetails = {
      address,
      sol: { balance: solAmount, price: solPrice, valueUSD: solValueUSD },
      tokens,
    };

    console.log("✅ [API] Prices object:", prices);
    console.log("✅ [API] Token response:", tokens);
    console.log("✅ [API] SOL:", solAmount, solPrice, solValueUSD);

    return NextResponse.json(body);
  } catch (error: any) {
    console.error(`[API WALLET DETAILS] Failed for ${params.address}:`, error);
    if (String(error?.message || "").includes("could not find account")) {
      const empty: WalletDetails = { address: params.address, sol: { balance: 0, price: 0, valueUSD: 0 }, tokens: [] };
      return NextResponse.json(empty);
    }
    return NextResponse.json({ message: `Failed to fetch wallet details: ${error?.message || "Unknown error"}` }, { status: 500 });
  }
}
