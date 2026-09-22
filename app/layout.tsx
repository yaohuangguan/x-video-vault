import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "X Video Vault",
  description: "A private, zero-API-cost library for video Posts saved from X.",
  manifest: "/manifest.webmanifest",
  applicationName: "X Video Vault",
  appleWebApp: {
    capable: true,
    title: "Video Vault",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/pwa-icon.svg",
    shortcut: "/favicon.svg",
    apple: "/pwa-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#080a0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
