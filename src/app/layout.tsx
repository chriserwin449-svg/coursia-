import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://coursia.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Coursia — Apprends n'importe quoi avec l'IA",
    template: "%s | Coursia",
  },
  description:
    "Coursia génère des cours personnalisés avec l'IA. Apprends à ton rythme avec des chapitres, des quiz et un suivi de progression. Premier cours gratuit.",
  keywords: [
    "Coursia",
    "cours IA",
    "apprentissage IA",
    "cours personnalisés",
    "éducation en ligne",
    "quiz en ligne",
    "formation IA",
    "apprendre en ligne",
    "AI courses",
    "personalized learning",
    "AI education",
    "online courses",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: "en_US",
    url: SITE_URL,
    siteName: "Coursia",
    title: "Coursia — Apprends n'importe quoi avec l'IA",
    description:
      "Coursia génère des cours personnalisés avec l'IA. Apprends à ton rythme avec des chapitres, des quiz et un suivi de progression. Premier cours gratuit.",
    images: [
      {
        url: "/app-preview.png",
        width: 1200,
        height: 630,
        alt: "Coursia — Apprends n'importe quoi avec l'IA. Plateforme de cours personnalisés générés par intelligence artificielle.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coursia — Apprends n'importe quoi avec l'IA",
    description:
      "Coursia génère des cours personnalisés avec l'IA. Apprends à ton rythme avec des chapitres, des quiz et un suivi de progression.",
    images: ["/app-preview.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "fr": SITE_URL,
      "en": SITE_URL,
      "fr-FR": SITE_URL,
      "en-US": SITE_URL,
      "x-default": SITE_URL,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* hreflang — language is toggled client-side on the same URL */}
        <link rel="alternate" hrefLang="fr" href={SITE_URL} />
        <link rel="alternate" hrefLang="en" href={SITE_URL} />
        <link rel="alternate" hrefLang="x-default" href={SITE_URL} />

        {/* JSON-LD: Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: "Coursia",
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/logo-512.png`,
                    width: 512,
                    height: 512,
                  },
                  description:
                    "Plateforme SaaS d'apprentissage personnalisé par IA. Coursia génère des cours sur mesure avec des chapitres, quiz et suivi de progression.",
                  sameAs: [],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: "Coursia",
                  description:
                    "Apprends n'importe quoi avec des cours générés par l'IA. Premier cours gratuit.",
                  publisher: {
                    "@id": `${SITE_URL}/#organization`,
                  },
                  inLanguage: ["fr", "en"],
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-night text-foreground`}
      >
        {children}
        <Toaster />
        <Analytics />
        <SpeedInsights />

        {/* Tawk.to Live Chat */}
        <script
          dangerouslySetInnerHTML={{
            __html: `var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/6a690e0d64a1cb1d4e015ac7/1jul5tpf4';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();`,
          }}
        />
      </body>
    </html>
  );
}