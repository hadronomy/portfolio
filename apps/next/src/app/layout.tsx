import type { Metadata } from 'next';
import Script from 'next/script';
import type React from 'react';

// import { SandpackCSS } from '~/components/sandpack';

import { cn } from '@portfolio/ui';
import { Footer } from '@portfolio/ui/footer';
import { Navbar } from '@portfolio/ui/navbar';

import { WebVitals } from '~/components/webvitals';
import { env } from '~/env.mjs';
import { neon, onest } from '~/fonts';
import { Providers } from './providers';

import '~/styles/globals.css';
import '~/styles/twoslash.css';

const LINKS = [
  {
    label: 'Home',
    href: '/',
    default: true,
  },
  {
    label: 'Blog',
    href: '/blog',
  },
];

export const metadata = {
  metadataBase: new URL('https://hadronomy.com'),
  title: {
    default: 'Portfolio | Pablo Hernández',
    template: '%s | Pablo Hernández',
  },
  description:
    'I am passionate about programming and love to create innovative solutions. Get to know me and explore my coding journey.',
  openGraph: {
    title: 'Portfolio | Pablo Hernández',
    description: 'Learn more about me and about code',
    siteName: 'Portfolio | Pablo Hernández',
    type: 'website',
    locale: 'en_US',
  },
  creator: 'Pablo Hernández',
} satisfies Metadata;

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      className={cn('antialiased', onest.variable, neon.variable)}
      lang="en"
      suppressHydrationWarning
    >
      {process.env.NODE_ENV === 'production' && (
        <Script
          async
          src="https://analytics.umami.is/script.js"
          data-website-id={env.ANALYTICS_ID}
        />
      )}
      <body>
        <Providers
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar className="print:hidden" pages={LINKS} />
          {children}
          <WebVitals />
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
