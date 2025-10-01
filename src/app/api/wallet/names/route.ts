// src/app/api/wallet/names/route.ts
import { NextRequest, NextResponse } from "next/server";
import { knownAddresses } from "@/lib/knownAddresses";

const DUNE_API_KEY = process.env.DUNE_API_KEY;
// Replace with the ID of your saved Dune query that uses `to_base58`
const DUNE_QUERY_ID = "YOUR_QUERY_ID_HERE";

export async function POST(request: NextRequest) {
  const { addresses } = await request.json();

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json(
      { message: "An array of addresses must be provided." },
      { status: 400 }
    );
  }

  const namesAndTags: Record<string, { name: string; tags: string[] }> = {};

  for (const address of addresses) {
    let tags: string[] = [];
    let name = address;

    // --- Step 0: Check knownAddresses first ---
    if (knownAddresses[address]) {
      tags = [knownAddresses[address]];
      name = address; // you could also give a prettier alias here if you want
    }

    // --- Step 1: Try Solscan if still no tags ---
    if (tags.length === 0) {
      try {
        const res = await fetch(
          `https://api-v2.solscan.io/v2/account?address=${address}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.tags?.length) tags = data.tags;
          if (data?.account?.displayName) name = data.account.displayName;
        }
      } catch (e) {
        console.warn(`[API NAMES] Solscan failed for ${address}`);
      }
    }

    // --- Step 2: Try Dune if still no tags ---
    if (tags.length === 0 && DUNE_API_KEY) {
      try {
        const res = await fetch(
          `https://api.dune.com/api/v1/query/${DUNE_QUERY_ID}/execute`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Dune-API-Key": DUNE_API_KEY,
            },
            body: JSON.stringify({
              parameters: [{ key: "address", type: "text", value: address }],
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rows = data?.result?.rows || [];
          if (rows.length > 0 && rows[0].label_type) {
            tags = [rows[0].label_type.toLowerCase()];
            if (!name || name === address) {
              name = rows[0].label_type;
            }
          }
        }
      } catch (e) {
        console.warn(`[API NAMES] Dune failed for ${address}`);
      }
    }

    // --- Step 3: Fallback ---
    namesAndTags[address] = { name, tags };
  }

  console.log(`[API NAMES] Tagged ${Object.keys(namesAndTags).length} addresses`);
  return NextResponse.json({ namesAndTags });
}
