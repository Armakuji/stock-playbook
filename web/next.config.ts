import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["676d-124-122-125-200.ngrok-free.app", "*.ngrok-free.app"],
  async rewrites() {
    // JOURNAL_API_ORIGIN is only set once the Journal API (Railway) is deployed.
    // Skip the rewrite entirely when it's missing instead of injecting "undefined"
    // into the destination — an invalid destination URL fails Next's build-time
    // validation and would otherwise take down the whole site's deploy over one
    // optional feature. Without it, /api/journal/* just 404s until it's deployed.
    if (!process.env.JOURNAL_API_ORIGIN) return [];
    return [
      {
        source: "/api/journal/:path*",
        destination: `${process.env.JOURNAL_API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
