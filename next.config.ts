import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The build script runs tsc first; Next's duplicate CLI check cannot spawn
  // in the restricted Windows workspace used for local verification.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    workerThreads: true,
  },
};

export default nextConfig;
