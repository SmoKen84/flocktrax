import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

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
      <body>{children}</body>
    </html>
  );
}
