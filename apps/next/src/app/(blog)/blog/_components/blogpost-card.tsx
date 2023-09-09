import * as React from 'react';
import Link from 'next/link';
import type { Post } from 'contentlayer/generated';
import Balancer from 'react-wrap-balancer';

import { cn } from '@portofolio/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@portofolio/ui/card';

import { Author } from './author';
import { PostDate } from './post-date';

export type BlogPostCardProps = React.ComponentProps<typeof Link> & {
  post: Post;
};

export function BlogPostCard({ className, post, ...props }: BlogPostCardProps) {
  const { title, description, date, body } = post;

  const wordsPerMinute = 200;
  const wordCount = body.raw.split(' ').length;
  const time = Math.ceil(wordCount / wordsPerMinute);

  return (
    <Link {...props}>
      <Card className={cn('', className)}>
        <CardHeader>
          <PostDate date={date} time={time} />
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
