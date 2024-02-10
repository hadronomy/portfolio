import Link from 'next/link';

import { buttonVariants } from '@portfolio/ui/button';
import { Meteors } from '@portfolio/ui/meteors';

export default function NotFound() {
  return (
    <main className="min-h-screen w-full overflow-hidden flex flex-col items-center justify-center">
      <section className="overflow-hidden relative items-center p-10 flex gap-y-4 flex-col">
        <h1 className="md:text-9xl font-mono text-8xl w-full text-center font-bold">
          404
        </h1>
        <h2 className="w-full font-mono text-xl text-muted-foreground text-center">
          Page Not Found
        </h2>
        <Link
          className={buttonVariants({
            size: 'lg',
            variant: 'linkHover1',
            className: 'mt-10',
          })}
          href="/"
        >
          Go back home
        </Link>
        <Meteors number={20} />
      </section>
    </main>
  );
}
