import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cover images are uploaded through a server action (5 MB max + form fields).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
