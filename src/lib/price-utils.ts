
// src/lib/price-utils.ts
import { loadTokenMap } from "./token-list";

/**
 * Returns a map of { [mint]: priceUSD }, always numeric (unknown => 0).
 */
export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints?.length) return {};
  const uniqueMints = [...new Set(mints)];
  const tokenMap = await loadTokenMap();

  const mintToSymbol: Record<string, string> = {};
  const idsForApi: string[] = []; // This will be the list of unique symbols for the API

  for (const mint of uniqueMints) {
    const symbol = tokenMap.get(mint);
    if (symbol) {
      mintToSymbol[mint] = symbol;
      if (!idsForApi.includes(symbol)) {
        idsForApi.push(symbol);
      }
    }
  }

  let priceData: any = {};
  if (idsForApi.length > 0) {
    try {
      const url = `https://price.jup.ag/v6/price?ids=${idsForApi.join(",")}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        priceData = (await res.json()).data || {};
      } else {
        console.error("[Price] Jupiter API error:", res.status, await res.text());
      }
    } catch (e) {
      console.error("[Price] Fetch error:", e);
    }
  }

  const prices: Record<string, number> = {};
  for (const mint of uniqueMints) {
    const symbol = mintToSymbol[mint];
    const priceInfo = symbol ? priceData[symbol] : undefined;
    const price = priceInfo?.price;
    prices[mint] = typeof price === "number" ? price : 0;
  }

  return prices;
}
