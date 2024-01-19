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
        <div className="fixed h-full w-full bg-black">
          <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
          <div className="absolute left-0 right-0 top-[-10%] h-[1000px] w-[1000px] rounded-full bg-[radial-gradient(circle_400px_at_50%_300px,#fbfbfb36,#000)]"></div>
        </div>
        {children}
        <WebVitals />
        <Footer />
      </body>
    </html>
  );
}
