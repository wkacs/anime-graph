import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // stray lockfile in the user home dir confuses workspace-root inference
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
