import * as React from 'react';
import Image from 'next/image';
import type { Post } from 'contentlayer/generated';
import Balancer from 'react-wrap-balancer';

import { Badge } from '@portfolio/ui/badge';

import { MDX } from '~/components/mdx';
import { Author } from './author';
import { PostDate } from './post-date';

export type BlogArticleProps = React.ComponentProps<'article'> & {
  post: Post;
};

export function BlogArticle({ post }: BlogArticleProps) {
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
        <h1 className="scroll-m-20 text-4xl font-extrabold leading-tight tracking-tight md:leading-loose lg:text-5xl">
          <Balancer>{title}</Balancer>
        </h1>
        <div className="mt-6 flex space-x-3">
          {tags.map((tag) => (
            <Badge key={tag} className="text-sm font-extrabold">
              #{tag}
            </Badge>
          ))}
        </div>
        <Author className="mt-6" />
        <div className="relative mt-6 h-fit min-h-[30rem] max-w-full overflow-hidden rounded">
          <Image src={image} alt="example" fill className="object-cover" />
        </div>
      </header>
      <MDX code={body.code} />
    </article>
  );
}
