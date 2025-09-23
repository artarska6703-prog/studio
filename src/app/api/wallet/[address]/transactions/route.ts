
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius, TransactionType, type EnrichedTransaction } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, TokenHolding } from "@/lib/types";
import { unstable_cache } from "next/cache";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const getTokenPrices = unstable_cache(
    async (mints: string[]) => {
        if (mints.length === 0) return {};
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${mints.join(',')}&vs_currencies=usd`);
            if (!response.ok) {
                console.error(`CoinGecko API request failed for tokens: ${response.status} ${await response.text()}`);
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
    { revalidate: 60 * 5 } // Revalidate every 5 minutes
);

const getSolanaPrice = unstable_cache(
    async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            if (!response.ok) {
                console.error(`CoinGecko API request failed for SOL: ${response.status} ${await response.text()}`);
                return null;
            }
            const data = await response.json();
            return data.solana.usd as number;
        } catch (error) {
            console.error("Failed to fetch Solana price from CoinGecko:", error);
            return null;
        }
    },
    ['solana-price'],
    { revalidate: 60 } // Revalidate every 60 seconds
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

    return flattenedTxs;
}


export async function GET(
  req: Request,
  { params }: { params?: { address?: string } }
) {
  if (!HELIUS_API_KEY) {
    return NextResponse.json({ error: "Server configuration error: Helius API key is missing." }, { status: 500 });
  }

  try {
    if (!params?.address) {
      return NextResponse.json({ error: "No address provided" }, { status: 400 });
    }
    
    const helius = new Helius(HELIUS_API_KEY);
    
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || undefined;

    const transactions = await helius.rpc.getTransactions({
      address: params.address,
      options: { limit: 50, before },
    });
    
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ transactions: [], nextCursor: null });
    }
    
    const allTokenMints = transactions
      .flatMap(tx => tx.tokenTransfers?.map(t => t.mint) || [])
      .filter((mint): mint is string => !!mint);
    const uniqueTokenMints = Array.from(new Set(allTokenMints));

    const [solPrice, tokenPrices] = await Promise.all([
      getSolanaPrice(),
      getTokenPrices(uniqueTokenMints)
    ]);
    
    const processedTxs = processHeliusTransactions(transactions, params.address, solPrice, tokenPrices);
    
    const nextCursor = transactions.length > 0 ? transactions[transactions.length - 1]?.signature : null;

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
    return NextResponse.json({ error: errorMessage, stack: String(err) }, { status: 500 });
  }
}

    