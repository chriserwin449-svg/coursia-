"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Cpu, Palette, TrendingUp,
  Sparkles, BookOpen, ArrowRight, Check, Crown, Zap,
  LogIn, GraduationCap, Briefcase, Lightbulb, BarChart3, Star,
  Settings, Globe, X, Flame, Trophy, Layers, MessageSquare, Lock,
  Search, Frown, Menu, Heart, Share2, Play, ChevronLeft, ChevronRight, MessageCircle, Send,
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
  const setRandomTopic = useAppStore((s) => s.setRandomTopic);
  const setRandomCourseLang = useAppStore((s) => s.setRandomCourseLang);

  // Typewriter & floating cards need heroVisible
  const [heroVisible, setHeroVisible] = useState(false);

  // Typewriter state
  const [typedCount, setTypedCount] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Topic input for generate CTA
  const [topicInput, setTopicInput] = useState("");

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

  // Parallax effect for hero background elements only
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          const glow = document.getElementById('hero-glow');
          if (glow) glow.style.transform = `translate(-50%, ${y * 0.1}px)`;
          const grid = document.getElementById('hero-grid');
          if (grid) grid.style.transform = `translateY(${y * 0.04}px)`;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Testimonials data — fun/cool comments (emojis only on 2 specific comments)
  const testimonials = lang === "fr" ? [
    { name: "Aminata K.", region: "Kinshasa", stars: 5, text: "Les cours sont trop stylés, j'ai tout pigé en 20 minutes 😂" },
    { name: "Lucas M.", region: "Paris", stars: 5, text: "La gestion des points c'est grave addictive, j'peux plus m'arrêter" },
    { name: "Fatou S.", region: "Dakar", stars: 5, text: "J'ai impressionné mon prof avec un cours sur la mécanique quantique" },
    { name: "Youssef B.", region: "Casablanca", stars: 4, text: "C'est bien mais j'voudrais plus de cours sur le foot" },
    { name: "Chloé D.", region: "Bruxelles", stars: 5, text: "Les quiz sont un game changer, même ma mère l'utilise 😅" },
    { name: "Kofi A.", region: "Abidjan", stars: 5, text: "J'ai généré 47 cours ce mois... oui j'ai un problème" },
    { name: "Inès R.", region: "Tunis", stars: 5, text: "Les chapitres sont bien structurés, style Netflix mais pour apprendre" },
    { name: "Jules P.", region: "Lyon", stars: 4, text: "Cours sur la crypto généré en 3 minutes, mon banquier est jaloux" },
    { name: "Aïcha N.", region: "Bamako", stars: 5, text: "Mieux que mes cours à la fac, et c'est pas peu dire" },
    { name: "Olivier T.", region: "Genève", stars: 5, text: "J'ai partagé un cours avec tout mon équipe, ils sont addicts aussi" },
    { name: "Mariama F.", region: "Yaoundé", stars: 4, text: "L'IA comprend même quand j'écris mal, c'est magique" },
    { name: "Théo L.", region: "Montréal", stars: 5, text: "10/10 je recommande, même mon chien a appris des trucs" },
  ] : [
    { name: "Aminata K.", region: "Kinshasa", stars: 5, text: "The courses are so dope, I got it all in 20 minutes 😂" },
    { name: "Lucas M.", region: "Paris", stars: 5, text: "The points system is seriously addictive, I can't stop" },
    { name: "Fatou S.", region: "Dakar", stars: 5, text: "Impressed my professor with a quantum mechanics course" },
    { name: "Youssef B.", region: "Casablanca", stars: 4, text: "It's cool but I want more football courses" },
    { name: "Chloé D.", region: "Brussels", stars: 5, text: "The quizzes are a game changer, even my mom uses it 😅" },
    { name: "Kofi A.", region: "Abidjan", stars: 5, text: "Generated 47 courses this month... yes I have a problem" },
    { name: "Inès R.", region: "Tunis", stars: 5, text: "Chapters are well structured, like Netflix but for learning" },
    { name: "Jules P.", region: "Lyon", stars: 4, text: "Crypto course generated in 3 minutes, my banker is jealous" },
    { name: "Aïcha N.", region: "Bamako", stars: 5, text: "Better than my university lectures, and that's saying a lot" },
    { name: "Olivier T.", region: "Geneva", stars: 5, text: "Shared a course with my whole team, they're addicted too" },
    { name: "Mariama F.", region: "Yaoundé", stars: 4, text: "The AI understands even when I write badly, it's magic" },
    { name: "Théo L.", region: "Montreal", stars: 5, text: "10/10 I recommend, even my dog learned things" },
  ];
  const testimonialsRow1 = testimonials.slice(0, 6);
  const testimonialsRow2 = testimonials.slice(6, 12);

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

  // Floating cards data — positions adjusted so animations don't overflow
  const floatingCards = [
    {
      title: lang === "fr" ? "Intelligence Artificielle" : "Artificial Intelligence",
      icon: Brain,
      progress: 78,
      isGenerating: true,
      floatClass: "hero-float-1",
      style: { top: "20px", left: "5%", width: "280px" },
    },
    {
      title: "Machine Learning",
      icon: Cpu,
      progress: 92,
      isGenerating: false,
      floatClass: "hero-float-2",
      style: { top: "200px", left: "48%", width: "240px" },
    },
    {
      title: lang === "fr" ? "Design UX/UI" : "UX/UI Design",
      icon: Palette,
      progress: 65,
      isGenerating: false,
      floatClass: "hero-float-3",
      style: { top: "340px", left: "2%", width: "240px" },
    },
    {
      title: lang === "fr" ? "Marketing Digital" : "Digital Marketing",
      icon: TrendingUp,
      progress: 84,
      isGenerating: false,
      floatClass: "hero-float-4",
      style: { top: "440px", left: "40%", width: "200px" },
    },
  ];

  // Quick topic tags for generate CTA
  const quickTopics = lang === "fr"
    ? ["Python", "Marketing", "Finance", "Design UI", "Anglais", "Business"]
    : ["Python", "Marketing", "Finance", "UI Design", "English", "Business"];

  // TikTok-style trend conversations — viral social proof
  const trendConversations = lang === "fr" ? [
    {
      id: 1,
      username: "@tentafruits",
      displayName: "Tentafruits",
      avatarEmoji: "🎵",
      verified: true,
      time: "2h",
      likes: "24.5K",
      shares: "1.2K",
      comments: "843",
      topicBadge: "Piano",
      topicColor: "from-pink-500 to-rose-500",
      messages: [
        { sender: "ami", name: "Kayss", avatar: "😏", text: "Wait tu as appris le piano en 2h?? 😳" },
        { sender: "self", name: "Tenta", avatar: "🎵", text: "Grâce à Coursia frérot, l'IA m'a fait un cours sur mesure" },
        { sender: "ami", name: "Kayss", avatar: "😏", text: "Mais c'est un joke?? Donne-moi le lien bg" },
        { sender: "self", name: "Tenta", avatar: "🎵", text: "coursia.app — et c'est GRATUIT pour le premier cours 💀🔥" },
      ],
    },
    {
      id: 2,
      username: "@leoduvod",
      displayName: "Leo Du VoD",
      avatarEmoji: "🎬",
      verified: true,
      time: "4h",
      likes: "18.2K",
      shares: "890",
      comments: "567",
      topicBadge: "Montage Vidéo",
      topicColor: "from-orange-500 to-amber-500",
      messages: [
        { sender: "ami", name: "Mehdi", avatar: "🎥", text: "Tes montages sont devenus dingues depuis quand ??" },
        { sender: "self", name: "Leo", avatar: "🎬", text: "J'ai généré un cours de montage sur Coursia, 15 chapitres de ouf" },
        { sender: "ami", name: "Mehdi", avatar: "🎥", text: "Envoie le lien direct stp j'ai un projet qui bloque" },
        { sender: "self", name: "Leo", avatar: "🎬", text: "coursia.app tape 'montage vidéo pro' et c'est parti 🚀" },
      ],
    },
    {
      id: 3,
      username: "@amina_cooks",
      displayName: "Amina Cooks",
      avatarEmoji: "👨‍🍳",
      verified: false,
      time: "6h",
      likes: "12.8K",
      shares: "654",
      comments: "421",
      topicBadge: "Pâtisserie",
      topicColor: "from-amber-500 to-yellow-500",
      messages: [
        { sender: "ami", name: "Fatou", avatar: "🧁", text: "D WHERE est-ce que tu as appris à faire cette tente ??" },
        { sender: "self", name: "Amina", avatar: "👨‍🍳", text: "Coursia m'a donné un cours pâtisserie de 0 à avancé en 30 sec 😭❤️" },
        { sender: "ami", name: "Fatou", avatar: "🧁", text: "Non j'y crois pas teste pour moi" },
        { sender: "self", name: "Amina", avatar: "👨‍🍳", text: "Je suis sérieuse coursia.app le premier cours est gratuit essaie !" },
      ],
    },
    {
      id: 4,
      username: "@devkarim",
      displayName: "Karim Dev",
      avatarEmoji: "💻",
      verified: true,
      time: "8h",
      likes: "31.4K",
      shares: "2.1K",
      comments: "1.2K",
      topicBadge: "Python",
      topicColor: "from-emerald-500 to-teal-500",
      messages: [
        { sender: "ami", name: "Yass", avatar: "📱", text: "Bro tu codes en Python maintenant?? Depuis quand ??" },
        { sender: "self", name: "Karim", avatar: "💻", text: "Depuis la semaine dernière 😂 j'ai généré un cours sur Coursia" },
        { sender: "ami", name: "Yass", avatar: "📱", text: "Mashallah c'est quoi cette IA j'veux tester" },
        { sender: "self", name: "Karim", avatar: "💻", text: "coursia.app tape ton sujet et boum tu as un cours complet 💻🔥" },
      ],
    },
    {
      id: 5,
      username: "@sarah_art",
      displayName: "Sarah Art",
      avatarEmoji: "🎨",
      verified: false,
      time: "10h",
      likes: "9.7K",
      shares: "432",
      comments: "298",
      topicBadge: "Design",
      topicColor: "from-violet-500 to-purple-500",
      messages: [
        { sender: "ami", name: "Léa", avatar: "✨", text: "Tes designs sont devenues professionnelles c'est fou !" },
        { sender: "self", name: "Sarah", avatar: "🎨", text: "Coursia m'a appris les bases du design en un soir 😅" },
        { sender: "ami", name: "Léa", avatar: "✨", text: "J'veux le même truc c'est payant ??" },
        { sender: "self", name: "Sarah", avatar: "🎨", text: "Non le premier cours est GRATUIT coursia.app 🤩" },
      ],
    },
    {
      id: 6,
      username: "@mo_taxi",
      displayName: "Mo Taxi",
      avatarEmoji: "🚕",
      verified: false,
      time: "12h",
      likes: "7.3K",
      shares: "312",
      comments: "187",
      topicBadge: "Finance",
      topicColor: "from-green-500 to-emerald-500",
      messages: [
        { sender: "ami", name: "Bado", avatar: "💰", text: "Comment tu gères ton argent comme ça bg ??" },
        { sender: "self", name: "Mo", avatar: "🚕", text: "J'ai pris un cours de finance perso sur Coursia frérot" },
        { sender: "ami", name: "Bado", avatar: "💰", text: "Envoie ça direct j'ai besoin d'aide sérieux" },
        { sender: "self", name: "Mo", avatar: "🚕", text: "coursia.app tape 'gestion budget' et tu seras étonné 📊" },
      ],
    },
  ] : [
    {
      id: 1,
      username: "@tentafruits",
      displayName: "Tentafruits",
      avatarEmoji: "🎵",
      verified: true,
      time: "2h",
      likes: "24.5K",
      shares: "1.2K",
      comments: "843",
      topicBadge: "Piano",
      topicColor: "from-pink-500 to-rose-500",
      messages: [
        { sender: "ami", name: "Kayss", avatar: "😏", text: "Wait you learned piano in 2 hours?? 😳" },
        { sender: "self", name: "Tenta", avatar: "🎵", text: "Thanks to Coursia bro, the AI made me a custom course" },
        { sender: "ami", name: "Kayss", avatar: "😏", text: "No way, send me the link" },
        { sender: "self", name: "Tenta", avatar: "🎵", text: "coursia.app — and the first course is FREE 💀🔥" },
      ],
    },
    {
      id: 2,
      username: "@leoduvod",
      displayName: "Leo Du VoD",
      avatarEmoji: "🎬",
      verified: true,
      time: "4h",
      likes: "18.2K",
      shares: "890",
      comments: "567",
      topicBadge: "Video Editing",
      topicColor: "from-orange-500 to-amber-500",
      messages: [
        { sender: "ami", name: "Mehdi", avatar: "🎥", text: "Your edits have gotten insane since when??" },
        { sender: "self", name: "Leo", avatar: "🎬", text: "I generated a video editing course on Coursia, 15 crazy chapters" },
        { sender: "ami", name: "Mehdi", avatar: "🎥", text: "Send me the link I have a project stuck" },
        { sender: "self", name: "Leo", avatar: "🎬", text: "coursia.app type 'pro video editing' and you're set 🚀" },
      ],
    },
    {
      id: 3,
      username: "@amina_cooks",
      displayName: "Amina Cooks",
      avatarEmoji: "👨‍🍳",
      verified: false,
      time: "6h",
      likes: "12.8K",
      shares: "654",
      comments: "421",
      topicBadge: "Pastry",
      topicColor: "from-amber-500 to-yellow-500",
      messages: [
        { sender: "ami", name: "Fatou", avatar: "🧁", text: "WHERE did you learn to bake that?? 😱" },
        { sender: "self", name: "Amina", avatar: "👨‍🍳", text: "Coursia gave me a pastry course from 0 to advanced in 30 sec 😭❤️" },
        { sender: "ami", name: "Fatou", avatar: "🧁", text: "No way try it for me" },
        { sender: "self", name: "Amina", avatar: "👨‍🍳", text: "I'm serious coursia.app first course is free try it!" },
      ],
    },
    {
      id: 4,
      username: "@devkarim",
      displayName: "Karim Dev",
      avatarEmoji: "💻",
      verified: true,
      time: "8h",
      likes: "31.4K",
      shares: "2.1K",
      comments: "1.2K",
      topicBadge: "Python",
      topicColor: "from-emerald-500 to-teal-500",
      messages: [
        { sender: "ami", name: "Yass", avatar: "📱", text: "Bro you code in Python now?? Since when??" },
        { sender: "self", name: "Karim", avatar: "💻", text: "Since last week 😂 I generated a course on Coursia" },
        { sender: "ami", name: "Yass", avatar: "📱", text: "Wow what AI is this I want to try" },
        { sender: "self", name: "Karim", avatar: "💻", text: "coursia.app type your topic and boom you get a full course 💻🔥" },
      ],
    },
    {
      id: 5,
      username: "@sarah_art",
      displayName: "Sarah Art",
      avatarEmoji: "🎨",
      verified: false,
      time: "10h",
      likes: "9.7K",
      shares: "432",
      comments: "298",
      topicBadge: "Design",
      topicColor: "from-violet-500 to-purple-500",
      messages: [
        { sender: "ami", name: "Lea", avatar: "✨", text: "Your designs have gotten so professional!" },
        { sender: "self", name: "Sarah", avatar: "🎨", text: "Coursia taught me design basics in one evening 😅" },
        { sender: "ami", name: "Lea", avatar: "✨", text: "I want the same thing is it paid??" },
        { sender: "self", name: "Sarah", avatar: "🎨", text: "No the first course is FREE coursia.app 🤩" },
      ],
    },
    {
      id: 6,
      username: "@mo_taxi",
      displayName: "Mo Taxi",
      avatarEmoji: "🚕",
      verified: false,
      time: "12h",
      likes: "7.3K",
      shares: "312",
      comments: "187",
      topicBadge: "Finance",
      topicColor: "from-green-500 to-emerald-500",
      messages: [
        { sender: "ami", name: "Bado", avatar: "💰", text: "How do you manage your money like that bro??" },
        { sender: "self", name: "Mo", avatar: "🚕", text: "I took a personal finance course on Coursia" },
        { sender: "ami", name: "Bado", avatar: "💰", text: "Send it directly I seriously need help" },
        { sender: "self", name: "Mo", avatar: "🚕", text: "coursia.app type 'budget management' and you'll be amazed 📊" },
      ],
    },
  ];

  // Carousel state for TikTok trends
  const [activeTrendIndex, setActiveTrendIndex] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTrendIndex((prev) => (prev + 1) % trendConversations.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [trendConversations.length]);

  const scrollTrendTo = (direction: 'left' | 'right') => {
    setActiveTrendIndex((prev) => {
      if (direction === 'left') return prev === 0 ? trendConversations.length - 1 : prev - 1;
      return (prev + 1) % trendConversations.length;
    });
  };

  const handleGenerateFromLP = () => {
    if (topicInput.trim()) {
      useAppStore.getState().setRandomTopic(topicInput.trim());
      useAppStore.getState().setRandomCourseLang(lang);
    }
    if (user) {
      setView("create");
    } else {
      setView("auth");
    }
  };

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
            <a href="#trends" onClick={(e) => { e.preventDefault(); scrollTo("trends"); }} className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors duration-200">
              {lang === "fr" ? "Tendances" : "Trends"}
            </a>
          </div>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-all duration-200 cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>

          {/* Right: lang toggle + CTA (desktop) */}
          <div className="hidden md:flex items-center gap-2">
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
              className="hero-premium-btn px-5 py-2 rounded-full text-white text-sm font-bold cursor-pointer items-center gap-1.5"
            >
              <span className="relative z-10">{tx.landing.startFree}</span>
              <ArrowRight className="w-3.5 h-3.5 relative z-10" />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden md:hidden"
            >
              <div className="mt-2 mx-2 bg-night/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/30 p-2">
                <a
                  href="#features"
                  onClick={(e) => { e.preventDefault(); scrollTo("features"); setMobileMenuOpen(false); }}
                  className="block px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  {tx.landing.navFeatures}
                </a>
                <a
                  href="#audience"
                  onClick={(e) => { e.preventDefault(); scrollTo("audience"); setMobileMenuOpen(false); }}
                  className="block px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  {tx.landing.heroNavHow}
                </a>
                <a
                  href="#compare"
                  onClick={(e) => { e.preventDefault(); scrollTo("compare"); setMobileMenuOpen(false); }}
                  className="block px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  {lang === "fr" ? "Comparaison" : "Comparison"}
                </a>
                <a
                  href="#trends"
                  onClick={(e) => { e.preventDefault(); scrollTo("trends"); setMobileMenuOpen(false); }}
                  className="block px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  {lang === "fr" ? "Tendances" : "Trends"}
                </a>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setView("offers"); setMobileMenuOpen(false); }}
                  className="block px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  {tx.nav.offers}
                </a>
                <a
                  href="mailto:hellocoursia@gmail.com?subject=Support%20Coursia"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  {lang === "fr" ? "Nous contacter" : "Contact us"}
                </a>
                <div className="border-t border-white/[0.06] mt-1 pt-1 flex items-center gap-2">
                  <button
                    onClick={() => { setLang(lang === "fr" ? "en" : "fr"); }}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                    {lang.toUpperCase()}
                  </button>
                  <button
                    onClick={() => { if (user) setView("create"); else setView("auth"); setMobileMenuOpen(false); }}
                    className="hero-premium-btn flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="relative z-10">{tx.landing.startFree}</span>
                    <ArrowRight className="w-3.5 h-3.5 relative z-10" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section id="hero" className="lp-section relative overflow-hidden min-h-screen flex items-center px-4 pt-20 sm:pt-28 pb-20">
        {/* Grid + Intensified Halos */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div id="hero-grid" className="absolute inset-0 hero-grid"></div>
          <div id="hero-glow" className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-purple-600/30" style={{ filter: "blur(130px)", transform: 'translate(-50%, 0)' }}></div>
          <div className="absolute -top-20 -right-40 w-[450px] h-[450px] rounded-full bg-orange-400/25" style={{ filter: "blur(130px)" }}></div>
          <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-violet-500/20" style={{ filter: "blur(100px)" }}></div>
          <div className="absolute bottom-1/4 right-1/3 w-56 h-56 rounded-full bg-amber-500/15" style={{ filter: "blur(90px)" }}></div>
          <div className="absolute top-2/3 right-1/5 w-40 h-40 rounded-full bg-pink-500/12" style={{ filter: "blur(70px)" }}></div>
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
            <p className="lp-stagger text-lg sm:text-xl text-muted-foreground/80 mb-6 max-w-lg leading-relaxed" style={{ transitionDelay: '240ms' }}>
              {tx.landing.heroSubtitleAlt}
            </p>

            {/* Feature Badges — colorful */}
            <div className="lp-stagger hidden sm:flex items-stretch gap-3 mb-8 max-w-md" style={{ transitionDelay: '300ms' }}>
              {heroBadges.map((badge, i) => {
                const Icon = badge.icon;
                const gradients = ['from-mauve/20 to-purple-600/10 border-mauve/30', 'from-pink-500/15 to-rose-600/10 border-pink-500/25', 'from-orange-500/15 to-amber-600/10 border-orange-500/25'];
                const iconColors = ['text-mauve-light', 'text-pink-400', 'text-orange-400'];
                return (
                  <div
                    key={badge.label}
                    className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl bg-gradient-to-br ${gradients[i]} backdrop-blur-sm border text-center`}
                  >
                    <Icon className={`w-4 h-4 ${iconColors[i]}`} />
                    <span className="text-xs font-bold text-foreground leading-tight">{badge.label}</span>
                    <span className="text-[10px] text-muted-foreground/60 leading-snug">{badge.sub}</span>
                  </div>
                );
              })}
            </div>

            {/* CTA Button — rounded-full to match navbar */}
            <div className="lp-stagger max-w-md mb-6" style={{ transitionDelay: '360ms' }}>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="hero-premium-btn w-full inline-flex items-center justify-center gap-2.5 px-6 py-5 rounded-full text-white font-bold text-lg sm:text-xl whitespace-nowrap cursor-pointer"
              >
                <span className="relative z-10 flex items-center gap-2.5">
                  {tx.landing.startFree}
                  <ArrowRight className="w-5 h-5 flex-shrink-0" />
                </span>
              </button>
            </div>

            {/* Topic Input — compact hero version with rotating glow border */}
            <div className="lp-stagger max-w-md mb-4" style={{ transitionDelay: '420ms' }}>
              <div className="generate-glow rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-mauve/40 transition-colors overflow-hidden relative">
                <div className="generate-glow-border absolute inset-0 rounded-2xl pointer-events-none" />
                <div className="flex items-center gap-2 p-1.5 relative z-10">
                  <Sparkles className="w-4 h-4 text-mauve-light flex-shrink-0 ml-2" />
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateFromLP(); }}
                    placeholder={lang === "fr" ? "Apprendre Python pour le développement web..." : "Learn Python for web development..."}
                    className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm font-medium focus:outline-none py-2.5 px-2"
                  />
                  <button
                    onClick={handleGenerateFromLP}
                    className="hero-premium-btn flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap flex-shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{lang === "fr" ? "Générer" : "Generate"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick topic tags */}
            <div className="lp-stagger flex flex-wrap gap-2 max-w-md mb-6" style={{ transitionDelay: '480ms' }}>
              {quickTopics.slice(0, 4).map((topic) => (
                <button
                  key={topic}
                  onClick={() => { setTopicInput(topic); }}
                  className="px-3 py-1.5 rounded-full bg-mauve/10 border border-mauve/20 text-xs text-mauve-light font-medium hover:bg-mauve/20 hover:border-mauve/30 transition-all cursor-pointer"
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Trust assertion */}
            <div className="lp-stagger max-w-md" style={{ transitionDelay: '540ms' }}>
              <div className="rounded-xl bg-white/[0.03] border-l-2 border-l-mauve/60 px-4 py-3">
                <p className="text-xs text-center text-muted-foreground/60 leading-relaxed">
                  {lang === "fr"
                    ? "Aucune carte de crédit requise \u2022 Gratuit pour le premier cours"
                    : "No credit card required \u2022 Free for the first course"}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Floating Cards with glow (desktop only) */}
          <div className="relative hidden lg:block" style={{ paddingTop: '24px', height: '560px', overflow: 'visible' }}>
            {/* Purple glow behind floating cards */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[400px] rounded-full bg-mauve/15 pointer-events-none" style={{ filter: 'blur(100px)' }}></div>
            {floatingCards.map((card, i) => (
              <motion.div
                key={card.title}
                className={`absolute ${card.floatClass}`}
                style={card.style}
                initial={{ opacity: 0, y: 40 }}
                animate={heroVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.7, delay: 0.4 + i * 0.12, ease: "easeOut" }}
              >
                <div className="bg-night-light/80 backdrop-blur-sm border border-mauve/[0.15] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(124,92,191,0.15)]">
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

      {/* ===== SCROLLING TESTIMONIALS ===== */}
      <section id="testimonials" className="lp-section relative z-10 py-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10">
          <div className="lp-stagger text-center mb-12 px-4" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold">
              {lang === "fr" ? "Ce qu'ils" : "What they"}<span className="gradient-text"> {lang === "fr" ? "en pensent" : "think"}</span>
            </h2>
          </div>

          {/* Row 1 — scrolls left */}
          <div className="lp-stagger mb-4" style={{ transitionDelay: '120ms' }}>
            <div className="testimonial-scroll-left">
              <div className="testimonial-track">
                {[...testimonialsRow1, ...testimonialsRow1].map((t, i) => (
                  <div key={i} className="testimonial-card flex-shrink-0" style={{ width: '300px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className={`w-3 h-3 ${s < t.stars ? 'text-gold fill-gold' : 'text-muted-foreground/20'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed mb-4" style={{ fontStyle: 'italic' }}>&ldquo;{t.text}&rdquo;</p>
                    <p className="text-xs text-muted-foreground/50 font-semibold tracking-wide uppercase">&mdash; {t.name}, {t.region}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="lp-stagger" style={{ transitionDelay: '240ms' }}>
            <div className="testimonial-scroll-right">
              <div className="testimonial-track-reverse">
                {[...testimonialsRow2, ...testimonialsRow2].map((t, i) => (
                  <div key={i} className="testimonial-card flex-shrink-0" style={{ width: '300px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className={`w-3 h-3 ${s < t.stars ? 'text-gold fill-gold' : 'text-muted-foreground/20'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed mb-4" style={{ fontStyle: 'italic' }}>&ldquo;{t.text}&rdquo;</p>
                    <p className="text-xs text-muted-foreground/50 font-semibold tracking-wide uppercase">&mdash; {t.name}, {t.region}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TIKTOK-STYLE TREND CAROUSELS ===== */}
      <section id="trends" className="lp-section relative z-10 py-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-mauve/6 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-pink-500/4 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10">
          {/* Section header */}
          <div className="lp-stagger text-center mb-12 px-4" style={{ transitionDelay: '0ms' }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-mauve/10 border border-mauve/20 text-sm text-mauve-light font-semibold mb-6">
              <Play className="w-3.5 h-3.5" />
              <span>{lang === "fr" ? "Tendances virales" : "Viral Trends"}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {lang === "fr" ? "Ils sont passés" : "They went"}<span className="gradient-text"> {lang === "fr" ? "viral" : "viral"}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {lang === "fr"
                ? "De vraies conversations. De vrais résultats. Découvre comment ils ont transformé leur apprentissage."
                : "Real conversations. Real results. See how they transformed their learning."}
            </p>
          </div>

          {/* Carousel container */}
          <div className="lp-stagger relative max-w-5xl mx-auto px-4" style={{ transitionDelay: '120ms' }}>
            {/* Navigation arrows */}
            <button
              onClick={() => scrollTrendTo('left')}
              className="absolute -left-2 sm:left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-night/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-night hover:border-mauve/30 transition-all duration-300 cursor-pointer hidden sm:flex"
              aria-label={lang === "fr" ? "Précédent" : "Previous"}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollTrendTo('right')}
              className="absolute -right-2 sm:right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-night/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-night hover:border-mauve/30 transition-all duration-300 cursor-pointer hidden sm:flex"
              aria-label={lang === "fr" ? "Suivant" : "Next"}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Cards wrapper */}
            <div className="overflow-hidden mx-6 sm:mx-14">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTrendIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex justify-center"
                >
                  <div className="w-full max-w-lg">
                    {/* Trend Card */}
                    <div className="trend-card rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
                      {/* Card header — profile */}
                      <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-white/[0.06]">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-mauve/20 to-purple-600/20 border border-mauve/30 flex items-center justify-center text-xl flex-shrink-0">
                          {trendConversations[activeTrendIndex].avatarEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground truncate">
                              {trendConversations[activeTrendIndex].displayName}
                            </span>
                            {trendConversations[activeTrendIndex].verified && (
                              <div className="w-4 h-4 rounded-full bg-mauve/20 flex items-center justify-center flex-shrink-0">
                                <Check className="w-2.5 h-2.5 text-mauve-light" />
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground/50 truncate block">
                            {trendConversations[activeTrendIndex].username} · {trendConversations[activeTrendIndex].time}
                          </span>
                        </div>
                        <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r ${trendConversations[activeTrendIndex].topicColor} flex-shrink-0`}>
                          <Sparkles className="w-3 h-3 text-white" />
                          <span className="text-[11px] font-bold text-white">{trendConversations[activeTrendIndex].topicBadge}</span>
                        </div>
                      </div>

                      {/* Conversation messages */}
                      <div className="p-4 sm:p-5 space-y-3">
                        {trendConversations[activeTrendIndex].messages.map((msg, mi) => (
                          <div
                            key={mi}
                            className={`flex items-start gap-2.5 ${msg.sender === 'self' ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                              msg.sender === 'self'
                                ? 'bg-gradient-to-br from-mauve/25 to-purple-600/25 border border-mauve/30'
                                : 'bg-white/[0.06] border border-white/[0.08]'
                            }`}>
                              {msg.avatar}
                            </div>
                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                              msg.sender === 'self'
                                ? 'bg-gradient-to-br from-mauve/20 to-purple-600/15 border border-mauve/25 rounded-br-md'
                                : 'bg-white/[0.05] border border-white/[0.08] rounded-bl-md'
                            }`}>
                              <p className={`text-xs font-semibold mb-0.5 ${msg.sender === 'self' ? 'text-mauve-light' : 'text-foreground/70'}`}>
                                {msg.name}
                              </p>
                              <p className="text-sm text-foreground/90 leading-relaxed">{msg.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Engagement bar */}
                      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          <button className="flex items-center gap-1.5 text-white/40 hover:text-red-400 transition-colors cursor-pointer">
                            <Heart className="w-4 h-4" />
                            <span className="text-xs font-semibold">{trendConversations[activeTrendIndex].likes}</span>
                          </button>
                          <button className="flex items-center gap-1.5 text-white/40 hover:text-mauve-light transition-colors cursor-pointer">
                            <MessageCircle className="w-4 h-4" />
                            <span className="text-xs font-semibold">{trendConversations[activeTrendIndex].comments}</span>
                          </button>
                          <button className="flex items-center gap-1.5 text-white/40 hover:text-mauve-light transition-colors cursor-pointer">
                            <Share2 className="w-4 h-4" />
                            <span className="text-xs font-semibold">{trendConversations[activeTrendIndex].shares}</span>
                          </button>
                        </div>
                        <button className="text-white/40 hover:text-mauve-light transition-colors cursor-pointer">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Dots indicator */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {trendConversations.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTrendIndex(i)}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    i === activeTrendIndex
                      ? 'w-6 h-2 bg-mauve'
                      : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={lang === "fr" ? `Conversation ${i + 1}` : `Conversation ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* CTA after carousel */}
          <div className="lp-stagger text-center mt-14 px-4" style={{ transitionDelay: '240ms' }}>
            <div className="inline-block glass rounded-2xl px-8 py-6 max-w-md">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-lg font-extrabold text-foreground">
                  {lang === "fr" ? "Et toi, c'est quand ?" : "What about you?"}
                </span>
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {lang === "fr"
                  ? "Rejoins des milliers de personnes qui apprennent plus vite avec Coursia. Ton premier cours est offert."
                  : "Join thousands of people learning faster with Coursia. Your first course is free."}
              </p>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="hero-premium-btn inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-bold text-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{tx.landing.startFree}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
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

      {/* ===== GENERATE CTA SECTION ===== */}
      <section id="generate-cta" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="lp-stagger glass rounded-3xl p-8 sm:p-10" style={{ transitionDelay: '0ms' }}>
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                {lang === "fr" ? "Génère ton premier cours" : "Generate your first course"}
                <span className="gradient-text"> {lang === "fr" ? "dès maintenant" : "right now"}</span>
              </h2>
              <p className="text-muted-foreground">
                {lang === "fr" ? "Décris ce que tu veux apprendre et l'IA s'occupe du reste." : "Describe what you want to learn and AI does the rest."}
              </p>
            </div>

            {/* Topic Input */}
            <div className="lp-stagger relative mb-6" style={{ transitionDelay: '120ms' }}>
              <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-mauve/40 transition-colors overflow-hidden">
                <Sparkles className="w-5 h-5 text-mauve-light flex-shrink-0 ml-2" />
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateFromLP(); }}
                  placeholder={lang === "fr" ? "Apprendre Python pour le développement web..." : "Learn Python for web development..."}
                  className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm font-medium focus:outline-none py-3 px-2"
                />
                <button
                  onClick={handleGenerateFromLP}
                  className="hero-premium-btn flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl text-white text-sm font-bold cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">{lang === "fr" ? "Générer" : "Generate"}</span>
                </button>
              </div>
            </div>

            {/* Quick topic tags */}
            <div className="lp-stagger flex flex-wrap gap-2 justify-center" style={{ transitionDelay: '240ms' }}>
              {quickTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => { setTopicInput(topic); }}
                  className="px-4 py-2 rounded-full bg-mauve/10 border border-mauve/20 text-sm text-mauve-light font-medium hover:bg-mauve/20 hover:border-mauve/30 transition-all cursor-pointer"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== AVEC / SANS COURSIA ===== */}
      <section id="compare" className="lp-section relative z-10 py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-mauve/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
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
              <div className="p-8 sm:p-12">
                {/* Header with label */}
                <div className="flex items-center justify-center mb-8">
                  <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-bold transition-all duration-500 ${activeComparison === 'avec' ? 'bg-mauve/15 text-mauve-light border border-mauve/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {activeComparison === 'avec' ? <Sparkles className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {activeComparison === 'avec' ? (lang === "fr" ? "Avec Coursia" : "With Coursia") : (lang === "fr" ? "Sans Coursia" : "Without Coursia")}
                  </div>
                </div>

                {/* Content area */}
                <div className="relative min-h-[280px]">
                  {/* Avec Coursia content */}
                  <div className={`comparison-content ${activeComparison === 'avec' ? 'comp-active' : 'comp-exit'}`}>
                    <div className="space-y-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Brain className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Cours personnalisés par IA" : "AI-personalized courses"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "L'intelligence artificielle crée un cours unique adapté à votre niveau et vos objectifs." : "AI creates a unique course tailored to your level and goals."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <TrendingUp className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Progression structurée" : "Structured progression"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Des chapitres organisés, des quiz interactifs et un suivi de niveau Débutant → Avancé." : "Organized chapters, interactive quizzes, and Beginner → Advanced tracking."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Résultats en quelques minutes" : "Results in minutes"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Pas besoin de chercher. Décrivez votre sujet et commencez à apprendre immédiatement." : "No need to search. Describe your topic and start learning immediately."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Layers className="w-5 h-5 text-mauve-light" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Parcours illimité" : "Unlimited learning paths"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Générez autant de cours que vous voulez, sur tous les sujets, sans limites." : "Generate as many courses as you want, on any topic, without limits."}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sans Coursia content */}
                  <div className={`comparison-content ${activeComparison === 'sans' ? 'comp-active' : 'comp-exit'}`}>
                    <div className="space-y-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Search className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Heures de recherche" : "Hours of searching"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Parcourir des centaines de vidéos YouTube et articles sans fil conducteur." : "Browsing hundreds of YouTube videos and articles with no guidance."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Aucun suivi" : "No tracking"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Pas de progression visible, pas de quiz, pas de validation de vos acquis." : "No visible progression, no quizzes, no validation of your knowledge."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Frown className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Contenu générique" : "Generic content"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Des cours faits pour tout le monde mais adaptés à personne en particulier." : "Courses made for everyone but tailored to no one in particular."}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Lock className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{lang === "fr" ? "Contenu non structuré" : "Unstructured content"}</h4>
                          <p className="text-base text-muted-foreground">{lang === "fr" ? "Des informations éparses sans progression logique ni cohérence pédagogique." : "Scattered information with no logical progression or pedagogical coherence."}</p>
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
                  <div className={`w-6 h-6 rounded-full border border-muted-foreground/30 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${openFaq === i ? 'bg-mauve/15 border-mauve/40' : ''}`}>
                    <span className={`text-sm font-bold transition-all duration-300 ${openFaq === i ? 'text-mauve-light' : 'text-muted-foreground'}`}>
                      {openFaq === i ? '−' : '+'}
                    </span>
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96 pb-5" : "max-h-0"}`}>
                  <p className="px-6 text-sm sm:text-base text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section id="bottom-cta" className="lp-section relative z-10 py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="lp-stagger" style={{ transitionDelay: '0ms' }}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
              {lang === "fr" ? "Prêt à transformer ton apprentissage" : "Ready to transform your learning"}
              <span className="gradient-text"> ?</span>
            </h2>
            <div className="lp-stagger mt-8" style={{ transitionDelay: '120ms' }}>
              <button
                onClick={() => user ? setView("create") : setView("auth")}
                className="hero-premium-btn inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-bold text-lg cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>{tx.landing.startFree}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
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
            <span className="text-muted-foreground/20">·</span>
            <a
              href="mailto:hellocoursia@gmail.com?subject=Support%20Coursia"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {lang === "fr" ? "Nous contacter" : "Contact us"}
            </a>

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

        /* ── Testimonial scrolling marquee ── */
        .testimonial-scroll-left,
        .testimonial-scroll-right {
          overflow: hidden;
          width: 100%;
          mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
        }
        .testimonial-track {
          display: flex;
          gap: 16px;
          width: max-content;
          animation: scroll-left 50s linear infinite;
        }
        .testimonial-track-reverse {
          display: flex;
          gap: 16px;
          width: max-content;
          animation: scroll-right 50s linear infinite;
        }
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .testimonial-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .testimonial-card:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 24px rgba(0,0,0,0.25), 0 0 1px rgba(124,92,191,0.15);
        }

        /* ── TikTok Trend Card ── */
        .trend-card {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.4s ease;
        }
        .trend-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 1px rgba(124,92,191,0.2), 0 0 20px rgba(124,92,191,0.08);
          border-color: rgba(124,92,191,0.3);
        }
        @media (prefers-reduced-motion: reduce) {
          .testimonial-track,
          .testimonial-track-reverse {
            animation: none;
          }
        }

        /* ── Floating card animations (reduced amplitude, no overflow) ── */
        @keyframes hero-float-1 {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes hero-float-2 {
          0%, 100% { transform: translateY(0) rotate(1.5deg); }
          50% { transform: translateY(-6px) rotate(1.5deg); }
        }
        @keyframes hero-float-3 {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-10px) rotate(-2deg); }
        }
        @keyframes hero-float-4 {
          0%, 100% { transform: translateY(0) rotate(1deg); }
          50% { transform: translateY(-5px) rotate(1deg); }
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

        /* ── Generate Input Rotating Glow Border ── */
        .generate-glow-border {
          background: conic-gradient(
            from var(--glow-angle, 0deg),
            transparent 0%,
            rgba(124, 92, 191, 0.5) 8%,
            rgba(167, 139, 250, 0.8) 15%,
            rgba(124, 92, 191, 0.4) 22%,
            transparent 32%,
            transparent 100%
          );
          animation: generate-glow-spin 3s linear infinite;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          padding: 2px;
          border-radius: inherit;
        }
        @property --glow-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes generate-glow-spin {
          to { --glow-angle: 360deg; }
        }
        .generate-glow {
          box-shadow: 0 0 15px rgba(124, 92, 191, 0.1), 0 0 30px rgba(124, 92, 191, 0.05);
        }

      `}</style>
    </div>
  );
}