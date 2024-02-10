import { Onest } from 'next/font/google';
import localFont from 'next/font/local';

export const onest = Onest({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-sans',
});

export const neon = localFont({
  src: './monaspace-neon.ttf',
  variable: '--font-mono',
});
