import type { Metadata } from "next";
import { Inter, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import GlowField from "@/components/GlowField";
import SpecularTracker from "@/components/SpecularTracker";
import TopNav from "@/components/TopNav";
import MobileTabBar from "@/components/MobileTabBar";
import InstallPrompt from "@/components/InstallPrompt";
import SiteFooter from "@/components/SiteFooter";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

// Egyetlen sans-család: Inter. A display-fokozatok súllyal (700-800) és
// szoros trackinggel különülnek el, nem külön fonttal.
// latin-ext explicit: a magyar ő/ű a display-fokozaton is a webfontból jöjjön.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "500"],
  subsets: ["latin"],
});

// Statikus metaadat: a getTranslations() dinamikus API-t hívna, ami az ISR-elt
// katalógus-oldalakat 500-azná (lásd src/i18n/request.ts). A kanonikus
// SEO-nyelv angol, ezért a metaadat is az.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Anime Graph — the list that works for you', template: '%s | Anime Graph' },
  description: 'Personal anime and manga tracker with taste-based discovery, a public catalogue and MAL/AniList import.',
  keywords: ['anime tracker', 'manga tracker', 'anime recommendations', 'AniList import', 'MAL import'],
  openGraph: {
    type: 'website', siteName: 'Anime Graph', title: 'Anime Graph — the list that works for you',
    description: 'Personal anime and manga tracker with taste-based discovery.',
    images: [{ url: '/opengraph-image' }],
  },
  twitter: { card: 'summary_large_image', title: 'Anime Graph', description: 'The list that works for you.', images: ['/opengraph-image'] },
};

export const viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // lang="en": a szerver-render kanonikus nyelve. Az IntlProvider hidratáláskor
  // átállítja a document.documentElement.lang-ot, ha a cookie mást mond.
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} ${notoJp.variable} antialiased`}
      >
        <GlowField />
        <SpecularTracker />
        <IntlProvider>
          <TopNav />
          {children}
          <SiteFooter />
          <MobileTabBar />
          {/* A sav csak a fooldalon latszik, de a listenernek mindenhol elnie
              kell: a beforeinstallprompt a betoltes utan azonnal tuzel. */}
          <InstallPrompt />
        </IntlProvider>
      </body>
    </html>
  );
}
