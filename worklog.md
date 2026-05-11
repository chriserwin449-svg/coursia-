---
Task ID: 1
Agent: Main Agent
Task: Replace DiceBear avatars with real AI-generated face photos, update trial system, remove flame display from CreateCourse, fix random topic, add flame bar to Journey, remove Score moyen

Work Log:
- Generated 6 professional AI headshot images for testimonials (marie.jpg, thomas.jpg, sarah.jpg, lucas.jpg, emma.jpg, nicolas.jpg) using z-ai image generation
- Updated LandingPage.tsx: replaced DiceBear URLs with local /avatars/*.jpg paths
- Updated i18n.ts: trial info changed from "1 cours, 3 jours" to "3 cours, 7 jours" in both FR and EN
- Updated OffersPage.tsx: FAQ trial text updated to match 7-day/3-course trial
- Rewrote CreateCourse.tsx: removed all flame points state, fetch, and display; removed Flame icon import; simplified generate button (no flame cost); added handleTitleChange to clear suggested topic when user types manually
- Rewrote Journey.tsx: replaced "Ma Progression" yellow bar with dynamic flame progress bar using /api/flames data; shows current flame type (emoji, name, color), flame points, progress percentage to next tier; removed Score moyen 4th card; changed stats grid from 4-col to 3-col; added Flame icon and formatFlamePoints import
- Verified generate/route.ts prompt already includes sub-chapters requirement (## en Markdown, 2-3 per chapter)
- Ran lint: clean, no errors
- Page loads with 200 OK status

Stage Summary:
- All 6 avatar images generated and saved to /public/avatars/
- Trial system text updated to 7 days / 3 courses everywhere (landing, offers, FAQ)
- CreateCourse page cleaned up: no more flame points display or cost logic
- Random topic: suggested topic clears when user modifies title manually; new random topic appears instantly on each shuffle click
- Journey page now shows a beautiful flame progress bar with tier system (Étincelle → Flamme → Brasier → Incendie → Météore → Supernova → Légende)
- Score moyen card removed from Journey, grid is now 3 columns
- Sub-chapters already enforced in AI generation prompt
