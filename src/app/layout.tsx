import React from 'react';
import { Urbanist } from 'next/font/google';

import { Navbar } from '~/components/ui/navbar';

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
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
