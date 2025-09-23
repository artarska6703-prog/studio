import { Helius } from "helius-sdk";

const heliusApiKey = process.env.HELIUS_API_KEY;

/**
 * Fetches prices for a list of token mints using the Helius API.
 * @param mints An array of token mint addresses.
 * @returns A promise that resolves to a map of mint addresses to their prices.
 */
export const getTokenPrices = async (mints: string[]): Promise<{ [mint: string]: number }> => {
    if (mints.length === 0 || !heliusApiKey) return {};
    
    const helius = new Helius(heliusApiKey);
    const prices: { [mint: string]: number } = {};
    
    try {
        const assets = await helius.rpc.getAssetBatch({ ids: mints });
        assets.forEach(asset => {
            if (asset && asset.id && asset.token_info?.price_info?.price_per_token) {
                prices[asset.id] = asset.token_info.price_info.price_per_token;
            }
        });

    } catch (e) {
        console.error("[Price Utils] Helius getAssetBatch failed. Falling back to Jupiter for required mints.", e);
        try {
            const jupiterResponse = await fetch(`https://price.jup.ag/v6/price?ids=${mints.join(',')}`);
            if (jupiterResponse.ok) {
                const jupiterData = await jupiterResponse.json();
                if (jupiterData.data) {
                    for (const mint of mints) {
                        if (jupiterData.data[mint]) {
                            prices[mint] = jupiterData.data[mint].price;
                        }
                    }
                }
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
