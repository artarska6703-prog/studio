
// src/app/api/wallet/[address]/details/route.ts
import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL, PublicKey, Connection } from "@solana/web3.js";
import type { TokenHolding, WalletDetails } from "@/lib/types";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { getTokenPrices } from "@/lib/price-utils";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
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
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const pubkey = new PublicKey(address);

    // Get SOL balance and price concurrently
    const [lamports, prices] = await Promise.all([
      connection.getBalance(pubkey).catch(e => {
          console.warn(`[API WALLET DETAILS] getBalance failed for ${address}:`, e?.message);
          return 0;
      }),
      getTokenPrices([SOL_MINT])
    ]);
    
    const solAmount = lamports / LAMPORTS_PER_SOL;
    const solPrice = prices[SOL_MINT] ?? 0;
    const solValueUSD = solAmount * solPrice;

    // Get Assets (tokens, NFTs, etc.) using a direct fetch call
    const response = await fetch(RPC_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAssetsByOwner',
            params: {
                ownerAddress: address,
                page: 1,
                limit: 1000,
            },
        }),
    });
    
    if (!response.ok) {
        throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`);
    }
    
    const { result: assets } = await response.json();

    // Build tokens list (excluding SOL, which is handled separately)
    const tokens: TokenHolding[] = (assets?.items ?? [])
      .filter((a: any) => a.interface === "FungibleToken" && a.token_info?.balance && a.id !== SOL_MINT)
      .map((a: any) => {
        const decimals = a.token_info?.decimals ?? 0;
        const raw = a.token_info?.balance ?? 0;
        const amount = raw / Math.pow(10, decimals);
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
    const empty: WalletDetails = { address: params.address, sol: { balance: 0, price: 0, valueUSD: 0 }, tokens: [] };
    return NextResponse.json(empty);
  }
}
