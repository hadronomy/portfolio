'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlignLeft as Menu } from 'lucide-react';
import { FaGithub, FaLinkedinIn, FaTwitter } from 'react-icons/fa';

import { cn } from './utils/cn';
import { Button, buttonVariants } from '~/button';

const links = [
  {
    label: 'Home',
    href: '/',
  },
  {
    label: 'About',
    href: '/#about',
  },
  {
    label: 'Contact',
    href: '/#contact',
  },
];

const socials = [
  {
    Icon: FaGithub,
    link: 'https://github.com/Hadronomy',
  },
  {
    Icon: FaLinkedinIn,
    link: 'https://linkedin.com/in/hadronomy',
  },
  {
    Icon: FaTwitter,
    link: 'https://twitter.com/hadronomy',
  },
];

export type NavbarProps = React.ComponentProps<'header'>;

export function Navbar({}: NavbarProps) {
  return (
    <header className="sticky top-0 z-20 w-full border-b-[1px] border-white/20 bg-background/90 backdrop-blur-[8px]">
      <nav className="mx-auto grid max-w-screen-xl grid-cols-4 px-6 py-4">
        <div className="flex md:order-2 md:hidden">
          <Button
            variant="ghost"
            className="inline-flex h-10 w-10 items-center rounded-lg p-3 text-sm text-white ring-slate-50/60 transition-all hover:ring-2 after:hover:ring-slate-50/30 focus:ring-2 active:ring-slate-50 md:hidden"
          >
            <span className="sr-only">Open main menu</span>
            <Menu className="h-full w-full" />
          </Button>
        </div>
        <div className="col-span-2 mx-auto flex max-h-10 items-center justify-between gap-x-2 align-middle md:col-span-1 md:ml-0 md:mr-auto">
          {socials.map(({ Icon, link }) => (
            <Link
              className={cn(
                buttonVariants({
                  className: 'h-8 w-8 px-0 py-0',
                  variant: 'link',
                }),
              )}
              href={link}
              target="_blank"
              key={link}
            >
              <Icon />
            </Link>
          ))}
        </div>
        <div
          id="navbar-menu"
          className="col-span-2 mx-auto hidden w-full items-center justify-center md:order-1 md:flex md:w-auto"
        >
          <ul className="flex w-full flex-col gap-x-10 p-4 capitalize md:flex-row md:p-0">
            {links.map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="font-bold text-muted-foreground hover:text-foreground/80 dark:hover:drop-shadow-[0.3_0.3_1.2rem_#ffffff80]"
                  aria-label={label}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
