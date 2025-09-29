// src/app/api/wallet/token-balances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { isValidSolanaAddress } from '@/lib/solana-utils';

const RPC_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

export async function POST(request: NextRequest) {
  if (!process.env.HELIUS_API_KEY) {
    return NextResponse.json({ message: 'Server configuration error: RPC endpoint is missing.' }, { status: 500 });
  }

  const { addresses, mint } = await request.json();

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ message: 'An array of addresses must be provided.' }, { status: 400 });
  }
  if (!mint || !isValidSolanaAddress(mint)) {
    return NextResponse.json({ message: 'A valid token mint address must be provided.' }, { status: 400 });
  }


  const validAddresses = addresses.filter(isValidSolanaAddress);
  if (validAddresses.length === 0) {
    return NextResponse.json({ message: 'No valid Solana addresses provided.' }, { status: 400 });
  }

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const mintPublicKey = new PublicKey(mint);
    
    // Get token accounts for all addresses for the specific mint
    const ataPublicKeys: PublicKey[] = await Promise.all(
        validAddresses.map(address => getAssociatedTokenAddress(mintPublicKey, new PublicKey(address)))
    );

    // Fetch balances in chunks
    const balances: Record<string, number> = {};
    const chunkSize = 100;
    for (let i = 0; i < ataPublicKeys.length; i += chunkSize) {
        const chunk = ataPublicKeys.slice(i, i + chunkSize);
        const chunkAddresses = validAddresses.slice(i, i + chunkSize);
        
        const accounts = await connection.getMultipleParsedAccounts(chunk);
        
        accounts.value.forEach((account, index) => {
            const ownerAddress = chunkAddresses[index];
            if (account && 'parsed' in account.data) {
                const parsedInfo = account.data.parsed.info;
                // We will return the raw uiAmount for simplicity on the client
                balances[ownerAddress] = parsedInfo.tokenAmount?.uiAmount || 0;
            } else {
                balances[ownerAddress] = 0;
            }
        });
    }

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error(`[API TOKEN BALANCES] Failed to fetch balances for mint ${mint}:`, error);
    return NextResponse.json({ message: `Failed to fetch token balances: ${error?.message || 'Unknown error'}` }, { status: 500 });
  }
}
