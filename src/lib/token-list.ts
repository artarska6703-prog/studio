let cached: Map<string, string> | null = null;
let lastFetch = 0;
const TTL = 5 * 60 * 1000; // 5 min

export async function loadTokenMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cached && now - lastFetch < TTL) return cached;

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
  return cached!;
}