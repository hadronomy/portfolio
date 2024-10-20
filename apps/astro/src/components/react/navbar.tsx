'use client';

import { motion } from 'framer-motion';
import * as React from 'react';

import { cn } from '@portfolio/ui';
// import { NextThemeToggle } from './next-theme-toggle';
import { Separator } from '@portfolio/ui/separator';

type Link =
  | {
      active: boolean;
      label: string;
      href: string;
      disabled?: undefined;
    }
  | {
      active: boolean;
      label: string;
      href: string;
      disabled: boolean;
    };

const links: Link[] = [
  {
    label: 'Home',
    href: '/',
    active: false,
  },
  {
    label: 'Blog',
    href: '/blog',
    active: false,
  },
  {
    label: 'Experiments',
    href: '/experiments',
    active: false,
    disabled: true,
  },
];

function startsWithAndNotHome(str: string | undefined, prefix: string) {
  if (str === undefined) return false;
  return (str.startsWith(prefix) && prefix !== '/') || prefix === str;
}

export interface NavbarProps extends React.ComponentProps<'header'> {
  pages?: typeof links;
}

export function Navbar({ className, pages = links, children }: NavbarProps) {
  const active = React.useMemo(
    () => pages.find((page) => page.active),
    [pages],
  );
  const [hoveredPath, setHoveredPath] = React.useState<string | undefined>(
    active?.href,
  );

  return (
    <header className={cn('sticky pt-5 top-0 z-20 w-full', className)}>
      <nav className="mx-auto gap-x-2 flex flex-row justify-between items-center max-w-fit px-3 md:px-8 py-3 bg-transparent backdrop-blur-xl border-foreground/10 border-2 md:rounded-full rounded-3xl overflow-hidden">
        <ul className="flex w-full h-full gap-x-0 capitalize flex-row p-0">
          {pages.map(({ label, href, active: currentActive, disabled }) => (
            <li key={label}>
              <a
                href={href}
                className={cn(
                  'rounded-md transition-all h-full inline-block relative px-5 py-2 font-bold hover:text-foreground/80 dark:hover:drop-shadow-[0.3_0.3_1.2rem_#ffffff80]',
                  {
                    'text-foreground': currentActive,
                    'text-muted-foreground': !currentActive,
                    'pointer-events-none': disabled,
                  },
                )}
                aria-label={label}
                onMouseOver={() => setHoveredPath(href)}
                onMouseLeave={() => setHoveredPath(active?.href)}
                onFocus={() => setHoveredPath(href)}
              >
                <span className="text-center">{label}</span>
                {hoveredPath === undefined && (
                  <AnimatedHighlight layoutId="navbar" style={{ opacity: 0 }} />
                )}
                {startsWithAndNotHome(hoveredPath, href) && (
                  <AnimatedHighlight layoutId="navbar" style={{ opacity: 1 }} />
                )}
              </a>
            </li>
          ))}
        </ul>
        <Separator orientation="vertical" className="h-5" />
        {children}
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
