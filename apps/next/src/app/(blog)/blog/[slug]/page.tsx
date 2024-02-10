import { allPosts } from 'contentlayer/generated';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BlogArticle } from '../_components/blog-article';

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
      type: 'article',
      description: post.description,
      siteName: 'Pablo Hernández | Blog',
      images: [post.image],
      authors: ['Pablo Hernández'],
    },
  } satisfies Metadata;
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostFromSlug(params.slug);

  return (
    <>
      <BlogArticle post={post} />
    </>
  );
}
