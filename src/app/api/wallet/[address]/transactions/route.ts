
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Helius, TransactionType } from "helius-sdk";
import { NextResponse } from "next/server";
import type { FlattenedTransaction, Transaction } from "@/lib/types";
import { getTokenPrices, getSymbolFromMint } from "@/lib/price-utils";


const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SYNDICA_RPC_URL = process.env.SYNDICA_RPC_URL;


const processHeliusTransactions = async (transactions: Transaction[], walletAddress: string, prices: { [mint: string]: number }): Promise<FlattenedTransaction[]> => {
    const flattenedTxs: FlattenedTransaction[] = [];
    if (!transactions || transactions.length === 0) return flattenedTxs;
    
    for (const tx of transactions) {
        let hasRelevantTransfer = false;
        const blockTime = tx.timestamp || tx.blockTime;
        
        const processTransfers = async (transfers: any[] | undefined | null, isNative: boolean) => {
            if (!transfers) return;
            for (const transfer of transfers) {
                const isOwnerInvolved = transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress || transfer.owner === walletAddress;
                
                if (isOwnerInvolved && (transfer.amount > 0 || transfer.tokenAmount > 0)) {
                    hasRelevantTransfer = true;
                    
                    const amountRaw = isNative ? transfer.amount / LAMPORTS_PER_SOL : transfer.tokenAmount;
                    const sign = (transfer.fromUserAccount === walletAddress || (transfer.owner === walletAddress && transfer.fromUserAccount !== walletAddress)) ? -1 : 1;
                    const finalAmount = sign * amountRaw;
                    
                    const mint = isNative ? 'So11111111111111111111111111111111111111112' : transfer.mint;
                    const price = prices[mint];
                    const valueUSD = typeof price === "number" ? Math.abs(finalAmount) * price : null;
                    
                    flattenedTxs.push({
                        ...tx,
                        blockTime: blockTime,
                        type: finalAmount > 0 ? 'received' : 'sent',
                        amount: finalAmount,
                        symbol: isNative ? 'SOL' : await getSymbolFromMint(transfer.mint),
                        mint: mint,
                        from: transfer.fromUserAccount,
                        to: transfer.toUserAccount,
                        by: tx.feePayer,
                        instruction: tx.type,
                        interactedWith: Array.from(new Set([tx.feePayer, transfer.fromUserAccount, transfer.toUserAccount].filter(a => a && a !== walletAddress))),
                        valueUSD: valueUSD,
                    });
                }
            }
        };
        
        await processTransfers(tx.nativeTransfers, true);
        await processTransfers(tx.tokenTransfers, false);

        if (!hasRelevantTransfer && tx.feePayer === walletAddress) {
            flattenedTxs.push({
                ...tx,
                blockTime: blockTime,
                type: 'program_interaction',
                amount: 0,
                symbol: null,
                mint: null,
                from: tx.feePayer,
                to: tx.instructions?.[0]?.programId || null,
                by: tx.feePayer,
                instruction: tx.type,
                interactedWith: Array.from(new Set(tx.instructions?.map(i => i.programId).filter(Boolean) as string[])),
                valueUSD: null,
            });
        }
    }

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
      return NextResponse.json({ transactions: [], nextCursor: null, addressBalances: {} });
    }
    
    const signatureStrings = signatures.map(s => s.signature);
    
    const parsedTxs = await helius.parseTransactions({ transactions: signatureStrings });
    const txArray = Array.isArray(parsedTxs) ? parsedTxs : [];

    const tokenMints = new Set<string>();
    tokenMints.add('So11111111111111111111111111111111111111112'); // Always get SOL price
    txArray.forEach(tx => {
        if (tx.tokenTransfers) {
            tx.tokenTransfers.forEach(transfer => {
                if(transfer.mint) tokenMints.add(transfer.mint);
            })
        }
    });
    
    const prices = await getTokenPrices(Array.from(tokenMints));
    
    const processedTxs = await processHeliusTransactions(txArray, params.address, prices);
    
    const allAddresses = new Set<string>();
    processedTxs.forEach(tx => {
      if (tx.from) allAddresses.add(tx.from);
      if (tx.to) allAddresses.add(tx.to);
    });

    const addressBalances: { [key: string]: number } = {};
    if (allAddresses.size > 0) {
        try {
            const balances = await connection.getMultipleAccountsInfo(
                Array.from(allAddresses).map(addr => new PublicKey(addr))
            );
            balances.forEach((account, index) => {
                const address = Array.from(allAddresses)[index];
                if (account) {
                    addressBalances[address] = account.lamports / LAMPORTS_PER_SOL;
                } else {
                    addressBalances[address] = 0;
                }
            });
        } catch (e) {
            console.error("Failed to fetch batch balances, proceeding without them.", e);
        }
    }

    const nextCursor = signatures.length > 0 ? signatures[signatures.length - 1]?.signature : null;

    return NextResponse.json({
      transactions: processedTxs,
      nextCursor,
      addressBalances,
    });
  } catch (err: any) {
    console.error("Error fetching wallet transactions:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error", stack: String(err) },
      { status: 500 }
    );
  }
}
