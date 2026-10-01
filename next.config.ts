import type { NextConfig } from "next";

/**
 * Next.js configuration exposing required environment variables to the client.
 *
 * - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are needed by the Supabase client.
 * - `OPENAI_API_KEY` is intentionally **not** exposed to the client for security reasons.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // TubeOS was renamed The Agency; keep old bookmarks working.
  async redirects() {
    return [{ source: "/tubeos", destination: "/agency", permanent: true }];
  },
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
