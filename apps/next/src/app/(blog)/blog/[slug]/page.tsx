import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { allPosts } from 'contentlayer/generated';
import { Balancer } from 'react-wrap-balancer';

import { Badge } from '@portofolio/ui/badge';
import { Navbar } from '@portofolio/ui/navbar';

import { MDX } from '~/components/mdx';
import { Author } from '../_components/author';
import { PostDate } from '../_components/post-date';

// import { Sandpack } from '~/components/sandpack';

export type BlogPostPageProps = {
  params: {
    slug: string;
  };
};

function getPostFromSlug(slug: string) {
  const post = allPosts.find((post) => post._raw.flattenedPath === slug);
  if (!post) notFound();
  return post;
}

export function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post._raw.flattenedPath }));
}

export function generateMetadata({ params }: BlogPostPageProps) {
  const post = allPosts.find((post) => post._raw.flattenedPath === params.slug);
  if (!post) notFound();
  return {
    title: post.title,
    openGraph: {
      title: post.title,
      description: post.description,
      siteName: 'Pablo Hernández | Blog',
      images: [post.image],
      authors: ['Pablo Hernández'],
    },
  } satisfies Metadata;
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const { title, image, date, tags, body } = getPostFromSlug(params.slug);

  return (
    <>
      <Navbar />
      <article className="mt-10 grid grid-cols-[1fr_min(85ch,_calc(100%_-_1.5rem))_1fr] px-3 py-8 [&>*]:col-start-2">
        <div className="mb-8 flex flex-col">
          <PostDate date={date} className="mb-6" />
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
        </div>
        <MDX code={body.code} />
      </article>
    </>
  );
}
