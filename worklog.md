---
Task ID: 1
Agent: Main
Task: Domain purchase guide + Full SEO implementation

Work Log:
- Guided user step-by-step for purchasing coursia.app via Vercel dashboard
- Answered user's question: yes, all future code changes will automatically reflect on the new domain
- Updated app/layout.tsx with metadataBase (https://coursia.app), title.template, complete Open Graph, Twitter Cards, canonical URL, hreflang
- Created app/sitemap.ts (auto-generated sitemap)
- Created app/robots.ts (allow all except /api/, block GPTBot)
- Deleted public/robots.txt (replaced by app/robots.ts)
- Added JSON-LD Organization + WebSite in layout <head>
- Added JSON-LD FAQPage + SoftwareApplication in LandingPage (client-side <script> tags)
- Converted nav links from <button onClick> to <a href> for SEO crawlability
- Added aria-label on main nav for accessibility
- Added display: "swap" to next/font to prevent FOIT
- Set <html lang="fr"> as default language
- Verified: no <img> tags in code, all images use next/image
- Verified: fonts already use next/font
- Updated STATUS.md with all SEO changes
- Pushed to GitHub (commit 137ae1d)

Stage Summary:
- Complete SEO foundation implemented: metadata, sitemap, robots, JSON-LD (4 schemas), Open Graph, Twitter Cards, hreflang, canonical, semantic HTML, accessibility
- All 10 todo items completed
- Domain guide provided: Vercel Dashboard → Settings → Domains → Purchase coursia.app
