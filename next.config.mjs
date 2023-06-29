import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = withAxiom({
  reactStrictMode: true,
  experimental: {
    appDir: true
  }
});

export default nextConfig;
