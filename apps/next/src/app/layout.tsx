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

import '~/styles/globals.css';
import '~/styles/twoslash.css';

const LINKS = [
  {
    label: 'Home',
    href: '/',
    default: true,
  },
  {
    label: 'Projects',
    href: '/#projects',
  },
  {
    label: 'About',
    href: '/#about',
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
  creator: 'Pablo Hernández',
} satisfies Metadata;

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      className={cn('dark antialiased', onest.variable, neon.variable)}
      lang="en"
    >
      {process.env.NODE_ENV === 'production' && (
        <Script
          async
          src="https://analytics.umami.is/script.js"
          data-website-id={env.ANALYTICS_ID}
        />
      )}
      <body>
        <Navbar pages={LINKS} />
        {children}
        <WebVitals />
        <Footer />
      </body>
    </html>
  );
}
