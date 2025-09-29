
// src/app/api/wallet/names/route.ts
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
    const response = await fetch(`https://api.helius.xyz/v0/addresses/names?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Helius API failed with status ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const results = await response.json();

    const namesAndTags: Record<
      string,
      { name: string; tags: string[] }
    > = {};

    results.forEach((result: { address: string, name: string, tags: any[] }) => {
        namesAndTags[result.address] = {
            name: result.name,
            tags: result.tags.map(t => t.tag) || []
        };
    });

    return NextResponse.json({ namesAndTags });
  } catch (error: any) {
    console.error(`[API NAMES] Failed to fetch names/tags:`, error);
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
