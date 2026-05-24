"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Sparkles,
  BookOpen,
  Trophy,
  ArrowRight,
  Star,
  Check,
  Crown,
  Zap,
  Globe,
  ChevronDown,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

const testimonials = [
  {
    text: "Coursia m\u2019a permis d\u2019apprendre Python en une semaine ! Les chapitres sont super bien structur\u00e9s.",
    author: "Marie L.",
    avatar: "/avatars/marie.jpg",
    roleFr: "\u00c9tudiante en informatique",
    roleEn: "CS Student",
  },
  {
    text: "Les quiz m\u2019aident vraiment \u00e0 retenir. J\u2019adore le syst\u00e8me de badges !",
    author: "Thomas R.",
    avatar: "/avatars/thomas.jpg",
    roleFr: "D\u00e9veloppeur web",
    roleEn: "Web Developer",
  },
  {
    text: "L\u2019IA g\u00e9n\u00e8re des cours incroyablement complets. Je recommande \u00e0 100%.",
    author: "Sarah K.",
    avatar: "/avatars/sarah.jpg",
    roleFr: "Designer UX",
    roleEn: "UX Designer",
  },
  {
    text: "Parfait pour r\u00e9viser avant les examens. J\u2019ai am\u00e9lior\u00e9 mes notes gr\u00e2ce \u00e0 Coursia.",
    author: "Lucas M.",
    avatar: "/avatars/lucas.jpg",
    roleFr: "\u00c9tudiant en m\u00e9decine",
    roleEn: "Medical Student",
  },
  {
    text: "L\u2019interface est magnifique et intuitive. Mieux que n\u2019importe quelle autre plateforme.",
    author: "Emma D.",
    avatar: "/avatars/emma.jpg",
    roleFr: "Data analyst",
    roleEn: "Data Analyst",
  },
  {
    text: "J\u2019utilise Coursia tous les jours pour apprendre de nouvelles comp\u00e9tences.",
    author: "Nicolas B.",
    avatar: "/avatars/nicolas.jpg",
    roleFr: "Entrepreneur",
    roleEn: "Entrepreneur",
  },
];

