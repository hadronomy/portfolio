'use client';

import * as React from 'react';
import Image from 'next/image';
import { type MDXComponents } from 'mdx/types';
import { getMDXComponent } from 'next-contentlayer/hooks';

import { MDXPre } from '~/components/mdx/pre';
import {
  Table,
  TableBody,
  // TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '~/components/ui/table';

import { cn } from '~/lib/utils';

export const components = {
  h1: ({ className, id, children, ...props }: React.ComponentProps<'h1'>) => (
    <h1
      id={id}
      className={cn(
        'scroll-m-20 text-4xl font-extrabold tracking-tight before:content-["#"] lg:text-5xl',
        className
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
        'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-all before:absolute before:translate-x-[-2rem] before:opacity-0 before:transition-all before:content-["#"] first:mt-0 hover:before:opacity-100',
        className
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
        'mt-8 scroll-m-20 text-2xl font-semibold tracking-tight before:absolute before:float-left before:translate-x-[-2rem] before:opacity-0 before:transition-all before:content-["#"] hover:before:opacity-100',
        className
      )}
      {...props}
    >
      <a href={`#${id}`}>{children}</a>
    </h3>
  ),
  p: ({ className, ...props }: React.ComponentProps<'p'>) => (
    <p
      className={cn(
        'text-lg leading-7 text-foreground/80 [&:not(:first-child)]:mt-6',
        className
      )}
      {...props}
    />
  ),
  strong: ({ className, ...props }: React.ComponentProps<'strong'>) => (
    <b className={cn('text-foreground/100', className)} {...props} />
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
  pre: MDXPre,
  code: ({ className, ...props }: React.ComponentProps<'code'>) => (
    <code
      className={cn('relative overflow-x-auto font-mono', className)}
      {...props}
    />
  ),
  img: ({ className, src, alt, id }: React.ComponentProps<'img'>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <Image
      src={src ?? ''}
      alt={alt ?? ''}
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
  )
} as const satisfies MDXComponents;

type MDXProps = React.ComponentProps<'div'> & {
  code: string;
};

export function MDX({ code }: MDXProps) {
  const Component = getMDXComponent(code);

  return (
    <>
      <Component components={components} />
    </>
  );
}
