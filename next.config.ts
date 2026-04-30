import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  transpilePackages: ["socket.io-client"],
  experimental: {
    optimizePackageImports: ["socket.io-client"],
  },
  turbopack: {
    resolveAlias: {
      "socket.io-client": "socket.io-client/build/esm/index.js",
    },
  },
};

export default nextConfig;
