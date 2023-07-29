import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
