
'use client';

import { useState } from 'react';
import { Copy, Check, Bookmark } from 'lucide-react';
import { shortenAddress } from '@/lib/solana-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface WalletHeaderProps {
  address: string;
}

export function WalletHeader({ address }: WalletHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({ title: "Address copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = () => {
      setBookmarked(!bookmarked);
      toast({
          title: bookmarked ? "Bookmark removed." : "Wallet bookmarked!",
          description: bookmarked ? "" : "User authentication coming soon to save bookmarks."
      });
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-primary to-accent rounded-full" />
        <h1 className="text-2xl lg:text-3xl font-bold font-headline tracking-tight">
          Wallet <span className="font-code text-muted-foreground">{shortenAddress(address, 6)}</span>
        </h1>
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleBookmark} className="shrink-0">
                        <Bookmark className={bookmarked ? "text-yellow-400 fill-yellow-400" : ""}/>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Bookmark this wallet (coming soon)</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-card border">
        <p className="font-code text-sm text-muted-foreground hidden sm:block">{address}</p>
         <p className="font-code text-sm text-muted-foreground sm:hidden">{shortenAddress(address, 10)}</p>
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Copy address</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
