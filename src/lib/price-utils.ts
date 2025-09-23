
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
    
    const pricePromises = mints.map(mint => 
        helius.rpc.getAsset(mint).then(asset => ({ mint, price: asset?.token_info?.price_info?.price_per_token }))
    );

    const results = await Promise.allSettled(pricePromises);

    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.price) {
            prices[result.value.mint] = result.value.price;
        }
    });

    return prices;
};

/**
 * Fetches the current price of Solana (SOL).
 * It first tries to get the price from Helius, and if that fails, it falls back to the Jupiter API.
 * @returns A promise that resolves to the SOL price as a number, or null if it cannot be fetched.
 */
export const getSolanaPrice = async (): Promise<number | null> => {
    // 1. Try Helius first
    if (heliusApiKey) {
        try {
            const helius = new Helius(heliusApiKey);
            const asset = await helius.rpc.getAsset("So11111111111111111111111111111111111111112");
            const heliusPrice = asset?.token_info?.price_info?.price_per_token;
            if (heliusPrice) {
                return heliusPrice;
            }
        } catch (e) {
            console.error("[Price Utils] Helius SOL price fetch failed, trying Jupiter.", e);
        }
    }
    
    // 2. Fallback to Jupiter
    try {
        const jupiterResponse = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112');
        if (jupiterResponse.ok) {
            const jupiterData = await jupiterResponse.json();
            const jupiterPrice = jupiterData.data['So1111111111111111111111111111111111111111112']?.price;
            if (jupiterPrice) return jupiterPrice;
        }
    } catch (e) {
         console.error("[Price Utils] Fallback to Jupiter for SOL price failed.", e);
    }
    
    // 3. If all fails
    return null;
};
