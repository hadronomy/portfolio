import * as React from 'react';
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

const Table = React.forwardRef<
  React.ComponentRef<'table'>,
  React.ComponentProps<'table'>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table ref={ref} className={base({ className })} {...props} />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  React.ComponentRef<'thead'>,
  React.ComponentProps<'thead'>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={header({ className })} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  React.ComponentRef<'tbody'>,
  React.ComponentProps<'tbody'>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={body({ className })} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  React.ComponentRef<'tfoot'>,
  React.ComponentProps<'tfoot'>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={footer({ className })} {...props} />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  React.ComponentRef<'tr'>,
  React.ComponentProps<'tr'>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={row({ className })} {...props} />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  React.ComponentRef<'th'>,
  React.ComponentProps<'th'>
>(({ className, ...props }, ref) => (
  <th ref={ref} className={head({ className })} {...props} />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  React.ComponentRef<'td'>,
  React.ComponentProps<'td'>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cell({ className })} {...props} />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  React.ComponentRef<'caption'>,
  React.ComponentProps<'caption'>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={caption({ className })} {...props} />
));
TableCaption.displayName = 'TableCaption';

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
