#!/usr/bin/env python3
"""
Tasks C-H: Create LegalPage, update store, landing, appshell
"""

# ===== Task C: Create LegalPage.tsx =====
legal_page_content = '''"use client";

import { useState } from "react";
import { ArrowLeft, Shield, FileText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function LegalPage() {
  const lang = useAppStore((s) => s.lang);
  const setView = useAppStore((s) => s.setView);
  const tx = t(lang);
  const [activeTab, setActiveTab] = useState<"privacy" | "terms">(
    useAppStore.getState().legalTab || "privacy"
  );

  const legalTx = tx.legal;
  const isFr = lang === "fr";
  const lastUpdated = new Date().toLocaleDateString(
    isFr ? "fr-FR" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="min-h-screen bg-night">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-night/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setView("landing")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">{tx.common.close}</span>
          </button>
          <h1 className="text-lg font-bold gradient-text">{legalTx.title}</h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex rounded-2xl glass overflow-hidden p-1">
          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "privacy"
                ? "bg-mauve/20 text-mauve-light"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="w-4 h-4" />
            {legalTx.privacyTab}
          </button>
          <button
            onClick={() => setActiveTab("terms")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "terms"
                ? "bg-mauve/20 text-mauve-light"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" />
            {legalTx.termsTab}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass rounded-3xl p-6 sm:p-10">
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">{legalTx.privacyTab}</h2>
                <p className="text-sm text-muted-foreground">{isFr ? "Dernière mise à jour :" : "Last updated:"} {lastUpdated}</p>
              </div>

              <Section title={legalTx.p1t} content={legalTx.p1c} />
              <Section title={legalTx.p2t} content={legalTx.p2c} />
              <Section title={legalTx.p3t} content={legalTx.p3c} />
              <Section title={legalTx.p4t} content={legalTx.p4c} />
              <Section title={legalTx.p5t} content={legalTx.p5c} />
              <Section title={legalTx.p6t} content={legalTx.p6c} />
              <Section title={legalTx.p7t} content={legalTx.p7c} />
              <Section title={legalTx.p8t} content={legalTx.p8c} />
              <Section title={legalTx.p9t} content={legalTx.p9c} />
            </div>
          )}

          {activeTab === "terms" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">{legalTx.termsTab}</h2>
                <p className="text-sm text-muted-foreground">{isFr ? "Dernière mise à jour :" : "Last updated:"} {lastUpdated}</p>
              </div>

              <Section title={legalTx.t1t} content={legalTx.t1c} />
              <Section title={legalTx.t2t} content={legalTx.t2c} />
              <Section title={legalTx.t3t} content={legalTx.t3c} />
              <Section title={legalTx.t4t} content={legalTx.t4c} />
              <Section title={legalTx.t5t} content={legalTx.t5c} />
              <Section title={legalTx.t6t} content={legalTx.t6c} />
              <Section title={legalTx.t7t} content={legalTx.t7c} />
              <Section title={legalTx.t8t} content={legalTx.t8c} />
              <Section title={legalTx.t9t} content={legalTx.t9c} />
              <Section title={legalTx.t10t} content={legalTx.t10c} />
              <Section title={legalTx.t11t} content={legalTx.t11c} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}
'''

with open('/home/z/my-project/src/components/coursia/LegalPage.tsx', 'w') as f:
    f.write(legal_page_content)
print("Task C: LegalPage.tsx created")

# ===== Task D: Update store.ts =====
with open('/home/z/my-project/src/lib/store.ts', 'r') as f:
    content = f.read()

# Add 'legal' to AppView type
content = content.replace(
    'export type AppView = "landing" | "auth" | "create" | "library" | "viewer" | "journey" | "offers";',
    'export type AppView = "landing" | "auth" | "create" | "library" | "viewer" | "journey" | "offers" | "legal";'
)

# Add legalTab to the interface (after expiryWarning48h setters)
content = content.replace(
    '  // 48h expiry warning',
    '  // Legal page tab
  legalTab: "privacy" | "terms";
  setLegalTab: (tab: "privacy" | "terms") => void;
  // 48h expiry warning'
)

