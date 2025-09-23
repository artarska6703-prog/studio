
import type { TokenInfo } from "@jup-ag/core";

let cachedTokenList: Map<string, TokenInfo> | null = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getTokenList(): Promise<Map<string, TokenInfo>> {
  const now = Date.now();

  if (cachedTokenList && now - lastFetch < CACHE_TTL) {
    return cachedTokenList;
  }

  try {
    const res = await fetch("https://token.jup.ag/all");
    if (!res.ok) throw new Error(`Jupiter token list failed: ${res.status}`);

    const tokens: TokenInfo[] = await res.json();
    cachedTokenList = new Map(tokens.map(t => [t.address, t]));
    lastFetch = now;

    return cachedTokenList!;
  } catch (err) {
    console.error("[Token List] Failed to fetch Jupiter token list:", err);
    return cachedTokenList || new Map();
  }
}

export async function mintToSymbol(mint: string): Promise<string> {
  const list = await getTokenList();
  return list.get(mint)?.symbol || mint.slice(0, 4); // fallback: truncated mint
}

export async function mintToDecimals(mint: string): Promise<number> {
  const list = await getTokenList();
  return list.get(mint)?.decimals || 0;
}

export async function mintToLogo(mint: string): Promise<string | null> {
  const list = await getTokenList();
  return list.get(mint)?.logoURI || null;
}
