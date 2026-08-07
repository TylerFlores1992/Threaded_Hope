import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Product photos are camera originals — 3000×4000, ~3 MB each. Handing one
     * of those to a 280px card means the browser downscales ~10×, which Chrome
     * does with a fast filter that visibly softens the image (the same photo
     * looks fine on the product page, where it's shown large). Routing them
     * through Next's optimizer serves a correctly-sized, modern-format copy
     * instead — sharper on the grid and a fraction of the bytes.
     */
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  experimental: {
    // Product photo uploads go through admin server actions; allow larger bodies.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
