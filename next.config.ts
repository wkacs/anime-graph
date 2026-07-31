import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

// routing nelkuli mod: a locale a cookie-bol jon, az URL valtozatlan
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://graphql.anilist.co${isDevelopment ? " ws: wss:" : ""}`,
  "media-src 'self' blob: https://v.animethemes.moe https://*.animethemes.moe",
  "frame-src https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // stray lockfile in the user home dir confuses workspace-root inference
  outputFileTracingRoot: path.join(__dirname),
  // AniList covers are loaded as WebGL textures via the image optimizer proxy
  // (the CDN sends no CORS headers, direct TextureLoader fetch gets blocked)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
    ],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ...(!isDevelopment ? [{
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        }] : []),
      ],
    }];
  },
};

export default withNextIntl(nextConfig);
