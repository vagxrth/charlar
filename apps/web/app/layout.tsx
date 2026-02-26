import "@repo/ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./_components/providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Charlar",
  description: "Connect. Chat. Call.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${jakarta.variable} font-[family-name:var(--font-body)]`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
