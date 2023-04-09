import Image from 'next/image'

const links = [
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

export default function NavBar() {
  return (
    <nav className="z-20 bg-white/40 dark:bg-black/40 fixed w-full backdrop-blur-[8px]">
      <div className="max-w-screen-xl flex items-center justify-between mx-auto p-5 pl-10 pr-10">
        <Image
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert ml-5"
          src="/next.svg"
          alt="Next.js Logo"
          width={90}
          height={40}
          priority
        />
        <div className="flex md:hidden md:order-2">
          <button 
            data-collapse-toggle="navbar-menu" 
            type="button" 
            className="inline-flex items-center p-2 text-sm text-white rounded-lg md:hidden hover:ring-2 hover:ring-slate-50" 
            aria-controls="navbar-menu" 
            aria-expanded="false"
          >
            <span className="sr-only">Open main menu</span>
            <svg 
              className="w-6 h-6" 
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
          className="items-center justify-between hidden w-full md:flex md:w-auto md:order-1"
        >
          <ul className="flex flex-col md:flex-row p-4 md:p-0 w-full gap-x-10 font-thin uppercase ">
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
  )
}
