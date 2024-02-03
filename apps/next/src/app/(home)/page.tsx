import { Hero } from './_components/hero';

export const metadata = {
  title: 'Portfolio',
};

export default function HomePage() {
  return (
    <>
      <main className="mx-auto flex w-full min-h-screen max-w-screen-xl flex-col">
        <Hero id="hero" className="md:h-screen" />
      </main>
    </>
  );
}
