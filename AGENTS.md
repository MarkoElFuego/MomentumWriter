# AGENTS.md — Momentum

Ovo je glavni fajl sa pravilima za sve AI agente koji rade na projektu. Pročitaj ga ceo pre bilo kakve izmene.

## 1. Šta pravimo

**Editor za pisanje knjiga sa mentorom (Tironom) koji ti pomaže da je završiš** — AI pomaže, ali **nikada ne piše umesto autora**.

Detalji: `docs/PRODUCT.md` (izvor istine za raspored ekrana i listu funkcija) · Arhitektura: `docs/ARCHITECTURE.md` · AI promptovi: `docs/AI_PROMPTS.md`

## 2. Zlatna pravila (ne krši ih nikad)

1. **AI predlaže, autor odlučuje.** Ništa ne ulazi u tekst bez eksplicitnog prihvatanja (Tab, broj, klik, Enter, „Prihvati”). AI **dodaje** tekst samo kao dopunu do kraja rečenice: **dovršetak započete rečenice** ≤ 7 reči (najbolje 2–5) ili **početak sledeće** ≤ 5 reči, bez tačke (sivi tekst dok pišeš). AI **menja** postojeći tekst samo kroz **proveru jezika** (pravopis, gramatika, dijakritici — kao Grammarly): svaka ispravka je podvučena reč koju autor prihvata ili odbacuje; stil, redosled i izbor reči i žargon u dijalogu se ne diraju. AI nikad ne piše pasuse, više rečenica, dijalog ni „nastavi tekst”, i nikad ne ocenjuje ni kritikuje tekst. *(Izmenjeno 2026-09-29, odluka autora.)*
2. **Editor je svetinja.** Raspored je tačno onaj iz `docs/PRODUCT.md` → „Raspored ekrana”: gornja traka koja bledi dok kucaš, tekst, „reči danas”, levi panel (sadržaj) i desni panel (Tiron, 4 sekcije) — oba panela podrazumevano zatvorena. Ništa više bez eksplicitnog odobrenja.
3. **Tekst korisnika se nikad ne gubi.** Autosave (debounce ~800 ms) + save na `visibilitychange`/`beforeunload`. Svaka izmena modela podataka = nova Dexie verzija + migracija + test migracije.
4. **Bez gamifikacije u Duolingo stilu.** Nema streak-ova, plamenčića, kažnjavanja, crvenih upozorenja.
5. **Radi samo trenutnu fazu** iz `docs/PROGRESS.md` (planovi: `docs/ZADATAK_UI.md`, pa `docs/ZADATAK_Tiron.md`). Ne dodaj funkcije iz kasnijih faza ili verzija (email, sync, auth…) čak i ako „izgleda lako”.
6. **Minimalizam.** Editor je tekst, kursor i tišina. Sve je nevidljivo dok ne zatreba. Nema novih dugmadi, panela ni funkcija van trenutne faze.
7. **Ne diraj ono što radi.** Sivi tekst (dopune), provera jezika, Resume i autosave zadržavaju postojeće ponašanje osim ako faza kaže drugačije.

## 2a. Tiron (iz `docs/ZADATAK_Tiron.md`)

Kad nisi siguran da li nešto sme: **„Da li bi Tiron ovo uradio?”** Tiron zapisuje, pamti, pita, podseća, ohrabruje ✅ — ne piše tekst umesto autora, ne ocenjuje kvalitet nacrta, ne prekida dok autor kuca, ne prebacuje ❌.

1. **Minimalizam:** Tiron živi samo u desnom panelu i na Resume ekranu. Desni panel ima **najviše 4 sekcije** — Tiron, Knjiga, Za kasnije, Jezik; nove sekcije se ne dodaju, sve što Tiron pamti ide u „Knjiga” kao podsekcija; prazna sekcija se ne prikazuje. U editoru se pojavljuje samo tačkica pored `T` u traci kad ima novi šapat. Nema iskačućih prozora, zvukova ni teksta preko rukopisa.
2. **Nikad dok autor kuca.** Šapati se generišu i prikazuju samo u pauzama i na prelomnim trenucima (ulazak, kraj poglavlja, kraj sesije).
3. **Najviše 2 šapata po sesiji** (ne računajući ulazak i kraj sesije).
4. **Ton (obavezno u svakom promptu):** kratko (max 2 rečenice), toplo, više pita nego tvrdi, pohvaljuje konkretno, nikad ne broji propuste, nikad „trebalo bi”, nikad poređenje sa drugim piscima, nikad ocena kvaliteta nacrta. Savremeni srpski, bez latinskih fraza i bez „gospodaru”.

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
    start/page.tsx           # nova knjiga: naslov i Srce knjige (Tiron T1)
    api/spark/route.ts       # jedini AI endpoint
  components/
    editor/                  # TipTap editor, footer, brojač
    structure/               # sadržaj knjige: uvodni delovi / poglavlja / završni delovi
    resume/
    book/                    # ekran sa pitanjima i polja Srca knjige
    tiron/                   # desni panel (Tiron, Knjiga, Jezik)
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

