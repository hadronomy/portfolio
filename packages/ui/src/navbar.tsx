'use client';

import path from 'path';
import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

import { cn } from './utils/cn';

const links = [
  {
    label: 'Home',
    href: '/',
  },
  {
    label: 'Projects',
    href: '/#projects',
  },
  {
    label: 'About',
    href: '/#about',
  },
  {
    label: 'Contact',
    href: '/#contact',
  },
  {
    label: 'Blog',
    href: '/blog',
  },
];

function startsWithAndNotHome(str: string, prefix: string) {
  return (str.startsWith(prefix) && prefix !== '/') || prefix === str;
}

export type NavbarProps = React.ComponentProps<'header'> & {
  pages?: typeof links;
};

export function Navbar({ className, pages = links }: NavbarProps) {
  const params = useParams();
  const url_pathname = usePathname();
  const [pathname, setPathname] = React.useState('/');
  const [hoveredPath, setHoveredPath] = React.useState('/');

  React.useEffect(() => {
    const new_pathname = path.join(url_pathname, window.location.hash) || '/';
    setHoveredPath(new_pathname);
  }, [url_pathname]);

  React.useEffect(() => {
    const new_pathname = path.join(url_pathname, window.location.hash) || '/';
    setPathname(new_pathname);
  }, [params, url_pathname]);

  return (
    <header className={cn('sticky pt-10 top-0 z-20 w-full', className)}>
      <nav className="mx-auto max-w-fit px-8 py-3 bg-transparent backdrop-blur-xl border-white/10 border-2 rounded-full overflow-hidden">
        <ul className="flex w-full h-full gap-x-5 capitalize flex-row p-0">
          {pages.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                className={cn(
                  'rounded-md transition-all inline-block relative px-5 py-2 font-bold hover:text-foreground/80 dark:hover:drop-shadow-[0.3_0.3_1.2rem_#ffffff80]',
                  {
                    'text-foreground': startsWithAndNotHome(pathname, href),
                    'text-muted-foreground': !startsWithAndNotHome(
                      pathname,
                      href,
                    ),
                  },
                )}
                aria-label={label}
                onMouseOver={() => setHoveredPath(href)}
                onMouseLeave={() => setHoveredPath(pathname)}
                onClick={() => setHoveredPath(href)}
              >
                <span className="text-center">{label}</span>
                {startsWithAndNotHome(hoveredPath, href) && (
                  <motion.div
                    className="absolute bottom-0 left-0 h-full bg-stone-800/80 rounded-md -z-10"
                    layoutId="navbar"
                    aria-hidden="true"
                    style={{
                      width: '100%',
                    }}
                    transition={{
                      type: 'tween',
                      bounce: 0.25,
                      stiffness: 130,
                      damping: 9,
                      duration: 0.3,
                    }}
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