# Add legalTab default values (before the closing })
content = content.replace(
    '  // 48h expiry warning\n  expiryWarning48h: false,\n  setExpiryWarning48h: (v) => set({ expiryWarning48h: v }),',
    '  // Legal page tab\n  legalTab: "privacy" as const,\n  setLegalTab: (tab) => set({ legalTab: tab }),\n  // 48h expiry warning\n  expiryWarning48h: false,\n  setExpiryWarning48h: (v) => set({ expiryWarning48h: v }),'
)

with open('/home/z/my-project/src/lib/store.ts', 'w') as f:
    f.write(content)
print("Task D: store.ts updated with legal view")

# ===== Task E: Update LandingPage footer =====
with open('/home/z/my-project/src/components/coursia/LandingPage.tsx', 'r') as f:
    content = f.read()

# Replace footer legal buttons to use setView instead of setLegalModal
old_footer = '''            <button
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
            </button>'''

new_footer = '''            <button
              onClick={() => { useAppStore.getState().setLegalTab("privacy"); setView("legal"); }}
              className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              {(tx.landing as Record<string, unknown>).privacy as string}
            </button>
            <span className="text-muted-foreground/20">·</span>
            <button
              onClick={() => { useAppStore.getState().setLegalTab("terms"); setView("legal"); }}
              className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              {(tx.landing as Record<string, unknown>).terms as string}
            </button>'''

content = content.replace(old_footer, new_footer)

# Remove the old legal modal section
old_modal = '''      {/* ===== LEGAL MODALS ===== */}
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
                    ? "Nous collectons uniquement les données nécessaires au fonctionnement de Coursia : ton prénom, ton nom, ton adresse email et ton code d\'accès. Nous ne collectons aucune donnée supplémentaire."
                    : "We only collect data necessary for Coursia to function: your first name, last name, email address and access code. We do not collect any additional data."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">2. {lang === "fr" ? "Utilisation de tes données" : "How We Use Your Data"}</h3>
                  <p>{lang === "fr"
                    ? "Tes données servent exclusivement à : créer et gérer ton compte, personnaliser les cours générés par IA, suivre ta progression d\'apprentissage, traiter tes paiements via PayPal."
                    : "Your data is used exclusively to: create and manage your account, personalize AI-generated courses, track your learning progress, process your payments via PayPal."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">3. {lang === "fr" ? "Paiements" : "Payments"}</h3>
                  <p>{lang === "fr"
                    ? "Les paiements sont traités par PayPal. Nous ne stockons aucune donnée bancaire. PayPal gère directement les cartes bancaires (Visa, Mastercard, American Express) et les comptes PayPal."
                    : "Payments are processed by PayPal. We do not store any banking data. PayPal directly handles credit/debit cards (Visa, Mastercard, American Express) and PayPal accounts."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">4. {lang === "fr" ? "Intelligence artificielle" : "Artificial Intelligence"}</h3>
                  <p>{lang === "fr"
                    ? "Les sujets que tu saisis pour générer des cours sont envoyés à notre fournisseur d\'IA. Ces sujets ne sont pas stockés au-delà de la génération du cours. Le contenu généré est stocké dans ton espace personnel."
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
                <h2 className="text-2xl font-bold mb-6 text-foreground">{lang === "fr" ? "Conditions d\'utilisation" : "Terms of Use"}</h2>
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p><strong className="text-foreground">Dernière mise à jour :</strong> {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">1. {lang === "fr" ? "Acceptation" : "Acceptance"}</h3>
                  <p>{lang === "fr"
                    ? "En utilisant Coursia, tu acceptes ces conditions. Si tu n\'es pas d\'accord, n\'utilise pas le service."
                    : "By using Coursia, you accept these terms. If you disagree, do not use the service."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">2. {lang === "fr" ? "Description du service" : "Service Description"}</h3>
                  <p>{lang === "fr"
                    ? "Coursia est un outil d\'apprentissage qui utilise l\'intelligence artificielle pour générer des cours personnalisés. Les cours sont générés automatiquement et peuvent contenir des imprécisions. Coursia ne remplace pas un enseignement professionnel."
                    : "Coursia is a learning tool that uses artificial intelligence to generate personalized courses. Courses are automatically generated and may contain inaccuracies. Coursia does not replace professional instruction."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">3. {lang === "fr" ? "Abonnements et paiements" : "Subscriptions and Payments"}</h3>
                  <p>{lang === "fr"
                    ? "Les abonnements sont facturés mensuellement ou annuellement via PayPal. Tu peux annuler à tout moment. L\'annulation prend effet à la fin de la période en cours. Aucun remboursement n\'est effectué pour la période déjà commencée."
                    : "Subscriptions are billed monthly or annually via PayPal. You can cancel at any time. Cancellation takes effect at the end of the current period. No refund is issued for the already started period."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">4. {lang === "fr" ? "Propriété intellectuelle" : "Intellectual Property"}</h3>
                  <p>{lang === "fr"
                    ? "Le contenu généré par Coursia est destiné à un usage personnel. Tu ne peux pas le revendre, le redistribuer ou l\'utiliser à des fins commerciales sans autorisation."
                    : "Content generated by Coursia is intended for personal use. You may not resell, redistribute, or use it for commercial purposes without authorization."}</p>
                  <h3 className="text-base font-semibold text-foreground pt-2">5. {lang === "fr" ? "Limitation de responsabilité" : "Limitation of Liability"}</h3>
                  <p>{lang === "fr"
                    ? "Coursia est fourni « en l\'état ». Nous ne garantissons pas que le contenu généré soit exempt d\'erreurs. Nous ne sommes pas responsables des pertes liées à l\'utilisation du service."
                    : "Coursia is provided \\"as is\\". We do not guarantee that generated content is error-free. We are not responsible for losses related to the use of the service."}</p>

                </div>
              </>
            )}
          </div>
        </div>
      )}'''

