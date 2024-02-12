'use client';

import { motion } from 'framer-motion';
import { HalfMoon, SunLight } from 'iconoir-react';
import { useTheme } from 'next-themes';
import type * as React from 'react';
import { tv } from 'tailwind-variants';

import { Button } from './button';

const themeToggleVariants = tv({
  slots: {
    icon: 'fill-muted-foreground transition-all text-muted-foreground group-hover:fill-foreground group-hover:text-foreground',
  },
});

export function MoonIcon() {
  return <HalfMoon className={themeToggleVariants.slots.icon} />;
}

export function SunIcon() {
  return <SunLight className={themeToggleVariants.slots.icon} />;
}

export type NextThemeToggleProps = React.ComponentProps<typeof Button>;

export function NextThemeToggle({ ...props }: NextThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="p-2 group rounded-md hover:text-foreground hover:bg-transparent text-bold duration-200 ease-in-out"
      onClick={() => {
        if (theme === 'dark') {
          setTheme('light');
        } else {
          setTheme('dark');
        }
      }}
      {...props}
    >
      {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}
