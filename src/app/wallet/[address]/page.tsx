import { WalletPageView } from "@/components/wallet/wallet-page-client";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { notFound } from "next/navigation";

type WalletPageProps = {
  params: {
    address: string;
  };
};

export default async function WalletPage({ params }: WalletPageProps) {
  const { address } = await params;

  if (!isValidSolanaAddress(address)) {
    notFound();
  }
  
  return (
      <WalletPageView 
          address={address}
      />
  );
}
