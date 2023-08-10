import type { Metadata } from 'next';

export const metadata = {
  title: {
    default: 'Blog',
    template: '%s | Pablo Hernández',
  },
  creator: 'Pablo Hernández',
} satisfies Metadata;

type BlogLayoutProps = {
  children: React.ReactNode;
};

export default function BlogLayout({ children }: BlogLayoutProps) {
  return <>{children}</>;
}
