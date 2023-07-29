'use client';

import * as React from 'react';
import { type MDXComponents } from 'mdx/types';
import { getMDXComponent } from 'next-contentlayer/hooks';

import { MDXPre } from '~/components/mdx/pre';

import { cn } from '~/lib/utils';

export const components = {
  h1: ({ className, ...props }: React.ComponentProps<'h1'>) => (
    <h1
      className={cn(
        'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.ComponentProps<'h2'>) => (
    <h2
      className={cn(
        'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0',
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.ComponentProps<'h3'>) => (
    <h3
      className={cn(
        'mt-8 scroll-m-20 text-2xl font-semibold tracking-tight',
        className
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }: React.ComponentProps<'p'>) => (
    <p
      className={cn(
        'text-justify text-lg leading-7 [&:not(:first-child)]:mt-6',
        className
      )}
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
  )
} as const satisfies MDXComponents;

type MDXProps = React.ComponentProps<'div'> & {
  code: string;
};

export function MDX({ code }: MDXProps) {
  const Component = getMDXComponent(code);

  return (
    <div className="mdx bg-background">
      <Component components={components} />
    </div>
  );
}
