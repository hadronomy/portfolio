import '@styles/globals.css';
import { Roboto } from 'next/font/google';
import type { AppProps } from 'next/app';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900']
});

export default function App({ Component, pageProps }: AppProps) {
  return <Component className={roboto.className} {...pageProps} />;
}
