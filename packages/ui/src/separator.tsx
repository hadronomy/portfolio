'use client';

import * as React from 'react';
import * as RadixSeparator from '@radix-ui/react-separator';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '~/utils/cn';

export const separatorStyle = cva('bg-accent mx-[15px]', {
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'h-full w-px',
    },
    skew: {
      none: '',
      left: '-rotate-[20deg]',
      right: 'rotate-[20deg]',
    },
  },
  defaultVariants: {
    skew: 'none',
  },
});

export type SeparatorProps = VariantProps<typeof separatorStyle> &
  RadixSeparator.SeparatorProps;

export function Separator({
  className,
  orientation,
  skew,
  ...props
}: SeparatorProps) {
  return (
    <RadixSeparator.Root
      className={cn(separatorStyle({ className, orientation, skew }))}
      orientation={orientation}
      {...props}
    />
  );
}
