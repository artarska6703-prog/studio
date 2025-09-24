// src/lib/token-list.ts
let cached: Map<string, string> | null = null;
let lastFetch = 0;
const TTL = 5 * 60 * 1000; // 5 minutes

// Critical mints
const SOL_MINT  = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Use the smaller token list (safe for Next.js / Firebase Studio)
const TOKEN_LIST_URL = "https://tokens.jup.ag/tokens";

function ensureCritical(map: Map<string, string>) {
  map.set(SOL_MINT, "SOL");
  map.set(USDC_MINT, "USDC");
  map.set(USDT_MINT, "USDT");
  return map;
}

export async function loadTokenMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cached && (now - lastFetch) < TTL) {
    return ensureCritical(cached);
  }

  try {
    const res = await fetch(TOKEN_LIST_URL, { 
        headers: { Accept: "application/json" },
        cache: "no-store"
    });
    if (!res.ok) throw new Error(`Token list failed: ${res.status}`);
    const tokens = await res.json();
    cached = new Map(tokens.map((t: any) => [t.address, t.symbol]));
    lastFetch = now;
  } catch (e) {
    console.error("[TokenList] fetch error:", e);
    cached = cached || new Map();
  }

  return ensureCritical(cached!);
}
