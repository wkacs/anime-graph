import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // stray lockfile in the user home dir confuses workspace-root inference
  outputFileTracingRoot: path.join(__dirname),
  // AniList covers are loaded as WebGL textures via the image optimizer proxy
  // (the CDN sends no CORS headers, direct TextureLoader fetch gets blocked)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
    ],
  },
};

export default nextConfig;
