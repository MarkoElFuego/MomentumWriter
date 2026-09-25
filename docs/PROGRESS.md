# PROGRESS.md

Agent: ažuriraj ovaj fajl na kraju svakog zadatka. Radi SAMO prvi nezavršen zadatak.

**Trenutna faza:** 2

## Faza 0 — Postavka
- [x] Next.js + TS + Tailwind + ESLint (pnpm)
- [x] Zavisnosti: TipTap, Dexie, Zod, Anthropic SDK, Vitest, fake-indexeddb
- [x] Struktura foldera + copy.ts + skripte
- [x] .env.local u .gitignore, trivijalan test

## Faza 1 — Editor
- [x] /write/demo sa TipTap, bez toolbar-a, serif, centrirana kolona
- [x] Footer: reči + „✦ Treba mi impuls”
- [x] Svetla/tamna tema
- [x] countWords + testovi

## Faza 2 — Struktura + čuvanje
- [ ] Dexie šema v1 + repo funkcije + testovi
- [ ] Početna: lista knjiga, „Nova knjiga”
- [ ] Autosave (debounce + flush) + status
- [ ] Panel strukture (Ctrl/Cmd+\)
- [ ] DailyStat → pravi „reči danas”

## Faza 3 — Sparing partner
- [ ] extractContext + testovi
- [ ] prompts / schemas / guardrail + testovi
- [ ] POST /api/spark
- [ ] Spark paleta (Ctrl/Cmd+J, 3 alata, Esc, fokus nazad)

## Faza 4 — Resume
- [ ] ResumeState + lastSentence + testovi
- [ ] Pravilo 6h → /resume
- [ ] Resume ekran (radi i bez AI-ja)
- [ ] 4. alat „↩ Vrati me u priču”

## Faza 5 — Polish
- [ ] copy.ts ton
- [ ] Tipografija + prazna stanja
- [ ] Export Markdown
- [ ] Provera prečica po browserima
- [ ] /review bez ❌

## Odluke (agent upisuje)
<!-- npr. 2026-09-26: font Literata preko next/font jer... -->
- 2026-09-25: Next.js 15.5 + React 19, Tailwind v4 (`@tailwindcss/postcss`, bez tailwind.config), ESLint 9 flat config.
- 2026-09-25: TypeScript zakucan na ~5.9 — TS 7 nije podržan od typescript-eslint-a.
- 2026-09-25: `lint` = `eslint .` jer je `next lint` deprecated u Next 15.5.
- 2026-09-25: `@tiptap/pm` dodat eksplicitno — obavezan peer za `@tiptap/react` v3.
- 2026-09-25: Zod je v4 — pri pisanju šema (Faza 3) koristiti v4 API.
- 2026-09-25: tsconfig ima i `noUncheckedIndexedAccess` radi sigurnosti pri radu sa nizovima.
- 2026-09-25: Font Literata preko `next/font/google` (self-hosted pri build-u, latin-ext + ćirilica), fallback Georgia.
- 2026-09-25: StarterKit bez code, codeBlock, horizontalRule i link — samo proza; H1 samo nivo 1.
- 2026-09-25: Tema preko CSS promenljivih + Tailwind `@theme inline` (`bg-paper`, `text-ink`, `text-muted`); samo `prefers-color-scheme`, bez ručnog prekidača.
- 2026-09-25: „reč/reči” se sklanja u `copy.editor.wordsToday(n)`.

## Utisci iz korišćenja (ti upisuješ)
<!-- šta smeta, šta fali, šta nikad ne koristiš -->
