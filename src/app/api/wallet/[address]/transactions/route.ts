
import { Helius, TransactionType, type EnrichedTransaction } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction } from "@/lib/types";
import { unstable_cache } from "next/cache";
import { Connection, PublicKey } from "@solana/web3.js";

const heliusApiKey = process.env.HELIUS_API_KEY;
const rpcEndpoint = process.env.SYNDICA_RPC_URL;
const LAMPORTS_PER_SOL = 1_000_000_000;

const getTokenPrices = unstable_cache(
    async (mints: string[]) => {
        if (mints.length === 0 || !heliusApiKey) return {};
        const helius = new Helius(heliusApiKey);
        try {
            const prices: { [mint: string]: number } = {};
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
        const helius = new Helius(heliusApiKey);
        try {
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

const processHeliusTransactions = (
    transactions: EnrichedTransaction[], 
    walletAddress: string, 
    solPrice: number | null, 
    tokenPrices: Record<string, number>
): FlattenedTransaction[] => {
    const flattenedTxs: FlattenedTransaction[] = [];
    if (!transactions || transactions.length === 0) return flattenedTxs;

    transactions.forEach(tx => {
        if (!tx) return;
        let hasRelevantTransfer = false;
        
        const processTransfers = (transfers: any[] | undefined | null, isNative: boolean) => {
            if (!transfers) return;
            transfers.forEach(transfer => {
                const isOwnerInvolved = transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress || transfer.owner === walletAddress;
                
                if (isOwnerInvolved && (isNative ? transfer.amount > 0 : transfer.tokenAmount > 0)) {
                    hasRelevantTransfer = true;
                    
                    const amountRaw = isNative ? transfer.amount / LAMPORTS_PER_SOL : transfer.tokenAmount;
                    const sign = (transfer.fromUserAccount === walletAddress || (transfer.owner === walletAddress && transfer.fromUserAccount !== walletAddress)) ? -1 : 1;
                    const finalAmount = sign * amountRaw;

                    let valueUSD: number | null = null;
                    const mint = isNative ? 'So11111111111111111111111111111111111111112' : transfer.mint;
                    const price = isNative ? solPrice : tokenPrices[mint];
                    
                    if (price) {
                        valueUSD = Math.abs(finalAmount) * price;
                    }

                    flattenedTxs.push({
                        ...tx,
                        type: finalAmount > 0 ? 'received' : 'sent',
                        amount: finalAmount,
                        symbol: isNative ? 'SOL' : null, 
                        mint: mint,
                        from: transfer.fromUserAccount,
                        to: transfer.toUserAccount,
                        by: tx.feePayer,
                        instruction: tx.type,
                        interactedWith: Array.from(new Set([tx.feePayer, transfer.fromUserAccount, transfer.toUserAccount].filter(a => a && a !== walletAddress))),
                        valueUSD: valueUSD,
                    });
                }
            });
        };
        
        processTransfers(tx.nativeTransfers, true);
        processTransfers(tx.tokenTransfers, false);

        if (!hasRelevantTransfer && tx.feePayer === walletAddress) {
            flattenedTxs.push({
                ...tx,
                type: 'program_interaction',
                amount: 0,
                symbol: null,
                mint: null,
                from: tx.feePayer,
                to: tx.accountData?.[0]?.programId || null,
                by: tx.feePayer,
                instruction: tx.type,
                interactedWith: Array.from(new Set(tx.accountData?.map(i => i.programId).filter(Boolean) as string[])),
                valueUSD: null,
            });
        }
    });

    return flattenedTxs.sort((a,b) => (b.blockTime || 0) - (a.blockTime || 0));
}


export async function GET(
  req: Request,
  { params }: { params?: { address?: string } }
) {
  if (!heliusApiKey || !rpcEndpoint) {
    return NextResponse.json({ error: "Server configuration error: API keys or RPC URL is missing." }, { status: 500 });
  }

  try {
    if (!params?.address) {
      return NextResponse.json({ error: "No address provided" }, { status: 400 });
    }
    
    const helius = new Helius(heliusApiKey);
    const connection = new Connection(rpcEndpoint, 'confirmed');

    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || undefined;

    const signatures = await connection.getSignaturesForAddress(
        new PublicKey(params.address), 
        { limit: 50, before }
    );

    if (!signatures || signatures.length === 0) {
      return NextResponse.json({ transactions: [], nextCursor: null });
    }
    
    const transactions = await helius.parser.parseTransaction({
        transactions: signatures.map(s => s.signature),
    });

    const allTokenMints = transactions
      .flatMap(tx => tx.tokenTransfers?.map(t => t.mint) || [])
      .filter((mint): mint is string => !!mint);
    const uniqueTokenMints = Array.from(new Set(allTokenMints));

    const [solPrice, tokenPrices] = await Promise.all([
      getSolanaPrice(),
      getTokenPrices(uniqueTokenMints)
    ]);
    
    const processedTxs = processHeliusTransactions(transactions, params.address, solPrice, tokenPrices);
    
    const nextCursor = signatures.length > 0 ? signatures[signatures.length - 1]?.signature : null;

    return NextResponse.json({
      transactions: processedTxs,
      nextCursor,
    });
  } catch (err: any) {
    console.error("[API TRANSACTIONS] Error fetching transactions:", err);
    const errorMessage = err?.message || "An unknown error occurred.";
    if (errorMessage.includes('429')) {
      return NextResponse.json({ error: 'Rate limited by API. Please try again in a moment.' }, { status: 429 });
    }
    return NextResponse.json({ error: `Failed to fetch transactions: ${errorMessage}` }, { status: 500 });
  }
}
