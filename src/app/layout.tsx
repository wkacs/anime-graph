import type { Metadata } from "next";
import { Instrument_Sans, Geist_Mono, Noto_Sans_JP } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Anime Graph",
  description: "Személyes 3D anime-térkép",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body
        className={`${instrument.variable} ${geistMono.variable} ${notoJp.variable} antialiased`}
      >
        <TopNav />
        {children}
      </body>
    </html>
  );
}
