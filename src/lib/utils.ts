import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    if (value === null || value === undefined) {
      return '$0.00';
    }
    
    const finalOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
        ...options
    };

    if (value > 0 && value < 0.01) {
      // For very small values, show more precision
      finalOptions.minimumFractionDigits = 2;
      finalOptions.maximumFractionDigits = 6;
    } else if (value >= 1000 && value % 1 === 0) {
      // For large whole numbers, omit cents
      finalOptions.minimumFractionDigits = 0;
      finalOptions.maximumFractionDigits = 0;
    } else {
      // Default for most other numbers
      finalOptions.minimumFractionDigits = 2;
      finalOptions.maximumFractionDigits = 2;
    }

    return new Intl.NumberFormat('en-US', finalOptions).format(value);
}
