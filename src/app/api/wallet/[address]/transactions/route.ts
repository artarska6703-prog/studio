
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius, TransactionType } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";


const HELIUS_API_KEY = "9e385df8-c8d3-4916-9615-3c9320ca87ff";
const SYNDICA_RPC_URL = "https://solana-mainnet.api.syndica.io/api-key/4kc7afJfAHBE2BvjRPSNR8RcdcJxSEtc6oMqaDnEDzX8Mx5zYZRFXT67dHLmJNqcccdW817WZaM4edyHNqLp8839nq3W9DRaay6";
const SOL_MINT = "So11111111111111111111111111111111111111112";


const processHeliusTransactions = async (transactions: Transaction[], walletAddress: string): Promise<FlattenedTransaction[]> => {
    const flattenedTxs: FlattenedTransaction[] = [];
    if (!transactions || transactions.length === 0) return flattenedTxs;

    const mints = new Set<string>([SOL_MINT]);
    transactions.forEach(tx => {
        tx.tokenTransfers?.forEach(t => {
            if(t.mint) mints.add(t.mint);
        })
    });

    const prices = await getTokenPrices(Array.from(mints));
    const solPrice = prices[SOL_MINT] ?? 0;

    transactions.forEach(tx => {
        let hasRelevantTransfer = false;
        
        const processTransfers = (transfers: any[] | undefined | null, isNative: boolean) => {
            if (!transfers) return;
            transfers.forEach(transfer => {
                const isOwnerInvolved = transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress || transfer.owner === walletAddress;
                
                if (isOwnerInvolved && transfer.amount > 0) {
                    hasRelevantTransfer = true;
                    
                    const amountRaw = isNative ? transfer.amount / LAMPORTS_PER_SOL : transfer.tokenAmount;
                    const sign = (transfer.fromUserAccount === walletAddress || (transfer.owner === walletAddress && transfer.fromUserAccount !== walletAddress)) ? -1 : 1;
                    const finalAmount = sign * amountRaw;
                    
                    const mint = isNative ? SOL_MINT : transfer.mint;
                    const price = prices[mint] ?? 0;
                    const valueUSD = Math.abs(finalAmount) * price;

                    flattenedTxs.push({
                        ...tx,
                        blockTime: tx.timestamp || tx.blockTime,
                        type: finalAmount > 0 ? 'received' : 'sent',
                        amount: finalAmount,
                        symbol: isNative ? 'SOL' : transfer.mint, // temp symbol
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
                blockTime: tx.timestamp || tx.blockTime,
                type: 'program_interaction',
                amount: 0,
                symbol: null,
                mint: null,
                from: tx.feePayer,
                to: tx.instructions?.[0]?.programId || null,
                by: tx.feePayer,
                instruction: tx.type,
                interactedWith: Array.from(new Set(tx.instructions?.map(i => i.programId).filter(Boolean) as string[])),
                valueUSD: 0, // Fee payer interactions have no direct value transfer
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
  if (!SYNDICA_RPC_URL) {
    return NextResponse.json({ error: "Server configuration error: RPC URL is missing." }, { status: 500 });
  }

  try {
    if (!params?.address) {
      return NextResponse.json(
        { error: "No address provided in route params" },
        { status: 400 }
      );
    }
    
    const helius = new Helius(HELIUS_API_KEY!);
    const connection = new Connection(SYNDICA_RPC_URL!, "confirmed");
    
    const pubkey = new PublicKey(params.address);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const before = searchParams.get("before") || undefined;

    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit,
      before
    });
    
    if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
      return NextResponse.json({ transactions: [], nextCursor: null });
    }
    
    const signatureStrings = signatures.map(s => s.signature);
    
    const parsedTxs = await helius.parseTransactions({ transactions: signatureStrings });

    const processedTxs = await processHeliusTransactions(parsedTxs || [], params.address);
    
    const nextCursor = signatures.length > 0 ? signatures[signatures.length - 1]?.signature : null;

    return NextResponse.json({
      transactions: processedTxs,
      nextCursor,
    });
  } catch (err: any) {
    console.error("Error fetching wallet transactions:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error", stack: String(err) },
      { status: 500 }
    );
  }
}
