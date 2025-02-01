'use client';

import * as React from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';

import { cn } from '@portfolio/ui';
import {
  ScrollArea,
  ScrollBar,
  ScrollViewport,
} from '@portfolio/ui/scroll-area';

export type CodeBlockProps = React.ComponentProps<'pre'> & {
  keepBackground?: boolean;
};

export const Pre = React.forwardRef<
  HTMLPreElement,
  React.HTMLAttributes<HTMLPreElement>
>(({ className, children, ...props }, ref) => {
  return (
    <pre ref={ref} className={cn('max-h-[400px] p-4', className)} {...props}>
      {children}
    </pre>
  );
});

Pre.displayName = 'Pre';

export const CodeBlock = React.forwardRef<HTMLPreElement, CodeBlockProps>(
  (
    { title, keepBackground = false, className, children, style, ...props },
    ref,
  ) => {
    const areaRef = React.useRef<HTMLDivElement>(null);
    const onCopy = React.useCallback(async () => {
      const pre = areaRef.current?.getElementsByTagName('pre').item(0);

      if (!pre) return;

      const clone = pre.cloneNode(true) as HTMLElement;
      for (const node of clone.querySelectorAll(
        '.nd-copy-ignore, .twoslash-popup-container',
      )) {
        node.remove();
      }

      void navigator.clipboard.writeText(clone.textContent ?? '');
    }, []);

    return (
      <figure
        className={cn(
          'not-prose group grid relative my-6 overflow-hidden rounded-lg border bg-secondary/50 text-md',
          keepBackground &&
            'bg-[var(--shiki-light-bg)] dark:bg-[var(--shiki-dark-bg)]',
          className,
        )}
        {...props}
      >
        {title ? (
          <div className="flex flex-row items-center gap-2 border-b bg-muted px-4 py-1.5">
            <figcaption className="flex-1 truncate text-muted-foreground">
              {title}
            </figcaption>
            <CopyButton
              className="p-2"
              onCopy={onCopy}
              aria-label="Copy code"
            />
          </div>
        ) : (
          <CopyButton
            className="absolute top-2 right-2 z-2 backdrop-blur-md"
            onCopy={onCopy}
          />
        )}
        <ScrollArea className="overflow-y-visible!" ref={areaRef} dir="ltr">
          <ScrollViewport>{children}</ScrollViewport>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </figure>
    );
  },
);

export function CopyButton({
  className,
  onCopy,
  ...props
}: React.ComponentProps<typeof motion.button> & {
  onCopy: () => Promise<void>;
}) {
  const [copied, setCopied] = React.useState(false);

  const iconVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  const buttonVariants = {
    initial: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  };

  return (
    <motion.button
      onClick={() => {
        onCopy().then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={cn(
        'p-2 rounded-md bg-muted text-muted-foreground hover:bg-muted-foreground/20 transition-all',
        className,
      )}
      variants={buttonVariants}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      whileHover="hover"
      whileTap="tap"
      aria-label={copied ? 'Copied!' : 'Copy code'}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.div
            key="check"
            variants={iconVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <Check className="w-5 h-5" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            variants={iconVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <Copy className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
