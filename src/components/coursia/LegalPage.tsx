"use client";

import { ArrowLeft, Shield, FileText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

export default function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const lang = useAppStore((s) => s.lang);
  const setLegalPage = useAppStore((s) => s.setLegalPage);

  return (
    <div className="min-h-screen bg-night flex flex-col">
      {/* Sticky top nav */}
      <nav className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-night/95 backdrop-blur-lg border-b border-muted-foreground/10">
        <button
          onClick={() => setLegalPage(null)}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === "fr" ? "Retour" : "Back"}</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <CoursiaLogo size={24} className="rounded-lg" />
          <span className="font-bold text-sm text-foreground">Coursia</span>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 md:px-16 py-12 sm:py-20">
          {type === "privacy" && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-mauve/15 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-mauve-light" />
                </div>
                <h1 className="text-4xl font-extrabold text-foreground">
                  {lang === "fr" ? "Politique de confidentialité" : "Privacy Policy"}
                </h1>
              </div>
              <p className="text-base text-muted-foreground mb-8">
                <strong className="text-foreground">
                  {lang === "fr" ? "Dernière mise à jour :" : "Last updated:"}
                </strong>{" "}
                {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <div className="space-y-8 text-lg text-muted-foreground leading-relaxed">
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">1. {lang === "fr" ? "Introduction" : "Introduction"}</h3>
                  <p>{lang === "fr"
                    ? 'Coursia ("nous", "notre" ou "le service") s\'engage à protéger la vie privée de ses utilisateurs. Cette Politique de confidentialité explique quelles données nous collectons, comment nous les utilisons, et quels sont vos droits.'
                    : 'Coursia ("we", "our" or "the service") is committed to protecting the privacy of its users. This Privacy Policy explains what data we collect, how we use it, and what your rights are.'}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">2. {lang === "fr" ? "Données que nous collectons" : "Data We Collect"}</h3>
                  <p className="mb-3">{lang === "fr"
                    ? "Nous collectons uniquement les données nécessaires au fonctionnement de Coursia :"
                    : "We only collect data necessary for Coursia to function:"}</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Informations du compte :</strong> prénom, nom, adresse email et code d\'accès.'
                      : '<strong className="text-foreground">Account information:</strong> first name, last name, email address and access code.'}</li>
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Données d\'utilisation :</strong> sujets de cours générés, progression d\'apprentissage, quiz complétés, badges obtenus.'
                      : '<strong className="text-foreground">Usage data:</strong> generated course topics, learning progress, completed quizzes, earned badges.'}</li>
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Données de paiement :</strong> traitées exclusivement par PayPal. Nous ne stockons aucune donnée bancaire.'
                      : '<strong className="text-foreground">Payment data:</strong> processed exclusively by PayPal. We do not store any banking data.'}</li>
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Cookies :</strong> cookies techniques essentiels au fonctionnement du site et à l\'authentification.'
                      : '<strong className="text-foreground">Cookies:</strong> essential technical cookies for site functionality and authentication.'}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">3. {lang === "fr" ? "Utilisation de vos données" : "How We Use Your Data"}</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{lang === "fr" ? "Créer et gérer votre compte utilisateur" : "Create and manage your user account"}</li>
                    <li>{lang === "fr" ? "Personnaliser les cours générés par intelligence artificielle" : "Personalize AI-generated courses"}</li>
                    <li>{lang === "fr" ? "Suivre votre progression et statistiques d\'apprentissage" : "Track your learning progress and statistics"}</li>
                    <li>{lang === "fr" ? "Traiter vos abonnements et paiements via PayPal" : "Process your subscriptions and payments via PayPal"}</li>
                    <li>{lang === "fr" ? "Améliorer notre service et notre intelligence artificielle" : "Improve our service and artificial intelligence"}</li>
                    <li>{lang === "fr" ? "Communiquer avec vous en cas de nécessité (service, sécurité)" : "Communicate with you when necessary (service, security)"}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">4. {lang === "fr" ? "Partage des données" : "Data Sharing"}</h3>
                  <p>{lang === "fr"
                    ? "Nous ne vendons, n\'échangeons et ne louons jamais vos données personnelles à des tiers. Nous partageons des données uniquement avec :"
                    : "We never sell, trade, or rent your personal data to third parties. We share data only with:"}</p>
                  <ul className="list-disc pl-5 space-y-2 mt-2">
                    <li><strong className="text-foreground">PayPal</strong> — {lang === "fr"
                      ? "pour le traitement sécurisé des paiements et abonnements récurrents."
                      : "for secure payment processing and recurring subscriptions."}</li>
                    <li><strong className="text-foreground">{lang === "fr" ? "Fournisseur d\'IA" : "AI Provider"}</strong> — {lang === "fr"
                      ? "pour la génération de cours (les sujets saisis sont envoyés temporairement)."
                      : "for course generation (entered topics are sent temporarily)."}</li>
                    <li><strong className="text-foreground">{lang === "fr" ? "Hébergeur" : "Hosting Provider"}</strong> — {lang === "fr"
                      ? "pour le stockage sécurisé des données (base de données chiffrée)."
                      : "for secure data storage (encrypted database)."}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">5. {lang === "fr" ? "Intelligence artificielle" : "Artificial Intelligence"}</h3>
                  <p>{lang === "fr"
                    ? "Les sujets que vous saisissez pour générer des cours sont envoyés à notre fournisseur d\'intelligence artificielle. Ces sujets ne sont pas stockés au-delà de la génération du cours. Le contenu généré est stocké dans votre espace personnel et peut être supprimé à tout moment."
                    : "The topics you enter to generate courses are sent to our AI provider. These topics are not stored beyond course generation. The generated content is stored in your personal space and can be deleted at any time."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">6. {lang === "fr" ? "Sécurité des données" : "Data Security"}</h3>
                  <p>{lang === "fr"
                    ? "Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données : chiffrement en transit (HTTPS/TLS), authentification par jeton sécurisé, et accès restreint aux données sensibles."
                    : "We implement appropriate technical and organizational security measures to protect your data: in-transit encryption (HTTPS/TLS), secure token authentication, and restricted access to sensitive data."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">7. {lang === "fr" ? "Vos droits" : "Your Rights"}</h3>
                  <p className="mb-2">{lang === "fr"
                    ? "Conformément au RGPD et aux lois applicables, vous disposez des droits suivants :"
                    : "In accordance with GDPR and applicable laws, you have the following rights:"}</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Droit d\'accès :</strong> demander une copie de toutes vos données.'
                      : '<strong className="text-foreground">Right of access:</strong> request a copy of all your data.'}</li>
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Droit de rectification :</strong> corriger vos informations personnelles.'
                      : '<strong className="text-foreground">Right of rectification:</strong> correct your personal information.'}</li>
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Droit de suppression :</strong> supprimer votre compte et toutes vos données.'
                      : '<strong className="text-foreground">Right of erasure:</strong> delete your account and all your data.'}</li>
                    <li>{lang === "fr"
                      ? '<strong className="text-foreground">Droit de portabilité :</strong> exporter vos données dans un format lisible.'
                      : '<strong className="text-foreground">Right of portability:</strong> export your data in a readable format.'}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">8. {lang === "fr" ? "Rétention des données" : "Data Retention"}</h3>
                  <p>{lang === "fr"
                    ? "Nous conservons vos données tant que votre compte est actif. Si vous supprimez votre compte, toutes vos données personnelles sont supprimées dans les 30 jours, sauf obligation légale de conservation."
                    : "We retain your data as long as your account is active. If you delete your account, all your personal data is deleted within 30 days, unless legally required to retain it."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">9. {lang === "fr" ? "Contact" : "Contact"}</h3>
                  <p>{lang === "fr"
                    ? "Pour toute question concernant cette politique de confidentialité, contactez-nous à : hellocoursia@gmail.com"
                    : "For any questions regarding this privacy policy, contact us at: hellocoursia@gmail.com"}</p>
                </section>
              </div>
            </>
          )}
          {type === "terms" && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-mauve/15 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-mauve-light" />
                </div>
                <h1 className="text-4xl font-extrabold text-foreground">
                  {lang === "fr" ? "Conditions d\'utilisation" : "Terms of Use"}
                </h1>
              </div>
              <p className="text-base text-muted-foreground mb-8">
                <strong className="text-foreground">
                  {lang === "fr" ? "Dernière mise à jour :" : "Last updated:"}
                </strong>{" "}
                {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <div className="space-y-8 text-lg text-muted-foreground leading-relaxed">
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">1. {lang === "fr" ? "Acceptation des conditions" : "Acceptance of Terms"}</h3>
                  <p>{lang === "fr"
                    ? "En créant un compte ou en utilisant Coursia, vous acceptez les présentes Conditions d\'utilisation dans leur intégralité. Si vous n\'êtes pas d\'accord avec l\'une quelconque de ces conditions, vous ne devez pas utiliser le service."
                    : "By creating an account or using Coursia, you accept these Terms of Use in their entirety. If you disagree with any of these terms, you must not use the service."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">2. {lang === "fr" ? "Description du service" : "Service Description"}</h3>
                  <p>{lang === "fr"
                    ? "Coursia est un service d\'apprentissage en ligne qui utilise l\'intelligence artificielle pour générer des cours personnalisés selon les sujets de votre choix. Les cours comprennent des chapitres structurés, des quiz, et un système de progression par niveaux (Débutant, Intermédiaire, Avancé). Le contenu généré par IA peut contenir des imprécisions et ne remplace pas un enseignement professionnel ou une formation certifiée."
                    : "Coursia is an online learning service that uses artificial intelligence to generate personalized courses based on topics of your choice. Courses include structured chapters, quizzes, and a level-based progression system (Beginner, Intermediate, Advanced). AI-generated content may contain inaccuracies and does not replace professional instruction or certified training."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">3. {lang === "fr" ? "Comptes utilisateurs" : "User Accounts"}</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{lang === "fr" ? "Vous devez fournir des informations exactes et à jour lors de la création de votre compte." : "You must provide accurate and up-to-date information when creating your account."}</li>
                    <li>{lang === "fr" ? "Vous êtes responsable de la sécurité de vos identifiants de connexion." : "You are responsible for the security of your login credentials."}</li>
                    <li>{lang === "fr" ? "Vous ne pouvez pas créer plusieurs comptes pour contourner les limites du service." : "You may not create multiple accounts to circumvent service limits."}</li>
                    <li>{lang === "fr" ? "Nous nous réservons le droit de suspendre ou supprimer les comptes qui violent ces conditions." : "We reserve the right to suspend or delete accounts that violate these terms."}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">4. {lang === "fr" ? "Abonnements et paiements" : "Subscriptions and Payments"}</h3>
                  <p className="mb-2">{lang === "fr"
                    ? "Coursia propose des abonnements récurrents via PayPal :"
                    : "Coursia offers recurring subscriptions via PayPal:"}</p>
                  <ul className="list-disc pl-5 space-y-2 mb-3">
                    <li><strong className="text-foreground">{lang === "fr" ? "Plan Mensuel" : "Monthly Plan"}:</strong> ${lang === "fr" ? "9,99" : "9.99"} {lang === "fr" ? "/mois, facturé mensuellement." : "/month, billed monthly."}</li>
                    <li><strong className="text-foreground">{lang === "fr" ? "Plan Annuel" : "Annual Plan"}:</strong> ${lang === "fr" ? "52,99" : "52.99"} {lang === "fr" ? "/an, facturé annuellement." : "/year, billed annually."}</li>
                  </ul>
                  <ul className="list-disc pl-5 space-y-2 mb-3">
                    <li>{lang === "fr" ? "Les paiements sont traités par PayPal. Nous ne stockons aucune donnée bancaire." : "Payments are processed by PayPal. We do not store any banking data."}</li>
                    <li>{lang === "fr" ? "L\'abonnement se renouvelle automatiquement à la fin de chaque période." : "The subscription automatically renews at the end of each period."}</li>
                    <li>{lang === "fr" ? "Vous pouvez annuler à tout moment via votre compte PayPal. L\'annulation prend effet à la fin de la période en cours." : "You can cancel at any time via your PayPal account. Cancellation takes effect at the end of the current period."}</li>
                    <li>{lang === "fr" ? "Aucun remboursement n\'est effectué pour la période déjà commencé. Un cours gratuit est offert à chaque nouvel utilisateur pour tester le service." : "No refund is issued for the already started period. One free course is offered to each new user to test the service."}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">5. {lang === "fr" ? "Propriété intellectuelle" : "Intellectual Property"}</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{lang === "fr" ? "Le contenu généré par Coursia est destiné à un usage personnel et éducatif." : "Content generated by Coursia is intended for personal and educational use."}</li>
                    <li>{lang === "fr" ? "Vous ne pouvez pas revendre, redistribuer ou utiliser le contenu généré à des fins commerciales sans autorisation écrite préalable." : "You may not resell, redistribute, or use generated content for commercial purposes without prior written authorization."}</li>
                    <li>{lang === "fr" ? "La marque Coursia, son logo et son interface graphique sont protégés par le droit d\'auteur." : "The Coursia brand, logo, and graphical interface are protected by copyright."}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">6. {lang === "fr" ? "Contenu utilisateur" : "User Content"}</h3>
                  <p>{lang === "fr"
                    ? "Vous êtes seul responsable des sujets que vous saisissez pour générer des cours. Vous vous engagez à ne pas utiliser le service pour générer du contenu illégal, diffamatoire, ou nuisible."
                    : "You are solely responsible for the topics you enter to generate courses. You agree not to use the service to generate illegal, defamatory, or harmful content."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">7. {lang === "fr" ? "Limitation de responsabilité" : "Limitation of Liability"}</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{lang === "fr" ? 'Coursia est fourni « en l\'état » sans garantie d\'aucune sorte.' : 'Coursia is provided "as is" without any warranty of any kind.'}</li>
                    <li>{lang === "fr" ? "Nous ne garantissons pas que le contenu généré par IA soit exempt d\'erreurs, exhaustif ou à jour." : "We do not guarantee that AI-generated content is error-free, comprehensive, or up-to-date."}</li>
                    <li>{lang === "fr" ? "Nous ne sommes pas responsables des pertes directes, indirectes ou consécutives liées à l\'utilisation du service." : "We are not liable for direct, indirect, or consequential losses related to the use of the service."}</li>
                    <li>{lang === "fr" ? "Notre responsabilité totale ne peut en aucun cas dépasser les frais d\'abonnement payés au cours des 12 derniers mois." : "Our total liability shall in no case exceed the subscription fees paid in the last 12 months."}</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">8. {lang === "fr" ? "Disponibilité du service" : "Service Availability"}</h3>
                  <p>{lang === "fr"
                    ? "Nous nous efforçons de maintenir Coursia disponible en permanence, mais ne pouvons garantir un accès ininterrompu. Des interruptions temporaires peuvent survenir pour des raisons de maintenance, de mise à jour ou de force majeure."
                    : "We strive to keep Coursia available at all times but cannot guarantee uninterrupted access. Temporary interruptions may occur for maintenance, updates, or force majeure reasons."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">9. {lang === "fr" ? "Modifications des conditions" : "Changes to Terms"}</h3>
                  <p>{lang === "fr"
                    ? "Nous nous réservons le droit de modifier ces Conditions d\'utilisation à tout moment. Les modifications seront communiquées via le service ou par email. Votre utilisation continue de Coursia après notification des modifications constitue votre acceptation des nouvelles conditions."
                    : "We reserve the right to modify these Terms of Use at any time. Changes will be communicated via the service or by email. Your continued use of Coursia after notification of changes constitutes your acceptance of the new terms."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">10. {lang === "fr" ? "Droit applicable" : "Governing Law"}</h3>
                  <p>{lang === "fr"
                    ? "Les présentes Conditions d\'utilisation sont régies par le droit applicable en vigueur dans le pays d\'établissement de Coursia. Tout litige sera soumis aux tribunaux compétents de cette juridiction."
                    : "These Terms of Use are governed by the applicable law in Coursia\'s country of establishment. Any dispute shall be submitted to the competent courts of this jurisdiction."}</p>
                </section>
                <section>
                  <h3 className="text-xl font-bold text-foreground mb-4">11. {lang === "fr" ? "Contact" : "Contact"}</h3>
                  <p>{lang === "fr"
                    ? "Pour toute question concernant ces Conditions d\'utilisation, contactez-nous à : hellocoursia@gmail.com"
                    : "For any questions regarding these Terms of Use, contact us at: hellocoursia@gmail.com"}</p>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
