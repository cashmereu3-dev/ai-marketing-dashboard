import type { NextConfig } from "next";

/**
 * Next.js configuration exposing required environment variables to the client.
 *
 * - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are needed by the Supabase client.
 * - `OPENAI_API_KEY` is intentionally **not** exposed to the client for security reasons.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
