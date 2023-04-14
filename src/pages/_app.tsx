import '@styles/globals.css';
import { Urbanist } from 'next/font/google';
import type { AppProps } from 'next/app';

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900']
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${urbanist.className}`}>
      <Component {...pageProps} />;
    </div>
  );
}
