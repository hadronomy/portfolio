import Head from 'next/head';

import Hero from '~/components/Hero';
import NavBar from '~/components/NavBar';

export const metadata = {
  title: 'Hadronomy - Pablo Hernández'
};

export default function HomePage() {
  return (
    <>
      <NavBar />
      <section
        id="hero"
        className="mx-auto flex h-screen max-w-screen-xl flex-col"
      >
        <Hero />
      </section>
      <section id="about" className="mx-auto h-screen max-w-screen-xl">
        {/* About */}
      </section>
      <section id="contact" className="mx-auto h-screen max-w-screen-xl">
        {/* Contact */}
      </section>
      {/* Footer */}
    </>
  );
}
