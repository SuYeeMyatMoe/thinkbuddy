import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext inspects multipart requests before API routing. The upload route
  // enforces its own 10 MB total and 5 MB per-file limits after authentication.
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

export default nextConfig;
