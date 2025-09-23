
import { loadTokenMap } from "./token-list";

export const getTokenPrices = async (
  mints: string[]
): Promise<{ [mint: string]: number }> => {
  if (mints.length === 0) return {};

  const tokenMap = await loadTokenMap();
  const mintToSymbol: { [mint: string]: string } = {};
  const symbols: string[] = [];

  for (const mint of mints) {
    const symbol = tokenMap.get(mint);
    if (symbol) {
      mintToSymbol[mint] = symbol;
      symbols.push(symbol);
    }
  }

  if (symbols.length === 0) {
    console.warn("[Price Utils] No matching symbols found for requested mints.");
    return {};
  }

  try {
    const url = `https://price.jup.ag/v6/price?ids=${symbols.join(",")}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `[Price Utils] Jupiter API failed with status: ${response.status}`
      );
      return {};
    }

    const data = await response.json();
    const prices: { [mint: string]: number } = {};

    for (const mint of Object.keys(mintToSymbol)) {
      const symbol = mintToSymbol[mint];
      if (data.data[symbol]?.price) {
        prices[mint] = data.data[symbol].price;
      }
    }

    return prices;
  } catch (err) {
    console.error("[Price Utils] Failed to fetch prices", err);
    return {};
  }
};


/**
 * Fetches the current price of Solana (SOL).
 * @returns A promise that resolves to the SOL price as a number, or null if it cannot be fetched.
 */
export const getSolanaPrice = async (): Promise<number | null> => {
    const solMint = 'So11111111111111111111111111111111111111112';
    try {
        const prices = await getTokenPrices([solMint]);
        return prices[solMint] ?? null;
    } catch (error) {
        console.error("[Price Utils] Failed to get Solana price.", error);
        return null;
    }
};

/**
 * Resolves a token mint address to its symbol using the cached Jupiter token list.
 * @param mint The token mint address.
 * @returns A promise that resolves to the token symbol string, or null if not found.
 */
export const getSymbolFromMint = async (mint: string): Promise<string | null> => {
    if (!mint) return null;
    const list = await loadTokenMap();
    return list.get(mint) || null;
}