content = content.replace(old_modal, '')

# Remove legalModal state and X import if no longer needed
# First remove the state declaration
content = content.replace(
    'const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);\n',
    ''
)

# Check if X is still used elsewhere (it's used in the mobile menu in AppShell, not LandingPage)
# In LandingPage, X was only used in the legal modal, so remove it from the import
# Let's check if X appears elsewhere in the file
if content.count('X className') <= 1:  # Only the import
    content = content.replace(', X', '')

with open('/home/z/my-project/src/components/coursia/LandingPage.tsx', 'w') as f:
    f.write(content)
print("Task E: LandingPage.tsx footer updated, modal removed")

# ===== Task F: Update AppShell.tsx =====
with open('/home/z/my-project/src/components/coursia/AppShell.tsx', 'r') as f:
    content = f.read()

# Add LegalPage import
content = content.replace(
    'import TopBar from "@/components/coursia/TopBar";',
    'import TopBar from "@/components/coursia/TopBar";\nimport LegalPage from "@/components/coursia/LegalPage";'
)

# Add legal view rendering (before the closing </div> of the main conditional)
# The legal page should be rendered as a separate full-page view, similar to landing and auth
content = content.replace(
    '      ) : view === "auth" ? (\n        <AuthPage />',
    '      ) : view === "auth" ? (\n        <AuthPage />\n      ) : view === "legal" ? (\n        <LegalPage />'
)

with open('/home/z/my-project/src/components/coursia/AppShell.tsx', 'w') as f:
    f.write(content)
print("Task F: AppShell.tsx updated with LegalPage")

# ===== Task G: Add legal translations to i18n.ts =====
with open('/home/z/my-project/src/lib/i18n.ts', 'r') as f:
    content = f.read()

# Add legal translations to FR (before the closing } of the fr object)
# We need to add it as a new top-level key in the fr object
# Find the last line before the closing of the fr object

