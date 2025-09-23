
import { Helius } from "helius-sdk";

const heliusApiKey = process.env.HELIUS_API_KEY;

/**
 * Fetches prices for a list of token mints using the Jupiter Price API.
 * @param mints An array of token mint addresses.
 * @returns A promise that resolves to a map of mint addresses to their prices.
 */
export const getTokenPrices = async (mints: string[]): Promise<{ [mint: string]: number }> => {
    if (mints.length === 0) return {};
    
    const prices: { [mint: string]: number } = {};
    const mintsToFetch = new Set(mints);

    if (mintsToFetch.size > 0) {
        try {
            const url = `https://price.jup.ag/v6/price?ids=${Array.from(mintsToFetch).join(',')}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`[Price Utils] Jupiter API request failed with status: ${response.status}`);
                return prices; // Return what we have, which is empty in this case
            }

            const data = await response.json();
            
            if (data.data) {
                for (const mint in data.data) {
                    if (data.data[mint]) {
                        prices[mint] = data.data[mint].price;
                    }
                }
            }
        } catch (error) {
             console.error("[Price Utils] Failed to fetch prices from Jupiter API.", error);
        }
    }

    return prices;
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

