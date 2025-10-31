/**
 * Utility Functions
 * 
 * @description Common utility functions for the application
 * @author Silent Risk Team
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence
 * 
 * @description Combines clsx for conditional classes and tailwind-merge
 * for proper Tailwind class deduplication and precedence
 * 
 * @example
 * ```tsx
 * cn('px-2 py-1', condition && 'bg-blue-500', 'px-4') // => 'py-1 bg-blue-500 px-4'
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
