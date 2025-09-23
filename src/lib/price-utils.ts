// src/lib/price-utils.ts
import { loadTokenMap } from "./token-list";

/**
 * Returns a map of { [mint]: priceUSD }, always numeric (unknown => 0).
 */
export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints?.length) return {};
  const tokenMap = await loadTokenMap();

  const mintToSymbol: Record<string, string> = {};
  const ids: string[] = [];

  for (const mint of mints) {
    const sym = tokenMap.get(mint);
    if (sym) {
      mintToSymbol[mint] = sym;
      ids.push(sym);
    }
  }

  let data: any = {};
  if (ids.length) {
    try {
      const url = `https://price.jup.ag/v6/price?ids=${ids.join(",")}`;
      const res = await fetch(url);
      if (res.ok) data = await res.json();
      else console.error("[Price] Jupiter error:", res.status);
    } catch (e) {
      console.error("[Price] fetch error:", e);
    }
  }

  const out: Record<string, number> = {};
  for (const mint of mints) {
    const sym = mintToSymbol[mint];
    const p = sym && data?.data?.[sym]?.price;
    out[mint] = typeof p === "number" ? p : 0;
  }

  return out;
}
