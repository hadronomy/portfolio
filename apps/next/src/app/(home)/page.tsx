import { Navbar } from '@portfolio/ui/navbar';

import { About } from '~/components/about';
import { Hero } from '~/components/hero';

export const metadata = {
  title: 'Portfolio',
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-screen-xl flex-col">
        <section id="hero" className="flex h-screen flex-col">
          <Hero />
        </section>
        <section id="about" className="flex h-screen flex-col">
          <About />
        </section>
        <section id="contact" className="flex h-screen flex-col">
          {/* Contact */}
        </section>
        {/* Footer */}
      </main>
    </>
  );
}
