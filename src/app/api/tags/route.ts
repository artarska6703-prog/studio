
// src/app/api/tags/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  console.log(">>>> INSIDE /api/tags REST ROUTE <<<<"); // ✅ put it here

  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet address in query param." },
      { status: 400 }
    );
  }

  try {
    const heliusRes = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/tags?api-key=${process.env.HELIUS_API_KEY}`
    );

    if (!heliusRes.ok) {
      const errorData = await heliusRes.json();
      return NextResponse.json(
        { error: "Helius API error", details: errorData },
        { status: heliusRes.status }
      );
    }

    const heliusData = await heliusRes.json();

    // Helius returns { address, tags: [...] }
    return NextResponse.json({
      wallet,
      tags: heliusData?.tags || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected server error.", details: err.message },
      { status: 500 }
    );
  }
}
