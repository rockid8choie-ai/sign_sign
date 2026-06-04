import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships a canvas optional dependency we don't use on the server.
  serverExternalPackages: ["pdf-lib"],
  webpack: (config) => {
    // pdfjs-dist references `canvas` only for Node rendering, which we never do.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