fr_legal = '''  legal: {
    title: "Mentions Légales",
    privacyTab: "Politique de confidentialité",
    termsTab: "Conditions d\'utilisation",
    p1t: "1. Introduction",
    p1c: "Coursia (\"le Service\") est un service d\'apprentissage en ligne propulsé par l\'intelligence artificielle. La présente Politique de confidentialité décrit comment nous collectons, utilisons, stockons et protégeons vos données personnelles. En utilisant Coursia, vous acceptez les pratiques décrites dans ce document. Nous nous engageons à protéger votre vie privée et à être transparents sur le traitement de vos données.",
    p2t: "2. Données collectées",
    p2c: "Nous collectons les données suivantes :\n\n• Informations de compte : prénom, nom, adresse e-mail et code d\'accès.\n• Données d\'utilisation : sujets de cours demandés, progression d\'apprentissage, scores aux quiz, temps passé sur la plateforme.\n• Données de paiement : les transactions sont traitées par PayPal. Nous ne stockons aucune donnée bancaire directement.",
    p3t: "3. Utilisation des données",
    p3c: "Vos données sont utilisées exclusivement pour :\n\n• Créer et gérer votre compte utilisateur.\n• Personnaliser les cours générés par l\'IA en fonction de vos préférences.\n• Suivre votre progression et vos résultats d\'apprentissage.\n• Traiter vos paiements et gérer votre abonnement.\n• Améliorer notre service et votre expérience utilisateur.",
    p4t: "4. Stockage et sécurité",
    p4c: "Vos données sont stockées sur des serveurs sécurisés. Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction. Cependant, aucune méthode de transmission sur Internet n\'est totalement sécurisée, et nous ne pouvons garantir une sécurité absolue.",
    p5t: "5. Cookies",
    p5c: "Coursia utilise des cookies essentiels au fonctionnement du service (authentification, préférences de langue). Nous n\'utilisons pas de cookies publicitaires ou de suivi tiers. Vous pouvez configurer votre navigateur pour refuser les cookies, mais certaines fonctionnalités du service pourraient ne pas fonctionner correctement.",
    p6t: "6. Services tiers",
    p6c: "Nous faisons appel aux services suivants :\n\n• PayPal : traitement sécurisé des paiements par carte bancaire et compte PayPal.\n• Fournisseur d\'IA : génération du contenu des cours. Les sujets saisis sont transmis au fournisseur mais ne sont pas stockés au-delà de la génération.\nCes services tiers sont soumis à leurs propres politiques de confidentialité.",
    p7t: "7. Vos droits",
    p7c: "Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :\n\n• Droit d\'accès : obtenir une copie de vos données personnelles.\n• Droit de rectification : corriger des données inexactes.\n• Droit à l\'effacement : demander la suppression de vos données.\n• Droit à la portabilité : recevoir vos données dans un format structuré.\nPour exercer ces droits, contactez-nous à l\'adresse indiquée ci-dessous.",
    p8t: "8. Conservation des données",
    p8c: "Nous conservons vos données personnelles tant que votre compte est actif. Si vous demandez la suppression de votre compte, vos données seront supprimées dans un délai de 30 jours, à l\'exception des données nécessitant une conservation plus longue pour des obligations légales. Les données de paiement sont conservées par PayPal conformément à leurs propres conditions.",
    p9t: "9. Contact",
    p9c: "Pour toute question concernant cette politique de confidentialité ou le traitement de vos données, vous pouvez nous contacter par e-mail à : contact@coursia.app",
    t1t: "1. Acceptation des conditions",
    t1c: "En accédant à et en utilisant Coursia, vous acceptez d\'être lié par les présentes Conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser le Service. L\'utilisation continue du Service après toute modification des conditions constitue votre acceptation de ces modifications.",
    t2t: "2. Description du service",
    t2c: "Coursia est une plateforme d\'apprentissage en ligne qui utilise l\"intelligence artificielle pour générer des cours personnalisés sur le sujet de votre choix. Le Service inclut la génération de cours structurés avec chapitres, quiz de validation et suivi de progression par niveaux de difficulté. Les cours sont générés automatiquement et peuvent contenir des imprécisions. Coursia ne constitue pas un substitut à un enseignement professionnel ou une certification.",
    t3t: "3. Comptes utilisateurs",
    t3c: "Pour utiliser certaines fonctionnalités du Service, vous devez créer un compte en fournissant un prénom, un nom, une adresse e-mail et un code d\'accès. Vous êtes responsable de maintenir la confidentialité de vos informations de compte. Vous acceptez de nous informer immédiatement de toute utilisation non autorisée de votre compte.",
    t4t: "4. Abonnements et paiements",
    t4c: "Coursia propose des abonnements payants mensuels et annuels. Les paiements sont traités par PayPal via carte bancaire (Visa, Mastercard, American Express) ou compte PayPal. L\'abonnement est facturé à l\'avance et se renouvelle automatiquement à la fin de chaque période. Vous pouvez annuler votre abonnement à tout moment via votre compte PayPal. L\'annulation prend effet à la fin de la période de facturation en cours.",
    t5t: "5. Annulation et remboursement",
    t5c: "Vous pouvez annuler votre abonnement à tout moment. Aucun remboursement n\'est effectué pour la période d\'abonnement déjà commencée. Après annulation, vous conservez l\'accès au Service jusqu\'à la fin de la période payée. Les cours que vous avez générés restent accessibles en lecture pendant une période de grâce.",
    t6t: "6. Propriété intellectuelle",
    t6c: "Le contenu de la plateforme Coursia (interface, design, logo, code source) est la propriété exclusive de Coursia. Les cours générés par l\'IA sont destinés à un usage personnel et éducatif. Vous ne pouvez pas revendre, redistribuer ou utiliser le contenu généré à des fins commerciales sans autorisation préalable écrite.",
    t7t: "7. Contenu utilisateur",
    t7c: "Vous restez propriétaire des sujets que vous soumettez pour la génération de cours. En utilisant le Service, vous accordez à Coursia une licence limitée pour traiter ces sujets afin de générer des cours personnalisés.",
    t8t: "8. Limitation de responsabilité",
    t8c: "Coursia est fourni \"en l\"état\" sans aucune garantie, expresse ou implicite. Nous ne garantissons pas que le contenu généré par l\"IA soit exact, complet ou à jour. Coursia ne saurait être tenu responsable des pertes ou dommages directs, indirects, accessoires ou consécutifs résultant de l\"utilisation du Service. L\"utilisation du Service est à vos propres risques.",
    t9t: "9. Droit applicable",
    t9c: "Les présentes conditions sont régies par et interprétées conformément au droit applicable. Tout litige relatif au Service sera soumis à la compétence exclusive des tribunaux compétents.",
    t10t: "10. Modifications des conditions",
    t10c: "Nous nous réservons le droit de modifier les présentes Conditions d\"utilisation à tout moment. Les modifications seront publiées sur cette page avec une date de mise à jour révisée. L\"utilisation continue du Service après la publication des modifications constitue votre acceptation des nouvelles conditions.",
    t11t: "11. Contact",
    t11c: "Pour toute question concernant les présentes conditions, vous pouvez nous contacter par e-mail à : contact@coursia.app",
  },
'''

