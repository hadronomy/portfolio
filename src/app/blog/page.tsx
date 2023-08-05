import Image from 'next/image';
import Link from 'next/link';
import { format, isAfter, parseISO } from 'date-fns';
import { Balancer } from 'react-wrap-balancer';
import { allPosts } from 'contentlayer/generated';

import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter
} from '~/components/ui/card';
import { Navbar } from '~/components/ui/navbar';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';

export type BlogPage = Record<string, never>;

export default function BlogPage({}: BlogPage) {
  const recentPosts = allPosts
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return isAfter(dateA, dateB) ? -1 : 1;
    })
    .slice(0, 10);
  const tags = Array.from(new Set(allPosts.flatMap(({ tags }) => tags)));

  return (
    <>
      <Navbar />
      <div className="flex flex-col"></div>
      <main className="mx-auto mt-6 grid w-full max-w-screen-xl grid-cols-[min(85ch,_100%)_1fr] grid-rows-2 gap-6 px-6">
        <section className="row-span-2 flex flex-col gap-y-6">
          <div>
            <h1 className="scroll-m-20 text-xl font-extrabold capitalize tracking-tight text-accent-foreground">
              RECENTLY PUBLISHED
            </h1>
          </div>
          <div className="flex flex-col gap-y-6">
            {recentPosts.map(({ title, description, date, slug }) => (
              <Link href={`blog${slug}`} key={slug}>
                <Card>
                  <CardHeader>
                    <div className="inline-flex items-center space-x-2 align-middle text-sm font-extrabold text-muted-foreground">
                      <time dateTime={date}>
                        {format(parseISO(date), 'LLLL d, yyyy')}
                      </time>
                      <span hidden>•</span>
                      <span hidden>10 min</span>
                    </div>
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
                      <span className="font-semibold">
                        Pablo Hernández Jiménez
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </section>
        <section className="hidden md:inline-block">
          <div className="mb-6">
            <h1 className="scroll-m-20 text-xl font-extrabold capitalize tracking-tight text-accent-foreground">
              TAGS
            </h1>
          </div>
          <div className="flex gap-2">
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
