import * as React from 'react';
import Link from 'next/link';
import Balancer from 'react-wrap-balancer';
import type { Post } from 'contentlayer/generated';

import { cn } from '~/lib/utils';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '~/components/ui/card';
import { PostDate } from './post-date';
import { Author } from './author';

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
          <Author className="mt-6" />
        </CardFooter>
      </Card>
    </Link>
  );
}
