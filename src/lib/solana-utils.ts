import { PublicKey, Connection } from '@solana/web3.js';
import { Helius } from "helius-sdk";
import { unstable_cache } from 'next/cache';

const heliusApiKey = process.env.HELIUS_API_KEY;


/**
 * Validates a Solana address.
 * @param address The address to validate.
 * @returns True if the address is a valid Solana public key, false otherwise.
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string' || address.length < 32 || address.length > 44) {
    return false;
  }
  try {
    // The `new PublicKey` constructor will throw an error if the address is invalid.
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Shortens a Solana address for display purposes.
 * @param address The full Solana address.
 * @param chars The number of characters to show at the start and end.
 * @returns A shortened address string (e.g., "AbC...XyZ").
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!isValidSolanaAddress(address)) {
    return address;
  }
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}


export const getTokenPrices = unstable_cache(
    async (mints: string[]) => {
        if (mints.length === 0 || !heliusApiKey) return {};
        try {
            const helius = new Helius(heliusApiKey);
            const prices: { [mint: string]: number } = {};
            
            const pricePromises = mints.map(async (mint) => {
                try {
                    const asset = await helius.rpc.getAsset(mint);
                    if (asset?.token_info?.price_info?.price_per_token) {
                        return { mint, price: asset.token_info.price_info.price_per_token };
                    }
                } catch (e) {
                    console.error(`Failed to fetch price for mint ${mint} from Helius`, e);
                }
                return { mint, price: null };
            });

            const results = await Promise.all(pricePromises);
            
            for (const result of results) {
                if (result.price !== null) {
                    prices[result.mint] = result.price;
                }
            }
            return prices;
        } catch (error) {
            console.error("Failed to fetch token prices from Helius:", error);
            return {};
        }
    },
    ['helius-token-prices-v2'], // More specific cache key
    { revalidate: 60 * 5 } // Revalidate every 5 minutes
);


export const getSolanaPrice = unstable_cache(
    async () => {
        if (!heliusApiKey) return null;
        try {
            const helius = new Helius(heliusApiKey);
            const asset = await helius.rpc.getAsset("So11111111111111111111111111111111111111112");
            return asset?.token_info?.price_info?.price_per_token ?? null;
        } catch (error) {
            console.error("Failed to fetch Solana price from Helius:", error);
            return null;
        }
    },
    ['helius-solana-price-v2'], // More specific cache key
    { revalidate: 60 * 5 } // Revalidate every 5 minutes
);
