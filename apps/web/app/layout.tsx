import "@repo/ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
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
  title: "charlar — connect · chat · call",
  description: "Effortless rooms for two. Chat or video, no signup.",
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
