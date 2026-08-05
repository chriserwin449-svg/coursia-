# Task 1: LandingPage.tsx Rewrite

## Status: Completed

## Changes Made

### 1. Fixed Floating Animations Overflowing
- Right column container already had `overflow-hidden`; adjusted floating card positions to be more conservative (card 2: `left: 55%` → `50%`, card 4: `left: 50%` → `45%`) to prevent overflow past container bounds.

### 2. Fixed Background Images Disappearing
- Replaced inline `style={{ transform: 'rotate(-3deg)' }}` on each `<img>` with `data-rotate="-3"` attributes.
- Added a new `useEffect` that reads `data-rotate` and sets `--rotate` CSS custom property on each image.
- Changed parallax handler to use `style.setProperty('--parallax-y', ...)` instead of overwriting `style.transform`.
- Updated `.study-bg-img` CSS to: `transform: rotate(var(--rotate, 0deg)) translateY(var(--parallax-y, 0px)); transition: none;`

### 3. Standardized CTA Buttons
- Changed hero CTA button from `rounded-xl` to `rounded-full` to match navbar button. Both now use `hero-premium-btn` class with `rounded-full`.

### 4. Added Interactive CTA Section (Generate CTA)
- Added new section `id="generate-cta"` between diff and compare sections.
- Contains a glass card with topic input field, generate button, and quick topic tags.
- Added `topicInput` state, `quickTopics` array, and `handleGenerateFromLP` handler.
- Handler calls `useAppStore.getState().setRandomTopic()` and `setRandomCourseLang()`.

### 5. Made Comparison Section Bigger
- Increased `max-w-4xl` → `max-w-5xl`.
- Increased card padding: `p-8 sm:p-10` → `p-8 sm:p-12`.
- Increased badge size: `px-5 py-2.5 text-sm` → `px-6 py-3 text-base`.
- Increased content area: `min-h-[220px]` → `min-h-[280px]`.
- Made text bigger: `font-bold` → `text-lg font-bold` for h4, `text-sm` → `text-base` for p.
- Added 4th point to "Avec Coursia": "Parcours illimité" with Layers icon.
- Added 4th point to "Sans Coursia": "Contenu non structuré" with Lock icon.

### 6. Added Bottom CTA Section
- Added section `id="bottom-cta"` after FAQ.
- Simple centered question + `hero-premium-btn` with Sparkles icon and ArrowRight.

### 7. Changed FAQ Chevron to +/- Toggle
- Replaced `ChevronDown` icon with a circular button containing `+`/`−` text.
- Active state shows `−` with mauve styling; inactive shows `+` with muted styling.
- Removed `ChevronDown` from lucide imports.

### 8. Added Store Functions
- Added `setRandomTopic` and `setRandomCourseLang` to store destructuring.

## Verification
- ESLint: No errors in LandingPage.tsx.
- Dev server: Page compiles and serves (200 responses, 3-4ms compile time).
