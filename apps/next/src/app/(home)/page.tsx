import { Navbar } from '@portfolio/ui/navbar';

import { Hero } from './_components/hero';

export const metadata = {
  title: 'Portfolio',
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full min-h-screen max-w-screen-xl flex-col">
        <Hero id="hero" className="md:h-screen" />
      </main>
    </>
  );
}
