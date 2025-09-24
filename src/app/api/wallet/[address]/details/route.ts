
import { NextRequest, NextResponse } from 'next/server';
import { LAMPORTS_PER_SOL, PublicKey, Connection } from '@solana/web3.js';
import type { TokenHolding, WalletDetails } from '@/lib/types';
import { isValidSolanaAddress } from '@/lib/solana-utils';
import { Helius } from "helius-sdk";
import { getTokenPrices } from '@/lib/price-utils';

const heliusApiKey = process.env.HELIUS_API_KEY;
const rpcEndpoint = process.env.SYNDICA_RPC_URL;
const SOL_MINT = "So11111111111111111111111111111111111111112";


export async function GET(
    request: NextRequest,
    { params }: { params: { address: string } }
) {
    const { address } = params;

    if (!heliusApiKey || !rpcEndpoint) {
        return NextResponse.json({ message: 'Server configuration error: API keys are missing.' }, { status: 500 });
    }

    if (!isValidSolanaAddress(address)) {
        return NextResponse.json({ message: 'Invalid Solana address format.' }, { status: 400 });
    }

    try {
        const helius = new Helius(heliusApiKey);
        const connection = new Connection(rpcEndpoint, 'confirmed');

        const [solBalanceLamports, assets] = await Promise.all([
            connection.getBalance(new PublicKey(address)),
            helius.rpc.getAssetsByOwner({ ownerAddress: address, page: 1, limit: 1000 })
        ]);
        
        const tokenMints = [SOL_MINT]; 
        if (assets && assets.items) {
            assets.items.forEach(asset => {
                 if (asset.interface === 'FungibleToken' && asset.content?.metadata && asset.token_info?.balance && asset.token_info.balance > 0) {
                     tokenMints.push(asset.id);
                 }
            });
        }
        
        const prices = await getTokenPrices(tokenMints);
        const solPrice = prices[SOL_MINT] ?? 0;

        const balance = solBalanceLamports / LAMPORTS_PER_SOL;
        const balanceUSD = balance * solPrice;

        let tokens: TokenHolding[] = [];
        if (assets && assets.items) {
             tokens = assets.items
                .filter(asset => asset.interface === 'FungibleToken' && asset.content?.metadata && asset.token_info?.balance)
                .map(asset => {
                    const amount = asset.token_info.balance / (10 ** asset.token_info.decimals);
                    const price = prices[asset.id] ?? 0;
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
                    };
                })
                .filter(token => token.amount > 0);
        }

        const walletDetails: WalletDetails = { 
            address, 
            sol: { 
                balance, 
                price: solPrice, 
                valueUSD: balanceUSD 
            }, 
            tokens 
        };
        
        return NextResponse.json(walletDetails);

    } catch (error: any) {
        console.error(`[API WALLET DETAILS] Failed to fetch for ${address}:`, error);
        if (error.message && error.message.includes('could not find account')) {
             const walletDetails: WalletDetails = { address, sol: { balance: 0, price: 0, valueUSD: 0 }, tokens: [] };
             return NextResponse.json(walletDetails);
        }
        return NextResponse.json({ message: `Failed to fetch wallet details: ${error.message}` }, { status: 500 });
    }
}
