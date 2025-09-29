
// src/app/api/wallet/[address]/details/route.ts
import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL, PublicKey, Connection } from "@solana/web3.js";
import type { TokenHolding, WalletDetails } from "@/lib/types";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { getTokenPrices } from "@/lib/price-utils";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_ENDPOINT = process.env.SYNDICA_RPC_URL!;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

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
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const pubkey = new PublicKey(address);

    // Get SOL balance and price concurrently
    const [lamports, prices] = await Promise.all([
      connection.getBalance(pubkey).catch(e => {
          if (String(e?.message || "").includes("could not find account")) return 0;
          throw e;
      }),
      getTokenPrices([SOL_MINT])
    ]);
    
    const solAmount = lamports / LAMPORTS_PER_SOL;
    const solPrice = prices[SOL_MINT] ?? 0;
    const solValueUSD = solAmount * solPrice;

    // Get Assets (tokens, NFTs, etc.) using direct fetch
    const assetsResponse = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'solviz-get-assets',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: address,
          page: 1,
          limit: 1000,
        },
      }),
    });
    
    if (!assetsResponse.ok) {
        const errorData = await assetsResponse.json();
        console.error("Helius API error response:", errorData);
        throw new Error(`Helius RPC error: ${assetsResponse.status} ${assetsResponse.statusText}`);
    }

    const assetsData = await assetsResponse.json();
    const assets = assetsData?.result;


    // Build tokens list (excluding SOL, which is handled separately)
    const tokens: TokenHolding[] = (assets?.items ?? [])
      .filter(a => a.interface === "FungibleToken" && a.token_info?.balance && a.id !== SOL_MINT)
      .map(a => {
        const decimals = a.token_info?.decimals ?? 0;
        const raw = a.token_info?.balance ?? 0;
        const amount = raw / Math.pow(10, decimals);
        // Price and valueUSD will be calculated on the client after this fetch.
        return {
          mint: a.id,
          name: a.content?.metadata?.name || "Unknown Token",
          symbol: a.content?.metadata?.symbol || "???",
          amount,
          decimals,
          price: 0, // Default to 0, will be updated on client
          valueUSD: 0, // Default to 0
          icon: a.content?.files?.[0]?.uri,
          tokenStandard: a.token_info?.token_program as any,
        };
      });

    const body: WalletDetails = {
      address,
      sol: { balance: solAmount, price: solPrice, valueUSD: solValueUSD },
      tokens,
    };

    return NextResponse.json(body);
  } catch (error: any) {
    console.error(`[API WALLET DETAILS] Failed for ${params.address}:`, error);
    // CRITICAL FIX: Always return a valid, empty WalletDetails object with a 200 status
    // to prevent the parent page from crashing with a 404.
    const empty: WalletDetails = { address: params.address, sol: { balance: 0, price: 0, valueUSD: 0 }, tokens: [] };
    return NextResponse.json(empty, { status: 200 });
  }
}
