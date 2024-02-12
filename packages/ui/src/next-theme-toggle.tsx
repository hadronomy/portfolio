'use client';

import { HalfMoon, SunLight } from 'iconoir-react';
import { useTheme } from 'next-themes';
import type * as React from 'react';
import { type VariantProps, tv } from 'tailwind-variants';

import { Button } from './button';

const themeToggleVariants = tv({
  slots: {
    icon: 'fill-muted-foreground transition-all duration-500 ease-in-out text-muted-foreground group-hover:fill-foreground group-hover:text-foreground',
  },
});

export function MoonIcon({ className }: React.ComponentProps<'svg'>) {
  return <HalfMoon className={className} />;
}

export function SunIcon({ className }: React.ComponentProps<'svg'>) {
  return <SunLight className={className} />;
}

export type NextThemeToggleProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof themeToggleVariants>;

export function NextThemeToggle({ className, ...props }: NextThemeToggleProps) {
  const { icon } = themeToggleVariants({ className });
  const { theme, setTheme } = useTheme();

  return (
    <Button
      className="p-2 relative group rounded-md hover:text-foreground hover:bg-transparent bg-transparent text-bold"
      size="icon"
      variant="ghost"
      onClick={() => {
        if (theme === 'dark') {
          setTheme('light');
        } else {
          setTheme('dark');
        }
      }}
      {...props}
    >
      <SunIcon
        className={icon({
          className: 'absolute h-4 w-4 scale-100 dark:scale-0',
        })}
      />
      <MoonIcon
        className={icon({
          className: 'absolute h-4 w-4 scale-0 dark:scale-100',
        })}
      />
    </Button>
  );
}
