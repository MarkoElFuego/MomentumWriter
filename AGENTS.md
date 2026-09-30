# AGENTS.md — Momentum

Ovo je glavni fajl sa pravilima za sve AI agente koji rade na projektu. Pročitaj ga ceo pre bilo kakve izmene.

## 1. Šta pravimo

Minimalistički editor za pisanje proze (romani, priče) sa AI **sparing partnerom** koji autora gura napred kada zapne — ali **nikada ne piše umesto njega**.

Detalji: `docs/PRODUCT.md` · Arhitektura: `docs/ARCHITECTURE.md` · AI promptovi: `docs/AI_PROMPTS.md`

## 2. Zlatna pravila (ne krši ih nikad)

1. **AI predlaže, autor odlučuje.** Ništa ne ulazi u tekst bez eksplicitnog prihvatanja (Tab, broj, klik, Enter, „Prihvati”). AI **dodaje** tekst samo kao dopunu do kraja rečenice: **dovršetak započete rečenice** ≤ 7 reči (najbolje 2–5) ili **početak sledeće** ≤ 5 reči, bez tačke (sivi tekst dok pišeš ili ✦ Poguraj me). AI **menja** postojeći tekst samo kroz **proveru jezika** (pravopis, gramatika, dijakritici — kao Grammarly): svaka ispravka je podvučena reč koju autor prihvata ili odbacuje; stil, redosled i izbor reči i žargon u dijalogu se ne diraju. AI nikad ne piše pasuse, više rečenica, dijalog ni „nastavi tekst”, i nikad ne ocenjuje ni kritikuje tekst. *(Izmenjeno 2026-09-29, odluka autora.)*
2. **Editor je svetinja.** Na ekranu za pisanje: tekst, kursor, brojač reči danas, jedno AI dugme. Ništa više bez eksplicitnog odobrenja.
3. **Tekst korisnika se nikad ne gubi.** Autosave (debounce ~800 ms) + save na `visibilitychange`/`beforeunload`. Svaka izmena modela podataka = nova Dexie verzija + migracija + test migracije.
4. **Bez gamifikacije u Duolingo stilu.** Nema streak-ova, plamenčića, kažnjavanja, crvenih upozorenja.
5. **Radi samo trenutnu fazu** iz `docs/PROGRESS.md` (plan za v0.2 je u `docs/ZADATAK_v0.2.md`). Ne dodaj funkcije iz kasnijih faza ili verzija (email, sync, auth…) čak i ako „izgleda lako”.
6. **Minimalizam.** Editor je tekst, kursor i tišina. Sve je nevidljivo dok ne zatreba. Nema novih dugmadi, panela ni funkcija van trenutne faze.
7. **Ne diraj ono što radi.** Sivi tekst (dopune), Spark paleta, Resume i autosave zadržavaju postojeće ponašanje osim ako faza kaže drugačije.

## 3. Stack

- Next.js 15 (App Router) + TypeScript (strict)
- Tailwind CSS
- TipTap (ProseMirror) za editor
- Dexie.js (IndexedDB) za lokalno čuvanje — **ne** localStorage za sadržaj
- Zustand za UI stanje (samo ako zatreba)
- OpenAI SDK (`openai`) preko server route-a; ključ iz `OPENAI_API_KEY`, model iz `AI_MODEL` env promenljive
- Zod za validaciju AI odgovora i API ulaza
- Vitest za unit testove
- Paket menadžer: **pnpm**

Ne dodaj nove zavisnosti bez obrazloženja u odgovoru. Preferiraj malo koda umesto nove biblioteke.

## 4. Komande

```bash
pnpm dev          # razvojni server
pnpm build        # produkcijski build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
```

Pre nego što kažeš da je zadatak gotov: `pnpm typecheck && pnpm lint && pnpm test` moraju proći.

## 5. Struktura

