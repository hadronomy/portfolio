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
          hostname: 'picsum.photos',
          pathname: '/**/*'
        }
      ]
    }
  })
);

export default nextConfig;
