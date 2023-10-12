import { format, parseISO } from 'date-fns';

import { cn } from '@portfolio/ui';

export type PostDate = React.ComponentProps<'div'> & {
  date: string;
  time: number;
};

export function PostDate({ className, date, time, ...props }: PostDate) {
  return (
    <div
      className={cn(
        'inline-flex items-center space-x-2 align-middle text-sm font-extrabold text-muted-foreground',
        className,
      )}
      {...props}
    >
      <time dateTime={date}>{format(parseISO(date), 'LLLL d, yyyy')}</time>
      <span>•</span>
      <span>{time} min</span>
    </div>
  );
}
