'use client';

import path from 'path';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from './utils/cn';

const links = [
  {
    label: 'Home',
    href: '/',
    default: true,
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
    label: 'Blog',
    href: '/blog',
  },
];

function startsWithAndNotHome(str: string | undefined, prefix: string) {
  if (str === undefined) return false;
  return (str.startsWith(prefix) && prefix !== '/') || prefix === str;
}

export type NavbarProps = React.ComponentProps<'header'> & {
  pages?: typeof links;
};

export function Navbar({ className, pages = links }: NavbarProps) {
  const params = useParams();
  const url_pathname = usePathname();
  const [pathname, setPathname] = React.useState<string | undefined>();
  const [hoveredPath, setHoveredPath] = React.useState<string | undefined>();

  React.useEffect(() => {
    const new_pathname = path.join(url_pathname, window.location.hash) || '/';
    setHoveredPath(new_pathname);
  }, [url_pathname]);

  /**
   * biome-ignore lint/correctness/useExhaustiveDependencies: We need to update the pathname
   * when the params changes
   */
  React.useEffect(() => {
    const new_pathname = path.join(url_pathname, window.location.hash) || '/';
    setPathname(new_pathname);
  }, [params, url_pathname]);

  return (
    <header className={cn('sticky pt-5 top-0 z-20 w-full', className)}>
      <nav className="mx-auto max-w-fit px-3 md:px-8 py-3 bg-transparent backdrop-blur-xl border-foreground/10 border-2 md:rounded-full rounded-3xl overflow-hidden">
        <ul className="flex w-full h-full gap-x-0 capitalize flex-row p-0">
          {pages.map(({ label, href, default: isDefault }) => (
            <li key={label}>
              <Link
                href={href}
                className={cn(
                  'rounded-md transition-all h-full inline-block relative px-5 py-2 font-bold hover:text-foreground/80 dark:hover:drop-shadow-[0.3_0.3_1.2rem_#ffffff80]',
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
                {hoveredPath === undefined && isDefault && (
                  <AnimatedHighlight layoutId="navbar" style={{ opacity: 0 }} />
                )}
                {startsWithAndNotHome(hoveredPath, href) && (
                  <AnimatedHighlight layoutId="navbar" style={{ opacity: 1 }} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

type AnimatedHighlightProps = React.ComponentProps<typeof motion.div>;

function AnimatedHighlight({
  className,
  style,
  layoutId,
  ...props
}: AnimatedHighlightProps) {
  return (
    <motion.div
      className={cn(
        'absolute bottom-0 left-0 h-full bg-muted rounded-md -z-10',
        className,
      )}
      layoutId={layoutId}
      aria-hidden="true"
      style={Object.assign(
        {
          width: '100%',
        },
        style,
      )}
      transition={{
        type: 'tween',
        duration: 0.3,
      }}
      {...props}
    />
  );
}
