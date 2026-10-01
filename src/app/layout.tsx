import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  themeColor: "#0b0718",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mira",
  },
  title: "Bilgi Dozu • Dijital Asistan",
  description: "Konuşan, duygularını yüzüne yansıtan kişisel dijital asistan.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-[#0b0718] text-white antialiased">{children}</body>
    </html>
  );
}
