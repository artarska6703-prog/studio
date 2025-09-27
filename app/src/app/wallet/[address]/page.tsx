
'use client';

import { useEffect, useState } from 'react';
import { Header } from "@/components/layout/header";
import { WalletPageView } from "@/components/wallet/wallet-page-client";
import { isValidSolanaAddress } from "@/lib/solana-utils";
import { notFound } from "next/navigation";

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
      <WalletPageView 
          address={address}
      />
  );
}
