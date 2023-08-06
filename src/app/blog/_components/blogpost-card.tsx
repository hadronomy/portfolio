import * as React from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import Balancer from 'react-wrap-balancer';
import type { Post } from 'contentlayer/generated';

import { cn } from '~/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '~/components/ui/card';
import { PostDate } from './post-date';

export type BlogPostCardProps = React.ComponentProps<typeof Link> & {
  post: Post;
};

export function BlogPostCard({ className, post, ...props }: BlogPostCardProps) {
  const { title, description, date } = post;

  return (
    <Link {...props}>
      <Card className={cn('', className)}>
        <CardHeader>
          <PostDate date={date} />
          <CardTitle className="text-3xl">
            <Balancer>{title}</Balancer>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!!description && (
            <CardDescription className="text-lg leading-7 text-foreground/80">
              {description}
            </CardDescription>
          )}
        </CardContent>
        <CardFooter>
          <div className="mt-6 inline-flex items-center gap-x-3 align-middle">
            <Avatar>
              <AvatarImage src="https://github.com/hadronomy.png" />
              <AvatarFallback>H</AvatarFallback>
            </Avatar>
            <span className="font-semibold">Pablo Hernández Jiménez</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
