
let tokenMap: Map<string, string> | null = null;

export const loadTokenMap = async (): Promise<Map<string, string>> => {
  if (tokenMap) return tokenMap;

  try {
    const response = await fetch("https://token.jup.ag/all");
    const tokens = await response.json();

    tokenMap = new Map<string, string>();
    tokens.forEach((t: any) => {
      if (t.address && t.symbol) {
        tokenMap!.set(t.address, t.symbol);
      }
    });

    console.log(`[Token List] Loaded ${tokenMap.size} tokens from Jupiter`);
    return tokenMap;
  } catch (err) {
    console.error("[Token List] Failed to fetch Jupiter token list", err);
    return new Map();
  }
};

export async function mintToSymbol(mint: string): Promise<string> {
  const list = await loadTokenMap();
  return list.get(mint) || mint.slice(0, 4); // fallback: truncated mint
}

export async function mintToDecimals(mint: string): Promise<number> {
  const list = await loadTokenMap();
  // This part is problematic as the map only stores symbols.
  // The full TokenInfo is needed for decimals.
  // For now, returning a default. A better implementation would cache the full TokenInfo object.
  return 0;
}

export async function mintToLogo(mint: string): Promise<string | null> {
    const list = await loadTokenMap();
    // This part is problematic as the map only stores symbols.
    // The full TokenInfo is needed for logos.
    // For now, returning null.
  return null;
}
