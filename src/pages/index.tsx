import Hero from '@components/Hero';
import NavBar from '@components/NavBar';
import Head from 'next/head';

export default function HomePage() {
  return (
    <div className="scroll h-screen flex-col divide-y-[1px] divide-white/30 overflow-y-scroll">
      <Head>
        <title>Hadronomy - Pablo Hernández</title>
      </Head>
      <NavBar />
      <section className="flex h-screen snap-start flex-col">
        <Hero />
      </section>
      <section id="about" className="h-screen snap-start">
        {/* About */}
      </section>
      <section id="contact" className="h-screen snap-start">
        {/* Contact */}
      </section>
      {/* Footer */}
    </div>
  );
}
