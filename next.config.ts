import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Product photo uploads go through admin server actions; allow larger bodies.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
