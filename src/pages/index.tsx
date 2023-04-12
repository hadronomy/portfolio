import NavBar from '@components/NavBar';
import InteractiveRoom from '@components/InteractiveRoom';
import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Hadronomy - Pablo Hernández</title>
      </Head>
      <NavBar />
      <main className="flex min-h-screen flex-col">
        <div className="flex flex-grow justify-center">
          <div className="flex-grow">
            <InteractiveRoom />
          </div>
        </div>
      </main>
    </>
  );
}
