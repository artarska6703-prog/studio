
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
        if (mints.length === 0) return {};
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${mints.join(',')}&vs_currencies=usd`, {
                next: { revalidate: 60 * 5 } // Revalidate every 5 minutes
            });
            if (!response.ok) {
                console.error("CoinGecko API request failed for tokens:", response.status, await response.text());
                return {};
            }
            const data = await response.json();
            const prices: { [mint: string]: number } = {};
            for (const mint of mints) {
                if (data[mint] && data[mint].usd) {
                    prices[mint] = data[mint].usd;
                }
            }
            return prices;
        } catch (error) {
            console.error("Failed to fetch token prices from CoinGecko:", error);
            return {};
        }
    },
    ['token-prices'],
    { revalidate: 60 * 5 }
);

const getSolanaPrice = unstable_cache(
    async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
                next: { revalidate: 60 } // Revalidate every 60 seconds
            });
            if (!response.ok) {
                console.error("CoinGecko API request failed:", response.status, await response.text());
                return null;
            }
            const data = await response.json();
            return data.solana.usd;
        } catch (error) {
            console.error("Failed to fetch Solana price from CoinGecko:", error);
            return null;
        }
    },
    ['solana-price'],
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

        const [solPrice, solBalanceLamports, assets] = await Promise.all([
            getSolanaPrice(),
            connection.getBalance(new PublicKey(address)),
            helius.rpc.getAssetsByOwner({ ownerAddress: address, page: 1, limit: 1000 })
        ]);
        
        const balance = solBalanceLamports / LAMPORTS_PER_SOL;
        const balanceUSD = solPrice ? balance * solPrice : null;
        
        let tokens: TokenHolding[] = [];
        const tokenMints: string[] = [];

        if (assets && assets.items) {
            assets.items.forEach(asset => {
                 if (asset.interface === 'FungibleToken' && asset.content?.metadata && asset.token_info?.balance && asset.token_info.balance > 0) {
                     tokenMints.push(asset.id);
                 }
            });

            const tokenPrices = await getTokenPrices(tokenMints);

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

        const walletDetails: WalletDetails = { address, balance, balanceUSD, tokens };
        
        return NextResponse.json(walletDetails);

    } catch (error: any) {
        console.error(`[API WALLET DETAILS] Failed to fetch for ${address}:`, error);
        // It's possible the account doesn't exist, which can be a valid case (e.g., empty wallet).
        if (error.message && error.message.includes('could not find account')) {
             const walletDetails: WalletDetails = { address, balance: 0, balanceUSD: 0, tokens: [] };
             return NextResponse.json(walletDetails);
        }
        return NextResponse.json({ message: `Failed to fetch wallet details: ${error.message}` }, { status: 500 });
    }
}
