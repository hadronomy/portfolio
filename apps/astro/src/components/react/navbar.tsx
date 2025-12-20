'use client';

import { motion } from 'framer-motion';
import * as React from 'react';

import { cn } from '@portfolio/ui';

type Link =
  | { active: boolean; label: string; href: string; disabled?: undefined }
  | { active: boolean; label: string; href: string; disabled: boolean };

const links: Link[] = [
  { label: 'Home', href: '/', active: false },
  { label: 'Blog', href: '/blog', active: false },
  { label: 'Experiments', href: '/experiments', active: false, disabled: true },
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
    <header
      className={cn(
        'fixed top-6 z-50 w-full flex justify-center px-4',
        className,
      )}
    >
      <nav className="flex flex-row items-center gap-x-2 border-2 border-foreground bg-background px-2 py-2 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
        <ul className="flex flex-row gap-x-1 p-0 m-0">
          {pages.map(({ label, href, active: currentActive, disabled }) => (
            <li key={label}>
              <a
                href={href}
                className={cn(
                  'relative block px-4 py-2 font-mono font-bold text-sm uppercase tracking-wide transition-colors',
                  {
                    'text-background': currentActive, // Inverted for active
                    'text-foreground hover:bg-muted': !currentActive,
                    'pointer-events-none opacity-50': disabled,
                  },
                )}
                aria-label={label}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                onMouseOver={() => setHoveredPath(href)}
                onMouseLeave={() => setHoveredPath(active?.href)}
                onFocus={() => setHoveredPath(href)}
              >
                <span className="relative z-10">{label}</span>
                {/* Active/Hover Background */}
                {(startsWithAndNotHome(hoveredPath, href) ||
                  (currentActive && !hoveredPath)) && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-0 bg-foreground z-0"
                    transition={{ type: 'tween', duration: 0.2 }}
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
        <div className="h-6 w-0.5 bg-foreground mx-2" />
        {children}
      </nav>
    </header>
  );
}