- Jedan endpoint: `POST /api/spark`. Modovi: `ghost` (sivi tekst), `proofread` (provera jezika), `resume` (Resume ekran), `stuck` („Zapeo sam”, desni panel); planirani Tironovi modovi iz `docs/ZADATAK_Tiron.md`.
- `ghost` (sivi tekst) radi po stanju kursora — usred rečenice dovršetak, posle završene rečenice početak sledeće, u praznom pasusu **nema API poziva** (ni podsetnika); koristi `AI_GHOST_CONTEXT_WORDS` (~150 reči), 1 pokušaj i timeout 6 s; zahtev se otkazuje čim autor nastavi da kuca. Pauze su u `src/lib/timing.ts`. Radi dobro — ne optimizuj bez odluke autora.
- `proofread` (v0.2): model vraća ceo ispravljen pasus kao čist tekst, ali on se **nikad ne ubacuje** — služi samo za diff po rečima (`lib/text/proofDiff.ts`), a autor prihvata ispravke reč po reč. Guardrail protiv proze za ovaj mode ne važi; umesto njega važe pravila iz `proofDiff` (sličnost reči, razlika u broju reči). Rezultat se čuva po pasusu u Dexie (`proofCache`, ključ `PROOF_CACHE_VERSION:jezik:hash`) — nepromenjen pasus se nikad ne šalje ponovo; promeni `PROOF_CACHE_VERSION` (`lib/ai/proofread.ts`) kad menjaš prompt ili model za proveru.
- Kontekst: poslednjih ~400 reči pre kursora (vidi `lib/text/extractContext.ts`). Ne šalji celu knjigu.
- Model mora da vrati JSON: koristi JSON mode (`response_format: { type: "json_object" }`) i svejedno parsiraj kroz Zod (izuzetak: `proofread` vraća čist tekst). Na grešku: jedan retry, pa ljubazna poruka u UI.
- Server odseca stavke duže od 220 karaktera i odbacuje odgovor koji liči na prozu (vidi `docs/AI_PROMPTS.md` → „Guardrail”).
- **GPT-6 Luna parametri:** `temperature` sme da se pošalje SAMO uz `reasoning_effort: "none"`; uz bilo koji drugi effort `temperature`/`top_p` ne smeju biti u zahtevu (API vraća 400). Parametre zahteva uvek gradi preko jednog helpera (`lib/ai/requestParams.ts`, v0.2 Faza 2).
- **Reasoning effort po pozivu** (env, podrazumevane vrednosti u kodu i u `.env.example`; tabela sa obrazloženjem u `docs/AI_PROMPTS.md`): `AI_GHOST_REASONING_EFFORT=none`, proofread `none` + `temperature: 0.2`, `AI_EFFORT_STUCK=low`, `AI_EFFORT_TIRON=medium`, `AI_EFFORT_SESSION_END=low`, `AI_EFFORT_MEMORY=medium`. Kod Tirona nikad `none` ni `temperature`. Log sadrži effort, npr. `[tiron] moment=… effort=medium ms in cached out`.
- Timeout 15 s (ghost 6 s, proofread 10 s). Prikaži skeleton dok čekaš.

## 7a. Prečice (važeća tabela: `docs/ARCHITECTURE.md` → „Prečice”)

- Sivi tekst se pojavljuje sam posle pauze · `↑`/`↓` bira predlog · `Tab` prihvata · `Ctrl/Cmd+→` jednu reč · `Esc` sklanja. `/` je običan znak.
- `Ctrl/Cmd+\` levi panel · `Ctrl/Cmd+Shift+\` desni panel (Tiron) · `Ctrl+Shift+F` fusnota · `***` u praznom pasusu prelom scene · `Alt+Enter` ispravka provere jezika.
- `Ctrl/Cmd+B`/`I` · `Ctrl/Cmd+Alt+0/1/2` stil pasusa · `# ` `## ` `> ` na početku reda · `Alt+F10` fokus na traku.
- `Ctrl/Cmd+Shift+L` beleška za kasnije (Tiron T3; `Ctrl+Shift+N` iz ZADATAK-a Chrome/Edge ne puštaju stranici — otvara incognito, pa se sluša samo dodatno).

## 7b. Izbačeno (ne vraćati bez odluke autora proizvoda)

Kopija iz `docs/PRODUCT.md`: AI paleta i svi njeni alati (Treba mi impuls, Poguraj me, Zakomplikuj, Šta mi nedostaje, Vrati me u priču, Zamisli scenu, Sprint) i prečica `Ctrl+/` · sinonimi · slash meni (meni u stilu Hemingway editora) · Urednik režim · odložene podvlake (podvlake tek kada pasus ostane iza autora) — odbačeno; provera ostaje kao sada.

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
