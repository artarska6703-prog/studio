
// src/app/api/wallet/balances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { isValidSolanaAddress } from '@/lib/solana-utils';

const RPC_ENDPOINT = process.env.SYNDICA_RPC_URL!;

export async function POST(request: NextRequest) {
  if (!RPC_ENDPOINT) {
    return NextResponse.json({ message: 'Server configuration error: RPC endpoint is missing.' }, { status: 500 });
  }

  const { addresses } = await request.json();

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ message: 'An array of addresses must be provided.' }, { status: 400 });
  }

  const validAddresses = addresses.filter(isValidSolanaAddress);
  if (validAddresses.length === 0) {
    return NextResponse.json({ message: 'No valid Solana addresses provided.' }, { status: 400 });
  }

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const publicKeys = validAddresses.map(address => new PublicKey(address));
    
    // Fetch balances in chunks to avoid hitting RPC limits
    const balances: Record<string, number> = {};
    const chunkSize = 100;
    for (let i = 0; i < publicKeys.length; i += chunkSize) {
        const chunk = publicKeys.slice(i, i + chunkSize);
        const chunkAddresses = validAddresses.slice(i, i + chunkSize);
        const accounts = await connection.getMultipleAccountsInfo(chunk);
        
        accounts.forEach((account, index) => {
            const address = chunkAddresses[index];
            balances[address] = (account?.lamports || 0) / LAMPORTS_PER_SOL;
        });
    }

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error(`[API BALANCES] Failed to fetch balances:`, error);
    return NextResponse.json({ message: `Failed to fetch balances: ${error?.message || 'Unknown error'}` }, { status: 500 });
  }
}
