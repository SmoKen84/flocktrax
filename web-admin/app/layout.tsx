import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

import { PwaInstallListener } from "@/components/pwa-install-listener";
import { evaluateEnvironmentSafety } from "@/lib/environment-safety";

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

const environment = evaluateEnvironmentSafety();

export const metadata: Metadata = {
  title: environment.isDemo
    ? {
        default: "🔴 FlockTrax Demo",
        template: "%s | 🔴 FlockTrax Demo",
      }
    : "FlockTrax Admin",
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
      <body className={`${sansFont.variable} ${serifFont.variable}`}>
        <PwaInstallListener />
        {children}
      </body>
    </html>
  );
}
