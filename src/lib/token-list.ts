
let cached: Map<string, string> | null = null;
let lastFetch = 0;
const TTL = 5 * 60 * 1000; // 5 min
const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function loadTokenMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cached && now - lastFetch < TTL) {
    // Ensure SOL is always present even in cached map
    if (!cached.has(SOL_MINT)) {
        cached.set(SOL_MINT, "SOL");
    }
    return cached;
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

  // Ensure SOL is always mapped after fetch or on error
  cached.set(SOL_MINT, "SOL");
  
  return cached!;
}
