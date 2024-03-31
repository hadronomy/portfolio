'use client';

import { Popup, PopupContent, PopupTrigger } from 'fumadocs-ui/twoslash/popup';
import type { MDXComponents } from 'mdx/types';
import type * as React from 'react';

import { cn } from '@portfolio/ui';
import {
  Table,
  TableBody,
  // TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@portfolio/ui/table';

export const components = {
  h1: ({ className, id, children, ...props }: React.ComponentProps<'h1'>) => (
    <h1
      id={id}
      className={cn(
        'scroll-m-20 text-4xl font-extrabold tracking-tight after:content-["#"] lg:text-5xl',
        className,
      )}
      {...props}
    >
      <a href={`#${id}`} className="group relative">
        {children}
      </a>
    </h1>
  ),
  h2: ({ className, id, children, ...props }: React.ComponentProps<'h2'>) => (
    <h2
      id={id}
      className={cn(
        'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-all after:absolute after:translate-x-[1rem] after:opacity-0 after:transition-all after:content-["#"] first:mt-0 mt-4 hover:after:opacity-100',
        className,
      )}
      {...props}
    >
      <a href={`#${id}`}>{children}</a>
    </h2>
  ),
  h3: ({ className, id, children, ...props }: React.ComponentProps<'h3'>) => (
    <h3
      id={id}
      className={cn(
        'mt-8 scroll-m-20 text-2xl font-semibold tracking-tight after:absolute after:translate-x-[1rem] after:opacity-0 after:transition-all after:content-["#"] hover:after:opacity-100',
        className,
      )}
      {...props}
    >
      <a href={`#${id}`}>{children}</a>
    </h3>
  ),
  p: ({ className, ...props }: React.ComponentProps<'p'>) => (
    <p
      className={cn(
        'text-xl leading-7 text-foreground/80 [&:not(:first-child)]:mt-6',
        className,
      )}
      {...props}
    />
  ),
  strong: ({ className, ...props }: React.ComponentProps<'strong'>) => (
    <strong className={cn('text-foreground/100', className)} {...props} />
  ),
  em: ({ className, ...props }: React.ComponentProps<'em'>) => (
    <em
      className={cn('font-medium text-foreground/100', className)}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }: React.ComponentProps<'blockquote'>) => (
    <blockquote
      className={cn('mt-6 border-l-2 pl-6 italic', className)}
      {...props}
    />
  ),
  // pre: MDXPre,
  code: ({ className, ...props }: React.ComponentProps<'code'>) => (
    <code
      className={cn('relative overflow-x-auto font-mono', className)}
      {...props}
    />
  ),
  img: ({ className, src, alt, id }: React.ComponentProps<'img'>) => (
    <img
      src={src}
      alt={alt}
      id={id}
      width={1000}
      height={700}
      className={cn('rounded', className)}
    />
  ),
  table: ({ className, children }: React.ComponentProps<'table'>) => (
    <Table className={cn('mt-6', className)}>{children}</Table>
  ),
  thead: ({ className, children }: React.ComponentProps<'thead'>) => (
    <TableHeader className={cn('', className)}>{children}</TableHeader>
  ),
  th: ({ className, children }: React.ComponentProps<'th'>) => (
    <TableHead className={cn('font-bold', className)}>{children}</TableHead>
  ),
  tbody: ({ className, children }: React.ComponentProps<'tbody'>) => (
    <TableBody className={cn('', className)}>{children}</TableBody>
  ),
  tr: ({ className, children }: React.ComponentProps<'tr'>) => (
    <TableRow className={cn('', className)}>{children}</TableRow>
  ),
  td: ({ className, children }: React.ComponentProps<'td'>) => (
    <TableCell className={cn('', className)}>{children}</TableCell>
  ),
  // Popup,
  // PopupContent: ({
  //   className,
  //   ...props
  // }: React.ComponentProps<typeof PopupContent>) => (
  //   <PopupContent className={cn('max-w-[70ch] p-3', className)} {...props} />
  // ),
  // PopupTrigger,
} as const satisfies MDXComponents;
