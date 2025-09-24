
// src/lib/token-list.ts

let cached: Map<string, string> | null = null;
let lastFetch = 0;
const TTL = 5 * 60 * 1000; // 5 minutes

// Critical mints we always want mapped
const SOL_MINT  = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

function ensureCritical(c: Map<string, string>) {
  c.set(SOL_MINT, "SOL");
  c.set(USDC_MINT, "USDC");
  c.set(USDT_MINT, "USDT");
  return c;
}

export async function loadTokenMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cached && now - lastFetch < TTL) {
    return ensureCritical(cached);
  }

  try {
    const res = await fetch("https://token.jup.ag/all");
    if (!res.ok) throw new Error(`Token list failed: ${res.status}`);
    const tokens = await res.json();
    cached = new Map(tokens.map((t: any) => [t.address, t.symbol]));
    lastFetch = now;
  } catch (e) {
    console.error("[TokenList] fetch error:", e);
    cached = cached || new Map(); // keep previous if any
  }

  return ensureCritical(cached!);
}
