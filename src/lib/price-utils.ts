
import { Helius } from "helius-sdk";
import { getTokenList } from "./token-list";


/**
 * Fetches prices for a list of token mints using the Jupiter Price API.
 * @param mints An array of token mint addresses.
 * @returns A promise that resolves to a map of mint addresses to their prices.
 */
export const getTokenPrices = async (mints: string[]): Promise<{ [mint: string]: number }> => {
  if (mints.length === 0) return {};

  const tokenList = await getTokenList();
  
  const ids = Array.from(new Set(mints.map(mint => tokenList.get(mint)?.symbol || mint).filter(Boolean)));

  if (ids.length === 0) return {};

  try {
    const url = `https://price.jup.ag/v6/price?ids=${ids.join(",")}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Price Utils] Jupiter API failed: ${response.status}`);
      return {};
    }

    const data = await response.json();
    const prices: { [mint: string]: number } = {};

    // Map back symbol -> mint
    mints.forEach(mint => {
      const symbol = tokenList.get(mint)?.symbol;
      if (symbol && data.data[symbol]) {
        prices[mint] = data.data[symbol].price;
      }
    });
    
    return prices;
  } catch (err) {
    console.error("[Price Utils] Error fetching prices:", err);
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
        return prices[solMint] || null;
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
    const list = await getTokenList();
    return list.get(mint)?.symbol || null;
}
