import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["676d-124-122-125-200.ngrok-free.app", "*.ngrok-free.app"],
  async rewrites() {
    return [
      {
        source: "/api/journal/:path*",
        destination: `${process.env.JOURNAL_API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
