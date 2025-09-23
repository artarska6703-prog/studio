'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { isValidSolanaAddress } from '@/lib/solana-utils';

const searchSchema = z.object({
  walletAddress: z.string().refine(isValidSolanaAddress, {
    message: 'Invalid Solana address format.',
  }),
});

export async function searchWalletAction(formData: FormData) {
  const rawFormData = {
    walletAddress: formData.get('walletAddress') as string,
  };

  const validated = searchSchema.safeParse(rawFormData);

  if (!validated.success) {
    const firstError = validated.error.errors[0].message;
    return redirect(`/error?message=${encodeURIComponent(firstError)}`);
  }

  redirect(`/wallet/${validated.data.walletAddress}`);
}
