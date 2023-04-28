import Head from 'next/head';

import Hero from '~/components/Hero';
import Navbar from '~/components/Navbar';

export const metadata = {
  title: 'Hadronomy - Pablo Hernández'
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
          {/* About */}
        </section>
        <section id="contact" className="flex h-screen flex-col">
          {/* Contact */}
        </section>
        {/* Footer */}
      </main>
    </>
  );
}
