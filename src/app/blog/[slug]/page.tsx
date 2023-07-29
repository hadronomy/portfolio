import { format, parseISO } from 'date-fns';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { allPosts } from 'contentlayer/generated';
import { Balancer } from 'react-wrap-balancer';

import { MDX } from '~/components/mdx';
import { Navbar } from '~/components/ui/navbar';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import { Separator } from '~/components/ui/separator';
import { Badge } from '~/components/ui/badge';

export type BlogPageProps = {
  params: {
    slug: string;
  };
};

async function getPostFromSlug(slug: string) {
  const post = allPosts.find((post) => post._raw.flattenedPath === slug);
  if (!post) notFound();
  return post;
}

export async function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post._raw.flattenedPath }));
}

export async function generateMetadata({ params }: BlogPageProps) {
  const post = allPosts.find((post) => post._raw.flattenedPath === params.slug);
  return {
    title: post?.title,
    openGraph: {
      title: post?.title,
      siteName: 'Hadronomy | Blog',
      images: ['https://picsum.photos/1000/700']
    }
  } satisfies Metadata;
}

export default async function BlogPage({ params }: BlogPageProps) {
  const post = await getPostFromSlug(params.slug);

  return (
    <>
      <Navbar />
      <article className="mx-4 mt-10 max-w-screen-md py-8 md:mx-auto">
        <div className="mb-8 flex flex-col">
          <div className="mb-6 inline-flex items-center space-x-2 align-middle text-sm font-extrabold text-gray-600">
            <time dateTime={post.date}>
              {format(parseISO(post.date), 'LLLL d, yyyy')}
            </time>
            <a hidden>•</a>
            <a hidden>10 min</a>
          </div>
          <h1 className="scroll-m-20 text-4xl font-extrabold leading-tight tracking-tight md:leading-loose lg:text-5xl">
            <Balancer>{post.title}</Balancer>
          </h1>
          <div className="flex space-x-3">
            {post.tags.map((tag) => (
              <Badge className="text-sm font-extrabold" key={tag}>
                #{tag}
              </Badge>
            ))}
          </div>
          <div className="mt-6 inline-flex items-center gap-x-3 align-middle">
            <Avatar>
              <AvatarImage src="https://github.com/hadronomy.png" />
              <AvatarFallback>H</AvatarFallback>
            </Avatar>
            <a className="font-semibold">Pablo Hernández Jiménez</a>
          </div>
          <div className="mt-6 h-fit overflow-clip rounded">
            <Image
              unoptimized
              src={post.image}
              alt="example"
              width={1000}
              height={700}
              className="object-cover"
            />
          </div>
        </div>
        <MDX code={post.body.code} />
      </article>
    </>
  );
}
