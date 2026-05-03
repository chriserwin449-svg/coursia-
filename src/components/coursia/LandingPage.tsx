"use client";

import { Sparkles, BookOpen, Trophy, GraduationCap, ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function LandingPage() {
  const setView = useAppStore((s) => s.setView);

  return (
    <div className="min-h-screen bg-night flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-mauve/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-mauve-dark/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-4xl animate-[fadeIn_0.6s_ease-out]">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-mauve to-mauve-dark glow-mauve mb-8">
          <GraduationCap className="w-12 h-12 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6">
          <span className="gradient-text">Coursia</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Apprends n&apos;importe quoi en quelques clics. L&apos;IA crée des cours
          personnalisés avec des chapitres, des quiz et un suivi de ta progression.
        </p>

        {/* CTA Button */}
        <button
          onClick={() => setView("create")}
          className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-xl font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 glow-mauve hover:shadow-[0_0_30px_rgba(124,92,191,0.5)] cursor-pointer"
        >
          <Sparkles className="w-6 h-6" />
          Commencer à Apprendre
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Feature cards */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpen,
              title: "Cours Générés par IA",
              desc: "Donne un sujet et l'IA crée un cours complet avec des chapitres organisés.",
            },
            {
              icon: Trophy,
              title: "Badges & Progression",
              desc: "Gagne des badges, suis ta progression et deviens un expert.",
            },
            {
              icon: Sparkles,
              title: "Quiz Interactifs",
              desc: "Teste tes connaissances avec des quiz à la fin de chaque chapitre.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass rounded-3xl p-6 text-left hover:border-mauve/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl bg-mauve/20 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-mauve-light" />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-sm text-muted-foreground/50">
        Propulsé par l&apos;IA · Coursia © 2025
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
