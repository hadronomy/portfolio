import * as React from 'react';

import { cn } from '@portofolio/ui';
import { Avatar, AvatarFallback, AvatarImage } from '@portofolio/ui/avatar';

export type AuthorProps = React.ComponentProps<'div'>;

export function Author({ className, ...props }: AuthorProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-x-3 align-middle', className)}
      {...props}
    >
      <Avatar>
        <AvatarImage src="https://github.com/hadronomy.png" />
        <AvatarFallback>H</AvatarFallback>
      </Avatar>
      <span className="font-semibold">Pablo Hernández Jiménez</span>
    </div>
  );
}
