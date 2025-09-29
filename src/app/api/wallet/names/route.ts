
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
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/names?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addresses),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Helius API failed with status ${response.status}: ${errorData.error || 'Unknown error'}`
      );
    }

    const data = await response.json();

    // 🧠 Format into expected object structure:
    const namesAndTags: Record<
      string,
      { name: string; tags: string[] }
    > = {};

    data.forEach((entry: any) => {
      const address = entry?.address;
      const name = entry?.name || '';
      const tags = entry?.tags || [];
      if (address) {
        namesAndTags[address] = { name, tags };
      }
    });

    return NextResponse.json({ namesAndTags });
  } catch (error) {
    console.error('[Helius Tag API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet names and tags.', details: error },
      { status: 500 }
    );
  }
}
