import NavBar from '@components/NavBar';
import Head from 'next/head';

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Hadronomy | About</title>
      </Head>
      <NavBar />
      <main>
        <div className="flex min-h-screen flex-col justify-center">
          <h1 className="mx-auto text-9xl">About</h1>
          <p className="mx-auto text-lg uppercase tracking-widest">
            Under construction
          </p>
        </div>
      </main>
    </>
  );
}
