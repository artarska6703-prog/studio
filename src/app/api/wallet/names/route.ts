
// src/app/api/wallet/names/route.ts
import { Helius } from 'helius-sdk';
import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;

export async function POST(request: NextRequest) {
  if (!HELIUS_API_KEY) {
    return NextResponse.json(
      { message: 'Server configuration error: Helius API key is missing.' },
      { status: 500 }
    );
  }

  const { addresses } = await request.json();

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json(
      { message: 'An array of addresses must be provided.' },
      { status: 400 }
    );
  }

  try {
    const helius = new Helius(HELIUS_API_KEY);
    const namesAndTags: Record<
      string,
      { name: string; tags: string[] }
    > = {};

    // Helius RPC has a limit of 100 addresses per request
    const chunkSize = 100;
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      const results = await helius.rpc.getNames({ addresses: chunk });

      Object.keys(results).forEach((address) => {
        namesAndTags[address] = {
          name: results[address].name,
          tags: results[address].tags,
        };
      });
    }

    return NextResponse.json({ namesAndTags });
  } catch (error: any) {
    console.error(`[API NAMES] Failed to fetch names/tags. Error:`, error.message);
    return NextResponse.json(
      {
        message: `Failed to fetch names and tags: ${
          error?.message || 'Unknown error'
        }`,
      },
      { status: 500 }
    );
  }
}