```
src/
  app/
    page.tsx                 # biblioteka knjiga / ulaz
    write/[partId]/page.tsx  # editor (jedan deo knjige)
    resume/page.tsx          # Resume ekran
    api/spark/route.ts       # jedini AI endpoint
  components/
    editor/                  # TipTap editor, footer, brojač
    spark/                   # Spark paleta (Ctrl+/) i kartice odgovora
    structure/               # sadržaj knjige: uvodni delovi / poglavlja / završni delovi
    resume/
  lib/
    db/                      # Dexie šema, migracije, repo funkcije
    ai/                      # promptovi, zod šeme, klijent
    text/                    # brojanje reči, izvlačenje konteksta
  hooks/
```

## 6. Stil koda

- Funkcionalne React komponente, named exports (osim Next.js stranica).
- Server kod (API ključ!) nikad ne sme da se importuje u klijentske komponente.
- Imena u kodu na **engleskom**; tekst u UI na **srpskom (latinica)**.
- Sav UI tekst drži u `src/lib/copy.ts` — lako menjanje tona kasnije.
- Male funkcije, bez preranih apstrakcija. Komentari samo kad objašnjavaju *zašto*.
- Pristupačnost: sve akcije dostupne sa tastature, fokus vidljiv.

## 7. AI pravila (tehnička)

- Jedan endpoint: `POST /api/spark` sa `mode: "push" | "complicate" | "missing" | "resume" | "ghost"` (u v0.2 je dodat `"proofread"`; `"synonyms"` je odložen).
- `ghost` (sivi tekst) radi po stanju kursora — usred rečenice dovršetak, posle završene rečenice početak sledeće, u praznom pasusu **nema API poziva** (samo podsetnik); koristi `AI_GHOST_CONTEXT_WORDS` (~150 reči), 1 pokušaj i timeout 6 s; zahtev se otkazuje čim autor nastavi da kuca. Pauze su u `src/lib/timing.ts`. Radi dobro — ne optimizuj bez odluke autora.
- `proofread` (v0.2): model vraća ceo ispravljen pasus kao čist tekst, ali on se **nikad ne ubacuje** — služi samo za diff po rečima (`lib/text/proofDiff.ts`), a autor prihvata ispravke reč po reč. Guardrail protiv proze za ovaj mode ne važi; umesto njega važe pravila iz `proofDiff` (sličnost reči, razlika u broju reči).
- Kontekst: poslednjih ~400 reči pre kursora (vidi `lib/text/extractContext.ts`). Ne šalji celu knjigu.
- Model mora da vrati JSON: koristi JSON mode (`response_format: { type: "json_object" }`) i svejedno parsiraj kroz Zod (izuzetak: `proofread` vraća čist tekst). Na grešku: jedan retry, pa ljubazna poruka u UI.
- Server odseca stavke duže od 220 karaktera i odbacuje odgovor koji liči na prozu (vidi `docs/AI_PROMPTS.md` → „Guardrail”).
- **GPT-6 Luna parametri:** `temperature` sme da se pošalje SAMO uz `reasoning_effort: "none"`; uz bilo koji drugi effort `temperature`/`top_p` ne smeju biti u zahtevu (API vraća 400). Parametre zahteva uvek gradi preko jednog helpera (`lib/ai/requestParams.ts`, v0.2 Faza 2).
- Timeout 15 s. Prikaži skeleton dok čekaš. Esc zatvara paletu.

## 8. Način rada

1. Pročitaj `docs/PROGRESS.md` i nađi prvi nezavršen zadatak.
2. Pre kodiranja napiši kratak plan (koji fajlovi, šta menjaš) — max 10 redova.
3. Implementiraj najmanju verziju koja ispunjava „Gotovo kada”.
4. Pokreni provere (sekcija 4).
5. Ažuriraj `docs/PROGRESS.md`: označi `[x]`, dodaj kratku belešku ako si nešto odlučio.
6. Predloži commit poruku (Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

Ako nešto nije jasno ili se kosi sa zlatnim pravilima — **pitaj, ne pretpostavljaj.**

## 9. Šta testirati

- `lib/text/*` (brojanje reči, izvlačenje konteksta, poslednja rečenica) — obavezno unit testovi.
- `lib/ai/schemas.ts` + guardrail — testovi sa dobrim i lošim AI odgovorima.
- `lib/db/*` repo funkcije — testovi sa `fake-indexeddb`.
- UI se testira ručno po „Gotovo kada” listi iz `docs/PLAN.md`.
