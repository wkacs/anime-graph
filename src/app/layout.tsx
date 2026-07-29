import type { Metadata } from "next";
import { Instrument_Sans, Bricolage_Grotesque, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import TopNav from "@/components/TopNav";
import MobileTabBar from "@/components/MobileTabBar";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

// Display-vágás: film-főcím logika, nem irodalmi serif. A wdth tengelyt a
// .display-* osztályok hangolják, az opsz-t a böngésző (font-optical-sizing).
// latin-ext explicit: a magyar ő/ű a display-fokozaton is a webfontból jöjjön.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
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
// katalógus-oldalakat 500-azná (lásd src/i18n/request.ts).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  title: { default: 'Anime Graph — a lista, ami dolgozik neked', template: '%s | Anime Graph' },
  description: 'Személyes anime- és manga-követő ízlésalapú felfedezéssel, publikus katalógussal és MAL/AniList-importtal.',
  keywords: ['anime tracker', 'manga tracker', 'anime recommendations', 'AniList import', 'MAL import'],
  openGraph: {
    type: 'website', siteName: 'Anime Graph', title: 'Anime Graph — a lista, ami dolgozik neked',
    description: 'Személyes anime- és manga-követő ízlésalapú felfedezéssel.',
    images: [{ url: '/opengraph-image' }],
  },
  twitter: { card: 'summary_large_image', title: 'Anime Graph', description: 'A lista, ami dolgozik neked.', images: ['/opengraph-image'] },
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
        className={`${instrument.variable} ${bricolage.variable} ${geistMono.variable} ${notoJp.variable} antialiased`}
      >
        <IntlProvider>
          <TopNav />
          {children}
          <SiteFooter />
          <MobileTabBar />
        </IntlProvider>
      </body>
    </html>
  );
}
