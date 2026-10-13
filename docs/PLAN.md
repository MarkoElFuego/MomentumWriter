# PLAN.md — Vibe coding plan

**Pravila igre**
- Jedna faza = jedan novi razgovor sa agentom = jedan commit.
- Nalepi prompt faze, pusti agenta da napravi plan, reci „ok”, pa pusti da radi.
- Posle faze sam prođi „Gotovo kada” u browseru. Ako nešto ne radi — popravi u istom razgovoru, tek onda commit.
- Ako agent počne da „dodaje stvari” — vrati ga: *„Drži se trenutne faze iz AGENTS.md.”*

Procena: v0.1 ≈ 6 faza, 1–2 večeri po fazi.

---

## Faza 0 — Postavka projekta

**Prompt:**
```
Pročitaj AGENTS.md i docs/ARCHITECTURE.md. Postavi prazan Next.js 15 projekat (App Router, TypeScript strict, Tailwind, ESLint) sa pnpm u ovom folderu, ne briši postojeće .md fajlove.
Dodaj: Vitest (+ fake-indexeddb), Zod, Dexie, TipTap (@tiptap/react, @tiptap/starter-kit, @tiptap/extension-placeholder), openai.
Napravi strukturu foldera iz AGENTS.md sa praznim placeholder fajlovima, src/lib/copy.ts, i skripte dev/build/lint/typecheck/test.
Dodaj .env.local u .gitignore. Napravi jedan trivijalan test da Vitest radi.
```
**Gotovo kada:** `pnpm dev` otvara stranicu · `pnpm typecheck && pnpm lint && pnpm test` prolaze · struktura foldera postoji.

---

## Faza 1 — Minimalistički editor

**Prompt:**
```
Faza 1 iz docs/PLAN.md. Napravi stranicu /write/demo sa TipTap editorom:
- centrirana kolona ~66 karaktera širine, serif font za tekst (npr. "Literata" ili sistemski Georgia), velika margina, bez toolbar-a
- placeholder iz copy.ts ("Počni ovde…")
- podrška za naslov poglavlja (H1) i pasuse; bold/italic samo prečicama
- footer: levo "{n} reči danas" (za sada: reči u dokumentu), desno dugme "✦ Treba mi impuls" (još ne radi ništa)
- gore desno: naziv poglavlja i "···" meni (prazan)
- svetla i tamna tema preko prefers-color-scheme
Napravi lib/text/countWords.ts sa testovima (latinica, ćirilica, interpunkcija, prazan string).
Još bez baze.
```
**Gotovo kada:** kucanje je glatko, nema ničeg osim teksta · brojač radi · tamna tema radi · testovi za countWords prolaze.

---

## Faza 2 — Struktura + lokalno čuvanje

**Prompt:**
```
Faza 2 iz docs/PLAN.md. Implementiraj Dexie šemu tačno po docs/ARCHITECTURE.md (lib/db/schema.ts) i repo funkcije (lib/db/books.ts, chapters.ts, scenes.ts) sa testovima preko fake-indexeddb.
- Početna stranica "/": lista knjiga + "Nova knjiga" (napravi i Poglavlje I i Scenu 1)
- /write/[sceneId] učitava scenu iz baze
- Autosave: debounce 800 ms + flush na visibilitychange/beforeunload
- Status "Sačuvano / Čuvam…" u ··· meniju
- Ctrl/Cmd+\ otvara tanak levi panel: poglavlja → scene, dodavanje, preimenovanje (dupli klik), prebacivanje između scena. Panel je podrazumevano zatvoren.
- DailyStat: pri prvom otvaranju dana upiši startWordTotal; footer prikazuje pravi "reči danas".
```
**Gotovo kada:** refresh stranice ne gubi ni jednu reč · mogu da napravim 2 poglavlja × 3 scene i krećem se između njih · „reči danas” se ne resetuje refreshom, a sutra kreće od nule.

---

## Faza 3 — AI sparing partner (Spark paleta) — ISTORIJA

> Paleta i svi njeni alati su izbačeni (`docs/PRODUCT.md` → „Izbačeno”); kod se uklanja u `docs/ZADATAK_UI.md` U1. Od ove faze ostaju `extractContext`, `/api/spark`, šeme i guardrail.

