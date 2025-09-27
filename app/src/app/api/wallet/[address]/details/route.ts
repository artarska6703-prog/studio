
// src/app/api/wallet/[address]/details/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { TokenHolding, WalletDetails } from "@/lib/types";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;
  const heliusRpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

  if (!HELIUS_API_KEY) {
    return NextResponse.json({ message: "Server configuration error: Helius API key is missing." }, { status: 500 });
  }
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ message: "Invalid Solana address format." }, { status: 400 });
  }

  try {
    const response = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'solviz-get-assets',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: address,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: true,
            showNativeBalance: true, // Explicitly request native SOL balance
          },
        },
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API WALLET DETAILS] Helius API error: ${response.status}`, errorText);
        throw new Error(`Failed to fetch assets from Helius: ${response.statusText}`);
    }

    const { result } = await response.json();

    const tokens: TokenHolding[] = [];

    for (const asset of result.items) {
      if (asset.interface === 'FungibleToken' && asset.token_info) {
        const price = asset.token_info.price_info?.price_per_token || 0;
        const amount = asset.token_info.balance / Math.pow(10, asset.token_info.decimals);
        tokens.push({
          mint: asset.id,
          name: asset.content?.metadata?.name || 'Unknown Token',
          symbol: asset.content?.metadata?.symbol || '???',
          amount: amount,
          decimals: asset.token_info.decimals,
          price: price,
          valueUSD: amount * price,
          icon: asset.content?.links?.image,
          tokenStandard: asset.token_info.token_program,
        });
      }
    }
    
    // Correctly get SOL balance and price from the `nativeBalance` object
    const solBalance = (result.nativeBalance?.lamports || 0) / LAMPORTS_PER_SOL;
    const solPrice = result.nativeBalance?.price_per_sol || 0;
    const solValueUSD = solBalance * solPrice;

    const body: WalletDetails = {
      address,
      sol: { balance: solBalance, price: solPrice, valueUSD: solValueUSD },
      tokens,
    };

    return NextResponse.json(body);
  } catch (error: any) {
    console.error(`[API WALLET DETAILS] Failed for ${params.address}:`, error);
    // Helius API might return an error for an address that doesn't exist on-chain yet
    if (String(error?.message || "").includes("ownerAddress not found")) {
      const empty: WalletDetails = { address: params.address, sol: { balance: 0, price: 0, valueUSD: 0 }, tokens: [] };
      return NextResponse.json(empty);
    }
    return NextResponse.json({ message: `Failed to fetch wallet details: ${error?.message || "Unknown error"}` }, { status: 500 });
  }
}
