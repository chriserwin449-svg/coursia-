# Coursia — Project State

> **Last updated:** 2025-06-30
> **Version:** 0.2.0
> **Domain:** coursia.io

## Purpose

This folder tracks the complete state of the Coursia SaaS project.
It is updated after every modification or feature addition to prevent
context loss between sessions.

## Files

| File | Description |
|------|-------------|
| `architecture.md` | Tech stack, file structure, data models, state management |
| `features.md` | All features implemented, their status, and key details |
| `changelog.md` | Chronological log of every change |
| `api-routes.md` | All API endpoints with request/response details |

## Quick Stats

- **Framework:** Next.js 16 + React 19 + TypeScript 5
- **Database:** SQLite via Prisma ORM (libSQL adapter)
- **UI:** Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State:** Zustand v5
- **Auth:** NextAuth 4 (credentials) + localStorage token
- **Payments:** PayPal (redirect flow)
- **AI:** z-ai-web-dev-sdk + multi-provider fallback (Groq, Gemini, OpenAI)
- **i18n:** French (primary) + English
- **Hosting:** Vercel (coursia.io)
- **API Routes:** 30
- **Components:** 19 Coursia + 42 shadcn/ui
- **DB Models:** 10