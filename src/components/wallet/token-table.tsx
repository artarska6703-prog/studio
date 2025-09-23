

'use client';

import { useState, useMemo } from 'react';
import type { TokenHolding } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';

interface TokenTableProps {
  tokens: TokenHolding[];
  className?: string;
}

export function TokenTable({ tokens, className }: TokenTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0));
  }, [tokens]);

  const paginatedTokens = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedTokens.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedTokens, page, rowsPerPage]);

  const totalPages = Math.ceil(sortedTokens.length / rowsPerPage);

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value, 10));
    setPage(1);
  };

  return (
    <Card className={cn(className, "flex flex-col")}>
      <CardHeader>
        <CardTitle>Token Holdings</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Value (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTokens.length > 0 ? paginatedTokens.map((token) => (
                <TableRow key={token.mint}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold relative overflow-hidden">
                            {token.icon ? (
                                <Image src={token.icon} alt={token.name} fill sizes="32px" className="object-cover"/>
                            ) : (
                                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span>{token.name}</span>
                            <span className="text-xs text-muted-foreground">{token.symbol}</span>
                        </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-code">
                    {token.amount.toLocaleString('en-US', { maximumFractionDigits: 4, })}
                  </TableCell>
                  <TableCell className="font-code">
                    {formatCurrency(token.price, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </TableCell>
                   <TableCell className="text-right font-code">
                    {formatCurrency(token.valueUSD ?? 0)}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No tokens found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </CardContent>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t mt-auto">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
                    <SelectTrigger className="w-20 h-8">
                        <SelectValue placeholder="Rows" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                </Select>
                <span>per page</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground whitespace-nowrap">
                    Page {page} of {totalPages > 0 ? totalPages : 1}
                </span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-8 w-8 p-0"
                    >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || totalPages === 0}
                        className="h-8 w-8 p-0"
                    >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
      )}
    </Card>
  );
}
