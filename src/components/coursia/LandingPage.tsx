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
  Globe,
  X,
  Flame,
  Trophy,
  Layers,
  MessageSquare,
  Lock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

export default function LandingPage() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
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
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

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

  // Feature cards
  const featureCards = tx.landing.featureCards.map((card, i) => {
    const icons = [BookOpen, Settings, BarChart3, Star];
    const gradients = ["from-mauve to-mauve-dark", "from-pink-500 to-rose-600", "from-orange-500 to-amber-600", "from-mauve-light to-mauve"];
    return { ...card, icon: icons[i], gradient: gradients[i] };
  });

  // Audience cards
  const audienceCards = tx.landing.audienceCards.map((card, i) => {
    const icons = [GraduationCap, Briefcase, Lightbulb];
    const gradients = ["from-mauve to-purple-600", "from-orange-500 to-amber-600", "from-mauve-light to-mauve"];
    return { ...card, icon: icons[i], gradient: gradients[i] };
  });

  // Hero badges
  const heroBadges = tx.landing.heroBadges.map((badge, i) => {
    const icons = [Sparkles, Settings, Check];
    return { ...badge, icon: icons[i] };
  });

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
              {tx.landing.navHome}
            </button>
            <button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {tx.landing.navFeatures}
            </button>
            <button onClick={() => scrollTo("audience")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {tx.landing.navAbout}
            </button>
            <button onClick={() => scrollTo("pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {tx.landing.navPricing}
            </button>
          </div>

          {/* CTA buttons + Language toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              title={lang === "fr" ? "Switch to English" : "Passer en Français"}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer text-sm font-bold"
            >
              <Globe className="w-4 h-4" />
              <span>{lang.toUpperCase()}</span>
            </button>

            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{tx.landing.navLogin}</span>
            </button>
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-foreground text-sm font-bold transition-colors duration-200 cursor-pointer"
            >
              <span>{tx.landing.startFree}</span>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-mauve-light font-semibold mb-10">
            <Sparkles className="w-4 h-4" />
            <span>{tx.landing.poweredBy}</span>
          </div>

          {/* Hero heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-8 leading-tight max-w-5xl mx-auto">
            <span className="text-foreground">{tx.landing.heroHeading1}</span>{" "}
            <span className="gradient-text">{tx.landing.heroHeading2}</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl md:text-3xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            {tx.landing.heroSubtitleAlt}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="group inline-flex items-center gap-3 px-10 py-5 rounded-full border border-border text-foreground text-lg sm:text-xl font-bold transition-colors duration-200 cursor-pointer"
            >
              <span>{tx.landing.startFree}</span>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full border border-border text-foreground font-semibold transition-colors duration-200 cursor-pointer text-sm sm:text-lg"
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
              {tx.landing.whyChooseTitle}{" "}
              <span className="gradient-text">{tx.landing.whyChooseHighlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.whyChooseDesc}
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
              {tx.landing.whoForTitle}{" "}
              <span className="gradient-text">{tx.app.name}</span>{" "}
              {tx.landing.whoForTitleEnd}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.whoForDesc}
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

      {/* ===== DIFFERENTIATION SECTION ===== */}
      <section className="relative py-24 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              <span className="gradient-text">{(tx.landing as Record<string, unknown>).diffTitle as string}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {(tx.landing as Record<string, unknown>).diffDesc as string}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {((tx.landing as Record<string, unknown>).diffCards as Array<{ title: string; desc: string }>).map((card, i) => {
              const icons = [Layers, MessageSquare, Flame];
              const Icon = icons[i] || Layers;
              const gradients = ["from-mauve to-purple-600", "from-orange-500 to-amber-600", "from-mauve-light to-mauve"];
              return (
                <div
                  key={card.title}
                  className="glass rounded-3xl p-8 text-left hover:border-mauve/30 transition-all duration-300 group hover:-translate-y-1"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradients[i]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-foreground">{card.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
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
                onClick={() => setView("create")}
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
                onClick={() => setView("create")}
                className="landing-annual-btn-shimmer w-full py-4 rounded-full text-night font-bold hover:from-amber-400 hover:to-gold transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] cursor-pointer relative overflow-hidden"
              >
                {tx.landing.pricing.annual.cta}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground/40 mt-10">
            {tx.landing.securePayment}
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
              <span className="gradient-text">{tx.landing.faqTitle}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.faqSubtitle}
            </p>
          </div>
          <div className="space-y-4">
            {tx.landing.faqs.map((faq, i) => (
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
              {tx.landing.finalCtaTitle}
              <span className="gradient-text"> ?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              {tx.landing.finalCtaDesc}
            </p>
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="group inline-flex items-center gap-3 px-10 py-5 rounded-full border border-border text-foreground text-lg sm:text-xl font-bold transition-colors duration-200 cursor-pointer"
            >
              <span>{tx.landing.startFree}</span>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== AURORA ARC ===== */}
      <div className="relative w-full h-64 sm:h-80 lg:h-96 -mt-20 overflow-hidden">
        {/* Aurora gradient arc - curved upward */}
        <div className="absolute bottom-0 left-0 right-0 h-[200%] rounded-t-[50%] aurora-arc" />

        {/* Animated aurora color layers */}
        <div className="absolute inset-0 aurora-layer-1" />
        <div className="absolute inset-0 aurora-layer-2" />
        <div className="absolute inset-0 aurora-layer-3" />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="aurora-particle aurora-particle-1" />
          <div className="aurora-particle aurora-particle-2" />
          <div className="aurora-particle aurora-particle-3" />
          <div className="aurora-particle aurora-particle-4" />
          <div className="aurora-particle aurora-particle-5" />
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 border-t border-muted-foreground/10 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CoursiaLogo size={32} className="rounded-xl" />
            <span className="font-bold text-sm text-foreground">{tx.app.name}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setLegalModal("privacy")}
              className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              {(tx.landing as Record<string, unknown>).privacy as string}
            </button>
            <span className="text-muted-foreground/20">·</span>
            <button
              onClick={() => setLegalModal("terms")}
              className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              {(tx.landing as Record<string, unknown>).terms as string}
            </button>

          </div>
          <p className="text-xs text-muted-foreground/40">{(tx.landing as Record<string, unknown>).footer as string}</p>
        </div>
      </footer>

      {/* ===== LEGAL MODALS ===== */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLegalModal(null)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] glass rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto animate-fade-in-slide-up">
            <button
              onClick={() => setLegalModal(null)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
            {legalModal === "privacy" && (
              <>
                <h2 className="text-2xl font-bold mb-6 text-foreground">{lang === "fr" ? "Politique de confidentialité" : "Privacy Policy"}</h2>
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p><strong className="text-foreground">Dernière mise à jour :</strong> {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">1. {lang === "fr" ? "Données que nous collectons" : "Data We Collect"}</h3>
                  <p>{lang === "fr"
                    ? "Nous collectons uniquement les données nécessaires au fonctionnement de Coursia : ton prénom, ton nom, ton adresse email et ton code d'accès. Nous ne collectons aucune donnée supplémentaire."
                    : "We only collect data necessary for Coursia to function: your first name, last name, email address and access code. We do not collect any additional data."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">2. {lang === "fr" ? "Utilisation de tes données" : "How We Use Your Data"}</h3>
                  <p>{lang === "fr"
                    ? "Tes données servent exclusivement à : créer et gérer ton compte, personnaliser les cours générés par IA, suivre ta progression d'apprentissage, traiter tes paiements via PayPal."
                    : "Your data is used exclusively to: create and manage your account, personalize AI-generated courses, track your learning progress, process your payments via PayPal."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">3. {lang === "fr" ? "Paiements" : "Payments"}</h3>
                  <p>{lang === "fr"
                    ? "Les paiements sont traités par PayPal. Nous ne stockons aucune donnée bancaire. PayPal gère directement les cartes bancaires (Visa, Mastercard, American Express) et les comptes PayPal."
                    : "Payments are processed by PayPal. We do not store any banking data. PayPal directly handles credit/debit cards (Visa, Mastercard, American Express) and PayPal accounts."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">4. {lang === "fr" ? "Intelligence artificielle" : "Artificial Intelligence"}</h3>
                  <p>{lang === "fr"
                    ? "Les sujets que tu saisis pour générer des cours sont envoyés à notre fournisseur d'IA. Ces sujets ne sont pas stockés au-delà de la génération du cours. Le contenu généré est stocké dans ton espace personnel."
                    : "The topics you enter to generate courses are sent to our AI provider. These topics are not stored beyond course generation. The generated content is stored in your personal space."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">5. {lang === "fr" ? "Tes droits" : "Your Rights"}</h3>
                  <p>{lang === "fr"
                    ? "Tu peux demander la suppression de ton compte et de toutes tes données à tout moment via les paramètres de ton compte."
                    : "You can request the deletion of your account and all your data at any time via your account settings."}</p>
                </div>
              </>
            )}
            {legalModal === "terms" && (
              <>
                <h2 className="text-2xl font-bold mb-6 text-foreground">{lang === "fr" ? "Conditions d'utilisation" : "Terms of Use"}</h2>
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p><strong className="text-foreground">Dernière mise à jour :</strong> {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">1. {lang === "fr" ? "Acceptation" : "Acceptance"}</h3>
                  <p>{lang === "fr"
                    ? "En utilisant Coursia, tu acceptes ces conditions. Si tu n'es pas d'accord, n'utilise pas le service."
                    : "By using Coursia, you accept these terms. If you disagree, do not use the service."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">2. {lang === "fr" ? "Description du service" : "Service Description"}</h3>
                  <p>{lang === "fr"
                    ? "Coursia est un outil d'apprentissage qui utilise l'intelligence artificielle pour générer des cours personnalisés. Les cours sont générés automatiquement et peuvent contenir des imprécisions. Coursia ne remplace pas un enseignement professionnel."
                    : "Coursia is a learning tool that uses artificial intelligence to generate personalized courses. Courses are automatically generated and may contain inaccuracies. Coursia does not replace professional instruction."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">3. {lang === "fr" ? "Abonnements et paiements" : "Subscriptions and Payments"}</h3>
                  <p>{lang === "fr"
                    ? "Les abonnements sont facturés mensuellement ou annuellement via PayPal. Tu peux annuler à tout moment. L'annulation prend effet à la fin de la période en cours. Aucun remboursement n'est effectué pour la période déjà commencée."
                    : "Subscriptions are billed monthly or annually via PayPal. You can cancel at any time. Cancellation takes effect at the end of the current period. No refund is issued for the already started period."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">4. {lang === "fr" ? "Propriété intellectuelle" : "Intellectual Property"}</h3>
                  <p>{lang === "fr"
                    ? "Le contenu généré par Coursia est destiné à un usage personnel. Tu ne peux pas le revendre, le redistribuer ou l'utiliser à des fins commerciales sans autorisation."
                    : "Content generated by Coursia is intended for personal use. You may not resell, redistribute, or use it for commercial purposes without authorization."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">5. {lang === "fr" ? "Limitation de responsabilité" : "Limitation of Liability"}</h3>
                  <p>{lang === "fr"
                    ? "Coursia est fourni « en l'état ». Nous ne garantissons pas que le contenu généré soit exempt d'erreurs. Nous ne sommes pas responsables des pertes liées à l'utilisation du service."
                    : "Coursia is provided \"as is\". We do not guarantee that generated content is error-free. We are not responsible for losses related to the use of the service."}</p>

                </div>
              </>
            )}
          </div>
        </div>
      )}

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

        /* ── Aurora Arc (Bottom Gradient) ── */
        .aurora-arc {
          background: radial-gradient(ellipse 120% 60% at 50% 120%, 
            rgba(124, 92, 191, 0.35) 0%, 
            rgba(139, 92, 246, 0.2) 25%,
            rgba(168, 85, 247, 0.15) 45%, 
            rgba(99, 102, 241, 0.1) 65%, 
            transparent 100%
          );
          filter: blur(2px);
        }

        @keyframes aurora-shift-1 {
          0%   { transform: translate(-5%, 0) scale(1); opacity: 0.6; }
          25%  { transform: translate(3%, -3%) scale(1.1); opacity: 0.8; }
          50%  { transform: translate(-2%, 2%) scale(0.95); opacity: 0.5; }
          75%  { transform: translate(4%, -1%) scale(1.05); opacity: 0.9; }
          100% { transform: translate(-5%, 0) scale(1); opacity: 0.6; }
        }

        @keyframes aurora-shift-2 {
          0%   { transform: translate(5%, 0) scale(1.05); opacity: 0.5; }
          30%  { transform: translate(-4%, -2%) scale(0.95); opacity: 0.7; }
          60%  { transform: translate(3%, 3%) scale(1.1); opacity: 0.6; }
          100% { transform: translate(5%, 0) scale(1.05); opacity: 0.5; }
        }

        @keyframes aurora-shift-3 {
          0%   { transform: translate(0, 2%) scale(1); opacity: 0.4; }
          40%  { transform: translate(-3%, -4%) scale(1.08); opacity: 0.7; }
          70%  { transform: translate(5%, -1%) scale(0.98); opacity: 0.5; }
          100% { transform: translate(0, 2%) scale(1); opacity: 0.4; }
        }

        .aurora-layer-1 {
          background: radial-gradient(ellipse 80% 50% at 30% 90%, 
            rgba(168, 85, 247, 0.25) 0%, 
            rgba(236, 72, 153, 0.12) 40%, 
            transparent 70%
          );
          animation: aurora-shift-1 8s ease-in-out infinite;
          pointer-events: none;
        }

        .aurora-layer-2 {
          background: radial-gradient(ellipse 70% 45% at 70% 85%, 
            rgba(99, 102, 241, 0.2) 0%, 
            rgba(168, 85, 247, 0.15) 35%,
            rgba(234, 179, 8, 0.06) 60%,
            transparent 85%
          );
          animation: aurora-shift-2 11s ease-in-out infinite;
          pointer-events: none;
        }

        .aurora-layer-3 {
          background: radial-gradient(ellipse 90% 55% at 50% 95%, 
            rgba(124, 92, 191, 0.18) 0%, 
            rgba(99, 102, 241, 0.1) 30%,
            rgba(168, 85, 247, 0.12) 50%,
            transparent 80%
          );
          animation: aurora-shift-3 14s ease-in-out infinite;
          pointer-events: none;
        }

        /* Floating particles in the aurora */
        @keyframes aurora-float-1 {
          0%   { transform: translate(0, 0) scale(0); opacity: 0; }
          20%  { opacity: 0.8; }
          80%  { opacity: 0.6; }
          100% { transform: translate(80px, -120px) scale(1.5); opacity: 0; }
        }
        @keyframes aurora-float-2 {
          0%   { transform: translate(0, 0) scale(0); opacity: 0; }
          25%  { opacity: 0.7; }
          75%  { opacity: 0.4; }
          100% { transform: translate(-60px, -100px) scale(1.2); opacity: 0; }
        }
        @keyframes aurora-float-3 {
          0%   { transform: translate(0, 0) scale(0); opacity: 0; }
          15%  { opacity: 0.9; }
          85%  { opacity: 0.5; }
          100% { transform: translate(50px, -80px) scale(0.8); opacity: 0; }
        }

        .aurora-particle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .aurora-particle-1 {
          width: 6px; height: 6px;
          background: rgba(168, 85, 247, 0.7);
          left: 20%; bottom: 30%;
          animation: aurora-float-1 6s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.5), 0 0 24px rgba(168, 85, 247, 0.2);
        }
        .aurora-particle-2 {
          width: 4px; height: 4px;
          background: rgba(99, 102, 241, 0.6);
          left: 55%; bottom: 25%;
          animation: aurora-float-2 8s ease-in-out infinite 1s;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.4), 0 0 20px rgba(99, 102, 241, 0.15);
        }
        .aurora-particle-3 {
          width: 5px; height: 5px;
          background: rgba(236, 72, 153, 0.5);
          left: 75%; bottom: 35%;
          animation: aurora-float-3 7s ease-in-out infinite 2s;
          box-shadow: 0 0 10px rgba(236, 72, 153, 0.4), 0 0 20px rgba(236, 72, 153, 0.15);
        }
        .aurora-particle-4 {
          width: 3px; height: 3px;
          background: rgba(234, 179, 8, 0.5);
          left: 35%; bottom: 40%;
          animation: aurora-float-1 9s ease-in-out infinite 3s;
          box-shadow: 0 0 8px rgba(234, 179, 8, 0.4);
        }
        .aurora-particle-5 {
          width: 4px; height: 4px;
          background: rgba(168, 85, 247, 0.6);
          left: 65%; bottom: 20%;
          animation: aurora-float-2 10s ease-in-out infinite 4s;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.4), 0 0 20px rgba(168, 85, 247, 0.15);
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        @keyframes fade-in-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-slide-up { animation: fade-in-slide-up 0.35s ease-out; }
      `}</style>
    </div>
  );
}
