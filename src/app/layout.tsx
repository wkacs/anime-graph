import type { Metadata } from "next";
import { Instrument_Sans, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import TopNav from "@/components/TopNav";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
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
  title: "Anime Graph",
  description: "3D anime map with an AI taste engine",
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
        className={`${instrument.variable} ${geistMono.variable} ${notoJp.variable} antialiased`}
      >
        <IntlProvider>
          <TopNav />
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
