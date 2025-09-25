
'use client';

import { useState } from 'react';
import { Copy, Check, Bookmark } from 'lucide-react';
import { shortenAddress } from '@/lib/solana-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

// Fallback copy function for restrictive environments
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        // First, try the modern Clipboard API
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // If that fails, fall back to the legacy execCommand
        console.warn("Clipboard API failed, falling back to execCommand.", err);
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Make the textarea invisible
        textArea.style.position = "fixed"; 
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "2em";
        textArea.style.height = "2em";
        textArea.style.padding = "0";
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            console.error("Fallback copy method failed:", err);
            document.body.removeChild(textArea);
            return false;
        }
    }
}


interface WalletHeaderProps {
  address: string;
}

export function WalletHeader({ address }: WalletHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    copyToClipboard(address).then((success) => {
        if (success) {
            setCopied(true);
            toast({ title: "Address copied to clipboard." });
            setTimeout(() => setCopied(false), 2000);
        } else {
            toast({ variant: 'destructive', title: "Could not copy address." });
        }
    });
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

    