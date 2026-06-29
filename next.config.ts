import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['gygqohzhfwkdwmrwttvl.supabase.co']
  },
  // MDX is handled via next-mdx-remote in the blog pages
  // No need for @next/mdx configuration
};

export default nextConfig;
