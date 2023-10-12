'use client';

import * as React from 'react';
import { ClipboardCheck, ClipboardCopy } from 'lucide-react';
import { never } from 'zod';

import { cn } from '@portfolio/ui';
import { Button } from '@portfolio/ui/button';

import { delay } from '~/lib/utils';

export type MDXPre = React.ComponentProps<'pre'>;

export function MDXPre({ className, children, ...props }: MDXPre) {
  const codeText = React.useRef<React.ElementRef<'pre'>>(null);
  const [copied, setCopied] = React.useState(false);

  async function copyContents() {
    setCopied(true);
    if (codeText?.current === null) return never;
    if (codeText.current?.textContent !== null)
      await navigator.clipboard.writeText(codeText.current.textContent);
  }

  async function handleLeaveButton() {
    if (!copied) return;
    await delay(1000);
    setCopied(false);
  }

  return (
    <pre
      ref={codeText}
      className={cn(
        'group relative rounded bg-muted [&(:first-child)]:my-6',
        className,
      )}
      {...props}
    >
      <Button
        onClick={copyContents}
        onPointerLeave={handleLeaveButton}
        variant="ghost"
        className={cn(
          'absolute right-6 top-6 z-10 h-8 w-8 border-[2px] border-muted-foreground from-transparent p-1.5 text-muted-foreground opacity-0 transition ease-in-out group-hover:opacity-100',
          copied ? 'border-green-300 text-green-300 hover:text-green-300' : '',
        )}
      >
        {copied && <ClipboardCheck />}
        {!copied && <ClipboardCopy />}
      </Button>
      {children}
    </pre>
  );
}
