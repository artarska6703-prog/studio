
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { shortenAddress } from '@/lib/solana-utils';
import { useToast } from '@/hooks/use-toast';
import { WalletDetails } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

interface WalletDetailSheetProps {
  address: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StatItem = ({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string | number;
  isLoading?: boolean;
}) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground">{label}</span>
    {isLoading ? (
      <Skeleton className="h-5 w-24" />
    ) : (
      <span className="font-medium">{value}</span>
    )}
  </div>
);

export function WalletDetailSheet({ address, open, onOpenChange }: WalletDetailSheetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<WalletDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && address) {
      const fetchData = async () => {
        setIsLoading(true);
        setDetails(null);
        try {
          const detailsRes = await fetch(`/api/wallet/${address}/details`);

          if (!detailsRes.ok) {
            const errorData = await detailsRes.json();
            throw new Error(
              errorData.message ||
                `Failed to fetch wallet details. Status: ${detailsRes.status}`
            );
          }

          const detailsData = await detailsRes.json();
          setDetails(detailsData);
        } catch (error: any) {
          console.error(error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: `Could not fetch wallet details: ${error.message}`,
          });
          onOpenChange(false);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [address, open, toast, onOpenChange]);

  const handleCopy = () => {
    navigator.clipboard.writeText(address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback
        if (textareaRef.current) {
          textareaRef.current.value = address;
          textareaRef.current.style.display = 'block';
          textareaRef.current.focus();
          textareaRef.current.select();

          setTimeout(() => {
            try {
              const successful = document.execCommand('copy');
              if (successful) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            } catch (err) {
              console.error('Copy fallback failed:', err);
            }
            textareaRef.current!.style.display = 'none';
          }, 1);
        }
      });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{address ? address.substring(0, 2) : '...'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>{shortenAddress(address, 12)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </SheetTitle>
          <SheetDescription>
            A summary of this wallet's balance and token holdings.
          </SheetDescription>
        </SheetHeader>

        {/* Hidden textarea for fallback */}
        <textarea
          ref={textareaRef}
          readOnly
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '0',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <StatItem
                label="SOL Balance"
                isLoading={isLoading}
                value={details ? `${details.sol.balance.toFixed(4)} SOL` : ''}
              />
              <StatItem
                label="SOL Value (USD)"
                isLoading={isLoading}
                value={details ? formatCurrency(details.sol.valueUSD || 0) : ''}
              />
              <Accordion type="single" collapsible>
                <AccordionItem value="tokens" className="border-none">
                  <AccordionTrigger className="flex justify-between items-center text-sm py-1 font-medium text-muted-foreground hover:no-underline">
                    <span>Token Holdings</span>
                    {isLoading ? (
                      <Skeleton className="h-5 w-16" />
                    ) : (
                      <span className="font-medium text-foreground">
                        ({details?.tokens.length || 0} Tokens)
                      </span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    {details && details.tokens.length > 0 ? (
                      <div className="space-y-2">
                        {details.tokens.slice(0, 5).map((token) => (
                          <div
                            key={token.mint}
                            className="flex justify-between items-center text-xs"
                          >
                            <span>{token.symbol}</span>
                            <span className="font-code">
                              {token.amount.toFixed(2)} ({formatCurrency(token.valueUSD || 0)})
                            </span>
                          </div>
                        ))}
                        {details.tokens.length > 5 && (
                          <p className="text-xs text-center text-muted-foreground">
                            ...and {details.tokens.length - 5} more.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center">
                        No other tokens held.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <div className="pt-4 text-center text-sm text-muted-foreground">
              Transaction stats have been moved to the full wallet view for faster performance.
            </div>
          </div>
        )}

        <div className="p-2 border-t mt-auto">
          <Button variant="ghost" className="w-full justify-center" asChild>
            <a
              href={`/wallet/${address}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Full View <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
