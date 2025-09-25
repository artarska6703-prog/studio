
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { TokenHolding, FlattenedTransaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { shortenAddress } from '@/lib/solana-utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatDistanceToNow, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Copy, Check, Filter, Download, MoreHorizontal, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { Input } from '../ui/input';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { DatePickerWithRange } from '../ui/date-picker';
import type { DateRange } from 'react-day-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { AddressFilter, AddressFilterPopover } from './address-filter-popover';

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


const AddressDisplay = ({ address }: { address: string | null }) => {
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();
    
    if (!address) {
        return <span className="text-muted-foreground">-</span>;
    }

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        copyToClipboard(address).then((success) => {
          if (success) {
            setCopied(true);
            toast({ title: "Address copied." });
            setTimeout(() => setCopied(false), 2000);
          } else {
            toast({ variant: 'destructive', title: "Copy failed." });
          }
        });
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 group">
                        <span className="font-code hover:underline">{shortenAddress(address, 8)}</span>
                        <div className="w-4 h-4 shrink-0">
                            {copied 
                                ? <Check className="w-3 h-3 text-green-500" /> 
                                : <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer" onClick={handleCopy} />
                            }
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{address}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const getActionBadge = (instruction: string) => {
    const action = instruction.toUpperCase();
    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    if (action === 'TRANSFER') variant = 'default';
    if (action === 'CLOSE ACCOUNT') variant = 'destructive';
    if (action === 'CREATE ACCOUNT') variant = 'secondary';
    if (action === 'SWAP') variant = 'secondary';


    return <Badge variant={variant} className="capitalize py-1">{action.toLowerCase()}</Badge>
}

const TransactionRowActions = ({ signature }: { signature: string }) => {
    const { toast } = useToast();

    const copySignature = (e: React.MouseEvent | Event) => {
        e.stopPropagation();
        copyToClipboard(signature).then(success => {
            if (success) {
                toast({ title: "Signature copied to clipboard." });
            } else {
                toast({ variant: 'destructive', title: "Copy failed." });
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copySignature}>
                    Copy Signature
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                     <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer">
                        View on Solscan
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface TransactionTableProps {
  transactions: FlattenedTransaction[];
  allTokens: TokenHolding[];
  walletAddress: string;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalTransactions: number;
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
}


export function TransactionTable({ 
    transactions, 
    allTokens, 
    walletAddress, 
    onLoadMore, 
    hasMore, 
    isLoadingMore, 
    totalTransactions,
    dateRange,
    setDateRange
}: TransactionTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tokenFilter, setTokenFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [minValueFilter, setMinValueFilter] = useState('');
  const debouncedMinValue = useDebounce(minValueFilter, 500);
  const [fromFilters, setFromFilters] = useState<AddressFilter[]>([]);
  const [toFilters, setToFilters] = useState<AddressFilter[]>([]);
  
  const tokenMap = useMemo(() => {
    const map = new Map<string, TokenHolding>();
    allTokens.forEach(token => map.set(token.mint, token));
    map.set('So11111111111111111111111111111111111111112', {
        mint: 'So11111111111111111111111111111111111111112',
        name: 'Solana',
        symbol: 'SOL',
        amount: 0,
        decimals: 9,
        price: 0,
        valueUSD: 0,
        tokenStandard: 'Native' as any
    });
    return map;
  }, [allTokens]);


  const filteredTransactions = useMemo(() => {
    const minValue = parseFloat(debouncedMinValue);
    const validMinValue = isNaN(minValue) ? 0 : minValue;

    return transactions.filter(tx => {
        if (!tx) return false;
        
        if (validMinValue > 0 && (tx.valueUSD === null || Math.abs(tx.valueUSD) < validMinValue)) return false;
        
        const tokenMatch = tokenFilter === 'all' || 
                            (tokenFilter === 'sol' && tx.mint === 'So11111111111111111111111111111111111111112') ||
                            (tokenFilter === 'spl' && tx.mint !== 'So11111111111111111111111111111111111111112');
                            
        const directionMatch = directionFilter === 'all' ||
                                (directionFilter === 'in' && tx.amount > 0) ||
                                (directionFilter === 'out' && tx.amount < 0) ||
                                (directionFilter === 'program' && tx.type === 'program_interaction');

        
        const dateMatch = !dateRange?.from || 
                          (tx.blockTime ? isWithinInterval(new Date(tx.blockTime * 1000), { 
                              start: startOfDay(dateRange.from), 
                              end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
                          }) : true);
        
        const checkAddressFilters = (address: string | null, filters: AddressFilter[]) => {
            if (filters.length === 0) return true;
            if (!address) return false;
            // For a transaction to be included, it must satisfy all filters
            return filters.every(filter => {
                const addressMatch = address.toLowerCase().includes(filter.address.toLowerCase());
                return filter.type === 'include' ? addressMatch : !addressMatch;
            });
        };

        const fromMatch = checkAddressFilters(tx.from, fromFilters);
        const toMatch = checkAddressFilters(tx.to, toFilters);

        return tokenMatch && directionMatch && dateMatch && fromMatch && toMatch;
    });
  }, [transactions, tokenFilter, directionFilter, debouncedMinValue, dateRange, fromFilters, toFilters]);
  
  const totalPages = useMemo(() => {
      const total = Math.ceil(filteredTransactions.length / rowsPerPage);
      return total > 0 ? total : 1;
  }, [filteredTransactions.length, rowsPerPage]);
  
  const paginatedTransactions = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTransactions, page, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) {
        setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, tokenFilter, directionFilter, debouncedMinValue, dateRange, fromFilters, toFilters]);

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value, 10));
  }
  
  const getSymbol = (tx: FlattenedTransaction) => {
      if(tx.mint && tokenMap.has(tx.mint)) {
          return tokenMap.get(tx.mint)?.symbol || shortenAddress(tx.mint, 4);
      }
      return tx.symbol || shortenAddress(tx.mint || '?', 4);
  }
  
  const formatAmount = (tx: FlattenedTransaction) => {
    if (tx.type === 'program_interaction') return '-';
    let amount = tx.amount;
    const absAmount = Math.abs(amount);
    if (absAmount === 0) return '0.00';

    const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
    
    return formatter.format(absAmount);
};


  return (
    <Card>
      <CardHeader className="p-4 border-b space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Showing {filteredTransactions.length} of {totalTransactions} loaded transfers</p>
                {(isLoadingMore) && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                    <Download className="mr-2 h-4 w-4"/>
                    Export CSV
                </Button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
                 <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <Button variant={tokenFilter === 'all' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setTokenFilter('all')}>All</Button>
                    <Button variant={tokenFilter === 'sol' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setTokenFilter('sol')}>SOL</Button>
                    <Button variant={tokenFilter === 'spl' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setTokenFilter('spl')}>SPL</Button>
                </div>
                <Separator orientation="vertical" className="h-6 mx-2 hidden md:block"/>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <Button variant={directionFilter === 'all' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setDirectionFilter('all')}>All</Button>
                    <Button variant={directionFilter === 'out' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setDirectionFilter('out')}>Sent</Button>
                     <Button variant={directionFilter === 'in' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setDirectionFilter('in')}>Received</Button>
                     <Button variant={directionFilter === 'program' ? 'default' : 'ghost'} size="sm" className={cn("h-7")} onClick={() => setDirectionFilter('program')}>Interaction</Button>
                </div>
                 <Separator orientation="vertical" className="h-6 mx-2 hidden md:block"/>
                 <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input 
                        placeholder="Min value"
                        className="h-8 pl-6 w-28"
                        type="number"
                        value={minValueFilter}
                        onChange={(e) => setMinValueFilter(e.target.value)}
                    />
                 </div>
            </div>
            <div className="flex items-center justify-start lg:justify-end gap-2">
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                {dateRange && <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>Clear</Button>}
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>
                    <div className="flex items-center gap-2">
                        From
                        <AddressFilterPopover onApply={setFromFilters} />
                    </div>
                </TableHead>
                <TableHead>
                    <div className="flex items-center gap-2">
                        To
                        <AddressFilterPopover onApply={setToFilters} />
                    </div>
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Token</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.length > 0 ? paginatedTransactions.map((tx, idx) => {
                const isOut = tx.amount < 0;
                return (
                <TableRow key={`${tx.signature}-${idx}`}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {tx.blockTime ? formatDistanceToNow(new Date(tx.blockTime * 1000), { addSuffix: true }) : 'Pending'}
                    </TableCell>
                    <TableCell>
                        {getActionBadge(tx.instruction)}
                    </TableCell>
                    <TableCell>
                        <AddressDisplay address={tx.from} />
                    </TableCell>
                     <TableCell>
                        <AddressDisplay address={tx.to} />
                    </TableCell>
                    <TableCell className={cn("text-right font-code whitespace-nowrap", tx.type === 'program_interaction' ? 'text-muted-foreground' : isOut ? 'text-red-500' : 'text-green-500')}>
                        {tx.type !== 'program_interaction' && (isOut ? '-' : '+')}{formatAmount(tx)}
                    </TableCell>
                    <TableCell className="text-right font-code text-muted-foreground">
                        {console.log("Tx valueUSD raw:", tx.valueUSD, "for signature", tx.signature)}
                        {formatCurrency(Math.abs(tx.valueUSD))}
                    </TableCell>
                    <TableCell className="text-right font-code font-bold">
                        {getSymbol(tx)}
                    </TableCell>
                    <TableCell>
                        <TransactionRowActions signature={tx.signature} />
                    </TableCell>
                </TableRow>
              )}) : (
                <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                        {isLoadingMore ? "Loading..." : "No transactions found for the current filters."}
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {hasMore && !useMockData && (
            <div className="p-4 border-t text-center">
                <Button onClick={onLoadMore} disabled={isLoadingMore} variant="secondary">
                     {isLoadingMore ? "Loading..." : "Load More Transactions"}
                </Button>
            </div>
        )}
      </CardContent>

        <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
                    <SelectTrigger className="w-20 h-8">
                        <SelectValue placeholder="Rows" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                </Select>
                <span>per page</span>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages > 0 ? totalPages : 1}
                </span>
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                    >
                        <span className="sr-only">First page</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                       <span className="sr-only">Previous page</span>
                       <ChevronLeft className="h-4 w-4" />
                    </Button>
                     <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || totalPages === 0}
                    >
                        <span className="sr-only">Next page</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages || totalPages === 0}
                    >
                        <span className="sr-only">Last page</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
      </div>

    </Card>
  );
}

    
