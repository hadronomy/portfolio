import { format, parseISO } from 'date-fns';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { allPosts } from 'contentlayer/generated';
import { getMDXComponent } from 'next-contentlayer/hooks';

import { MDX } from '~/components/ui/mdx';

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
  return { title: post?.title };
}

export default async function BlogPage({ params }: BlogPageProps) {
  const post = await getPostFromSlug(params.slug);

  return (
    <article className="mx-4 mt-10 max-w-screen-md py-8 md:mx-auto">
      <div className="mb-8 flex flex-col">
        <time
          dateTime={post.date}
          className="mb-5 text-sm font-extrabold text-gray-600"
        >
          {format(parseISO(post.date), 'LLLL d, yyyy')}
        </time>
        <h1 className="scroll-m-20 text-4xl font-extrabold leading-loose tracking-tight lg:text-5xl">
          {post.title}
        </h1>
        <div className="mt-6 h-80 overflow-clip rounded">
          <Image
            src="https://picsum.photos/1000/700"
            alt="example"
            width={1000}
            height={700}
            className="object-cover"
          />
        </div>
      </div>
      <MDX code={post.body.code} />
    </article>
  );
}
