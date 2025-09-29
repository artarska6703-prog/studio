
// src/lib/price-utils.ts
import { loadTokenMap } from "./token-list";

const JUP_PRICE_URL = "https://quote-api.jup.ag/v6/price";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const COINGECKO_SOL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints?.length) return {};
  const uniqueMints = Array.from(new Set(mints));
  const tokenMap = await loadTokenMap();

  const mintToSymbol: Record<string, string> = {};
  const symbols = new Set<string>();

  for (const mint of uniqueMints) {
    const sym = tokenMap.get(mint);
    if (sym) {
      mintToSymbol[mint] = sym;
      symbols.add(sym);
    }
  }

  let data: any = {};
  const jupiterMints = uniqueMints.filter(mint => mint !== SOL_MINT);
  
  if (jupiterMints.length > 0) {
    try {
      const url = `${JUP_PRICE_URL}?ids=${jupiterMints.join(",")}`;
      const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        data = json?.data || {};
      } else {
        console.error("[Price] Jupiter error:", res.status, await res.text());
      }
    } catch (e) {
      console.error("[Price] fetch error:", e);
    }
  }

  const out: Record<string, number> = {};
  for (const mint of uniqueMints) {
     if (mint === SOL_MINT) continue;
    const p = data[mint]?.price;
    out[mint] = typeof p === "number" ? p : 0;
  }

  // Always fetch SOL price from Coingecko as a more reliable source
  if (uniqueMints.includes(SOL_MINT)) {
    try {
      const res = await fetch(COINGECKO_SOL, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const p = json?.solana?.usd;
        if (typeof p === "number") {
          out[SOL_MINT] = p;
        } else {
          out[SOL_MINT] = 0;
        }
      }
    } catch (e) {
      console.error("[Price] SOL fallback error:", e);
      out[SOL_MINT] = out[SOL_MINT] || 0; // ensure it's set
    }
  }

  return out;
}
