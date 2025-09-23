
import { Helius } from "helius-sdk";

interface JupiterToken {
    address: string; // Mint address
    symbol: string;
    name: string;
    decimals: number;
}

let tokenMap: Map<string, JupiterToken> | null = null;

async function getJupiterTokenMap(): Promise<Map<string, JupiterToken>> {
    if (tokenMap) {
        return tokenMap;
    }

    try {
        const response = await fetch('https://token.jup.ag/all');
        if (!response.ok) {
            console.error('[Price Utils] Failed to fetch Jupiter token list');
            return new Map();
        }
        const tokenList: JupiterToken[] = await response.json();
        
        const newMap = new Map<string, JupiterToken>();
        tokenList.forEach(token => {
            newMap.set(token.address, token);
        });

        tokenMap = newMap;
        return tokenMap;

    } catch (error) {
        console.error('[Price Utils] Error fetching or processing Jupiter token list:', error);
        return new Map();
    }
}


/**
 * Fetches prices for a list of token mints using the Jupiter Price API.
 * @param mints An array of token mint addresses.
 * @returns A promise that resolves to a map of mint addresses to their prices.
 */
export const getTokenPrices = async (mints: string[]): Promise<{ [mint: string]: number }> => {
    if (mints.length === 0) return {};
    
    const prices: { [mint: string]: number } = {};
    const mintsToFetch = Array.from(new Set(mints)); // Remove duplicates

    const jupiterTokenMap = await getJupiterTokenMap();
    
    const symbolsToFetch = mintsToFetch
        .map(mint => jupiterTokenMap.get(mint)?.symbol)
        .filter((symbol): symbol is string => !!symbol);

    if (symbolsToFetch.length > 0) {
        try {
            const url = `https://price.jup.ag/v6/price?ids=${symbolsToFetch.join(',')}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`[Price Utils] Jupiter API request failed with status: ${response.status}`);
                return prices;
            }

            const data = await response.json();
            
            if (data.data) {
                 for (const mint of mintsToFetch) {
                    const symbol = jupiterTokenMap.get(mint)?.symbol;
                    if (symbol && data.data[symbol]) {
                        prices[mint] = data.data[symbol].price;
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

/**
 * Resolves a token mint address to its symbol using the cached Jupiter token list.
 * @param mint The token mint address.
 * @returns A promise that resolves to the token symbol string, or null if not found.
 */
export const getSymbolFromMint = async (mint: string): Promise<string | null> => {
    if (!mint) return null;
    const map = await getJupiterTokenMap();
    return map.get(mint)?.symbol || null;
}
