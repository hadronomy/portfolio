import Hero from '@components/Hero';
import NavBar from '@components/NavBar';
import Head from 'next/head';

export default function HomePage() {
  return (
    <div className="h-screen snap-y snap-mandatory flex-col overflow-y-scroll">
      <Head>
        <title>Hadronomy - Pablo Hernández</title>
      </Head>
      <NavBar />
      <section className="flex h-screen snap-start flex-col">
        <Hero />
      </section>
      <section id="about" className="h-screen snap-center border-t-2"></section>
      <section
        id="contact"
        className="h-screen snap-center border-t-2"
      ></section>
      {/* Footer */}
    </div>
  );
}
