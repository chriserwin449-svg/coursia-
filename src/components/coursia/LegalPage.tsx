"use client";

import {
  ArrowLeft, Shield, FileText, Scale, CheckCircle2, AlertCircle,
  CreditCard, Lock, UserCheck, Brain, Database, Eye, Trash2, Download,
  Globe, RefreshCw, Zap, Ban, Coins, Info, AlertTriangle, Heart,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

export default function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const lang = useAppStore((s) => s.lang);
  const setLegalPage = useAppStore((s) => s.setLegalPage);

  return (
    <div className="min-h-screen bg-night flex flex-col">
      {/* Sticky top nav */}
      <nav className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-night/95 backdrop-blur-xl border-b border-muted-foreground/10">
        <button
          onClick={() => setLegalPage(null)}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-mauve-light transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="uppercase tracking-widest">{lang === "fr" ? "Retour" : "Back"}</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <CoursiaLogo size={24} className="rounded-lg" />
          <span className="font-bold text-sm text-foreground">Coursia</span>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12">
          {/* Back to home link */}
          <button
            onClick={() => setLegalPage(null)}
            className="inline-flex items-center gap-2 text-muted-foreground/40 hover:text-mauve-light transition-colors group text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            {lang === "fr" ? "Retour à l'accueil" : "Back to home"}
          </button>

          {/* ===== PRIVACY POLICY ===== */}
          {type === "privacy" && (
            <>
              {/* Hero Header */}
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic">
                  {lang === "fr" ? (
                    <>Politique de <span className="text-mauve-light">Confidentialité</span></>
                  ) : (
                    <>Privacy <span className="text-mauve-light">Policy</span></>
                  )}
                </h1>
                <p className="text-muted-foreground/40 font-medium tracking-wide uppercase text-sm">
                  {lang === "fr"
                    ? "Comment Coursia protège vos données personnelles."
                    : "How Coursia protects your personal data."}
                </p>
              </div>

              {/* Main Card */}
              <div className="rounded-xl border bg-white/[0.03] border-white/[0.08] shadow-lg">
                {/* Card Header */}
                <div className="flex flex-col space-y-1.5 border-b border-white/[0.05] bg-white/[0.02] p-6 sm:p-8">
                  <div className="tracking-tight text-xl sm:text-2xl font-black flex items-center gap-3 italic uppercase">
                    <Shield className="w-6 h-6 text-mauve-light" />
                    {lang === "fr" ? "Protection des données" : "Data Protection"}
                  </div>
                  <p className="text-muted-foreground/50 text-sm mt-1">
                    <strong className="text-foreground/70">
                      {lang === "fr" ? "Dernière mise à jour :" : "Last updated:"}
                    </strong>{" "}
                    {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                {/* Card Body */}
                <div className="p-6 sm:p-8 space-y-10 text-muted-foreground/70 leading-relaxed">
                  {/* 1. Introduction */}
                  <SectionBlock
                    number="1"
                    title={lang === "fr" ? "Introduction" : "Introduction"}
                    icon={<Info className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? 'Coursia ("nous", "notre" ou "le service") s\'engage à protéger la vie privée de ses utilisateurs. Cette Politique de confidentialité explique quelles données nous collectons, comment nous les utilisons, et quels sont vos droits.'
                      : 'Coursia ("we", "our" or "the service") is committed to protecting the privacy of its users. This Privacy Policy explains what data we collect, how we use it, and what your rights are.'}</p>
                  </SectionBlock>

                  {/* 2. Données collectées */}
                  <SectionBlock
                    number="2"
                    title={lang === "fr" ? "Données que nous collectons" : "Data We Collect"}
                    icon={<Database className="w-5 h-5 text-mauve-light" />}
                  >
                    <p className="mb-4">{lang === "fr"
                      ? "Nous collectons uniquement les données nécessaires au fonctionnement de Coursia :"
                      : "We only collect data necessary for Coursia to function:"}</p>
                    <div className="bg-white/[0.03] p-5 sm:p-6 rounded-2xl border border-white/[0.06] space-y-3">
                      <ListItem icon={<UserCheck className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Informations du compte :" : "Account information:"}</strong>{" "}
                        {lang === "fr" ? "prénom, nom, adresse email et code d'accès." : "first name, last name, email address and access code."}
                      </ListItem>
                      <ListItem icon={<Brain className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Données d'utilisation :" : "Usage data:"}</strong>{" "}
                        {lang === "fr" ? "sujets de cours générés, progression d'apprentissage, quiz complétés, badges obtenus." : "generated course topics, learning progress, completed quizzes, earned badges."}
                      </ListItem>
                      <ListItem icon={<CreditCard className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Données de paiement :" : "Payment data:"}</strong>{" "}
                        {lang === "fr" ? "traitées exclusivement par PayPal. Nous ne stockons aucune donnée bancaire." : "processed exclusively by PayPal. We do not store any banking data."}
                      </ListItem>
                      <ListItem icon={<Globe className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Cookies :" : "Cookies:"}</strong>{" "}
                        {lang === "fr" ? "cookies techniques essentiels au fonctionnement du site et à l'authentification." : "essential technical cookies for site functionality and authentication."}
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 3. Utilisation */}
                  <SectionBlock
                    number="3"
                    title={lang === "fr" ? "Utilisation de vos données" : "How We Use Your Data"}
                    icon={<Zap className="w-5 h-5 text-mauve-light" />}
                  >
                    <div className="space-y-3">
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Créer et gérer votre compte utilisateur" : "Create and manage your user account"}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Personnaliser les cours générés par intelligence artificielle" : "Personalize AI-generated courses"}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Suivre votre progression et statistiques d'apprentissage" : "Track your learning progress and statistics"}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Traiter vos abonnements et paiements via PayPal" : "Process your subscriptions and payments via PayPal"}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Améliorer notre service et notre intelligence artificielle" : "Improve our service and artificial intelligence"}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Communiquer avec vous en cas de nécessité (service, sécurité)" : "Communicate with you when necessary (service, security)"}
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 4. Partage des données */}
                  <SectionBlock
                    number="4"
                    title={lang === "fr" ? "Partage des données" : "Data Sharing"}
                    icon={<Eye className="w-5 h-5 text-mauve-light" />}
                  >
                    <p className="mb-4">{lang === "fr"
                      ? "Nous ne vendons, n'échangeons et ne louons jamais vos données personnelles à des tiers. Nous partageons des données uniquement avec :"
                      : "We never sell, trade, or rent your personal data to third parties. We share data only with:"}</p>
                    <div className="bg-white/[0.03] p-5 sm:p-6 rounded-2xl border border-white/[0.06] space-y-3">
                      <ListItem icon={<CreditCard className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">PayPal</strong> — {lang === "fr"
                          ? "pour le traitement sécurisé des paiements et abonnements récurrents."
                          : "for secure payment processing and recurring subscriptions."}
                      </ListItem>
                      <ListItem icon={<Brain className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Fournisseur d'IA" : "AI Provider"}</strong> — {lang === "fr"
                          ? "pour la génération de cours (les sujets saisis sont envoyés temporairement)."
                          : "for course generation (entered topics are sent temporarily)."}
                      </ListItem>
                      <ListItem icon={<Database className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Hébergeur" : "Hosting Provider"}</strong> — {lang === "fr"
                          ? "pour le stockage sécurisé des données (base de données chiffrée)."
                          : "for secure data storage (encrypted database)."}
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 5. Intelligence artificielle */}
                  <SectionBlock
                    number="5"
                    title={lang === "fr" ? "Intelligence artificielle" : "Artificial Intelligence"}
                    icon={<Brain className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Les sujets que vous saisissez pour générer des cours sont envoyés à notre fournisseur d'intelligence artificielle. Ces sujets ne sont pas stockés au-delà de la génération du cours. Le contenu généré est stocké dans votre espace personnel et peut être supprimé à tout moment."
                      : "The topics you enter to generate courses are sent to our AI provider. These topics are not stored beyond course generation. The generated content is stored in your personal space and can be deleted at any time."}</p>
                  </SectionBlock>

                  {/* 6. Sécurité */}
                  <SectionBlock
                    number="6"
                    title={lang === "fr" ? "Sécurité des données" : "Data Security"}
                    icon={<Lock className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données : chiffrement en transit (HTTPS/TLS), authentification par jeton sécurisé, et accès restreint aux données sensibles."
                      : "We implement appropriate technical and organizational security measures to protect your data: in-transit encryption (HTTPS/TLS), secure token authentication, and restricted access to sensitive data."}</p>
                  </SectionBlock>

                  {/* 7. Vos droits */}
                  <SectionBlock
                    number="7"
                    title={lang === "fr" ? "Vos droits" : "Your Rights"}
                    icon={<CheckCircle2 className="w-5 h-5 text-mauve-light" />}
                  >
                    <p className="mb-4">{lang === "fr"
                      ? "Conformément au RGPD et aux lois applicables, vous disposez des droits suivants :"
                      : "In accordance with GDPR and applicable laws, you have the following rights:"}</p>
                    <div className="space-y-3">
                      <ListItem icon={<Eye className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Droit d'accès :" : "Right of access:"}</strong>{" "}
                        {lang === "fr" ? "demander une copie de toutes vos données." : "request a copy of all your data."}
                      </ListItem>
                      <ListItem icon={<RefreshCw className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Droit de rectification :" : "Right of rectification:"}</strong>{" "}
                        {lang === "fr" ? "corriger vos informations personnelles." : "correct your personal information."}
                      </ListItem>
                      <ListItem icon={<Trash2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Droit de suppression :" : "Right of erasure:"}</strong>{" "}
                        {lang === "fr" ? "supprimer votre compte et toutes vos données." : "delete your account and all your data."}
                      </ListItem>
                      <ListItem icon={<Download className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        <strong className="text-foreground">{lang === "fr" ? "Droit de portabilité :" : "Right of portability:"}</strong>{" "}
                        {lang === "fr" ? "exporter vos données dans un format lisible." : "export your data in a readable format."}
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 8. Rétention */}
                  <SectionBlock
                    number="8"
                    title={lang === "fr" ? "Rétention des données" : "Data Retention"}
                    icon={<Database className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Nous conservons vos données tant que votre compte est actif. Si vous supprimez votre compte, toutes vos données personnelles sont supprimées dans les 30 jours, sauf obligation légale de conservation."
                      : "We retain your data as long as your account is active. If you delete your account, all your personal data is deleted within 30 days, unless legally required to retain it."}</p>
                  </SectionBlock>

                  {/* 9. Contact */}
                  <SectionBlock
                    number="9"
                    title={lang === "fr" ? "Contact" : "Contact"}
                    icon={<Heart className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Pour toute question concernant cette politique de confidentialité, contactez-nous à :"
                      : "For any questions regarding this privacy policy, contact us at:"}</p>
                    <div className="mt-3 bg-mauve/10 p-4 rounded-xl border border-mauve/20">
                      <p className="text-mauve-light font-bold text-center">
                        hellocoursia@gmail.com
                      </p>
                    </div>
                  </SectionBlock>
                </div>
              </div>
            </>
          )}

          {/* ===== TERMS OF USE ===== */}
          {type === "terms" && (
            <>
              {/* Hero Header */}
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic">
                  {lang === "fr" ? (
                    <>Conditions <span className="text-mauve-light">Générales</span></>
                  ) : (
                    <>Terms of <span className="text-mauve-light">Use</span></>
                  )}
                </h1>
                <p className="text-muted-foreground/40 font-medium tracking-wide uppercase text-sm">
                  {lang === "fr"
                    ? "Conditions d'utilisation de la plateforme Coursia."
                    : "Terms of use for the Coursia platform."}
                </p>
              </div>

              {/* Main Card */}
              <div className="rounded-xl border bg-white/[0.03] border-white/[0.08] shadow-lg">
                {/* Card Header */}
                <div className="flex flex-col space-y-1.5 border-b border-white/[0.05] bg-white/[0.02] p-6 sm:p-8">
                  <div className="tracking-tight text-xl sm:text-2xl font-black flex items-center gap-3 italic uppercase">
                    <Scale className="w-6 h-6 text-mauve-light" />
                    {lang === "fr" ? "Contrat d'utilisation" : "Usage Agreement"}
                  </div>
                  <p className="text-muted-foreground/50 text-sm mt-1">
                    <strong className="text-foreground/70">
                      {lang === "fr" ? "Dernière mise à jour :" : "Last updated:"}
                    </strong>{" "}
                    {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                {/* Card Body */}
                <div className="p-6 sm:p-8 space-y-10 text-muted-foreground/70 leading-relaxed">
                  {/* 1. Acceptation */}
                  <SectionBlock
                    number="1"
                    title={lang === "fr" ? "Acceptation des conditions" : "Acceptance of Terms"}
                    icon={<CheckCircle2 className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "En créant un compte ou en utilisant Coursia, vous acceptez les présentes Conditions d'utilisation dans leur intégralité. Si vous n'êtes pas d'accord avec l'une quelconque de ces conditions, vous ne devez pas utiliser le service."
                      : "By creating an account or using Coursia, you accept these Terms of Use in their entirety. If you disagree with any of these terms, you must not use the service."}</p>
                  </SectionBlock>

                  {/* 2. Description du service */}
                  <SectionBlock
                    number="2"
                    title={lang === "fr" ? "Description du service" : "Service Description"}
                    icon={<Info className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Coursia est un service d'apprentissage en ligne qui utilise l'intelligence artificielle pour générer des cours personnalisés selon les sujets de votre choix. Les cours comprennent des chapitres structurés, des quiz, et un système de progression par niveaux (Débutant, Intermédiaire, Avancé)."
                      : "Coursia is an online learning service that uses artificial intelligence to generate personalized courses based on topics of your choice. Courses include structured chapters, quizzes, and a level-based progression system (Beginner, Intermediate, Advanced)."}</p>
                    <div className="mt-4 bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20">
                      <p className="flex items-start gap-3 text-amber-400 font-bold">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        {lang === "fr"
                          ? "Le contenu généré par IA peut contenir des imprécisions et ne remplace pas un enseignement professionnel ou une formation certifiée."
                          : "AI-generated content may contain inaccuracies and does not replace professional instruction or certified training."}
                      </p>
                    </div>
                  </SectionBlock>

                  {/* 3. Comptes utilisateurs */}
                  <SectionBlock
                    number="3"
                    title={lang === "fr" ? "Comptes utilisateurs" : "User Accounts"}
                    icon={<UserCheck className="w-5 h-5 text-mauve-light" />}
                  >
                    <div className="space-y-3">
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Vous devez fournir des informations exactes et à jour lors de la création de votre compte." : "You must provide accurate and up-to-date information when creating your account."}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Vous êtes responsable de la sécurité de vos identifiants de connexion." : "You are responsible for the security of your login credentials."}
                      </ListItem>
                      <ListItem icon={<Ban className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Vous ne pouvez pas créer plusieurs comptes pour contourner les limites du service." : "You may not create multiple accounts to circumvent service limits."}
                      </ListItem>
                      <ListItem icon={<AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}>
                        <span className="text-red-400 font-bold">
                          {lang === "fr" ? "Nous nous réservons le droit de suspendre ou supprimer les comptes qui violent ces conditions." : "We reserve the right to suspend or delete accounts that violate these terms."}
                        </span>
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 4. Abonnements et paiements */}
                  <SectionBlock
                    number="4"
                    title={lang === "fr" ? "Abonnements et paiements" : "Subscriptions and Payments"}
                    icon={<Coins className="w-5 h-5 text-mauve-light" />}
                  >
                    <p className="mb-4">{lang === "fr"
                      ? "Coursia propose des abonnements récurrents via PayPal :"
                      : "Coursia offers recurring subscriptions via PayPal:"}</p>
                    <div className="bg-white/[0.03] p-5 sm:p-6 rounded-2xl border border-white/[0.06] space-y-3 mb-6">
                      <p className="flex items-start gap-3">
                        <Coins className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-foreground">{lang === "fr" ? "Plan Mensuel" : "Monthly Plan"}:</strong>{" "}
                          ${lang === "fr" ? "9,99" : "9.99"} {lang === "fr" ? "/mois, facturé mensuellement." : "/month, billed monthly."}
                        </span>
                      </p>
                      <p className="flex items-start gap-3">
                        <Coins className="w-5 h-5 text-mauve-light shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-foreground">{lang === "fr" ? "Plan Annuel" : "Annual Plan"}:</strong>{" "}
                          ${lang === "fr" ? "52,99" : "52.99"} {lang === "fr" ? "/an, facturé annuellement." : "/year, billed annually."}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-3">
                      <ListItem icon={<CreditCard className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Les paiements sont traités par PayPal. Nous ne stockons aucune donnée bancaire." : "Payments are processed by PayPal. We do not store any banking data."}
                      </ListItem>
                      <ListItem icon={<RefreshCw className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "L'abonnement se renouvelle automatiquement à la fin de chaque période." : "The subscription automatically renews at the end of each period."}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Vous pouvez annuler à tout moment via votre compte PayPal. L'annulation prend effet à la fin de la période en cours." : "You can cancel at any time via your PayPal account. Cancellation takes effect at the end of the current period."}
                      </ListItem>
                    </div>
                    <div className="mt-4 bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20">
                      <p className="flex items-start gap-3 text-amber-400 font-bold">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        {lang === "fr"
                          ? "Aucun remboursement n'est effectué pour la période déjà commencée. Un cours gratuit est offert à chaque nouvel utilisateur pour tester le service."
                          : "No refund is issued for the already started period. One free course is offered to each new user to test the service."}
                      </p>
                    </div>
                  </SectionBlock>

                  {/* 5. Propriété intellectuelle */}
                  <SectionBlock
                    number="5"
                    title={lang === "fr" ? "Propriété intellectuelle" : "Intellectual Property"}
                    icon={<Shield className="w-5 h-5 text-mauve-light" />}
                  >
                    <div className="space-y-3">
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Le contenu généré par Coursia est destiné à un usage personnel et éducatif." : "Content generated by Coursia is intended for personal and educational use."}
                      </ListItem>
                      <ListItem icon={<Ban className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Vous ne pouvez pas revendre, redistribuer ou utiliser le contenu généré à des fins commerciales sans autorisation écrite préalable." : "You may not resell, redistribute, or use generated content for commercial purposes without prior written authorization."}
                      </ListItem>
                      <ListItem icon={<CheckCircle2 className="w-5 h-5 text-mint shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "La marque Coursia, son logo et son interface graphique sont protégés par le droit d'auteur." : "The Coursia brand, logo, and graphical interface are protected by copyright."}
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 6. Contenu utilisateur */}
                  <SectionBlock
                    number="6"
                    title={lang === "fr" ? "Contenu utilisateur" : "User Content"}
                    icon={<FileText className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Vous êtes seul responsable des sujets que vous saisissez pour générer des cours."
                      : "You are solely responsible for the topics you enter to generate courses."}</p>
                    <div className="mt-4 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 space-y-3">
                      <p className="flex items-start gap-3 text-red-400 font-bold">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        {lang === "fr"
                          ? "Vous vous engagez à ne pas utiliser le service pour générer du contenu illégal, diffamatoire, ou nuisible."
                          : "You agree not to use the service to generate illegal, defamatory, or harmful content."}
                      </p>
                    </div>
                  </SectionBlock>

                  {/* 7. Limitation de responsabilité */}
                  <SectionBlock
                    number="7"
                    title={lang === "fr" ? "Limitation de responsabilité" : "Limitation of Liability"}
                    icon={<AlertCircle className="w-5 h-5 text-mauve-light" />}
                  >
                    <div className="space-y-3">
                      <ListItem icon={<Info className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />}>
                        {lang === "fr"
                          ? 'Coursia est fourni « en l\'état » sans garantie d\'aucune sorte.'
                          : 'Coursia is provided "as is" without any warranty of any kind.'}
                      </ListItem>
                      <ListItem icon={<Info className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Nous ne garantissons pas que le contenu généré par IA soit exempt d'erreurs, exhaustif ou à jour." : "We do not guarantee that AI-generated content is error-free, comprehensive, or up-to-date."}
                      </ListItem>
                      <ListItem icon={<Info className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />}>
                        {lang === "fr" ? "Nous ne sommes pas responsables des pertes directes, indirectes ou consécutives liées à l'utilisation du service." : "We are not liable for direct, indirect, or consequential losses related to the use of the service."}
                      </ListItem>
                      <ListItem icon={<AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}>
                        <span className="text-amber-400">
                          {lang === "fr"
                            ? "Notre responsabilité totale ne peut en aucun cas dépasser les frais d'abonnement payés au cours des 12 derniers mois."
                            : "Our total liability shall in no case exceed the subscription fees paid in the last 12 months."}
                        </span>
                      </ListItem>
                    </div>
                  </SectionBlock>

                  {/* 8. Disponibilité */}
                  <SectionBlock
                    number="8"
                    title={lang === "fr" ? "Disponibilité du service" : "Service Availability"}
                    icon={<Globe className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Nous nous efforçons de maintenir Coursia disponible en permanence, mais ne pouvons garantir un accès ininterrompu. Des interruptions temporaires peuvent survenir pour des raisons de maintenance, de mise à jour ou de force majeure."
                      : "We strive to keep Coursia available at all times but cannot guarantee uninterrupted access. Temporary interruptions may occur for maintenance, updates, or force majeure reasons."}</p>
                  </SectionBlock>

                  {/* 9. Modifications */}
                  <SectionBlock
                    number="9"
                    title={lang === "fr" ? "Modifications des conditions" : "Changes to Terms"}
                    icon={<RefreshCw className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Nous nous réservons le droit de modifier ces Conditions d'utilisation à tout moment. Les modifications seront communiquées via le service ou par email. Votre utilisation continue de Coursia après notification des modifications constitue votre acceptation des nouvelles conditions."
                      : "We reserve the right to modify these Terms of Use at any time. Changes will be communicated via the service or by email. Your continued use of Coursia after notification of changes constitutes your acceptance of the new terms."}</p>
                  </SectionBlock>

                  {/* 10. Droit applicable */}
                  <SectionBlock
                    number="10"
                    title={lang === "fr" ? "Droit applicable" : "Governing Law"}
                    icon={<Scale className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Les présentes Conditions d'utilisation sont régies par le droit applicable en vigueur dans le pays d'établissement de Coursia. Tout litige sera soumis aux tribunaux compétents de cette juridiction."
                      : "These Terms of Use are governed by the applicable law in Coursia's country of establishment. Any dispute shall be submitted to the competent courts of this jurisdiction."}</p>
                  </SectionBlock>

                  {/* 11. Contact */}
                  <SectionBlock
                    number="11"
                    title={lang === "fr" ? "Contact" : "Contact"}
                    icon={<Heart className="w-5 h-5 text-mauve-light" />}
                  >
                    <p>{lang === "fr"
                      ? "Pour toute question concernant ces Conditions d'utilisation, contactez-nous à :"
                      : "For any questions regarding these Terms of Use, contact us at:"}</p>
                    <div className="mt-3 bg-mauve/10 p-4 rounded-xl border border-mauve/20">
                      <p className="text-mauve-light font-bold text-center">
                        hellocoursia@gmail.com
                      </p>
                    </div>
                  </SectionBlock>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Reusable Components ===== */

function SectionBlock({
  number,
  title,
  icon,
  children,
}: {
  number: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg sm:text-xl font-black text-foreground uppercase italic flex items-center gap-2">
        <div className="w-1 h-6 bg-mauve-light rounded-full" />
        <span>{number}.</span>
        {title}
        <span className="ml-auto">{icon}</span>
      </h2>
      <div>{children}</div>
    </section>
  );
}

function ListItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-3">
      {icon}
      <span>{children}</span>
    </p>
  );
}
