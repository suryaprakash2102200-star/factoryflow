import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,   // never cache dynamic pages on the client router
      static: 180,  // static pages cached 3 min (default)
    },
  },
};

export default nextConfig;
