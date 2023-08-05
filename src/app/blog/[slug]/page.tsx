import { format, parseISO } from 'date-fns';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { allPosts } from 'contentlayer/generated';
import { Balancer } from 'react-wrap-balancer';

import { MDX } from '~/components/mdx';
import { Navbar } from '~/components/ui/navbar';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
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
      authors: ['Pablo Hernández']
    }
  } satisfies Metadata;
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const { title, image, date, tags, body } = getPostFromSlug(params.slug);

  return (
    <>
      <Navbar />
      <article className="mt-10 grid grid-cols-[1fr_min(85ch,_calc(100%_-_3rem))_1fr] px-6 py-8 [&>*]:col-start-2">
        <div className="mb-8 flex flex-col">
          <div className="mb-6 inline-flex items-center space-x-2 align-middle text-sm font-extrabold text-muted-foreground">
            <time dateTime={date}>
              {format(parseISO(date), 'LLLL d, yyyy')}
            </time>
            <span hidden>•</span>
            <span hidden>10 min</span>
          </div>
          <h1 className="scroll-m-20 text-4xl font-extrabold leading-tight tracking-tight md:leading-loose lg:text-5xl">
            <Balancer>{title}</Balancer>
          </h1>
          <div className="mt-6 flex space-x-3">
            {tags.map((tag) => (
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
            <span className="font-semibold">Pablo Hernández Jiménez</span>
          </div>
          <div className="relative mt-6 h-fit min-h-[30rem] max-w-full overflow-hidden rounded">
            <Image src={image} alt="example" fill className="object-cover" />
          </div>
        </div>
        <MDX code={body.code} />
      </article>
    </>
  );
}
