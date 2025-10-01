import { PublicKey } from '@solana/web3.js';

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
