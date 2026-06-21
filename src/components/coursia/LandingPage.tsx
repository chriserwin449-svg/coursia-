"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  Check,
  Crown,
  Zap,
  ChevronDown,
  LogIn,
  GraduationCap,
  Briefcase,
  Lightbulb,
  BarChart3,
  Star,
  Settings,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

export default function LandingPage() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user);

  // Scroll-triggered visibility
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const audienceRef = useRef<HTMLDivElement>(null);
  const [audienceVisible, setAudienceVisible] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);
  const [pricingVisible, setPricingVisible] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id === "hero") setHeroVisible(true);
            if (id === "features") setFeaturesVisible(true);
            if (id === "audience") setAudienceVisible(true);
            if (id === "pricing") setPricingVisible(true);
            if (id === "final-cta") setCtaVisible(true);
          }
        });
      },
      { threshold: 0.15 }
    );
    ["hero", "features", "audience", "pricing", "final-cta"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const isFr = lang === "fr";

  // Feature cards for "Pourquoi choisir" section
  const featureCards = [
    {
      icon: BookOpen,
      title: isFr ? "Leçons dynamiques" : "Dynamic lessons",
      desc: isFr
        ? "Des cours clairs, structurés et générés automatiquement pour retenir l'essentiel."
        : "Clear, structured courses automatically generated to retain the essentials.",
      gradient: "from-mauve to-mauve-dark",
    },
    {
      icon: Settings,
      title: isFr ? "100% personnalisé" : "100% personalized",
      desc: isFr
        ? "Le contenu s'adapte à ton niveau, ton rythme et tes objectifs."
        : "The content adapts to your level, pace and objectives.",
      gradient: "from-pink-500 to-rose-600",
    },
    {
      icon: BarChart3,
      title: isFr ? "Suivi intelligent" : "Intelligent tracking",
      desc: isFr
        ? "Suis ta progression et reçois des recommandations intelligentes."
        : "Track your progress and receive intelligent recommendations.",
      gradient: "from-orange-500 to-amber-600",
    },
    {
      icon: Star,
      title: isFr ? "Apprends plus vite" : "Learn faster",
      desc: isFr
        ? "Des méthodes prouvées pour maximiser ta compréhension et ta rétention."
        : "Proven methods to maximize your understanding and retention.",
      gradient: "from-mauve-light to-mauve",
    },
  ];

  // Audience cards
  const audienceCards = [
    {
      icon: GraduationCap,
      title: isFr ? "Étudiants" : "Students",
      desc: isFr
        ? "Réussis tes examens et comprends mieux."
        : "Pass your exams and understand better.",
      gradient: "from-mauve to-purple-600",
    },
    {
      icon: Briefcase,
      title: isFr ? "Professionnels" : "Professionals",
      desc: isFr
        ? "Développe tes compétences et progresse dans ta carrière."
        : "Develop your skills and progress in your career.",
      gradient: "from-orange-500 to-amber-600",
    },
    {
      icon: Lightbulb,
      title: isFr ? "Curieux" : "Curious",
      desc: isFr
        ? "Explore de nouveaux sujets quand tu veux."
        : "Explore new topics whenever you want.",
      gradient: "from-mauve-light to-mauve",
    },
  ];

  // Hero badges
  const heroBadges = [
    {
      icon: Sparkles,
      label: isFr ? "Généré par IA" : "AI Generated",
      sub: isFr ? "Contenu sur-mesure" : "Custom content",
    },
    {
      icon: Settings,
      label: isFr ? "Adaptatif" : "Adaptive",
      sub: isFr ? "Selon ton niveau et ton rythme" : "Based on your level and pace",
    },
    {
      icon: Check,
      label: isFr ? "Simple & Efficace" : "Simple & Effective",
      sub: isFr ? "Apprends sans distraction" : "Learn without distractions",
    },
  ];

  // FAQ items
  const faqs = isFr
    ? [
        { q: "Comment fonctionne la progression par niveaux ?", a: "Chaque cours comporte 3 niveaux de difficulté : Débutant, Intermédiaire et Avancé. Tu commences toujours par le niveau Débutant. Après avoir terminé un niveau, tu peux choisir de passer au suivant." },
        { q: "Les cours sont-ils personnalisés selon mon niveau ?", a: "Oui ! L'IA adapte la complexité du contenu, les exemples et les quiz en fonction de ton niveau." },
        { q: "Puis-je créer un cours gratuitement ?", a: "Oui ! Tu peux créer ton premier cours gratuitement et lire le premier chapitre." },
        { q: "Comment fonctionne le système de flammes ?", a: "Les flammes sont ta monnaie d'apprentissage ! Tu en gagnes en réussissant des quiz et en terminant des cours." },
        { q: "Puis-je accéder à mes cours depuis n'importe quel appareil ?", a: "Oui, Coursia est accessible depuis n'importe quel navigateur web." },
      ]
    : [
        { q: "How does level progression work?", a: "Each course has 3 difficulty levels: Beginner, Intermediate and Advanced." },
        { q: "Are courses personalized to my level?", a: "Yes! The AI adapts the content complexity, examples and quizzes based on your level." },
        { q: "Can I create a course for free?", a: "Yes! You can create your first course for free and read the first chapter." },
        { q: "How does the flame system work?", a: "Flames are your learning currency! You earn them by passing quizzes and completing courses." },
        { q: "Can I access my courses from any device?", a: "Yes, Coursia is accessible from any web browser." },
      ];

  return (
    <div className="min-h-screen bg-night flex flex-col">
      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-night/80 border-b border-muted-foreground/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <CoursiaLogo size={32} className="rounded-lg" />
            <span className="font-extrabold text-foreground text-lg">{tx.app.name}</span>
          </div>

          {/* Nav links (desktop) */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo("hero")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {isFr ? "Accueil" : "Home"}
            </button>
            <button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {isFr ? "Fonctionnalités" : "Features"}
            </button>
            <button onClick={() => scrollTo("audience")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {isFr ? "À propos" : "About"}
            </button>
            <button onClick={() => scrollTo("pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {isFr ? "Tarifs" : "Pricing"}
            </button>
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{isFr ? "Connexion" : "Login"}</span>
            </button>
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="hero-cta-btn group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold transition-all duration-300 glow-mauve cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tx.landing.cta}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section id="hero" className="relative overflow-hidden flex items-start justify-center min-h-screen px-4 pt-28 pb-12">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-mauve/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-mauve-dark/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div
          ref={heroRef}
          className="relative z-10 text-center max-w-5xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-mauve-light font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            <span>{isFr ? "Propulsé par l'Intelligence Artificielle" : "Powered by Artificial Intelligence"}</span>
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="glow-mauve rounded-2xl overflow-hidden">
              <CoursiaLogo size={56} variant="wide" />
            </div>
          </div>

          {/* Hero heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight max-w-4xl mx-auto">
            <span className="text-foreground">{isFr ? "Tu n'as pas besoin de plus de contenu. Tu as besoin d'un" : "You don't need more content. You need a"}</span>{" "}
            <span className="gradient-text">{isFr ? "cours qui s'adapte à toi" : "course that adapts to you"}</span>
            <span className="text-foreground">.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {isFr
              ? "Coursia crée des leçons dynamiques, claires et personnalisées pour t'aider à apprendre plus vite et mieux retenir."
              : "Coursia creates dynamic, clear and personalized lessons to help you learn faster and remember better."}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="hero-cta-btn group inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg sm:text-xl font-bold transition-all duration-300 glow-mauve hover:shadow-[0_0_50px_rgba(124,92,191,0.6)] cursor-pointer"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="relative z-10">{isFr ? "Commencer gratuitement" : "Start for free"}</span>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full glass text-foreground font-semibold hover:border-mauve/30 transition-all duration-300 cursor-pointer text-sm sm:text-lg"
            >
              {tx.landing.pricing.title}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Hero feature badges */}
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            {heroBadges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-mauve/20 flex items-center justify-center flex-shrink-0">
                  <badge.icon className="w-3 h-3 text-mauve-light" />
                </div>
                <div className="text-left">
                  <p className="text-foreground font-semibold text-xs">{badge.label}</p>
                  <p className="text-muted-foreground/60 text-xs">{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="mt-14 flex justify-center animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
              <div className="w-1.5 h-3 rounded-full bg-muted-foreground/50" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY CHOOSE SECTION ===== */}
      <section id="features" className="relative py-24 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div
          ref={featuresRef}
          className="relative z-10 max-w-6xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {isFr ? "Apprendre n'a jamais été aussi" : "Learning has never been so"}{" "}
              <span className="gradient-text">{isFr ? "simple" : "simple"}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {isFr
                ? "Coursia transforme n'importe quel sujet en une expérience d'apprentissage interactive et personnalisée."
                : "Coursia transforms any subject into an interactive and personalized learning experience."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="glass rounded-3xl p-6 text-left hover:border-mauve/30 transition-all duration-300 group hover:-translate-y-1"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-foreground">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AUDIENCE SECTION ===== */}
      <section id="audience" className="relative py-24 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-gold/5 rounded-full blur-[120px]" />
        </div>
        <div
          ref={audienceRef}
          className="relative z-10 max-w-5xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: audienceVisible ? 1 : 0,
            transform: audienceVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {isFr ? "Pour qui est" : "Who is"}{" "}
              <span className="gradient-text">{tx.app.name}</span>{" "}
              {isFr ? "?" : "for?"}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {isFr
                ? "Que tu sois étudiant, professionnel ou simplement curieux, Coursia t'aide à atteindre tes objectifs."
                : "Whether you're a student, professional or simply curious, Coursia helps you achieve your goals."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {audienceCards.map((card) => (
              <div
                key={card.title}
                className="glass rounded-3xl p-8 text-center hover:border-mauve/30 transition-all duration-300 group hover:-translate-y-1"
              >
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300`}
                >
                  <card.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION (KEPT FROM ORIGINAL) ===== */}
      <section id="pricing" className="relative py-24 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-mauve/5 rounded-full blur-[150px]" />
        </div>

        <div
          ref={pricingRef}
          className="relative z-10 max-w-5xl mx-auto transition-all duration-1000 ease-out"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start max-w-4xl mx-auto">
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
                onClick={() => setView("offers")}
                className="landing-monthly-btn-shimmer w-full py-4 rounded-full text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 cursor-pointer relative overflow-hidden"
              >
                {tx.landing.pricing.monthly.cta}
              </button>
            </div>

            {/* ANNUAL PLAN — highlighted */}
            <div className="landing-pricing-float landing-annual-shimmer relative glass rounded-3xl p-8 flex flex-col border-2 border-gold/50 hover:border-gold/70 transition-all duration-300 shadow-[0_0_40px_rgba(234,179,8,0.1)]">
              <span className="landing-annual-badge-pulse absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-xs font-extrabold uppercase tracking-wider z-10">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  {tx.landing.pricing.annual.badge}
                </span>
              </span>
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
                onClick={() => setView("offers")}
                className="landing-annual-btn-shimmer w-full py-4 rounded-full text-night font-bold hover:from-amber-400 hover:to-gold transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] cursor-pointer relative overflow-hidden"
              >
                {tx.landing.pricing.annual.cta}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground/40 mt-10">
            {isFr ? "Paiement 100% sécurisé via PayPal" : "100% secure payment via PayPal"}
          </p>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="relative py-24 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              <span className="gradient-text">{isFr ? "Questions Fréquentes" : "Frequently Asked Questions"}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {isFr ? "Tout ce que tu dois savoir sur Coursia." : "Everything you need to know about Coursia."}
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-mauve/30">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
                >
                  <span className="font-semibold text-foreground text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96 pb-5" : "max-h-0"}`}>
                  <p className="px-6 text-sm sm:text-base text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA SECTION ===== */}
      <section id="final-cta" className="py-20 px-4">
        <div
          ref={ctaRef}
          className="max-w-4xl mx-auto text-center glass rounded-3xl p-12 md:p-16 relative overflow-hidden transition-all duration-1000 ease-out"
          style={{
            opacity: ctaVisible ? 1 : 0,
            transform: ctaVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-mauve/10 rounded-full blur-[100px]" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {isFr ? "Prêt à révolutionner ta façon d'apprendre" : "Ready to revolutionize your way of learning"}
              <span className="gradient-text"> ?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              {isFr
                ? "Rejoins des milliers d'apprenants qui utilisent déjà Coursia."
                : "Join thousands of learners already using Coursia."}
            </p>
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="hero-cta-btn group inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg sm:text-xl font-bold transition-all duration-300 glow-mauve hover:shadow-[0_0_50px_rgba(124,92,191,0.6)] cursor-pointer"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="relative z-10">{isFr ? "Commencer gratuitement" : "Start for free"}</span>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-muted-foreground/10 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CoursiaLogo size={32} className="rounded-xl" />
            <span className="font-bold text-sm text-foreground">{tx.app.name}</span>
          </div>
          <p className="text-sm text-muted-foreground/50">{tx.app.footer}</p>
        </div>
      </footer>

      {/* ===== GLOBAL STYLES ===== */}
      <style jsx global>{`
        /* ── Landing Pricing Card Effects ── */
        @keyframes landing-float-card {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .landing-pricing-float {
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .landing-pricing-float:hover {
          animation: landing-float-card 1.8s ease-in-out infinite;
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.4), 0 0 30px rgba(168, 85, 247, 0.08);
        }

        /* Monthly card: mauve shimmer sweep */
        @keyframes landing-monthly-shimmer-sweep {
          0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
        }
        .landing-monthly-shimmer { position: relative; overflow: hidden; }
        .landing-monthly-shimmer::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(124, 92, 191, 0.06) 20%, rgba(255, 255, 255, 0.1) 40%, rgba(124, 92, 191, 0.06) 60%, transparent 100%);
          z-index: 1; pointer-events: none; border-radius: inherit;
          animation: landing-monthly-shimmer-sweep 3.5s ease-in-out infinite;
        }
        .landing-monthly-shimmer > * { position: relative; z-index: 2; }
        .landing-monthly-shimmer:hover {
          border-color: rgba(168, 85, 247, 0.45) !important;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.2), 0 0 40px rgba(168, 85, 247, 0.1), 0 0 60px rgba(168, 85, 247, 0.05);
        }

        /* Monthly CTA button shimmer */
        @keyframes landing-monthly-btn-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .landing-monthly-btn-shimmer {
          background-size: 200% auto;
          background-image: linear-gradient(90deg, #7c5cbf 0%, #9b7fd4 25%, #c4b5fd 40%, #9b7fd4 55%, #7c5cbf 75%, #5a3d8f 100%);
          animation: landing-monthly-btn-shimmer 2.5s linear infinite;
        }

        /* Annual card: gold shimmer sweep */
        @keyframes landing-annual-shimmer-sweep {
          0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
        }
        .landing-annual-shimmer { position: relative; overflow: hidden; }
        .landing-annual-shimmer::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(234, 179, 8, 0.06) 20%, rgba(255, 255, 255, 0.12) 40%, rgba(234, 179, 8, 0.06) 60%, transparent 100%);
          z-index: 1; pointer-events: none; border-radius: inherit;
          animation: landing-annual-shimmer-sweep 3s ease-in-out infinite;
        }
        .landing-annual-shimmer > * { position: relative; z-index: 2; }

        /* Annual badge glow pulse */
        @keyframes landing-annual-badge-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.3), 0 0 16px rgba(234, 179, 8, 0.15); }
          50% { box-shadow: 0 0 16px rgba(234, 179, 8, 0.5), 0 0 32px rgba(234, 179, 8, 0.25), 0 0 48px rgba(234, 179, 8, 0.1); }
        }
        .landing-annual-badge-pulse { animation: landing-annual-badge-glow 2.5s ease-in-out infinite; }

        /* Annual CTA button shimmer */
        @keyframes landing-annual-btn-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .landing-annual-btn-shimmer {
          background-size: 200% auto;
          background-image: linear-gradient(90deg, #eab308 0%, #f59e0b 25%, #fde68a 40%, #f59e0b 55%, #eab308 75%, #f59e0b 100%);
          animation: landing-annual-btn-shimmer 2.5s linear infinite;
        }

        /* Hero CTA Button: breathing glow + shimmer */
        @keyframes hero-cta-glow-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(124, 92, 191, 0.35), 0 0 30px rgba(124, 92, 191, 0.15), 0 4px 15px rgba(0, 0, 0, 0.3); }
          50% { box-shadow: 0 0 25px rgba(124, 92, 191, 0.55), 0 0 50px rgba(124, 92, 191, 0.25), 0 0 80px rgba(124, 92, 191, 0.1), 0 4px 15px rgba(0, 0, 0, 0.3); }
        }
        @keyframes hero-cta-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .hero-cta-btn {
          position: relative; overflow: hidden;
          background-size: 200% auto;
          background-image: linear-gradient(90deg, #7c5cbf 0%, #9b7fd4 20%, #c4b5fd 35%, #a78bfa 50%, #9b7fd4 65%, #7c5cbf 80%, #5a3d8f 100%);
          animation: hero-cta-shimmer 3s linear infinite, hero-cta-glow-pulse 2.5s ease-in-out infinite;
          transform: scale(1);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hero-cta-btn:hover {
          transform: scale(1.05);
          animation: hero-cta-shimmer 3s linear infinite, hero-cta-glow-pulse 1.5s ease-in-out infinite;
        }
        .hero-cta-btn:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}
