import Image from 'next/image';

const links = [
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' }
];

export default function NavBar() {
  return (
    <nav className="fixed top-0 z-20 w-full border-b-[1px] border-white/20 bg-white/40 backdrop-blur-[8px] dark:bg-black/40">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between p-5 px-10">
        <Image
          className="relative ml-5 dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src="/next.svg"
          alt="Next.js Logo"
          width={90}
          height={40}
          priority
        />
        <div className="flex md:order-2 md:hidden">
          <button
            data-collapse-toggle="navbar-menu"
            type="button"
            className="inline-flex items-center rounded-lg p-2 text-sm text-white hover:ring-2 hover:ring-slate-50 md:hidden"
            aria-controls="navbar-menu"
            aria-expanded="false"
          >
            <span className="sr-only">Open main menu</span>
            <svg
              className="h-6 w-6"
              aria-hidden="true"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div
          id="navbar-menu"
          className="hidden w-full items-center justify-between md:order-1 md:flex md:w-auto"
        >
          <ul className="flex w-full flex-col gap-x-10 p-4 capitalize md:flex-row md:p-0 ">
            {links.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  className="dark:hover:drop-shadow-[0_0_0.3rem_#ffffff70]"
                >
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
