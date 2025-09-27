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
import { getTag, setTag, LocalTag } from '@/lib/tag-store';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { groupStyles } from './wallet-relationship-graph-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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

const tagOptions = Object.keys(groupStyles).filter(key => key !== 'root');

export function WalletDetailSheet({ address, open, onOpenChange, onTagUpdate }: WalletDetailSheetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<WalletDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagType, setTagType] = useState('');
  const [localTag, setLocalTag] = useState<LocalTag | null>(null);

  useEffect(() => {
    if (open && address) {
      const currentTag = getTag(address);
      setLocalTag(currentTag);
      setTagName(currentTag?.name || '');
      setTagType(currentTag?.type || '');

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
    } else {
        setIsEditingTag(false);
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
    if (!tagName && !tagType) {
      setTag(address, null); // Remove tag if both are empty
      toast({ title: 'Tag Removed' });
    } else {
      setTag(address, { name: tagName, type: tagType });
      toast({ title: 'Tag Saved' });
    }
    onTagUpdate(); // Notify parent to refresh tags
    setIsEditingTag(false);
    const newTag = getTag(address);
    setLocalTag(newTag);
  };

  const sheetTitle = localTag?.name || shortenAddress(address, 12);
  const sheetDescription = localTag?.name ? `(${localTag.type}) ${shortenAddress(address, 6)}` : `A summary of this wallet's balance and token holdings.`;

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
            </Accordion>
             <Accordion type="single" collapsible>
              <AccordionItem value="tagging" className="border-b-0">
                <AccordionTrigger className="font-semibold text-base py-2">
                    <div className='flex items-center gap-2'>
                        <Tag className="h-4 w-4"/> Manual Tag
                    </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2">
                        <Label htmlFor="tagName">Custom Name</Label>
                        <Input 
                            id="tagName"
                            placeholder="e.g., My Burner Wallet"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                        />
                     </div>
                     <div className="space-y-2">
                        <Label htmlFor="tagType">Category</Label>
                        <Select value={tagType} onValueChange={setTagType}>
                            <SelectTrigger id="tagType">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {tagOptions.map(opt => (
                                    <SelectItem key={opt} value={opt} className="capitalize">
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                     </div>
                     <Button onClick={handleSaveTag} className="w-full">Save Tag</Button>
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
