'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isValidSolanaAddress } from '@/lib/solana-utils';

export default function WalletSearch() {
  const [address, setAddress] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidSolanaAddress(address)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Address',
        description: 'Please enter a valid Solana wallet address.',
      });
      return;
    }

    startTransition(() => {
      router.push(`/wallet/${address}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Enter Solana wallet address..."
        className="h-12 pl-10 pr-24 text-base font-code"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isPending}
        required
      />
      <Button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        disabled={isPending || !address}
      >
        {isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <span>Search</span>
        )}
      </Button>
    </form>
  );
}
