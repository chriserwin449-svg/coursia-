"use client";

import { motion } from "framer-motion";
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

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center max-w-4xl"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-mauve to-mauve-dark glow-mauve mb-8"
        >
          <GraduationCap className="w-12 h-12 text-white" />
        </motion.div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6">
          <span className="gradient-text">Coursia</span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          Apprends n&apos;importe quoi en quelques clics. L&apos;IA crée des cours
          personnalisés avec des chapitres, des quiz et un suivi de ta progression.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={() => setView("create")}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-xl font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 glow-mauve hover:shadow-[0_0_30px_rgba(124,92,191,0.5)] cursor-pointer"
          >
            <Sparkles className="w-6 h-6" />
            Commencer à Apprendre
            <ArrowRight className="w-6 h-6" />
          </button>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
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
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.1 }}
              className="glass rounded-3xl p-6 text-left hover:border-mauve/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl bg-mauve/20 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-mauve-light" />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-sm text-muted-foreground/50">
        Propulsé par l&apos;IA · Coursia © 2025
      </div>
    </div>
  );
}