function TestimonialCard({
  text,
  author,
  roleFr,
  roleEn,
  avatar,
}: {
  text: string;
  author: string;
  roleFr: string;
  roleEn: string;
  avatar: string;
}) {
  const lang = useAppStore((s) => s.lang);
  return (
    <div className="glass rounded-3xl p-6 min-w-[320px] max-w-[380px] mx-3 flex-shrink-0 hover:border-mauve/30 transition-all duration-300">
      <div className="flex items-center gap-1 mb-3">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className="w-4 h-4 fill-gold text-gold"
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        &ldquo;{text}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full ring-2 ring-mauve/30 overflow-hidden flex-shrink-0">
          <Image
            src={avatar}
            alt={author}
            width={44}
            height={44}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-sm text-foreground block">{author}</span>
          <span className="text-xs text-muted-foreground block">{lang === "fr" ? roleFr : roleEn}</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const user = useAppStore((s) => s.user);
  const heroRef = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(true);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [testimonialsVisible, setTestimonialsVisible] = useState(false);
  const [pricingVisible, setPricingVisible] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const h = window.innerHeight;

      if (scrollY < h * 0.5) setVisible((v) => v || true);
      if (scrollY > h * 0.2) setFeaturesVisible((v) => v || true);
      if (scrollY > h * 0.55) setTestimonialsVisible((v) => v || true);
      if (scrollY > h * 0.9) setPricingVisible((v) => v || true);
      if (scrollY > h * 1.3) setFaqVisible((v) => v || true);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-night flex flex-col">
      {/* ===== STICKY TOP NAVIGATION BAR ===== */}
      <nav className="fixed top-0 w-full z-50 bg-night/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          {/* Left: Logo + brand name */}
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Coursia" width={32} height={32} className="object-contain" priority />
            <span className="text-lg font-bold text-foreground">{tx.app.name}</span>
          </div>
          {/* Right: CTA button */}
          <button
            onClick={() => user ? setView("create") : setView("auth")}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full glass font-semibold text-foreground hover:bg-white/10 hover:border-mauve/30 transition-all duration-300 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-mauve-light" />
            {tx.landing.cta}
          </button>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden flex items-start justify-center min-h-screen px-4 pt-28 pb-12">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-mauve/8 rounded-full blur-[120px]" />
          <div
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-mauve-dark/10 rounded-full blur-[120px]"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px]" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div
          ref={heroRef}
          className="relative z-10 text-center max-w-5xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-mauve-light font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            <span>{lang === "fr" ? "Propulsé par l'Intelligence Artificielle" : "Powered by Artificial Intelligence"}</span>
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 glow-mauve rounded-2xl overflow-hidden">
              <Image src="/logo.png" alt="Coursia" width={96} height={96} className="w-full h-full object-contain" priority />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold mb-6 leading-tight">
            <span className="gradient-text">{tx.app.name}</span>
          </h1>

          {/* Hero text */}
          <p className="text-xl sm:text-2xl md:text-3xl text-foreground font-bold mb-4 max-w-3xl mx-auto">
            {tx.landing.hero}
          </p>
          <p className="text-base sm:text-lg text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            {tx.landing.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg sm:text-xl font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 glow-mauve hover:shadow-[0_0_40px_rgba(124,92,191,0.5)] cursor-pointer"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              {tx.landing.cta}
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("pricing-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full glass text-foreground font-semibold hover:border-mauve/30 transition-all duration-300 cursor-pointer text-base sm:text-lg"
            >
              {tx.landing.pricing.title}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {useMemo(() => [
              { icon: BookOpen, value: "10K+", label: lang === "fr" ? "Cours créés" : "Courses created", key: "courses" },
              { icon: Trophy, value: "50K+", label: lang === "fr" ? "Quiz complétés" : "Quizzes completed", key: "quizzes" },
              { icon: Globe, value: "98%", label: lang === "fr" ? "Satisfaction" : "Satisfaction", key: "sat" },
            ], [lang]).map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-mauve-light" />
                </div>
                <div className="text-left">
                  <div className="text-xl font-extrabold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div className="w-1.5 h-3 rounded-full bg-muted-foreground/50" />
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="relative py-24 px-4">
        <div
          className="max-w-6xl mx-auto transition-all duration-1000 ease-out delay-200"
          style={{
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {lang === "fr"
                ? "Pourquoi choisir"
                : "Why choose"}{" "}
              <span className="gradient-text">{tx.app.name}</span>{" "}
              ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {lang === "fr"
                ? "Une plateforme d'apprentissage nouvelle génération, conçue pour toi."
                : "A next-generation learning platform, designed for you."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useMemo(() => [
              {
                icon: Sparkles,
                title: tx.landing.features.ai.title,
                desc: tx.landing.features.ai.desc,
                gradient: "from-mauve to-mauve-dark",
                glow: "glow-mauve",
              },
              {
                icon: Trophy,
                title: tx.landing.features.badges.title,
                desc: tx.landing.features.badges.desc,
                gradient: "from-gold to-amber-600",
                glow: "",
              },
              {
                icon: BookOpen,
                title: tx.landing.features.quiz.title,
                desc: tx.landing.features.quiz.desc,
                gradient: "from-emerald-500 to-emerald-700",
                glow: "",
              },
            ], [tx.landing.features]).map((feature) => (
              <div
                key={feature.title}
                className="glass rounded-3xl p-8 text-left hover:border-mauve/30 transition-all duration-300 group hover:-translate-y-1"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 ${feature.glow} group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="relative py-24 overflow-hidden">
        <div
          className="text-center mb-14 px-4 transition-all duration-1000 ease-out"
          style={{
            opacity: testimonialsVisible ? 1 : 0,
            transform: testimonialsVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
            <span className="gradient-text">{tx.landing.testimonials.title}</span>
          </h2>
        </div>

        {/* Row 1 — left to right */}
        <div className="overflow-hidden mb-6">
          <div className="marquee-track">
            {[...testimonials, ...testimonials].map((t, i) => (
              <TestimonialCard key={`r1-${i}`} text={t.text} author={t.author} roleFr={t.roleFr} roleEn={t.roleEn} avatar={t.avatar} />
            ))}
          </div>
        </div>

        {/* Row 2 — right to left */}
        <div className="overflow-hidden">
          <div className="marquee-track-reverse">
            {[...testimonials.slice().reverse(), ...testimonials.slice().reverse()].map((t, i) => (
              <TestimonialCard key={`r2-${i}`} text={t.text} author={t.author} roleFr={t.roleFr} roleEn={t.roleEn} avatar={t.avatar} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section id="pricing-section" className="relative py-24 px-4">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-mauve/5 rounded-full blur-[150px]" />
        </div>

        <div
          className="relative z-10 max-w-6xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: pricingVisible ? 1 : 0,
            transform: pricingVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {tx.landing.pricing.title}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.pricing.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* FREE PLAN */}
            <div className="landing-pricing-float glass rounded-3xl p-8 flex flex-col hover:border-mauve/30 transition-all duration-300">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-mauve-light" />
                  </div>
                  <h3 className="text-xl font-bold">{tx.landing.pricing.free.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm">{tx.landing.pricing.free.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold">{tx.landing.pricing.free.price}</span>
                {lang === "fr" && (
                  <p className="text-sm text-gold font-semibold mt-1">{tx.landing.pricing.free.note}</p>
                )}
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {tx.landing.pricing.free.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="w-full py-4 rounded-full border border-muted-foreground/20 text-foreground font-bold hover:bg-muted-foreground/10 transition-all duration-300 cursor-pointer"
              >
                {tx.landing.pricing.free.cta}
              </button>
            </div>

            {/* MONTHLY PLAN */}
            <div className="landing-pricing-float landing-monthly-shimmer glass rounded-3xl p-8 flex flex-col hover:border-mauve/30 transition-all duration-300">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-mauve-light" />
                  </div>
                  <h3 className="text-xl font-bold">{tx.landing.pricing.monthly.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm">{tx.landing.pricing.monthly.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold">{tx.landing.pricing.monthly.price}</span>
                <span className="text-lg text-muted-foreground">{tx.landing.pricing.monthly.period}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {tx.landing.pricing.monthly.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="landing-monthly-btn-shimmer w-full py-4 rounded-full text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 cursor-pointer relative overflow-hidden"
              >
                {tx.landing.pricing.monthly.cta}
              </button>
            </div>

            {/* ANNUAL PLAN — highlighted */}
            <div className="landing-pricing-float landing-annual-shimmer relative glass rounded-3xl p-8 flex flex-col border-2 border-gold/50 hover:border-gold/70 transition-all duration-300 shadow-[0_0_40px_rgba(234,179,8,0.1)]">
              {/* Popular badge */}
              <span className="landing-annual-badge-pulse absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-xs font-extrabold uppercase tracking-wider z-10">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  {tx.landing.pricing.annual.badge}
                </span>
              </span>

              {/* Save badge */}
              <div className="flex justify-end mb-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                  {tx.landing.pricing.annual.save}
                </span>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-gold" />
                  </div>
                  <h3 className="text-xl font-bold">{tx.landing.pricing.annual.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm">{tx.landing.pricing.annual.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold">{tx.landing.pricing.annual.price}</span>
                <span className="text-lg text-muted-foreground">{tx.landing.pricing.annual.period}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {tx.landing.pricing.annual.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="landing-annual-btn-shimmer w-full py-4 rounded-full text-night font-bold hover:from-amber-400 hover:to-gold transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] cursor-pointer relative overflow-hidden"
              >
                {tx.landing.pricing.annual.cta}
              </button>
            </div>
          </div>

          {/* LemonSqueezy placeholder note */}
          <p className="text-center text-xs text-muted-foreground/40 mt-10">
            {lang === "fr"
              ? "Paiement sécurisé via LemonSqueezy — disponible prochainement"
              : "Secure payment via LemonSqueezy — coming soon"}
          </p>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="relative py-24 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div
          className="relative z-10 max-w-3xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: faqVisible ? 1 : 0,
            transform: faqVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              <span className="gradient-text">
                {lang === "fr" ? "Questions Fréquentes" : "Frequently Asked Questions"}
              </span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {lang === "fr"
                ? "Tout ce que tu dois savoir sur Coursia."
                : "Everything you need to know about Coursia."}
            </p>
          </div>

          <div className="space-y-4">
            {(
              lang === "fr"
                ? [
                    { q: "Comment Coursia génère-t-il les cours ?", a: "Coursia utilise une intelligence artificielle avancée pour analyser ton sujet et créer un cours structuré avec des chapitres, des résumés et des quiz. Chaque cours est unique et adapté au niveau que tu choisis." },
                    { q: "Les cours sont-ils personnalisés selon mon niveau ?", a: "Oui ! Tu peux choisir entre trois niveaux : Débutant, Intermédiaire et Avancé. L'IA adapte la complexité du contenu, les exemples et les quiz en fonction de ton niveau." },
                    { q: "Puis-je progresser d'un niveau à l'autre ?", a: "Absolument ! Après avoir terminé un cours à un niveau, Coursia te propose de passer au niveau supérieur avec un récapitulatif IA pour t'aider à progresser. Termine les 3 niveaux pour gagner un maximum de flammes !" },
                    { q: "Combien de cours puis-je créer ?", a: "Avec le plan Découverte, tu peux créer 3 cours gratuitement pendant 7 jours. Les plans payants offrent des cours illimités pour apprendre sans limites." },
                    { q: "Comment fonctionne le système de flammes ?", a: "Les flammes sont ta monnaie d'apprentissage ! Tu en gagnes en réussissant des quiz et en terminant des cours. Utilise-les pour créer de nouveaux cours ou débloque des badges en accumulant des points." },
                    { q: "Puis-je accéder à mes cours depuis n'importe quel appareil ?", a: "Oui, Coursia est accessible depuis n'importe quel navigateur web. Tes cours et ta progression sont sauvegardés dans ton compte." },
                  ]
                : [
                    { q: "How does Coursia generate courses?", a: "Coursia uses advanced AI to analyze your topic and create a structured course with chapters, summaries and quizzes. Each course is unique and adapted to the level you choose." },
                    { q: "Are courses personalized to my level?", a: "Yes! You can choose between three levels: Beginner, Intermediate and Advanced. The AI adapts the content complexity, examples and quizzes based on your level." },
                    { q: "Can I progress from one level to another?", a: "Absolutely! After completing a course at one level, Coursia offers to move you to the next level with an AI recap to help you progress. Complete all 3 levels to earn maximum flames!" },
                    { q: "How many courses can I create?", a: "With the Discovery plan, you can create 3 free courses for 7 days. Paid plans offer unlimited courses to learn without limits." },
                    { q: "How does the flame system work?", a: "Flames are your learning currency! You earn them by passing quizzes and completing courses. Use them to create new courses or unlock badges by accumulating points." },
                    { q: "Can I access my courses from any device?", a: "Yes, Coursia is accessible from any web browser. Your courses and progress are saved in your account." },
                  ]
            ).map((faq, i) => (
              <div
                key={i}
                className="glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-mauve/30"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
                >
                  <span className="font-semibold text-foreground text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === i ? "max-h-96 pb-5" : "max-h-0"
                  }`}
                >
                  <p className="px-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center glass rounded-3xl p-12 md:p-16 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-mauve/10 rounded-full blur-[100px]" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {lang === "fr"
                ? "Prêt à commencer ?"
                : "Ready to start?"}
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              {tx.app.tagline}
            </p>
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg sm:text-xl font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 glow-mauve hover:shadow-[0_0_40px_rgba(124,92,191,0.5)] cursor-pointer"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              {tx.landing.cta}
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-muted-foreground/10 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Coursia" width={28} height={28} className="object-contain" />
            <span className="font-bold text-sm text-foreground">{tx.app.name}</span>
          </div>
          <p className="text-sm text-muted-foreground/50">{tx.app.footer}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                useAppStore.getState().setLang(lang === "fr" ? "en" : "fr");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5 rounded-full glass"
            >
              {lang === "fr" ? "🇬🇧 English" : "🇫🇷 Français"}
            </button>
          </div>
        </div>
      </footer>

      {/* ===== GLOBAL STYLES ===== */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-track {
          display: flex;
          animation: marquee 30s linear infinite;
          width: max-content;
        }
        .marquee-track-reverse {
          display: flex;
          animation: marquee-reverse 30s linear infinite;
          width: max-content;
        }
        .marquee-track:hover,
        .marquee-track-reverse:hover {
          animation-play-state: paused;
        }

        /* ── Landing Pricing Card Effects ── */

        /* Float animation on hover for all pricing cards */
        @keyframes landing-float-card {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .landing-pricing-float {
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .landing-pricing-float:hover {
          animation: landing-float-card 1.8s ease-in-out infinite;
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.4),
                      0 0 30px rgba(168, 85, 247, 0.08);
        }

        /* ── Monthly card: mauve shimmer sweep ── */
        @keyframes landing-monthly-shimmer-sweep {
          0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
        }
        .landing-monthly-shimmer {
          position: relative;
          overflow: hidden;
        }
        .landing-monthly-shimmer::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 60%; height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(124, 92, 191, 0.06) 20%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(124, 92, 191, 0.06) 60%,
            transparent 100%
          );
          z-index: 1;
          pointer-events: none;
          border-radius: inherit;
          animation: landing-monthly-shimmer-sweep 3.5s ease-in-out infinite;
        }
        .landing-monthly-shimmer > * { position: relative; z-index: 2; }
        .landing-monthly-shimmer:hover {
          border-color: rgba(168, 85, 247, 0.45) !important;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.2),
                      0 0 40px rgba(168, 85, 247, 0.1),
                      0 0 60px rgba(168, 85, 247, 0.05);
        }

        /* Monthly CTA button shimmer */
        @keyframes landing-monthly-btn-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .landing-monthly-btn-shimmer {
          background-size: 200% auto;
          background-image: linear-gradient(
            90deg,
            #7c5cbf 0%,
            #9b7fd4 25%,
            #c4b5fd 40%,
            #9b7fd4 55%,
            #7c5cbf 75%,
            #5a3d8f 100%
          );
          animation: landing-monthly-btn-shimmer 2.5s linear infinite;
        }

        /* ── Annual card: gold shimmer sweep ── */
        @keyframes landing-annual-shimmer-sweep {
          0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
        }
        .landing-annual-shimmer {
          position: relative;
          overflow: hidden;
        }
        .landing-annual-shimmer::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 60%; height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(234, 179, 8, 0.06) 20%,
            rgba(255, 255, 255, 0.12) 40%,
            rgba(234, 179, 8, 0.06) 60%,
            transparent 100%
          );
          z-index: 1;
          pointer-events: none;
          border-radius: inherit;
          animation: landing-annual-shimmer-sweep 3s ease-in-out infinite;
        }
        .landing-annual-shimmer > * { position: relative; z-index: 2; }

        /* Annual badge glow pulse */
        @keyframes landing-annual-badge-glow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(234, 179, 8, 0.3), 0 0 16px rgba(234, 179, 8, 0.15);
          }
          50% {
            box-shadow: 0 0 16px rgba(234, 179, 8, 0.5), 0 0 32px rgba(234, 179, 8, 0.25), 0 0 48px rgba(234, 179, 8, 0.1);
          }
        }
        .landing-annual-badge-pulse {
          animation: landing-annual-badge-glow 2.5s ease-in-out infinite;
        }

        /* Annual CTA button shimmer */
        @keyframes landing-annual-btn-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .landing-annual-btn-shimmer {
          background-size: 200% auto;
          background-image: linear-gradient(
            90deg,
            #eab308 0%,
            #f59e0b 25%,
            #fde68a 40%,
            #f59e0b 55%,
            #eab308 75%,
            #f59e0b 100%
          );
          animation: landing-annual-btn-shimmer 2.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
