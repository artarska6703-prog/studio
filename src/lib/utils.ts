import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    if (value === null || value === undefined) {
      return '$0.00';
    }
    const finalOptions = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options
    };

    // For very small, non-zero values, show more precision.
    if (value > 0 && value < 0.01) {
      finalOptions.minimumFractionDigits = 4;
      finalOptions.maximumFractionDigits = 4;
    }
    
    // For larger numbers, don't show cents if it's a whole number
    if (value >= 1000 && value % 1 === 0) {
        finalOptions.minimumFractionDigits = 0;
        finalOptions.maximumFractionDigits = 0;
    }

    return new Intl.NumberFormat('en-US', finalOptions).format(value);
}
