import Hero from '@components/Hero';
import NavBar from '@components/NavBar';
import Head from 'next/head';

export default function HomePage() {
  return (
    <div className="scroll h-screen flex-col overflow-y-scroll">
      <Head>
        <title>Hadronomy - Pablo Hernández</title>
      </Head>
      <NavBar />
      <section
        id="hero"
        className="mx-auto flex h-screen max-w-screen-xl snap-start flex-col"
      >
        <Hero />
      </section>
      <section
        id="about"
        className="mx-auto h-screen max-w-screen-xl snap-start"
      >
        {/* About */}
      </section>
      <section
        id="contact"
        className="mx-auto h-screen max-w-screen-xl snap-start"
      >
        {/* Contact */}
      </section>
      {/* Footer */}
    </div>
  );
}
