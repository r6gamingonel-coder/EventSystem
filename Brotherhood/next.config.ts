import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel Blob (production media storage — see src/lib/media.ts) serves
    // files from a per-project subdomain of blob.vercel-storage.com.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
