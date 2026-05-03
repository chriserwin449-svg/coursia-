import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coursia — Apprends n'importe quoi avec l'IA",
  description:
    "Coursia génère des cours personnalisés avec l'IA. Apprends à ton rythme avec des chapitres, des quiz et un suivi de progression.",
  keywords: ["Coursia", "IA", "apprentissage", "cours", "éducation", "quiz"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-night text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
