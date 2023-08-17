'use client';

import * as React from 'react';
import type { VariantProps } from 'tailwind-variants';
import { tv } from 'tailwind-variants';

import { Ripple } from './ripple';
import { useRipple } from './ripple/use-ripple';

export const button = tv({
  base: 'inline-flex overflow-hidden items-center relative group z-0 justify-center rounded-md text-sm font-medium transition duration-300 active:scale-[.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      outline:
        'border border-input hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'underline-offset-4 hover:underline text-primary',
    },
    size: {
      default: 'h-10 py-2 px-4',
      sm: 'h-9 px-3 rounded-md',
      lg: 'h-11 px-8 rounded-md',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof button>;

export const Button = React.forwardRef<React.ComponentRef<'button'>, ButtonProps>(
  ({ className, variant, size, onClick, children, ...props }, ref) => {
    const { ripples, onClick: onClickRipple } = useRipple();
    return (
      <button
        className={button({ variant, size, className })}
        ref={ref}
        onClick={(e) => {
          onClickRipple(e);
          if (onClick !== undefined) onClick(e);
        }}
        {...props}
      >
        {children}
        <Ripple ripples={ripples} />
      </button>
    );
  },
);
Button.displayName = 'Button';
