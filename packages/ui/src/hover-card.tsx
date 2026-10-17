'use client';

import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import type * as React from 'react';

import { cn } from './utils/cn';

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden animate-in zoom-in-90',
        className,
      )}
      {...props}
    />
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
