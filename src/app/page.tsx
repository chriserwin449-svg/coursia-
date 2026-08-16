import type { Metadata } from "next";
import AppShell from "@/components/coursia/AppShell";

const SITE_URL = "https://coursia.app";

export const metadata: Metadata = {
  title: "Coursia — Apprends n'importe quoi avec l'IA | Premier cours gratuit",
  description:
    "Coursia génère des cours personnalisés par intelligence artificielle en quelques secondes. Apprends à ton rythme avec des chapitres structurés, des quiz interactifs et un suivi de progression. Piano, Python, Design, Finance — tout est possible. Premier cours gratuit, sans carte bancaire.",
  keywords: [
    "Coursia",
    "cours IA",
    "intelligence artificielle apprentissage",
    "cours personnalisés IA",
    "éducation en ligne gratuite",
    "quiz interactifs",
    "formation intelligence artificielle",
    "apprendre piano en ligne",
    "cours Python IA",
    "cours design IA",
    "formation en ligne",
    "cours gratuit",
    "plateforme éducation IA",
    "apprendre n'importe quoi",
    "cours sur mesure",
    "AI courses free",
    "personalized AI learning",
    "AI education platform",
    "learn anything with AI",
    "free online courses",
  ],
  openGraph: {
    title: "Coursia — Apprends n'importe quoi avec l'IA",
    description:
      "Génère des cours personnalisés par IA en quelques secondes. Piano, Python, Design, Finance — tout est possible. Premier cours gratuit.",
    url: SITE_URL,
    siteName: "Coursia",
    images: [
      {
        url: "/app-preview.png",
        width: 1200,
        height: 630,
        alt: "Coursia — Apprends n'importe quoi avec l'IA. Cours personnalisés générés par intelligence artificielle.",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coursia — Apprends n'importe quoi avec l'IA",
    description:
      "Génère des cours personnalisés par IA en quelques secondes. Premier cours gratuit.",
    images: ["/app-preview.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function Home() {
  return (
    <>
      {/* Server-rendered SEO content — always visible to crawlers even before JS hydration */}
      <div className="sr-only" aria-hidden="true">
        <h1>Coursia — L'IA qui crée votre cours parfait en quelques secondes</h1>
        <h2>Apprends n'importe quoi avec l'IA — Premier cours gratuit</h2>
        <p>
          Coursia est une plateforme d'apprentissage qui utilise l'intelligence artificielle pour générer
          des cours personnalisés. Choisis ton sujet (Piano, Python, Design, Finance, Marketing, Anglais...),
          et Coursia crée un cours complet avec chapitres, quiz et suivi de progression.
          Des milliers d'utilisateurs utilisent Coursia pour apprendre plus vite.
        </p>
        <nav aria-label="Sections">
          <a href="#features">Fonctionnalités</a>
          <a href="#audience">Pour qui</a>
          <a href="#testimonials">Témoignages</a>
          <a href="#trends">Tendances virales</a>
          <a href="#compare">Comparaison</a>
          <a href="#faq">Questions fréquentes</a>
        </nav>
      </div>
      <AppShell />
    </>
  );
}
