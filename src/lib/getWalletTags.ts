// src/lib/getWalletTags.ts
export interface WalletTag {
  tag: string;
  confidence?: number;
}

export async function getWalletTags(wallet: string): Promise<WalletTag[]> {
  try {
    const res = await fetch(`/api/tags?wallet=${wallet}`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Helius tag API error:", data);
      return [];
    }

    // API returns { wallet, tags: [...] }
    return data.tags as WalletTag[];
  } catch (error) {
    console.error("Unexpected error fetching tags:", error);
    return [];
  }
}
