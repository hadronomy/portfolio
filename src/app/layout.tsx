import React from 'react';
import { Urbanist } from 'next/font/google';
import Script from 'next/script';

import { WebVitals } from '~/components/webvitals';
import { env } from '~/env.mjs';

import '~/styles/globals.css';

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900']
});

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={`dark ${urbanist.className}`} lang="en">
      {process.env.NODE_ENV === 'production' && (
        <Script
          async
          src="https://analytics.umami.is/script.js"
          data-website-id={env.ANALYTICS_ID}
        />
      )}
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