# Add legal section to FR (before the closing } of the fr object, which is before the en object)
content = content.replace(
    '  auth: {\n    signInToContinue: "Connecte-toi pour continuer",',
    fr_legal + '  auth: {\n    signInToContinue: "Connecte-toi pour continuer",'
)

# Add legal section to EN
en_legal = '''  legal: {
    title: "Legal",
    privacyTab: "Privacy Policy",
    termsTab: "Terms of Use",
    p1t: "1. Introduction",
    p1c: "Coursia (\"the Service\") is an AI-powered online learning platform. This Privacy Policy describes how we collect, use, store and protect your personal data. By using Coursia, you agree to the practices described in this document. We are committed to protecting your privacy and being transparent about how we process your data.",
    p2t: "2. Data Collected",
    p2c: "We collect the following data:\n\n• Account information: first name, last name, email address and access code.\n• Usage data: course topics requested, learning progress, quiz scores, time spent on the platform.\n• Payment data: transactions are processed by PayPal. We do not store any banking data directly.",
    p3t: "3. How Data Is Used",
    p3c: "Your data is used exclusively to:\n\n• Create and manage your user account.\n• Personalize AI-generated courses based on your preferences.\n• Track your learning progress and results.\n• Process your payments and manage your subscription.\n• Improve our service and your user experience.",
    p4t: "4. Data Storage and Security",
    p4c: "Your data is stored on secure servers. We implement appropriate technical and organizational measures to protect your data against unauthorized access, modification, disclosure or destruction. However, no method of transmission over the Internet is completely secure, and we cannot guarantee absolute security.",
    p5t: "5. Cookies",
    p5c: "Coursia uses cookies essential to the operation of the service (authentication, language preferences). We do not use advertising or third-party tracking cookies. You can configure your browser to refuse cookies, but some features of the service may not work properly.",
    p6t: "6. Third-Party Services",
    p6c: "We use the following services:\n\n• PayPal: secure processing of payments by credit/debit card and PayPal account.\n• AI Provider: generation of course content. Topics entered are transmitted to the provider but are not stored beyond generation.\nThese third-party services are subject to their own privacy policies.",
    p7t: "7. Your Rights",
    p7c: "In accordance with the General Data Protection Regulation (GDPR), you have the following rights:\n\n• Right of access: obtain a copy of your personal data.\n• Right to rectification: correct inaccurate data.\n• Right to erasure: request the deletion of your data.\n• Right to data portability: receive your data in a structured format.\nTo exercise these rights, contact us at the address below.",
    p8t: "8. Data Retention",
    p8c: "We retain your personal data as long as your account is active. If you request the deletion of your account, your data will be deleted within 30 days, except for data requiring longer retention for legal obligations. Payment data is retained by PayPal in accordance with their own terms.",
    p9t: "9. Contact",
    p9c: "For any questions regarding this privacy policy or the processing of your data, you can contact us by email at: contact@coursia.app",
    t1t: "1. Acceptance of Terms",
    t1c: "By accessing and using Coursia, you agree to be bound by these Terms of Use. If you do not accept these terms, please do not use the Service. Continued use of the Service after any modification to the terms constitutes your acceptance of those modifications.",
    t2t: "2. Description of Service",
    t2c: "Coursia is an online learning platform that uses artificial intelligence to generate personalized courses on the topic of your choice. The Service includes generating structured courses with chapters, validation quizzes and difficulty-level progress tracking. Courses are automatically generated and may contain inaccuracies. Coursia does not constitute a substitute for professional instruction or certification.",
    t3t: "3. User Accounts",
    t3c: "To use certain features of the Service, you must create an account by providing a first name, last name, email address and access code. You are responsible for maintaining the confidentiality of your account information. You agree to notify us immediately of any unauthorized use of your account.",
    t4t: "4. Subscriptions and Payments",
    t4c: "Coursia offers monthly and annual paid subscriptions. Payments are processed by PayPal via credit/debit card (Visa, Mastercard, American Express) or PayPal account. The subscription is billed in advance and renews automatically at the end of each period. You can cancel your subscription at any time through your PayPal account. Cancellation takes effect at the end of the current billing period.",
    t5t: "5. Cancellation and Refund",
    t5c: "You can cancel your subscription at any time. No refund is issued for the subscription period already started. After cancellation, you retain access to the Service until the end of the paid period. Courses you have generated remain accessible in read-only mode during a grace period.",
    t6t: "6. Intellectual Property",
    t6c: "The Coursia platform content (interface, design, logo, source code) is the exclusive property of Coursia. AI-generated courses are intended for personal and educational use. You may not resell, redistribute or use the generated content for commercial purposes without prior written authorization.",
    t7t: "7. User Content",
    t7c: "You retain ownership of the topics you submit for course generation. By using the Service, you grant Coursia a limited license to process these topics in order to generate personalized courses.",
    t8t: "8. Limitation of Liability",
    t8c: "Coursia is provided \"as is\" without any warranty, express or implied. We do not guarantee that AI-generated content is accurate, complete or up-to-date. Coursia shall not be liable for any direct, indirect, incidental or consequential losses or damages arising from the use of the Service. Use of the Service is at your own risk.",
    t9t: "9. Governing Law",
    t9c: "These terms are governed by and construed in accordance with applicable law. Any dispute relating to the Service shall be subject to the exclusive jurisdiction of the competent courts.",
    t10t: "10. Changes to Terms",
    t10c: "We reserve the right to modify these Terms of Use at any time. Changes will be published on this page with a revised update date. Continued use of the Service after the publication of changes constitutes your acceptance of the new terms.",
    t11t: "11. Contact",
    t11c: "For any questions regarding these terms, you can contact us by email at: contact@coursia.app",
  },
'''

# Add legal section to EN (before the en auth section)
content = content.replace(
    '  auth: {\n    signInToContinue: "Sign in to continue",',
    en_legal + '  auth: {\n    signInToContinue: "Sign in to continue",'
)

with open('/home/z/my-project/src/lib/i18n.ts', 'w') as f:
    f.write(content)
print("Task G: i18n.ts updated with legal translations")

print("\n=== All remaining tasks completed! ===")
