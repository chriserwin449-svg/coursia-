# Coursia — État du projet

> Dernière mise à jour : 16 juillet 2025 (session 3)

## Vue d'ensemble

**Coursia** est une plateforme SaaS d'apprentissage personnalisé par IA. L'utilisateur choisit un sujet, l'IA génère un cours structuré en 3 niveaux (Débutant → Intermédiaire → Avancé) avec des chapitres, des quiz et un suivi de progression.

## Stack technique

| Catégorie | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui (New York) |
| Animations | Framer Motion + CSS animations |
| Base de données | Prisma ORM + SQLite (libsql) |
| Auth | NextAuth.js v4 (credentials) |
| Paiement | PayPal |
| State client | Zustand |
| Hébergement | Vercel |
| Domaine | En cours d'achat (`coursia.app`) |

## Architecture des vues (App Shell)

Le routing est géré par un store Zustand (`useAppStore().view`) dans `src/app/page.tsx` :

| Vue | Composant | Description |
|---|---|---|
| `landing` | `LandingPage.tsx` | Page vitrine publique |
| `auth` | `AuthPage.tsx` | Connexion / Inscription |
| `create` | `CreateCourse.tsx` | Création de cours (saisie sujet) |
| `library` | `Library.tsx` | Bibliothèque de cours de l'utilisateur |
| `study` | `CourseViewer.tsx` | Lecture d'un cours + quiz par chapitre |
| `offers` | `OffersPage.tsx` | Plans d'abonnement + paiement |
| `settings` | `SettingsPage.tsx` | Paramètres utilisateur |

## Modèle de données (Prisma)

- **User** — email, mot de passe, nom, abonnement, `freeCourseUsed`
- **Course** — titre, description, niveau, chapitres
- **Chapter** — titre, contenu (markdown), quiz
- **Quiz** — questions JSON
- **CourseQuiz** — quiz final de niveau
- **ChapterProgress / CourseProgress** — suivi de complétion
- **FlameTransaction** — historique des points flamme
- **PaymentRequest** — demandes de paiement admin
- **Feedback** — retours utilisateurs
- **StudySession** — sessions d'étude
- **UsedTopic** — sujets déjà proposés (pour diversité)
- **AppSettings** — configuration globale

## Page vitrine (LandingPage) — État actuel

### Header / Navbar
- Logo Coursia + nom à gauche
- Navigation centre : Fonctionnalités, Comment ça marche, Tarifs
- Toggle langue (FR/EN) + bouton CTA "Commencer gratuitement" à droite
- **Glassmorphism au scroll** (bg-night/70 + backdrop-blur)
- Transparent par défaut

