// src/app/api/wallet/names/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { addresses } = await req.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: "Missing or invalid addresses array" },
        { status: 400 }
      );
    }

    const heliusRes = await fetch(
      `https://api.helius.xyz/v0/addresses/names?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      }
    );

    if (!heliusRes.ok) {
      const errorData = await heliusRes.json();
      return NextResponse.json(
        { error: "Helius API error", details: errorData },
        { status: heliusRes.status }
      );
    }

    const heliusData = await heliusRes.json();
    return NextResponse.json(heliusData);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
}
