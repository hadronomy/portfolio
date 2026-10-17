import type * as React from 'react';
import { tv } from 'tailwind-variants';

const table = tv({
  slots: {
    base: 'w-full caption-bottom text-sm',
    header: '[&_tr]:border-b',
    body: '[&_tr:last-child]:border-0',
    footer: 'bg-primary font-medium text-primary-foreground',
    row: 'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
    head: 'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
    cell: 'p-4 align-middle [&:has([role=checkbox])]:pr-0',
    caption: 'mt-4 text-sm text-muted-foreground',
  },
});

const { base, header, body, footer, row, head, cell, caption } = table();

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-auto">
      <table className={base({ className })} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={header({ className })} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={body({ className })} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return <tfoot className={footer({ className })} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={row({ className })} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={head({ className })} {...props} />;
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cell({ className })} {...props} />;
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return <caption className={caption({ className })} {...props} />;
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
