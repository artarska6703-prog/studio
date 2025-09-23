
import { Helius } from "helius-sdk";

const heliusApiKey = process.env.HELIUS_API_KEY;

/**
 * Fetches prices for a list of token mints using the Helius API with a Jupiter fallback.
 * @param mints An array of token mint addresses.
 * @returns A promise that resolves to a map of mint addresses to their prices.
 */
export const getTokenPrices = async (mints: string[]): Promise<{ [mint: string]: number }> => {
    if (mints.length === 0) return {};
    
    const prices: { [mint: string]: number } = {};
    const mintsToFetch = new Set(mints);

    // 1. Try Helius first
    if (heliusApiKey && mintsToFetch.size > 0) {
        const helius = new Helius(heliusApiKey);
        try {
            const assets = await helius.rpc.getAssetBatch({ ids: Array.from(mintsToFetch) });
            assets.forEach(asset => {
                if (asset && asset.id && asset.token_info?.price_info?.price_per_token) {
                    prices[asset.id] = asset.token_info.price_info.price_per_token;
                    mintsToFetch.delete(asset.id);
                }
            });
        } catch (e) {
            console.error("[Price Utils] Helius getAssetBatch failed. Will try Jupiter for all mints.", e);
        }
    }

    // 2. Fallback to Jupiter for any remaining mints
    if (mintsToFetch.size > 0) {
        try {
            const jupiterResponse = await fetch(`https://price.jup.ag/v6/price?ids=${Array.from(mintsToFetch).join(',')}`);
            if (jupiterResponse.ok) {
                const jupiterData = await jupiterResponse.json();
                if (jupiterData.data) {
                    for (const mint of mintsToFetch) {
                        if (jupiterData.data[mint]) {
                            prices[mint] = jupiterData.data[mint].price;
                        }
                    }
                }
            } else {
                 console.error(`[Price Utils] Jupiter API request failed with status: ${jupiterResponse.status}`);
            }
        } catch (jupiterError) {
             console.error("[Price Utils] Fallback to Jupiter for prices failed.", jupiterError);
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
    const prices = await getTokenPrices([solMint]);
    return prices[solMint] || null;
};
