
import heliusSdk from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices } from "@/lib/price-utils";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { Connection, PublicKey } from "@solana/web3.js";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_ENDPOINT = process.env.SYNDICA_RPC_URL;
const SOL_MINT = "So11111111111111111111111111111111111111112";

const processHeliusTransactions = async (transactions: Transaction[], walletAddress: string): Promise<FlattenedTransaction[]> => {
    const flattenedTxs: FlattenedTransaction[] = [];
    if (!transactions || transactions.length === 0) return flattenedTxs;
    
    const mints = new Set<string>([SOL_MINT]);
    transactions.forEach(tx => {
        tx.tokenTransfers?.forEach(t => {
            if (t.mint) mints.add(t.mint);
        });
    });

    const prices = await getTokenPrices(Array.from(mints));

    transactions.forEach(tx => {
        let hasRelevantTransfer = false;
        
        const processTransfers = (transfers: any[] | undefined | null, isNative: boolean) => {
            if (!transfers) return;
            
            transfers.forEach(transfer => {
                const isOwnerInvolved = transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress;
                
                if (isOwnerInvolved && (isNative ? transfer.amount > 0 : transfer.tokenAmount > 0)) {
                    hasRelevantTransfer = true;
                    
                    const amountRaw = isNative ? transfer.amount / 1e9 : transfer.tokenAmount;
                    const sign = transfer.fromUserAccount === walletAddress ? -1 : 1;
                    const finalAmount = sign * amountRaw;
                    
                    const mint = isNative ? SOL_MINT : transfer.mint;
                    const price = prices[mint] ?? 0;
                    const valueUSD = Math.abs(finalAmount) * price;

                    flattenedTxs.push({
                        signature: tx.signature,
                        timestamp: tx.timestamp,
                        blockTime: tx.timestamp,
                        fee: tx.fee,
                        feePayer: tx.feePayer,
                        instructions: tx.instructions,
                        type: finalAmount > 0 ? 'received' : 'sent',
                        amount: finalAmount,
                        symbol: null, 
                        mint: mint,
                        from: transfer.fromUserAccount,
                        to: transfer.toUserAccount,
                        by: tx.feePayer,
                        instruction: tx.type,
                        interactedWith: Array.from(new Set([tx.feePayer, transfer.fromUserAccount, transfer.toUserAccount].filter(a => a && a !== walletAddress) as string[])),
                        valueUSD: valueUSD,
                    });
                }
            });
        };
        
        processTransfers(tx.nativeTransfers, true);
        processTransfers(tx.tokenTransfers, false);

        if (!hasRelevantTransfer && tx.feePayer === walletAddress) {
            flattenedTxs.push({
                signature: tx.signature,
                timestamp: tx.timestamp,
                blockTime: tx.timestamp,
                fee: tx.fee,
                feePayer: tx.feePayer,
                instructions: tx.instructions,
                type: 'program_interaction',
                amount: 0,
                symbol: null,
                mint: null,
                from: tx.feePayer,
                to: tx.instructions?.[0]?.programId || null,
                by: tx.feePayer,
                instruction: tx.type,
                interactedWith: Array.from(new Set(tx.instructions?.map(i => i.programId).filter(Boolean) as string[])),
                valueUSD: 0,
            });
        }
    });

    return flattenedTxs;
}

export async function GET(
  req: Request,
  { params }: { params?: { address?: string } }
) {
  if (!HELIUS_API_KEY || !RPC_ENDPOINT) {
    return NextResponse.json({ error: "Server configuration error: API keys are missing." }, { status: 500 });
  }

  try {
    if (!params?.address || !isValidSolanaAddress(params.address)) {
      return NextResponse.json(
        { error: "A valid wallet address must be provided." },
        { status: 400 }
      );
    }
    
    const helius = heliusSdk.createHelius({ apiKey: HELIUS_API_KEY });
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") || undefined;
    const publicKey = new PublicKey(params.address);

    const signatureInfo = await connection.getSignaturesForAddress(publicKey, { 
        limit: 100,
        before,
    });
    
    if (!signatureInfo || signatureInfo.length === 0) {
      return NextResponse.json({ transactions: [], nextCursor: null });
    }

    const signatureStrings = signatureInfo.map(sig => sig.signature);
    const response = await helius.parseTransactions({ transactions: signatureStrings });
    
    const parsedTxs = response.map(tx => tx as unknown as Transaction);

    const processedTxs = await processHeliusTransactions(parsedTxs, params.address);
    
    const nextCursor = signatureInfo.length > 0 ? signatureInfo[signatureInfo.length - 1]?.signature : null;

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
