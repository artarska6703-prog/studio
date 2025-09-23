
import { notFound } from 'next/navigation';
import { isValidSolanaAddress } from '@/lib/solana-utils';
import WalletPageClient from '@/components/wallet/wallet-page-client';
import { Suspense } from 'react';
import Loading from './loading';

type WalletPageProps = {
  params: {
    address: string;
  };
};

export default function WalletPage({ params }: WalletPageProps) {
  const { address } = params;

  if (!isValidSolanaAddress(address)) {
    notFound();
  }

  return (
    <Suspense fallback={<Loading />}>
      <WalletPageClient address={address} />
    </Suspense>
  );
}
