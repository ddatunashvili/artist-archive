import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a minimal server bundle so the Docker image stays small.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
