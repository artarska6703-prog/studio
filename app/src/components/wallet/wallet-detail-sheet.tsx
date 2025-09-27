'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, Loader2, Tag } from 'lucide-react';
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
import { LocalTag, saveTag, getTag } from '@/lib/tag-store';
import { Input } from '../ui/input';

interface WalletDetailSheetProps {
  address: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagUpdate: () => void;
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

export function WalletDetailSheet({ address, open, onOpenChange, onTagUpdate }: WalletDetailSheetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<WalletDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localTag, setLocalTag] = useState<LocalTag | null>(null);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagType, setTagType] = useState('');

  useEffect(() => {
    if (open && address) {
      setIsEditingTag(false);
      const tag = getTag(address);
      setLocalTag(tag);
      setTagName(tag?.name || '');
      setTagType(tag?.type || '');

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
        toast({ title: 'Address Copied' });
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleSaveTag = () => {
    const newTag: LocalTag = { name: tagName, type: tagType };
    saveTag(address, newTag);
    setLocalTag(newTag);
    setIsEditingTag(false);
    onTagUpdate(); // Notify parent to refresh tags
    toast({ title: "Tag Saved", description: `Address tagged as "${tagName}".`});
  }

  const sheetTitle = localTag?.name || shortenAddress(address, 12);
  const sheetDescription = localTag?.type || `A summary of this wallet's holdings.`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{address ? address.substring(0, 2) : '...'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-lg font-semibold">
                <span>{sheetTitle}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <SheetDescription className="text-left">{sheetDescription}</SheetDescription>
            </div>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
             <Accordion type="single" collapsible defaultValue="summary">
              <AccordionItem value="summary" className="border-b-0">
                <AccordionTrigger className="font-semibold text-base py-2">Wallet Summary</AccordionTrigger>
                <AccordionContent className="space-y-2">
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
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Token Holdings</span>
                         {isLoading ? (
                            <Skeleton className="h-5 w-16" />
                        ) : (
                            <span className="font-medium">
                                ({details?.tokens.length || 0} Tokens)
                            </span>
                        )}
                    </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="tagging">
                 <AccordionTrigger className="font-semibold text-base py-2">
                    <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Manual Tagging
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    {isEditingTag ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="tagName">Custom Name</Label>
                                <Input id="tagName" value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="e.g., My Burner Wallet"/>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="tagType">Category / Type</Label>
                                <Input id="tagType" value={tagType} onChange={(e) => setTagType(e.target.value)} placeholder="e.g., friend, degen, CEX"/>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsEditingTag(false)}>Cancel</Button>
                                <Button onClick={handleSaveTag}>Save Tag</Button>
                            </div>
                        </div>
                    ) : (
                         <div className="flex flex-col items-center justify-center text-center gap-3 py-4">
                            {localTag ? (
                                <>
                                    <p className="text-sm text-muted-foreground">This wallet is tagged as:</p>
                                    <p><span className="font-bold">{localTag.name}</span> ({localTag.type})</p>
                                    <Button onClick={() => setIsEditingTag(true)}>Edit Tag</Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">No custom tag applied.</p>
                                    <Button onClick={() => setIsEditingTag(true)}>Add Tag</Button>
                                </>
                            )}
                        </div>
                    )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        <div className="p-2 border-t mt-auto">
          <Button variant="ghost" className="w-full justify-center" asChild>
            <a href={`/wallet/${address}`} target="_blank" rel="noopener noreferrer">
              Open Full View <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
