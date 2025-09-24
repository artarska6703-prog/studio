// src/lib/price-utils.ts
import { loadTokenMap } from "./token-list";

const JUP_PRICE_URL = "https://price.jup.ag/v6/price";
const SOL_MINT = "So11111111111111111111111111111111111111112";

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
  if (symbols.size > 0) {
    try {
      const url = `${JUP_PRICE_URL}?ids=${Array.from(symbols).join(",")}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
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
    const sym = mintToSymbol[mint];
    const p = sym && data?.[sym]?.price;
    out[mint] = typeof p === "number" ? p : 0;
  }

  // Hard fallback for SOL if still zero (network hiccup or mapping miss)
  if ((uniqueMints.includes(SOL_MINT)) && out[SOL_MINT] === 0) {
    try {
      const res = await fetch(`${JUP_PRICE_URL}?ids=SOL`, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const json = await res.json();
        const p = json?.data?.SOL?.price;
        if (typeof p === "number") out[SOL_MINT] = p;
      }
    } catch (e) {
      console.error("[Price] SOL fallback error:", e);
    }
  }

  return out;
}