### Hero Section
- Fond sombre avec grille fine CSS + halos lumineux (violet, orange, rose)
- Badge IA "Propulsé par l'Intelligence Artificielle"
- **Titre avec animation typewriter** (s'écrit à l'arrivée, 30ms/char, curseur clignotant)
- Description sous le titre
- Bouton CTA "Commencer gratuitement" plein width, violet uni (#7c3aed), sans glow/shimmer
- Cartes flottantes desktop (Machine Learning, UX/UI, Marketing Digital, Intelligence Artificielle)
- Carte IA : spinner circulaire animé SVG (au lieu de barre de progression)
- Cartes avec animations float CSS + délais décalés

### Sections (toutes avec fade-in au scroll)
1. **Pourquoi Coursia** (features) — 4 cartes : Leçons dynamiques, 100% personnalisé, Suivi intelligent, Apprends plus vite
2. **Pour qui ?** (audience) — 3 cartes : Étudiants, Professionnels, Curieux
3. **Différence vs ChatGPT** (diff) — 3 cartes : Progression par niveaux, Suivi structuré, Système de flammes & badges
4. **Tarifs** (pricing) — Mensuel ($4.99/mois) + Annuel ($1.79/mois, badge "Le plus économique")
5. **FAQ** — 6 questions en accordéon
6. **CTA final** — Carte glass avec bouton
7. **Footer** — Logo, liens légaux (modals), copyright

### Animations
- Typewriter sur le titre hero (curseur clignotant violet, disparaît à la fin)
- Fade-in + slide-up sur **toutes** les sections au scroll (IntersectionObserver, 7 sections)
- Float animation sur les cartes hero (4 variantes CSS)
- Spinner circulaire SVG sur la carte IA
- Aurora arc en bas de page (3 couches + particules)
- Shimmer sur les cartes pricing
- **CreateCourse** : bannière sujet suggéré + pill niveau avec `animate-fade-in-slide-up`

### Responsive (mobile-first)
- **Mobile (<768px)** : sidebar masquée, hamburger menu + slide-over, contenu pleine largeur, grilles 1 colonne, boutons pleine largeur, touch targets ≥44px
- **Tablette (768-1024px)** : sidebar réduite (icônes seules), grilles 2 colonnes
- **Desktop (1024px+)** : sidebar complète, grilles 3-4 colonnes, layout inchangé

### Bug fixes (session 3)
- **Cours d'essai gratuit** : le bouton Générer était cliquable AVANT que le statut paywall soit chargé → redirectait vers offres. Fix : disabled tant que `paywallLoaded` est false + early return dans `generateCourse()`
- **Crash page Offres** : `<style jsx global>` causait une erreur côté client sur Vercel (App Router). Styles déplacés dans `globals.css`
- **Barre de flammes à 0** : `Math.max(..., 8)` forçait 8% min → retiré, affiche maintenant 0% correctement

## Fonctionnalités implémentées

### Authentification
- Inscription / Connexion par email + mot de passe
- Session persistante via NextAuth
- Protection des routes API par session

### Génération de cours
- Saisie d'un sujet → génération IA (3 niveaux × 3 chapitres)
- Contenu en markdown avec résumé
- Quiz automatiques par chapitre
- Système de flammes (points) pour la motivation
- Badges de progression

### Suivi de progression
- Complétion par chapitre
- Quiz de fin de chapitre (4/7 pour passer)
- Niveaux débloqués séquentiellement
- Historique des sessions d'étude

### Monétisation
- Plans mensuel / annuel via PayPal
- Page offres avec détails
- Un cours gratuit par utilisateur (`freeCourseUsed`)
- Webhook PayPal pour confirmation

### i18n
- Système FR/EN via `src/lib/i18n.ts`
- Toggle langue dans la navbar

## Points à améliorer / TODO

### Haute priorité
- [ ] Achat domaine `coursia.app` via Vercel
- [ ] Système de quiz final de niveau (7 questions, 4/7 minimum, retry avec questions différentes)
- [ ] Prévention abus cours gratuit (flag `freeCourseUsed` non reset à la suppression)
- [ ] Message flow "Ton premier cours est gratuit" → "Tu as utilisé ton cours d'essai" → ne plus réapparaître

### Moyenne priorité
- [ ] Bug langue (sélection EN → cours généré en FR)
- [ ] Bug animation bouton "Suivant" (double-click)
- [ ] Diversité des sujets aléatoires (ne jamais répéter, tracker via `UsedTopic`)
- [ ] Persistance de la génération (continuer si l'utilisateur navigue)
- [ ] Système de flammes : refonte des points
- [ ] Notification d'expiration abonnement 48h (badge rouge + bannière)

### Basse priorité
- [ ] Améliorer la qualité de la génération de cours (prompt engineering)
- [ ] Espacement PayPal sur la page offres
- [ ] Optimisation SEO pour le domaine `coursia.app`

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/page.tsx` | Point d'entrée, routing par store |
| `src/components/coursia/LandingPage.tsx` | Page vitrine complète |
| `src/components/coursia/CreateCourse.tsx` | Création de cours |
| `src/components/coursia/CourseViewer.tsx` | Lecteur de cours + quiz |
| `src/components/coursia/OffersPage.tsx` | Plans et paiement |
| `src/components/coursia/Library.tsx` | Bibliothèque utilisateur |
| `src/components/coursia/AuthPage.tsx` | Authentification |
| `src/components/coursia/SettingsPage.tsx` | Paramètres |
| `src/lib/store.ts` | Store Zustand global |
| `src/lib/i18n.ts` | Traductions FR/EN |
| `src/lib/db.ts` | Client Prisma |
| `src/lib/supabase.ts` | Client Supabase |
| `src/app/globals.css` | Styles globaux + animations |
| `prisma/schema.prisma` | Schéma de base de données |