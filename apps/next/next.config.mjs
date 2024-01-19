import { withAxiom } from 'next-axiom';
import { withContentlayer } from 'next-contentlayer';

/** @type {import('next').NextConfig} */
const nextConfig = withContentlayer(
  withAxiom({
    reactStrictMode: true,
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'images.unsplash.com',
          pathname: '/*',
        },
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          pathname: '/**/*',
        },
        {
          protocol: 'https',
          hostname: 'twemoji.maxcdn.com',
        },
      ],
    },
    transpilePackages: ['@portfolio/ui'],
  }),
);

export default nextConfig;
