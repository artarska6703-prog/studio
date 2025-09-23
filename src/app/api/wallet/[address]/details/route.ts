import { NextRequest, NextResponse } from 'next/server';
import { LAMPORTS_PER_SOL, PublicKey, Connection } from '@solana/web3.js';
import type { TokenHolding, WalletDetails } from '@/lib/types';
import { isValidSolanaAddress } from '@/lib/solana-utils';
import { Helius } from "helius-sdk";
import { unstable_cache } from 'next/cache';

const heliusApiKey = process.env.HELIUS_API_KEY;
const rpcEndpoint = process.env.SYNDICA_RPC_URL;

const getTokenPrices = unstable_cache(
    async (mints: string[]) => {
        if (mints.length === 0 || !heliusApiKey) return {};
        try {
            const helius = new Helius(heliusApiKey);
            const prices: { [mint: string]: number } = {};
            // Helius getAssetBatch is better but not available in all SDK versions easily.
            // Let's do it one by one and cache it.
            const pricePromises = mints.map(async (mint) => {
                try {
                    const asset = await helius.rpc.getAsset(mint);
                    if (asset?.token_info?.price_info?.price_per_token) {
                        return { mint, price: asset.token_info.price_info.price_per_token };
                    }
                } catch (e) {
                    console.error(`Failed to fetch price for mint ${mint} from Helius`, e);
                }
                return { mint, price: null };
            });

            const results = await Promise.all(pricePromises);
            
            for (const result of results) {
                if (result.price !== null) {
                    prices[result.mint] = result.price;
                }
            }
            return prices;
        } catch (error) {
            console.error("Failed to fetch token prices from Helius:", error);
            return {};
        }
    },
    ['helius-token-prices'],
    { revalidate: 60 } // Revalidate every 60 seconds
);


const getSolanaPrice = unstable_cache(
    async () => {
        if (!heliusApiKey) return null;
        try {
            const helius = new Helius(heliusApiKey);
            const asset = await helius.rpc.getAsset("So11111111111111111111111111111111111111112");
            return asset?.token_info?.price_info?.price_per_token ?? null;
        } catch (error) {
            console.error("Failed to fetch Solana price from Helius:", error);
            return null;
        }
    },
    ['helius-solana-price'],
    { revalidate: 60 }
);


export async function GET(
    request: NextRequest,
    { params }: { params: { address: string } }
) {
    const { address } = params;

    if (!isValidSolanaAddress(address)) {
        return NextResponse.json({ message: 'Invalid Solana address format.' }, { status: 400 });
    }

    if (!heliusApiKey) {
        return NextResponse.json({ message: 'Helius API key is not configured.' }, { status: 500 });
    }
     if (!rpcEndpoint) {
        return NextResponse.json({ message: 'RPC endpoint is not configured.' }, { status: 500 });
    }

    try {
        const helius = new Helius(heliusApiKey);
        const connection = new Connection(rpcEndpoint, 'confirmed');

        const [solBalanceLamports, assets] = await Promise.all([
            connection.getBalance(new PublicKey(address)),
            helius.rpc.getAssetsByOwner({ ownerAddress: address, page: 1, limit: 1000 })
        ]);
        
        let tokens: TokenHolding[] = [];
        const tokenMints: string[] = []; 

        if (assets && assets.items) {
            assets.items.forEach(asset => {
                 if (asset.interface === 'FungibleToken' && asset.content?.metadata && asset.token_info?.balance && asset.token_info.balance > 0) {
                     tokenMints.push(asset.id);
                 }
            });
        }
        
        const [solPrice, tokenPrices] = await Promise.all([
            getSolanaPrice(),
            getTokenPrices(tokenMints)
        ]);
        
        const balance = solBalanceLamports / LAMPORTS_PER_SOL;
        const balanceUSD = solPrice ? balance * solPrice : null;

        if (assets && assets.items) {
             tokens = assets.items
                .filter(asset => asset.interface === 'FungibleToken' && asset.content?.metadata && asset.token_info?.balance)
                .map(asset => {
                    const amount = asset.token_info.balance / (10 ** asset.token_info.decimals);
                    const price = tokenPrices[asset.id];
                    const valueUSD = price ? amount * price : null;

                    return {
                        mint: asset.id,
                        name: asset.content.metadata.name || 'Unknown Token',
                        symbol: asset.content.metadata.symbol || '???',
                        amount: amount,
                        decimals: asset.token_info.decimals,
                        valueUSD: valueUSD,
                        icon: asset.content.files?.[0]?.uri,
                        tokenStandard: asset.token_info.token_program as any,
                    };
                })
                .filter(token => token.amount > 0);
        }

        const walletDetails: WalletDetails = { address, sol: { balance, price: solPrice, valueUSD}, tokens };
        
        return NextResponse.json(walletDetails);

    } catch (error: any) {
        console.error(`[API WALLET DETAILS] Failed to fetch for ${address}:`, error);
        // It's possible the account doesn't exist, which can be a valid case (e.g., empty wallet).
        if (error.message && error.message.includes('could not find account')) {
             const walletDetails: WalletDetails = { address, sol: { balance: 0, price: 0, valueUSD: 0 }, tokens: [] };
             return NextResponse.json(walletDetails);
        }
        return NextResponse.json({ message: `Failed to fetch wallet details: ${error.message}` }, { status: 500 });
    }
}
