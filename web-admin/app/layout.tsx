import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

const sansFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const serifFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlockTrax Admin",
  description: "Web-first admin console for FlockTrax operations and placement planning.",
  icons: {
    icon: [{ url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" }],
    shortcut: [{ url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={`${sansFont.variable} ${serifFont.variable}`}>{children}</body>
    </html>
  );
}
