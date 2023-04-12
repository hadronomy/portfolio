import Image from 'next/image';
import Link from 'next/link';
import { Bars3CenterLeftIcon, MoonIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';

const links = [
  {
    label: 'Home',
    href: '/'
  },
  {
    label: 'About',
    href: '/about'
  },
  {
    label: 'Contact',
    href: '/contact'
  }
];

export default function NavBar() {
  const router = useRouter();

  return (
    <nav className="fixed top-0 z-20 w-full border-b-[1px] border-white/20 bg-white/40 backdrop-blur-[8px] dark:bg-black/40">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between p-5 px-10">
        <div className="flex md:order-2 md:hidden">
          <button
            data-collapse-toggle="navbar-menu"
            type="button"
            className="inline-flex h-8 w-8 items-center rounded-lg p-2 text-sm text-white hover:ring-2 hover:ring-slate-50 md:hidden"
            aria-controls="navbar-menu"
            aria-expanded="false"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3CenterLeftIcon className="h-auto w-auto" />
          </button>
        </div>
        <Image
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src="/next.svg"
          alt="Next.js Logo"
          width={80}
          height={80}
          priority
        />
        <div
          id="navbar-menu"
          className="hidden w-full items-center justify-between md:order-1 md:flex md:w-auto"
        >
          <ul className="flex w-full flex-col gap-x-10 p-4 capitalize md:flex-row md:p-0 ">
            {links.map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="aria-selected:border-b-2 dark:hover:drop-shadow-[0_0_0.3rem_#ffffff70]"
                  aria-current={router.route === href ? 'page' : undefined}
                  aria-selected={router.route === href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="items-center md:flex">
          <button className="inline-flex h-8 w-8 items-center rounded-lg p-2 text-sm text-white hover:ring-2 hover:ring-slate-50 md:hidden">
            <MoonIcon className="h-auto w-auto" />
          </button>
        </div>
      </div>
    </nav>
  );
}
