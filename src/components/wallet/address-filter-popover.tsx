'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Plus, Trash2 } from 'lucide-react';
import { isValidSolanaAddress } from '@/lib/solana-utils';

export interface AddressFilter {
    id: number;
    address: string;
    type: 'include' | 'exclude';
    group: string;
}

interface AddressFilterPopoverProps {
    onApply: (filters: AddressFilter[]) => void;
}

export const AddressFilterPopover = ({ onApply }: AddressFilterPopoverProps) => {
    const [open, setOpen] = useState(false);
    const [filters, setFilters] = useState<AddressFilter[]>([
        { id: 1, address: '', type: 'include', group: 'all' }
    ]);

    const addFilter = () => {
        setFilters([...filters, { id: Date.now(), address: '', type: 'include', group: 'all' }]);
    };

    const removeFilter = (id: number) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const updateFilter = (id: number, updatedValues: Partial<Omit<AddressFilter, 'id'>>) => {
        setFilters(filters.map(f => f.id === id ? { ...f, ...updatedValues } : f));
    };

    const handleReset = () => {
        const initialFilter = [{ id: 1, address: '', type: 'include', group: 'all' }];
        setFilters(initialFilter);
        onApply(initialFilter.filter(f => isValidSolanaAddress(f.address)));
    };

    const handleApply = () => {
        // Only apply filters that have a valid address
        const validFilters = filters.filter(f => f.address.trim() !== '');
        onApply(validFilters);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Filter className="h-4 w-4" />
                    <span className="sr-only">Open address filter</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="start">
                <div className="space-y-4">
                    <div className="space-y-2">
                        {filters.map((filter, index) => (
                            <div key={filter.id} className="flex items-center gap-2">
                                <Input
                                    placeholder="Type to filter address"
                                    value={filter.address}
                                    onChange={(e) => updateFilter(filter.id, { address: e.target.value })}
                                    className="h-9"
                                />
                                <Select
                                    value={filter.type}
                                    onValueChange={(value: 'include' | 'exclude') => updateFilter(filter.id, { type: value })}
                                >
                                    <SelectTrigger className="w-32 h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="include">Include</SelectItem>
                                        <SelectItem value="exclude">Exclude</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeFilter(filter.id)} disabled={filters.length === 1}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addFilter} className="w-full">
                        <Plus className="mr-2 h-4 w-4" /> Add address
                    </Button>
                    <div className="flex justify-between items-center pt-4 border-t">
                        <Button variant="ghost" onClick={handleReset}>Reset</Button>
                        <Button onClick={handleApply}>Filter</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
