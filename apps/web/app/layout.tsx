import "@repo/ui/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "./_components/providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://charlar.vagarth.in"),
  title: "charlar — connect · chat · call",
  description: "Effortless rooms for two. Chat or video, no signup.",
  openGraph: {
    title: "charlar — connect · chat · call",
    description: "Effortless rooms for two. Chat or video, no signup.",
    siteName: "charlar",
    type: "website",
    images: [
      {
        url: "/images/og-charlar-lines.png",
        width: 1200,
        height: 630,
        alt: "Charlar — The Room Between",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "charlar — connect · chat · call",
    description: "Effortless rooms for two. Chat or video, no signup.",
    images: ["/images/og-charlar-lines.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0704" },
    { media: "(prefers-color-scheme: light)", color: "#fbf8f2" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} font-[family-name:var(--font-body)]`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
