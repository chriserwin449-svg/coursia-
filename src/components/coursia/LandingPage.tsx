"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain, Cpu, Palette, TrendingUp,
  Sparkles, BookOpen, ArrowRight, Check, Crown, Zap, ChevronDown,
  LogIn, GraduationCap, Briefcase, Lightbulb, BarChart3, Star,
  Settings, Globe, X, Flame, Trophy, Layers, MessageSquare, Lock,
  Search, Frown,
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

  // Typewriter & floating cards need heroVisible
  const [heroVisible, setHeroVisible] = useState(false);

  // Typewriter state
  const [typedCount, setTypedCount] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Comparison card state
  const [activeComparison, setActiveComparison] = useState<'avec' | 'sans'>('avec');
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      const sections = document.querySelectorAll('.lp-section');
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              if (entry.target.id === 'hero') setHeroVisible(true);
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.25 }
      );
      sections.forEach((s) => observer.observe(s));
    }, 100);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Parallax effect for hero background elements + background collage
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          // Hero glows (existing)
          const glow = document.getElementById('hero-glow');
          if (glow) glow.style.transform = `translate(-50%, ${y * 0.1}px)`;
          const grid = document.getElementById('hero-grid');
          if (grid) grid.style.transform = `translateY(${y * 0.04}px)`;
          // Background collage parallax
          const collage = document.getElementById('bg-collage');
          if (collage) {
            const imgs = collage.querySelectorAll('.study-bg-img');
            imgs.forEach((img, i) => {
              const speed = 0.03 + (i * 0.015);
              (img as HTMLElement).style.transform = `translateY(${y * speed}px)`;
            });
            const halos = collage.querySelectorAll('.bg-halo');
            halos.forEach((h, i) => {
              const speed = 0.02 + (i * 0.01);
              (h as HTMLElement).style.transform = `translateY(${y * speed}px)`;
            });
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cycling timer for comparison card
  useEffect(() => {
    if (isHovering) return;
    const interval = setInterval(() => {
      setActiveComparison(prev => prev === 'avec' ? 'sans' : 'avec');
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovering]);

  // Typewriter logic
  const heading1 = tx.landing.heroHeading1;
  const heading2 = tx.landing.heroHeading2;
  const fullHeading = heading1 + "|" + heading2;
  const typingDone = typedCount >= fullHeading.length;
  useEffect(() => {
    if (!heroVisible || typingDone) return;
    const timer = setTimeout(() => setTypedCount((c) => c + 1), 30);
    return () => clearTimeout(timer);
  }, [heroVisible, typedCount, fullHeading.length, typingDone]);

  const typedPart = fullHeading.slice(0, typedCount);
  const splitIdx = typedPart.indexOf("|");
  const line1 = splitIdx === -1 ? typedPart : typedPart.slice(0, splitIdx);
  const line2 = splitIdx === -1 ? "" : typedPart.slice(splitIdx + 1);
  const showCursor = !typingDone;

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

  // Floating cards data
  const floatingCards = [
    {
      title: lang === "fr" ? "Intelligence Artificielle" : "Artificial Intelligence",
      icon: Brain,
      progress: 78,
      isGenerating: true,
      floatClass: "hero-float-1",
      style: { top: "0px", left: "5%", width: "280px" },
    },
    {
      title: "Machine Learning",
      icon: Cpu,
      progress: 92,
      isGenerating: false,
      floatClass: "hero-float-2",
      style: { top: "180px", left: "55%", width: "240px" },
    },
    {
      title: lang === "fr" ? "Design UX/UI" : "UX/UI Design",
      icon: Palette,
      progress: 65,
      isGenerating: false,
      floatClass: "hero-float-3",
      style: { top: "320px", left: "0%", width: "240px" },
    },
    {
      title: lang === "fr" ? "Marketing Digital" : "Digital Marketing",
      icon: TrendingUp,
      progress: 84,
      isGenerating: false,
      floatClass: "hero-float-4",
      style: { top: "410px", left: "50%", width: "200px" },
    },
  ];

  // JSON-LD structured data
  const SITE_URL = "https://coursia.app";
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": tx.landing.faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-night flex flex-col overflow-x-hidden">
      {/* JSON-LD: FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Background Study Environment Collage ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" id="bg-collage">
        <img src="/images/bg/study-books.png" alt="" className="absolute study-bg-img" style={{ top: '5%', left: '-5%', width: '35%', transform: 'rotate(-3deg)' }} />
        <img src="/images/bg/study-laptop.png" alt="" className="absolute study-bg-img" style={{ top: '15%', right: '-8%', width: '40%', transform: 'rotate(2deg)' }} />
        <img src="/images/bg/study-coffee.png" alt="" className="absolute study-bg-img" style={{ top: '40%', left: '10%', width: '30%', transform: 'rotate(-1.5deg)' }} />
        <img src="/images/bg/study-materials.png" alt="" className="absolute study-bg-img" style={{ top: '55%', right: '5%', width: '35%', transform: 'rotate(1deg)' }} />
        <img src="/images/bg/study-backpack.png" alt="" className="absolute study-bg-img" style={{ top: '75%', left: '25%', width: '30%', transform: 'rotate(-2deg)' }} />

        {/* Dark overlay on top of everything */}
        <div className="absolute inset-0 bg-night/85" />

        {/* Parallax halos */}
        <div className="bg-halo bg-halo-1" />
        <div className="bg-halo bg-halo-2" />
        <div className="bg-halo bg-halo-3" />
      </div>

      {/* ===== FLOATING PILL NAVBAR ===== */}
      <nav aria-label="Navigation principale" className={`fixed top-4 left-0 right-0 z-50 transition-all duration-500 px-4 sm:px-6`}>
        <div className={`max-w-[900px] mx-auto flex items-center justify-between ${scrolled ? 'bg-night/80 backdrop-blur-2xl shadow-2xl shadow-black/20 border border-white/[0.08]' : 'bg-night/60 backdrop-blur-xl shadow-lg shadow-black/10 border border-white/[0.06]'} rounded-full ${scrolled ? 'px-5 py-2.5' : 'px-6 py-3'} transition-all duration-500`}>
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <CoursiaLogo size={32} className="rounded-lg" />
            <span className="font-extrabold text-foreground text-lg tracking-tight hidden sm:inline">{tx.app.name}</span>
          </div>

          {/* Center nav links (desktop) */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }} className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors duration-200">
              {tx.landing.navFeatures}
            </a>
            <a href="#audience" onClick={(e) => { e.preventDefault(); scrollTo("audience"); }} className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors duration-200">
              {tx.landing.heroNavHow}
            </a>
            <a href="#compare" onClick={(e) => { e.preventDefault(); scrollTo("compare"); }} className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors duration-200">
              {lang === "fr" ? "Comparaison" : "Comparison"}
            </a>
          </div>

          {/* Right: lang toggle + CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              title={lang === "fr" ? "Switch to English" : "Passer en Français"}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer text-sm font-semibold"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{lang.toUpperCase()}</span>
            </button>
            <button
              onClick={() => user ? setView("create") : setView("auth")}
              className="hidden sm:flex hero-premium-btn px-5 py-2 rounded-full text-white text-sm font-bold cursor-pointer items-center gap-1.5"
            >
              <span className="relative z-10">{tx.landing.startFree}</span>
              <ArrowRight className="w-3.5 h-3.5 relative z-10" />
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section id="hero" className="lp-section relative overflow-hidden min-h-screen flex items-center px-4 pt-28 pb-20">
        {/* Grid + Halos */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div id="hero-grid" className="absolute inset-0 hero-grid"></div>
          <div id="hero-glow" className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-600/20" style={{ filter: "blur(150px)", transform: 'translate(-50%, 0)' }}></div>
          <div className="absolute -top-20 -right-40 w-80 h-80 rounded-full bg-orange-400/15" style={{ filter: "blur(150px)" }}></div>
          <div className="absolute top-1/3 left-1/4 w-56 h-56 rounded-full bg-violet-500/10" style={{ filter: "blur(120px)" }}></div>
          <div className="absolute bottom-1/4 right-1/3 w-40 h-40 rounded-full bg-amber-500/8" style={{ filter: "blur(100px)" }}></div>
          <div className="absolute top-2/3 right-1/5 w-28 h-28 rounded-full bg-pink-500/7" style={{ filter: "blur(80px)" }}></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* LEFT COLUMN */}
          <div>
            {/* AI Badge */}
            <div className="lp-stagger inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-mauve/10 border border-mauve/20 text-sm text-mauve-light font-semibold mb-8" style={{ transitionDelay: '0ms' }}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tx.landing.poweredBy}</span>
            </div>

            {/* Title — typewriter */}
            <h1 className="lp-stagger text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight min-h-[2.4em] sm:min-h-[2.2em]" style={{ transitionDelay: '120ms' }}>
              <span className="text-foreground">{line1}</span>
              {line2 && (
                <>
                  <br />
                  <span className="hero-gradient-text">{line2}</span>
                </>
              )}
              {showCursor && <span className="hero-typewriter-cursor" />}
            </h1>

            {/* Description */}
            <p className="lp-stagger text-lg sm:text-xl text-muted-foreground/80 mb-8 max-w-lg leading-relaxed" style={{ transitionDelay: '240ms' }}>
              {tx.landing.heroSubtitleAlt}
            </p>

            {/* CTA Button */}
            <div className="lp-stagger max-w-md mb-8" style={{ transitionDelay: '360ms' }}>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="hero-premium-btn w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-base whitespace-nowrap cursor-pointer"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {tx.landing.startFree}
                  <ArrowRight className="w-5 h-5" />
                </span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN — Floating Cards (desktop only) */}
          <div className="relative hidden lg:block h-[520px] overflow-hidden">
            {floatingCards.map((card, i) => (
              <motion.div
                key={card.title}
                className={`absolute ${card.floatClass}`}
                style={card.style}
                initial={{ opacity: 0, y: 40 }}
                animate={heroVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.7, delay: 0.4 + i * 0.12, ease: "easeOut" }}
              >
                <div className="bg-night-light/80 backdrop-blur-sm border border-mauve/[0.15] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_1px_rgba(124,92,191,0.2)]">
                  {/* Generating badge (only for first card) */}
                  {card.isGenerating && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mauve/10 border border-mauve/20 text-[11px] text-mauve-light font-semibold mb-3">
                      <span>{tx.landing.heroAiGenerating}</span>
                      <span className="flex items-center gap-0.5 ml-1">
                        <span className="hero-dot-1 w-1.5 h-1.5 rounded-full bg-mauve-light inline-block" />
                        <span className="hero-dot-2 w-1.5 h-1.5 rounded-full bg-mauve-light inline-block" />
                        <span className="hero-dot-3 w-1.5 h-1.5 rounded-full bg-mauve-light inline-block" />
                      </span>
                    </div>
                  )}

                  {/* Card header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0">
                      <card.icon className="w-4.5 h-4.5 text-mauve-light" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground leading-tight">{card.title}</h3>
                  </div>

                  {/* Progress bar (not for generating card) */}
                  {!card.isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground/60 font-medium">
                          {lang === "fr" ? "Progression" : "Progress"}
                        </span>
                        <span className="text-[11px] text-mauve-light font-bold">{card.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-mauve to-mauve-light transition-all duration-1000"
                          style={{ width: heroVisible ? `${card.progress}%` : "0%", transitionDelay: `${0.8 + i * 0.15}s` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Spinning circle loader (for generating card) */}
                  {card.isGenerating && (
                    <div className="flex items-center justify-center pt-1">
                      <svg className="hero-circle-loader w-8 h-8" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeDasharray="66 22" />
                      </svg>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY CHOOSE SECTION ===== */}
      <section id="features" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="lp-stagger text-center mb-16" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {tx.landing.whyChooseTitle}{" "}
              <span className="gradient-text">{tx.landing.whyChooseHighlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.whyChooseDesc}
            </p>
          </div>

          <div className="lp-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" style={{ transitionDelay: '120ms' }}>
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
      <section id="audience" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-gold/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="lp-stagger text-center mb-16" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {tx.landing.whoForTitle}{" "}
              <span className="gradient-text">{tx.app.name}</span>{" "}
              {tx.landing.whoForTitleEnd}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.whoForDesc}
            </p>
          </div>

          <div className="lp-stagger grid grid-cols-1 md:grid-cols-3 gap-6" style={{ transitionDelay: '120ms' }}>
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
      <section id="diff" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="lp-stagger text-center mb-16" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              <span className="gradient-text">{(tx.landing as Record<string, unknown>).diffTitle as string}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {(tx.landing as Record<string, unknown>).diffDesc as string}
            </p>
          </div>
          <div className="lp-stagger grid grid-cols-1 md:grid-cols-3 gap-6" style={{ transitionDelay: '120ms' }}>
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

      {/* ===== AVEC / SANS COURSIA ===== */}
      <section id="compare" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="lp-stagger text-center mb-12" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              <span className="gradient-text">{lang === "fr" ? "La Différence est Claire" : "The Difference is Clear"}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {lang === "fr" ? "Découvrez comment Coursia transforme votre apprentissage" : "See how Coursia transforms your learning"}
            </p>
          </div>

          {/* Cycling comparison card */}
          <div className="lp-stagger flex justify-center" style={{ transitionDelay: '120ms' }}>
            <div
              className="glass rounded-3xl overflow-hidden w-full max-w-2xl comparison-card-hover transition-all duration-500 cursor-default"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div className="p-8 sm:p-10">
                {/* Header with label */}
                <div className="flex items-center justify-center mb-8">
                  <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-500 ${activeComparison === 'avec' ? 'bg-mauve/15 text-mauve-light border border-mauve/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {activeComparison === 'avec' ? <Sparkles className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {activeComparison === 'avec' ? (lang === "fr" ? "Avec Coursia" : "With Coursia") : (lang === "fr" ? "Sans Coursia" : "Without Coursia")}
                  </div>
                </div>

                {/* Content area */}
                <div className="relative min-h-[220px]">
                  {/* Avec Coursia content */}
                  <div className={`comparison-content ${activeComparison === 'avec' ? 'comp-active' : 'comp-exit'}`}>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Brain className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-1">{lang === "fr" ? "Cours personnalisés par IA" : "AI-personalized courses"}</h4>
                          <p className="text-sm text-muted-foreground">{lang === "fr" ? "L'intelligence artificielle crée un cours unique adapté à votre niveau et vos objectifs." : "AI creates a unique course tailored to your level and goals."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <TrendingUp className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-1">{lang === "fr" ? "Progression structurée" : "Structured progression"}</h4>
                          <p className="text-sm text-muted-foreground">{lang === "fr" ? "Des chapitres organisés, des quiz interactifs et un suivi de niveau Débutant → Avancé." : "Organized chapters, interactive quizzes, and Beginner → Advanced tracking."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-1">{lang === "fr" ? "Résultats en quelques minutes" : "Results in minutes"}</h4>
                          <p className="text-sm text-muted-foreground">{lang === "fr" ? "Pas besoin de chercher. Décrivez votre sujet et commencez à apprendre immédiatement." : "No need to search. Describe your topic and start learning immediately."}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sans Coursia content */}
                  <div className={`comparison-content ${activeComparison === 'sans' ? 'comp-active' : 'comp-exit'}`}>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Search className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-1">{lang === "fr" ? "Heures de recherche" : "Hours of searching"}</h4>
                          <p className="text-sm text-muted-foreground">{lang === "fr" ? "Parcourir des centaines de vidéos YouTube et articles sans fil conducteur." : "Browsing hundreds of YouTube videos and articles with no guidance."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-1">{lang === "fr" ? "Aucun suivi" : "No tracking"}</h4>
                          <p className="text-sm text-muted-foreground">{lang === "fr" ? "Pas de progression visible, pas de quiz, pas de validation de vos acquis." : "No visible progression, no quizzes, no validation of your knowledge."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Frown className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-1">{lang === "fr" ? "Contenu générique" : "Generic content"}</h4>
                          <p className="text-sm text-muted-foreground">{lang === "fr" ? "Des cours faits pour tout le monde mais adaptés à personne en particulier." : "Courses made for everyone but tailored to no one in particular."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section id="faq" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="lp-stagger text-center mb-14" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              <span className="gradient-text">{tx.landing.faqTitle}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tx.landing.faqSubtitle}
            </p>
          </div>
          <div className="lp-stagger space-y-4" style={{ transitionDelay: '120ms' }}>
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

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 border-t border-muted-foreground/10 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CoursiaLogo size={32} className="rounded-xl" />
            <span className="font-bold text-sm text-foreground">{tx.app.name}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => useAppStore.getState().setLegalPage("privacy")}
              className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              {(tx.landing as Record<string, unknown>).privacy as string}
            </button>
            <span className="text-muted-foreground/20">·</span>
            <button
              onClick={() => useAppStore.getState().setLegalPage("terms")}
              className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              {(tx.landing as Record<string, unknown>).terms as string}
            </button>

          </div>
          <p className="text-xs text-muted-foreground/40">{(tx.landing as Record<string, unknown>).footer as string}</p>
        </div>
      </footer>

      {/* ===== COMPONENT STYLES ===== */}
      <style jsx global>{`
        /* ── Premium Scroll Reveal ── */
        .lp-stagger {
          opacity: 0;
          transform: translateY(60px) scale(0.98);
          transition: 
            opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity;
        }
        .revealed .lp-stagger {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-stagger {
            opacity: 1;
            transform: none;
            transition: none;
            will-change: auto;
          }
        }

        /* ── Glass Card Micro-interactions ── */
        .glass {
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.35s ease;
        }
        .glass:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 1px rgba(124,92,191,0.2), 0 0 20px rgba(124,92,191,0.05);
          border-color: rgba(124,92,191,0.3);
        }

        /* ── Comparison Card Hover ── */
        .comparison-card-hover:hover {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 25px 50px rgba(0,0,0,0.35), 0 0 1px rgba(124,92,191,0.3), 0 0 30px rgba(124,92,191,0.08);
          border-color: rgba(124,92,191,0.4);
        }

        /* ── Comparison Content Switching ── */
        .comparison-content {
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .comp-active {
          opacity: 1;
          transform: translateY(0);
          position: relative;
        }
        .comp-exit {
          opacity: 0;
          transform: translateY(10px);
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        /* ── Background Study Images ── */
        .study-bg-img {
          object-fit: cover;
          filter: blur(12px) saturate(0.2) brightness(0.35) contrast(0.7);
          opacity: 0.08;
        }

        /* ── Parallax Halos ── */
        .bg-halo {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .bg-halo-1 {
          top: -10%; left: 30%; width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(124,92,191,0.15) 0%, transparent 70%);
          filter: blur(80px);
          will-change: transform;
        }
        .bg-halo-2 {
          top: 30%; right: -5%; width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%);
          filter: blur(60px);
          will-change: transform;
        }
        .bg-halo-3 {
          top: 60%; left: 10%; width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%);
          filter: blur(70px);
          will-change: transform;
        }

        /* ── Floating card animations (reduced amplitude) ── */
        @keyframes hero-float-1 {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(-1deg); }
        }
        @keyframes hero-float-2 {
          0%, 100% { transform: translateY(0) rotate(1.5deg); }
          50% { transform: translateY(-8px) rotate(1.5deg); }
        }
        @keyframes hero-float-3 {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
        @keyframes hero-float-4 {
          0%, 100% { transform: translateY(0) rotate(1deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }

        /* ── Utility animations ── */
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