**Prompt:**
```
Faza 3 iz docs/PLAN.md. Implementiraj AI sparing partnera tačno po docs/AI_PROMPTS.md:
- lib/text/extractContext.ts (+ testovi): poslednjih AI_CONTEXT_WORDS reči pre kursora
- lib/ai/prompts.ts, schemas.ts, guardrail.ts (+ testovi iz AI_PROMPTS.md)
- POST /api/spark: Zod ulaz, poziv OpenAI API-ja, parsiranje, guardrail, jedan retry, timeout 15s
- Spark paleta: prečica ili klik na "✦ Treba mi impuls" otvara mali lebdeći prozor iznad footera sa 3 alata: 1 ✦ Poguraj me, 2 ⚔ Zakomplikuj, 3 👁 Šta mi nedostaje?  (izbor brojem ili klikom; Esc zatvara)
- Rezultat: kratke kartice, skeleton dok čeka. Kartice se NE ubacuju u tekst. Dugme "Još jednom" i "Zatvori".
- Fokus se posle zatvaranja vraća u editor na istu poziciju.
Alat "↩ Vrati me u priču" pravimo u Fazi 4.
```
**Gotovo kada:** paleta → `1` usred rečenice daje 3 dovršetka moje misli (≤ 7 reči), posle tačke 3 početka sledeće (≤ 5 reči); izbor se ubacuje na kursor (izmenjeno 2026-09-28) · ostali alati nisu proza · bez interneta dobijam ljubaznu poruku, ne pad aplikacije · kursor ostaje gde je bio.

---

## Faza 4 — Resume ekran

**Prompt:**
```
Faza 4 iz docs/PLAN.md. Implementiraj povratak u priču:
- ResumeState po ARCHITECTURE.md: ažurira se pri autosave-u (sceneId, cursorPos, lastSentence, lastWrittenAt). lib/text/lastSentence.ts + testovi.
- Otvaranje knjige: ako je lastWrittenAt stariji od 6h → /resume?book=..., inače direktno editor na poziciji kursora.
- /resume: "Dobrodošao nazad." · "Juče si stao ovde:" (ili "Pre N dana…") · citat poslednje rečenice · linija · "Otvoreno pitanje:" (AI mode "resume", keširano po hash-u konteksta; skeleton dok se učitava; ako AI padne, sekcija se samo sakrije) · dugme [Nastavi da pišeš] koje radi odmah, bez čekanja AI-ja.
- Klik → editor, poglavlje od početka (izmenjeno 2026-10-02: kursor se više ne vraća na cursorPos).
```
**Gotovo kada:** zatvorim tab, promenim `lastWrittenAt` u DevTools-u na juče, otvorim → vidim Resume · „Nastavi” me vraća tačno na kursor · Resume radi i bez AI-ja.

---

## Faza 5 — Polish i svakodnevna upotreba

**Prompt:**
```
Faza 5 iz docs/PLAN.md. Samo poliranje, bez novih funkcija:
- prođi sve UI tekstove u copy.ts — ton topao, kratak, bez uzvičnika i krivice
- tipografija: line-height, veličina, širina kolone; fokus stil; animacije ≤150ms
- prazna stanja (nema knjiga, prazna scena)
- export trenutne knjige u Markdown (··· meni) kao sigurnosna kopija
- proveri prečice (ARCHITECTURE.md → „Prečice”) u Chrome/Firefox/Safari
- pokreni /review i popravi sve ❌
```
**Gotovo kada:** pišeš 7 dana zaredom u sopstvenoj aplikaciji. Beleži šta smeta u `docs/PROGRESS.md` → „Utisci”.

---

> Napomena (2026-09-29): prečice su se menjale posle Faze 3 — važeća tabela je u `docs/ARCHITECTURE.md` → „Prečice”.

## v0.2

Plan i „Gotovo kada” po fazama: **`docs/ZADATAK_v0.2.md`** (redosled i status u `docs/PROGRESS.md`). Faze 4 (Resume) i 5 (Polish) iz v0.1 rade se posle v0.2.

## Posle v0.2

Redosled (status u `docs/PROGRESS.md`): `docs/ZADATAK_UI.md` U0 → U1 → ostatak Faze 4 (Resume, bez 4. alata) → U2–U7 → `docs/ZADATAK_Tiron.md` T0–T7. Mesto Faze 5 (Polish) u redosledu određuje autor.

## Kasnije (bez roka)

1. **Stranice umesto reči** — „+ 1 stranica” svakih 300 reči, mala animacija papira na gomilu
2. **Kalendar** na početnom ekranu (tačkice po danima, „6 dana pisanja · 4.280 novih reči · 12 stranica”)
3. **`[[likovi]]`** — TipTap mention ekstenzija, kartica lika, AI dobija listu likova u kontekstu
4. **Optimizacija troškova sivog teksta** (v0.2 Faza 8) — samo ako autor odluči

## v0.3 (cloud + povratak mejlom)

1. **Supabase** auth (magic link) + sync (lokalno ostaje izvor istine, sync u pozadini)
2. **Resend** email „Nezavršena rečenica”: naslov iz priče („Petar je ostao ispred otvorenih vrata.”), poslednja rečenica, jedno pitanje, dugme „Nastavi poglavlje →”
3. **Cron** (Vercel/Supabase) jednom dnevno: ko nije pisao 2–3 dana → max 1 mejl, pa pauza nedelju dana
4. **Nedeljni pregled narativa**: scene ove nedelje, najprisutniji lik, sledeći otvoreni korak
5. **Deep link** sa tokenom → tačno ta scena i kursor

> Pre v0.3: ažuriraj AGENTS.md (novi stack, env promenljive, privatnost — rukopis na serveru!).
