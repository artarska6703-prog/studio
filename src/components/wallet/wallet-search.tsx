
'use client';

import { useRef, useTransition } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchWalletAction } from '@/app/actions';

export default function WalletSearch() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
        searchWalletAction(formData);
    });
  };

  return (
    <form ref={formRef} action={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        type="text"
        name="walletAddress"
        placeholder="Enter Solana wallet address..."
        className="h-12 pl-10 pr-24 text-base font-code"
        disabled={isPending}
        required
      />
      <Button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        disabled={isPending}
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
