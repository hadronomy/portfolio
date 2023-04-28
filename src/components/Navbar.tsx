import Link from 'next/link';
import { HiMoon, HiMenuAlt1 } from 'react-icons/hi';
import { SocialIcon } from 'react-social-icons';
import React from 'react';

import { Button, buttonVariants } from '~/components/ui/Button';

const links = [
  {
    label: 'Home',
    href: '/'
  },
  {
    label: 'About',
    href: '/#about'
  },
  {
    label: 'Contact',
    href: '/#contact'
  }
];

const socials = [
  {
    link: 'https://github.com/Hadronomy'
  },
  {
    link: 'https://twitter.com/hadronomy'
  },
  {
    link: 'https://linkedin.com/in/hadronomy'
  }
];

type NavBarProps = React.HTMLAttributes<HTMLHeadElement> & {};

export default function Navbar({}: NavBarProps) {
  return (
    <header className="sticky top-0 z-20 max-h-20 w-full border-b-[1px] border-white/20 bg-background/80 backdrop-blur-[8px]">
      <nav className="mx-auto flex max-h-20 max-w-screen-xl items-center justify-between p-6">
        <div className="flex md:order-2 md:hidden">
          <button
            data-collapse-toggle="navbar-menu"
            type="button"
            className="inline-flex h-10 w-10 items-center rounded-lg p-3 text-sm text-white ring-slate-50/60 transition-all hover:ring-2 after:hover:ring-slate-50/30 focus:ring-2 active:ring-slate-50 md:hidden"
            aria-label="Menu Button"
            aria-controls="navbar-menu"
            aria-expanded="false"
          >
            <span className="sr-only">Open main menu</span>
            <HiMenuAlt1 className="h-full w-full" />
          </button>
        </div>
        <div className="flex max-h-10 items-center justify-between gap-x-2 align-middle">
          {socials.map(({ link }) => (
            <div className="inline-flex w-10 p-1" key={link}>
              <SocialIcon
                className={buttonVariants({
                  className: 'h-10',
                  variant: 'ghost'
                })}
                bgColor="transparent"
                fgColor="white"
                url={link}
              />
            </div>
          ))}
        </div>
        <div
          id="navbar-menu"
          className="hidden w-full items-center justify-between md:order-1 md:flex md:w-auto"
        >
          <ul className="flex w-full flex-col gap-x-10 p-4 capitalize md:flex-row md:p-0 ">
            {links.map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="dark:hover:drop-shadow-[0_0_0.3rem_#ffffff70]"
                  aria-label={label}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-last items-center">
          <button
            disabled={true}
            className="inline-flex h-10 w-10 items-center rounded-lg p-3 text-sm text-white ring-slate-50/60 transition-all hover:ring-2 hover:ring-slate-50/30  focus:ring-2 active:ring-slate-50 disabled:opacity-20"
            aria-label="Dark Mode Button"
          >
            <HiMoon className="h-full w-full" />
          </button>
        </div>
      </nav>
    </header>
  );
}
