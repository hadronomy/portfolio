import type { Post } from 'contentlayer/generated';
import Image from 'next/image';
import type * as React from 'react';
import QRCode from 'react-qr-code';
import Balancer from 'react-wrap-balancer';

import { Badge } from '@portfolio/ui/badge';
import { Meteors } from '@portfolio/ui/meteors';

import { MDX } from '~/components/mdx';
import { Author } from './author';
import { PostDate } from './post-date';

export type BlogArticleProps = React.ComponentProps<'article'> & {
  post: Post;
  url: URL;
};

export function BlogArticle({ post, url }: BlogArticleProps) {
  const { title, image, date, tags, body } = post;

  const wordsPerMinute = 200;
  const wordCount = body.raw.split(' ').length;
  // really inacurate for now beacuse it's taking into account all
  // the markdown, not only the text
  const readingTime = Math.ceil(wordCount / wordsPerMinute);

  return (
    <article className="mt-10 grid grid-cols-[1fr_min(75ch,_calc(100%_-_1.5rem))_1fr] px-3 py-8 [&>*]:col-start-2">
      <header className="mb-8 flex flex-col">
        <PostDate date={date} time={readingTime} className="mb-6" />
        <div className="flex flex-row justify-between">
          <h1 className="scroll-m-20 text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
            <Balancer>{title}</Balancer>
          </h1>
          <QRCode
            className="hidden print:inline-block max-h-20 max-w-[5rem]"
            value={url.href}
          />
        </div>
        <div className="mt-6 flex space-x-3">
          {tags.map((tag) => (
            <Badge key={tag} className="text-sm font-extrabold">
              #{tag}
            </Badge>
          ))}
        </div>
        <Author className="mt-6" />
        <picture className="relative mt-6 h-fit min-h-[30rem] max-w-full overflow-hidden rounded">
          <Image src={image} alt="example" fill className="object-cover" />
        </picture>
      </header>
      <MDX code={body.code} />
      <footer className="relative print:hidden group overflow-hidden my-8 flex h-[75vh] hover:ring-4 transition-all ring-muted rounded-md place-items-center justify-center">
        <small
          aria-hidden
          className="scroll-m-20 transition-all opacity-0 group-hover:opacity-100 group-hover:block text-lg text-foreground/60 font-extrabold text-center leading-tight tracking-tight md:leading-loose lg:text-xl"
        >
          <Balancer>
            This margin is intentional
            <br />
            for mantaining eye level when reading
          </Balancer>
        </small>
        <Meteors number={20} />
      </footer>
    </article>
  );
}
