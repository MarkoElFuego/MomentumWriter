# PROGRESS.md

Agent: ažuriraj ovaj fajl na kraju svakog zadatka. Radi SAMO prvi nezavršen zadatak.

**Trenutna faza:** 4

## Faza 0 — Postavka
- [x] Next.js + TS + Tailwind + ESLint (pnpm)
- [x] Zavisnosti: TipTap, Dexie, Zod, OpenAI SDK (ranije Anthropic), Vitest, fake-indexeddb
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
- [x] extractContext + testovi
- [x] prompts / schemas / guardrail + testovi
- [x] POST /api/spark
- [x] Spark paleta (Ctrl/Cmd+J, 3 alata, Esc, fokus nazad)

## Faza 4 — Resume
- [x] ResumeState + lastSentence + testovi
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
- 2026-09-28: AI provajder promenjen sa Anthropic na OpenAI (korisnik ima GPT ključ): paket `openai`, `OPENAI_API_KEY`, model `gpt-6-luna` (najjeftiniji), JSON mode + Zod.
- 2026-09-28: `extractContext` uzima cele pasuse od kursora unazad; pasus koji ne staje seče se na početku rečenice. Sečenje po reči (sa „…”) samo ako je pasus kod kursora jedna preduga rečenica. Prima bilo šta sa `textBetween` (ProseMirror `Node`).
- 2026-09-28: Stavke duže od 220 (siže 160) znakova se **odsecaju** na granici reči sa „…”, ne odbacuju — AGENTS §7 ima prednost nad `.max()` iz AI_PROMPTS šeme. Deljenje na rečenice je u `lib/text/sentences.ts` (koriste ga extractContext i guardrail).
- 2026-09-28: Guardrail za kopiranje poredi nizove od 8 reči malim slovima, bez interpunkcije; `kind` polje se ne proverava.
- 2026-09-28: `/api/spark`: logika u `lib/ai/spark.ts` (poziv modela ubačen spolja radi testova), SDK samo u `lib/ai/openai.ts` sa `maxRetries: 0`. Jedan rok od 15 s važi za oba pokušaja; timeout se ne ponavlja. Server ponovo seče kontekst na `AI_CONTEXT_WORDS`. Greške: 400 `bad-request`, 500 `config`, 502 `unavailable`, 504 `timeout`. Razlog odbijanja se loguje u terminal (`[spark] …`).
- 2026-09-28: gpt-6-luna odbija `temperature` ≠ 1 → ne šaljemo je; `max_completion_tokens` 400 → 1200 jer se razmišljanje modela računa u limit. Prazan odgovor se loguje sa `finish_reason`.
- 2026-09-28: Spark paleta: kontekst i pozicija kursora se zamrzavaju pri otvaranju; zatvaranje vraća kursor na tu poziciju samo ako autor u međuvremenu nije kliknuo u tekst. Nema zatvaranja klikom van palete (kartice mogu da ostanu otvorene dok pišeš). Dodato dugme „Drugi alat” pored „Još jednom”/„Zatvori”. Ctrl+J hvata i `event.code === "KeyJ"` (ćirilični raspored). Firefox Ctrl+J (Downloads) proveriti u Fazi 5.
- 2026-09-28: `resumeState` se upisuje u istoj transakciji kao `saveScene` (opcioni `cursor` argument); pozicija i poslednja rečenica se čitaju pri save-u, ne na svaki taster. `openQuestion`/`openQuestionFor` se čuvaju pri prepisivanju. `lastSentence` uzima poslednji pasus → poslednju (i nedovršenu) rečenicu; duga rečenica čuva **kraj** sa „…” na početku. Bez migracije — tabela postoji od v1.

## Utisci iz korišćenja (ti upisuješ)
<!-- šta smeta, šta fali, šta nikad ne koristiš -->
