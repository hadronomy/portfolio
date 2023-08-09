import { format, parseISO } from 'date-fns';

import { cn } from '@portofolio/ui';

export type PostDate = React.ComponentProps<'div'> & {
  date: string;
};

export function PostDate({ className, date, ...props }: PostDate) {
  return (
    <div
      className={cn(
        'inline-flex items-center space-x-2 align-middle text-sm font-extrabold text-muted-foreground',
        className,
      )}
      {...props}
    >
      <time dateTime={date}>{format(parseISO(date), 'LLLL d, yyyy')}</time>
      {/* <span hidden>•</span>
      <span hidden>10 min</span> */}
    </div>
  );
}
