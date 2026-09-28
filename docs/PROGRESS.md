# PROGRESS.md

Agent: ažuriraj ovaj fajl na kraju svakog zadatka. Radi SAMO prvi nezavršen zadatak.

**Trenutna faza:** 3

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
- [x] Dexie šema v1 + repo funkcije + testovi
- [x] Početna: lista knjiga, „Nova knjiga”
- [x] Autosave (debounce + flush) + status
- [x] Panel strukture (Ctrl/Cmd+\)
- [x] DailyStat → pravi „reči danas”

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
- 2026-09-25: Dexie v1 uključuje i `resumeState` tabelu (prazna do Faze 4) da ne bi trebala migracija.
- 2026-09-25: `saveScene` u jednoj transakciji čuva scenu + `endWordTotal`; ako dan pređe ponoć tokom pisanja, novi dan kreće od totala pre tog save-a.
- 2026-09-25: `openScene` (lib/db/session.ts) pri otvaranju upisuje `startWordTotal`; footer računa „reči danas” uživo (ostale scene + trenutna).
- 2026-09-25: Autosave: neuspeli save se ne guta — status „Čuvanje nije uspelo”, retry na 3 s, a `beforeunload` traži potvrdu samo ako je poslednji save pao.
- 2026-09-25: Otvaranje knjige vodi na prvu scenu dok Faza 4 ne doda poziciju kursora.
- 2026-09-25: Preimenovanje: dupli klik ili F2; Enter čuva, Esc odustaje. Knjiga se preimenuje u vrhu panela.
- 2026-09-25: Ctrl/Cmd+\ proverava i `event.code === "Backslash"` — na srpskom rasporedu taj taster je „ž”.
- 2026-09-25: Stanje panela (otvoren/zatvoren) u `sessionStorage` — samo UI, ne sadržaj; stranica se remontira pri promeni scene.
- 2026-09-25: `···` meni sadrži: status čuvanja, „Struktura”, „Sve knjige”. Brisanje knjiga/poglavlja/scena namerno još ne postoji.
- 2026-09-25: `newId()` ima fallback jer `crypto.randomUUID` ne postoji na http preko LAN IP-a (npr. telefon).

## Utisci iz korišćenja (ti upisuješ)
<!-- šta smeta, šta fali, šta nikad ne koristiš -->
