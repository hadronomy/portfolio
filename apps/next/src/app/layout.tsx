import React from 'react';
import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import Script from 'next/script';

// import { SandpackCSS } from '~/components/sandpack';

import { cn } from '@portfolio/ui';
import { Footer } from '@portfolio/ui/footer';

import { WebVitals } from '~/components/webvitals';
import { env } from '~/env.mjs';

import '~/styles/globals.css';

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-sans',
});

export const metadata = {
  metadataBase: new URL('https://hadronomy.com'),
  title: {
    default: 'Portfolio | Pablo Hernández',
    template: '%s | Pablo Hernández',
  },
  creator: 'Pablo Hernández',
} satisfies Metadata;

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={cn('dark antialiased', urbanist.variable)} lang="en">
      {process.env.NODE_ENV === 'production' && (
        <Script
          async
          src="https://analytics.umami.is/script.js"
          data-website-id={env.ANALYTICS_ID}
        />
      )}
      <body>
        {children}
        <WebVitals />
        <Footer />
      </body>
    </html>
  );
}
