import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['gygqohzhfwkdwmrwttvl.supabase.co']
  },
  // MDX is handled via next-mdx-remote in the blog pages
  // No need for @next/mdx configuration
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
  },
});

export default withPWA(nextConfig);
