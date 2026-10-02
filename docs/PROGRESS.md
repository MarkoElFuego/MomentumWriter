# PROGRESS.md

Agent: ažuriraj ovaj fajl na kraju svakog zadatka. Radi SAMO prvi nezavršen zadatak.

**Trenutna faza:** ZADATAK_UI (`docs/ZADATAK_UI.md`). Izvor istine za raspored i funkcije: `docs/PRODUCT.md`.

**Redosled (odluka autora 2026-10-01):** U0 → U1 → ostatak Faze 4 (Resume, **bez** 4. alata) → U2–U6 → U7 → ZADATAK_Tiron (T0–T7). v0.2 je završena (Faza 6 sinonimi izbačena, Faza 8 odložena).

**Sledeće:** U5 — kod gotov, čeka ručnu proveru autora (treba pravi `OPENAI_API_KEY` u `.env.local` i `AI_EFFORT_STUCK` po želji). Posle „radi”: čekirati U5, pa U6.
- Stanje 2026-10-02: U4 gotov, autor ručno proverio („sve ostalo radi”). `Alt+↑/↓` u panelu nije radio — **uklonjen** (odluka autora: niko ga ne koristi); redosled se menja samo prevlačenjem.
- Stanje 2026-10-02: U3 gotov, autor ručno proverio („radi”).
- Stanje 2026-10-02: U2 gotov i commitovan, autor ručno proverio i `Ctrl+Alt+0/1/2` na srpskom rasporedu („proverio, može dalje”).
- Stanje 2026-10-02: commitovano sve do `746f389` (Resume). Autor je ručno proverio Resume: stara knjiga → Resume sa pitanjem, nova (0 reči) → editor.
- Otvoreno pitanje za autora: „nova knjiga otvara nov prozor” — da li je to isti tab (u redu) ili novi tab/prozor browsera (greška)? Proveriti pre U2.
- Za U2 važi i napomena iz ZADATAK_UI: u traci samo „Sačuvano” / „Čuvam…” — „Nacrt 1 ·” dolazi tek sa Tiron T1. Obostrano poravnanje: screenshotovi sa i bez `hyphens`, odluku donosi autor.

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

## Faza 3.5 — Dorade (odluke korisnika)
- [x] Tab → Spark meni na mestu kursora
- [x] ✦ Poguraj me → dovrši započetu rečenicu / početak sledeće (autor bira)
- [x] Dopune kao sivi tekst (pauza 1,5 s, Tab / Ctrl+→ / ↓↑, prekidač u ···)
- [x] Dopune po stanju kursora (usred / posle tačke / prazan pasus) + „/” otvara meni umesto Tab-a

## v0.2 (detalji i „Gotovo kada”: `docs/ZADATAK_v0.2.md`)

### v0.2 · Faza 1 — Dokumentacija
- [x] AGENTS / ARCHITECTURE / PLAN / PRODUCT usklađeni, Urednik uklonjen, faze u PROGRESS

### v0.2 · Faza 1b — Prečica
- [x] Ctrl/Cmd+/ otvara paletu; `/` se kuca normalno; Ctrl+J uklonjen

### v0.2 · Faza 2 — Priprema za više jezika (bez promene ponašanja)
- [x] `Book.language` (`"sr-Latn"`) + Dexie migracija + test
- [x] `src/lib/languages/sr-Latn/{prompts,typography}.ts` + `index.ts`
- [x] `lib/ai/requestParams.ts` (temperature samo uz effort `none`) + test
- [x] Sav UI tekst iz komponenti u `copy.ts`
- [x] ARCHITECTURE: koraci za dodavanje jezika

### v0.2 · Faza 3 — Poglavlja umesto scena (pre početka: backup svih knjiga!)
- [x] Model `Book → Part` (`front | chapter | back`) + migracija scena → poglavlje (prelom + naslov u kurzivu) + test 2×3
- [x] `ResumeState` i `DailyStat` na `partId`
- [x] Panel = sadržaj knjige (rimski brojevi, + Novo poglavlje, + Dodaj deo, prevlačenje, preimenovanje)
- [x] Ruta `/write/[partId]`
- [x] `***` u praznom redu → `sceneBreak` (✱ ✱ ✱)

### v0.2 · Faza 4 — Fusnote
- [x] Ctrl+Shift+F ubacuje fusnotu; zona na dnu; Esc nazad iza broja
- [x] Prenumerisanje, tooltip na hover
- [x] Brisanje broja briše fusnotu; jedan Ctrl+Z vraća oboje
- [x] Sivi tekst i provera jezika ne rade u fusnoti

### v0.2 · Faza 5 — Provera jezika (glavna funkcija)
- [x] 5a: `scripts/proofread-cases.json` + `pnpm eval:proofread` (A vs B) → izlaz autoru pre UI-ja
- [x] 5b: mode `proofread` na Enter posle pasusa (hash, bez ponovnog slanja)
- [x] 5b: `lib/text/proofDiff.ts` + testovi
- [x] 5b: podvlake (tačkasta / talasasta), popover Prihvati/Odbaci, „Prihvati sve kvačice u pasusu”
- [x] 5b: prekidač u ··· + log `[proofread] …`

### v0.2 · Faza 6 — Sinonimi — IZBAČENO (PRODUCT.md → „Izbačeno”; ranije odloženo 2026-09-30)
_`[-]` = namerno preskočeno za sada; agent ne radi ove stavke dok ih autor ne vrati._
- [-] BubbleMenu „≈ Sinonimi” / Alt+S na jednoj reči
- [-] mode `synonyms` (isti padež/rod/broj/vreme) + Zod + keš
- [-] Popover: strelice + Enter / klik, jedan Ctrl+Z, čuva veliko slovo

### v0.2 · Faza 7 — Vizuelne teme
- [x] `themes.css` (papir / noc / masina / magla) + fontovi preko `next/font`
- [x] Izbor u ··· (4 kružića), pamti se u Dexie; tamni sistem → noc
- [x] Fokus mod + Pisaća mašina skrol
- [x] Kontrast teksta, ghosta i podvlaka u svim temama

_v0.2 · Faza 8 (troškovi sivog teksta) je odložena — dopune rade dobro, ne dira se bez odluke autora._

## ZADATAK_UI (`docs/ZADATAK_UI.md`)
- [x] U0 — Dokumentacija: PRODUCT.md, ZADATAK_UI.md, AGENTS/ARCHITECTURE/AI_PROMPTS/PLAN usklađeni; paleta samo u „Izbačeno”
- [x] U1 — Uklanjanje AI palete (komponente, prečice, „Treba mi impuls”, podsetnik „Zapeo si?”, modovi push/complicate/missing; `resume` ostaje)

## Faza 4 — Resume (posle U1)
- [x] ResumeState + lastSentence + testovi
- [x] Pravilo 6h → /resume — `lastWrittenAt` stariji od 6 h → `/resume?book=…`, inače editor tačno na kursoru (`ResumeState` se već puni pri autosave-u; `cursorPos` resetovan na 0 u v0.2 Faza 3, sve je na `partId`)
- [x] Resume ekran (radi i bez AI-ja) — „Dobrodošao nazad.” · „Juče si stao ovde:” / „Pre N dana…” · poslednja rečenica · „Otvoreno pitanje:” (mode `resume`, keš po hash-u konteksta, skeleton; AI padne → sekcija se sakrije) · „Nastavi da pišeš” radi odmah i vraća kursor na `cursorPos`
- [-] ~~4. alat „↩ Vrati me u priču”~~ — izbačeno sa paletom (PRODUCT.md → „Izbačeno”)

## ZADATAK_UI — nastavak (posle Resume)
- [x] U2 — Gornja traka i formatiranje (stilovi pasusa, B/I, poravnanje + rastavljanje reči, traka bledi)
- [x] U3 — Naslov poglavlja povezan sa sadržajem (+ migracija starog H1)
- [x] U4 — Levi panel: animirano prevlačenje (`@dnd-kit`) i brisanje sa „Poništi” (`Alt+↑/↓` uklonjen — odluka autora)
- [ ] U5 — Desni panel: 4 sekcije i „Zapeo sam” (mode `stuck`, `AI_EFFORT_STUCK=low`)
- [ ] U6 — Fokus, ceo ekran, footer, uski ekrani
- [ ] U7 — Ocena jezika (`languageScore.ts`, bez novih AI poziva)

## ZADATAK_Tiron (`docs/ZADATAK_Tiron.md`, posle U7)
- [ ] T0 — Provera stanja i dokumentacija (postoji / delimično / ne postoji)
- [ ] T1 — Srce knjige i prvi korak
- [ ] T2 — Tiron pamti: StoryMemory, sažeci poglavlja i najjače rečenice
- [ ] T3 — Beleška za kasnije (`Ctrl+Shift+N`)
- [ ] T4 — Signali procesa (lokalno, bez AI-ja)
- [ ] T5 — Tiron šapuće
- [ ] T6 — Mala pobeda i Resume
- [ ] T7 — Put do kraja (kraj nacrta)

## Faza 5 — Polish (redosled određuje autor)
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
- 2026-09-28: Korisnik tražio (1) meni na Tab dok kuca i (2) Hemingway parametre. Odluke: Tab u editoru otvara Spark paletu **na kursoru** (i Ctrl+J/dugme sada otvaraju na kursoru; `coordsAtPos`, iznad reda ako dole nema mesta); Shift+Tab ostaje za izlaz iz editora; u paleti Tab šeta po dugmadi, zatvara Esc. Revision mode (Hemingway) pomeren iz v0.2 u Fazu 3.5 kao **poseban režim**, ne stalni panel dok se piše.
- 2026-09-28: **Zlatno pravilo 1 izmenjeno (odluka autora, opcija B):** ✦ Poguraj me vraća 3 *početka* rečenice (2–5 reči, bez tačke na kraju, istim pismom/pravopisom kao autor). Izbor (1/2/3 ili klik) ubacuje početak na kursor kao čist tekst + razmak; rečenicu autor završava sam. Ubacuje se na zamrznutu poziciju ako se dokument nije menjao, inače na trenutni kursor; Ctrl+Z vraća. Guardrail je sada po modu: push = max 5 reči, bez završne interpunkcije, bez novog reda, bez odsecanja (šema max 60 znakova); ostali modovi kao pre. Zakomplikuj / Šta mi nedostaje ostaju pitanja bez ubacivanja.
- 2026-09-28: Probom na pravom tekstu predlozi su bili van konteksta — prompt je forsirao 3 „različita pravca” i usred rečenice. Sada server (`endsMidSentence`) razlikuje: **usred rečenice** → 3 dovršetka *iste misli* (≤ 8 reči, sme tačka, jedna rečenica, `kind: finish`, prvi najprirodniji); **posle tačke** → 3 početka na različite strane (≤ 5 reči, bez tačke). Nedovršena rečenica se eksplicitno šalje u `---KURSOR---`. Pravilo 1 u AGENTS.md prošireno u skladu s tim.
- 2026-09-28: **Pravilo 1 je sada „AI predlaže, autor odlučuje”** (autor usvojio): ništa bez eksplicitnog prihvatanja; dopune do kraja rečenice; prepravke postojećeg teksta samo u Urednik režimu uz Prihvati/Odbaci (original prvi); kritika samo u Urednik režimu. **Urednik režim zamenjuje Revision mode** — Hemingway mere postaju deo beleški na margini.
- 2026-09-28: Sivi tekst (`mode: "ghost"`): posle 1,5 s pauze, samo usred rečenice na kraju pasusa bez selekcije; 3 nastavka (očekivan / obrt / čulni), prikazuje se prvi. Tab prihvata, Ctrl/Cmd+→ reč po reč, ↓/↑ menja predlog (autor izabrao umesto Alt+]; ←/→ ostaju za kursor; brojač „1/3”), Esc/kucanje sklanja; Tab bez sivog teksta i dalje otvara paletu. Zahtev se otkazuje na svaki taster, odgovor za promenjen tekst se baca, greške su tihe. Server: `AI_GHOST_CONTEXT_WORDS` (150), 1 pokušaj, timeout 6 s. Prekidač „Dopune” u ··· meniju, u `localStorage` (`momentum:ghost`, UI podešavanje). Paleta otvorena → nema sivog teksta. Merenje: bez podešavanja Luna je davala 3,5–5,7 s (i 504), pa ghost šalje `reasoning_effort` iz `AI_GHOST_REASONING_EFFORT` (podrazumevano `low`; gpt-6-luna odbija `minimal` — podržava none/low/medium/high/xhigh).
- 2026-09-28: Sivi tekst se ponekad nije pojavljivao (`finish-too-long` → ceo odgovor odbijen, ghost nema retry) i trajao je 4–8 s i sa `low`. Sada: guardrail za push/ghost **filtrira po stavci** (loše i duplikati ispadaju, odbija se tek kad ne ostane nijedna), šema prima 1–3 stavke; dovršetak **najbolje 2–5 reči, najviše 7** (bilo 8), tačka samo ako se rečenica prirodno završava; ghost podrazumevano `reasoning_effort: none` (ako kvalitet padne → `low` u `.env.local`).
- 2026-09-29: Sivi tekst po stanju kursora (`cursorSituation`, gleda samo trenutni pasus): **usred** → dovršetak posle 1500 ms; **posle završene rečenice** (`. ! ? …` ili zatvoren navodnik `”`/`»`, zajednički `endsSentence` za klijent i server) → početak sledeće (2–5 reči, inner/outer/shift) posle 3000 ms; **prazan pasus** → bez API poziva, posle 6000 ms sivi podsetnik „Zapeo si? Pritisni /” (nestaje na prvi taster, jednom po pasusu — pozicija se prati kroz `transaction.mapping`). Pauze u `src/lib/timing.ts`. **„/” umesto Tab-a** otvara meni: samo na početku praznog pasusa ili posle razmaka (u „i/ili” kuca se normalno); „/” ponovo na izboru alata upisuje pravu kosu crtu. Tab sada samo prihvata sivi tekst, inače ne radi ništa (Shift+Tab izlazi).
- 2026-09-29: **Plan v0.2** (`docs/ZADATAK_v0.2.md`) usvojen. **Urednik režim je ukinut potpuno** (i beleške na margini, rad na rečenici, ocena scene, Hemingway mere) — ne ide ni u „kasnije”; starije beleške o Uredniku gore su samo istorija. Pravilo 1: AI **dodaje** samo dopune do kraja rečenice, **menja** samo kroz proveru jezika (Grammarly za srpski — glavna funkcija v0.2), nikad ne ocenjuje. Dopune ostaju kako rade (≤ 7 / ≤ 5 reči); Faza 8 (optimizacija ghost-a) odložena. Paleta: `Ctrl/Cmd+/` + dugme umesto `/` i `Ctrl+J` (Faza 1b). Paleta i njeni alati ostaju, ali su **ZA MENJANJE** — autor razmišlja. Resume i Polish (stare Faze 4–5) idu posle v0.2.
- 2026-09-29: Faza 1b: paletu otvaraju/zatvaraju samo `Ctrl/Cmd+/` (hvata i `event.code === "Slash"` i `Ctrl+Shift+7` na srpskom) i dugme. `/` se kuca normalno svuda; `slashOpensMenu` i „/ ponovo upisuje kosu crtu” uklonjeni. Podsetnik: „Zapeo si?  Pritisni Ctrl/Cmd+/” (bez detekcije Mac-a, kao `Ctrl/Cmd+\`).
- 2026-09-29: v0.2 Faza 2: `Book.language` (`"sr-Latn"`) kroz Dexie v2 (`.stores({})` + `.upgrade()`, bez novih indeksa) + test migracije v1→v2. Jezički modul daje samo redove koji zavise od jezika (`writer`, `sameScript`); ostatak promptova ostaje zajednički i na srpskom. Sistem promptovi za sr-Latn provereni **znak po znak identični** pre/posle refaktora. `language` je opciono u `/api/spark` (stari klijent → podrazumevani). `typography.ts` još niko ne koristi — prelom scene ga koristi u Fazi 3. `buildRequestParams` izbacuje `temperature`/`top_p` i kad effort nije poslat (podrazumevani nije `none`). UI tekst je već bio sav u `copy.ts` — nije bilo šta da se premešta.
- 2026-09-30: v0.2 Faza 3: `Part` (`front | chapter | back`) zamenjuje Chapter + Scene; Dexie v3 spaja scene (`mergeScenes` u `lib/db/migrations.ts`) i briše tabele `chapters`/`scenes` (autor: postojeći tekstovi su testni). Pri spajanju otpadaju prazne scene i automatski naslovi „Scena N”; pravi naslovi scene ostaju kao pasus u kurzivu. Id poglavlja ostaje id dela. „Poglavlje IV” → `title: ""` jer se broj računa (`chapterNumber`, rimski); header „Poglavlje I · Dolazak”, panel „I · Dolazak”, uvodni/završni delovi samo naslov. `ResumeState.partId`, `cursorPos` resetovan na 0; `DailyStat` je već bio po knjizi — bez promene. „+ Dodaj deo” nudi 6 gotovih delova (Naslovna, Posveta, Predgovor · Epilog, Zahvalnica, Beleška o autoru). Redosled: HTML5 prevlačenje ili `Alt+↑/↓`, samo unutar grupe. Ime poglavlja sme da se obriše (ostaje broj). AI poruka više nema „Scena:” red; `chapterTitle` nosi naslov dela. `sceneBreak` je atom čvor bez teksta (ne broji se u reči, ne ide u AI kontekst); `***` radi samo u pasusu koji sadrži samo zvezdice.
- 2026-09-30: v0.2 Faza 4: fusnote su deo istog dokumenta (`components/editor/footnotes.ts`) — broj `footnoteRef` (atom, bez teksta: ne ide u reči ni u AI kontekst) + zona `footnotes > footnote` koja sme da stoji samo na kraju (`doc: block+ footnotes?`). Zato nema nove Dexie verzije: sadržaj je i dalje JSON dela. Brojevi se ne čuvaju — računaju se (dekoracija `data-n` + `title` za tooltip u tekstu, `<ol>` u zoni). `syncFootnotes` u `appendTransaction` drži zonu u redosledu brojeva, briše fusnotu bez broja, dodaje praznu za broj bez fusnote, a kopiran broj dobija nov id (original zadržava fusnotu); pošto je u istom koraku istorije, jedan Ctrl+Z vraća broj i fusnotu. Fusnota je jedan red teksta: Esc **i Enter** vraćaju iza broja, Backspace na početku / Delete na kraju ne spajaju fusnote, nalepljeni pasusi se spajaju u jedan red. Reči u fusnotama se broje u „reči danas”. Sivi tekst i podsetnik ne rade u fusnoti; **Faza 5 mora da proveri `isInFootnote`** pre slanja pasusa na proveru jezika. Resume `lastSentence` gleda samo prozu.
- 2026-09-30: v0.2 Faza 5a: `pnpm eval:proofread` (`scripts/eval-proofread.ts`, 17 slučajeva). Nova dev zavisnost **`tsx`** — pokreće TS skriptu sa `@/` importima, da zahtev ide kroz isti `buildRequestParams` kao aplikacija. `.env.local` učitava sama skripta (`process.loadEnvFile`). `buildRequestParams` dobio `format: "json" | "text"` (proofread vraća čist tekst). Sistem prompt lektora je u `languages/sr-Latn/prompts.ts` (`proofreader`), doslovno iz ZADATAK-a. Ocena po rečima (samo kad broj reči ostane isti): tačna ispravka / pogrešna izmena / propuštena greška. 5a se čekira kad autor vidi izlaz i izabere A ili B.
- 2026-09-30: **5a rezultat → autor bira A** (`reasoning_effort: "none"`, `temperature: 0.2`). Prvi krug (17 slučajeva): A 17/17, B 16/17 (propustio zarez), B troši 2× više izlaznih tokena, brzina ista (~1,2–1,4 s). Drugi krug samo A, +6 težih (ijekavica ne sme u ekavicu, dug pasus ~140 reči, stilsko ponavljanje, strane reči, govor u dijalogu): **23/23, 0 pogrešnih izmena**, prosek 1175 ms, dug pasus 3,4 s. `cached=0` jer je zahtev < 1024 tokena (OpenAI kešira tek iznad) — keš ne donosi uštedu, ne optimizujemo za njega.
- 2026-09-30: v0.2 Faza 5b-1 (server + diff, bez UI-ja): proofread ide kroz isti `POST /api/spark`, ali sa svojom šemom (`{ mode: "proofread", text, language? }`, najviše 400 reči) i funkcijom `lib/ai/proofread.ts` — `SPARK_MODES` i paleta nisu dirani. Odgovor `{ corrected }`, 1 pokušaj, timeout 10 s, `[proofread] …` log u `openai.ts`. `proofDiff`: poravnanje reči preko LCS-a, unutar nejednakih blokova uparivanje po sličnosti (izbačena/dodata reč ne kvari ostale pozicije); sličnost se meri **bez kvačica i sa đ = dj** (inače bi „Djordje → Đorđe” bio odbijen). Kvačica + zarez („dodje” → „dođe,”) je `grammar`. Kratke reči: „sa → s” se odbacuje (40% pravilo) — namerno konzervativno. Stavka „mode proofread na Enter” ostaje otvorena do 5b-2 (okidač i hash su na klijentu).
- 2026-09-30: v0.2 Faza 5b-2 (UI provere jezika): `useProofread` — posle Enter-a koji je napravio nov pasus (capture/bubble `keydown` na `view.dom`: dokument se promenio, kursor nije u fusnoti) šalje **prethodni** pasus, ako ima reči i ≤ 400 reči. Već poslati tekstovi se pamte (`Set` tekstova umesto hash-a, do 500), neuspeh se zaboravlja pa sledeći Enter pokušava ponovo; greške su tihe. Odgovor se primenjuje samo na pasus koji i dalje ima isti tekst (najbliži poziciji slanja). Podvlake (`proofMarks.ts`) su dekoracije: tačkasto = kvačice, talasasto = gramatika, boja `--proof` (tiha plava, ne crvena). Reč koja sadrži broj fusnote se ne podvlači (prihvatanje bi obrisalo fusnotu). Promena podvučene reči briše podvlaku. Popover: klik na reč (fokus ostaje u tekstu, Esc zatvara) ili **Alt+Enter** (fokus na „Prihvati”, Enter prihvata, Esc vraća u tekst); „Prihvati sve kvačice u pasusu (N)” kad ih ima ≥ 2. Prihvatanje = `insertText` preko reči (čuva bold/kurziv), jedan Ctrl+Z. Prekidač „Provera jezika” u ···, `localStorage` `momentum:proofread`, isključivanje briše podvlake. Popover ne prati skrol (fixed) — zatvara se na klik van ili kucanje.
- 2026-09-30: Provera jezika — okidač promenjen posle probe autora (već napisan tekst i prazni redovi između pasusa se nisu proveravali, jer je Enter slao samo prazan pasus iznad): pri otvaranju poglavlja proveravaju se **svi pasusi** osim onog sa kursorom, a posle toga pasus se proverava **kad kursor izađe iz njega** (Enter, strelice, klik) — samo ako mu je tekst nov. Najviše 2 zahteva istovremeno. Keš ostaje u memoriji (autor: posle osvežavanja ponovna provera nije problem) — bez promene baze. „Prihvati sve kvačice” namerno ne dira talasaste (gramatika). U `proofread-cases.json` dodata 3 slučaja iz autorovog teksta (26 ukupno).
- 2026-09-30: **Odluka autora (b): pravilo „> 20% razlike u broju reči → odbaci sve” iz ZADATAK-a je zamenjeno.** Proba na pravom nacrtu: pasus sa slučajno dupliranom rečenicom — model izbaci duplikat, broj reči padne ~50% i pasus ostane bez ijedne ispravke. Sada `isProofreadOf`: odbacuje se samo ako manje od polovine reči odgovora (bez kvačica/velikih slova/interpunkcije, LCS redom) postoji u originalu, tj. model je prepričao. Izbačeni delovi se jednostavno ne nude; zaštita po reči (≤ 3 / ≤ 40%) ostaje. Odbijen tekst (502/400) se više ne šalje ponovo dok se ne promeni; mreža/timeout se ponavljaju.
- 2026-09-30: **Odluka autora: provera jezika sme da ispravlja i više reči odjednom** („neka promeni tekst ako treba da se pravilno napiše”) — i dalje samo uz Prihvati. `proofDiff` sada poravnava ceo pasus odjednom (iste reči imaju prednost, pa slične); pored zamena reč-za-reč nudi spajanje/razdvajanje („kapkeDosao” → „kapke. Došao”), zamenu kratkih reči („je” → „su”) i do 3 dodate/izbačene kratke reči (≤ 4 slova) okačene na susednu nepromenjenu reč („njega.” → „za njega.”). Ne nudi se: izbačena rečenica ili nova duga reč. `isProofreadOf` broji i slične reči (kratki pasusi sa više ispravki više ne ispadaju „prepričani”). U dev režimu konzola (F12) ispisuje po pasusu šta je model vratio i šta je odbačeno i zašto (`[proofread] …`).
- 2026-09-30: Provera jezika — pasus sa kursorom se više ne preskače pri otvaranju (autofokus stavlja kursor na kraj, pa poslednji/jedini pasus nikad nije bio proveren dok autor ne izađe iz njega). Dodato: pasus u kome se piše proverava se i posle **3 s pauze u kucanju** (`PROOFREAD_PAUSE_MS` u `lib/timing.ts`). Proba skriptom na autorovom pasusu („…bilo povoljno njega.”): model 3/3 puta vraća „bili su povoljni za njega.”, `proofDiff` nudi svih 5 ispravki — problem je bio samo okidač.
- 2026-09-30: Provera jezika gleda **svaki tekstualni blok** (pasus i naslov, i unutar citata/liste — nalepljen tekst često završi tamo), ne samo pasuse na vrhu dokumenta; fusnote i dalje ne. U dev konzoli se sada vide i neuspeli zahtevi, odbijeni odgovori, preskočeni predugi pasusi i pasusi promenjeni pre nego što je odgovor stigao.
- 2026-09-30: **Faza 6 (sinonimi) je odložena — preskačemo je za sada** (odluka autora). Ne ide se na nju dok autor ne kaže; sledeća je Faza 7 (vizuelne teme).
- 2026-09-30: v0.2 Faza 7: teme u `src/styles/themes.css` na `<html data-theme>`; bez izbora nema `data-theme` i CSS prati sistem (tamni → noc). Paper/ink/font tačno iz ZADATAK-a; **`--ink-muted` i `--ghost` minimalno potamnjeni** (autor odobrio) da pređu kontrast ≥ 4,5 i ≥ 3,0 — `lib/themes.test.ts` čita pravi CSS i proverava ink ≥ 7, ink-muted ≥ 4,5, ghost ≥ 3 (i bleđi od ink-muted), podvlake ≥ 3. Podvlake: plavo-siva (kvačice) i oker (gramatika), nikad crvena. `--muted/--focus/--proof` zamenjeni; Tailwind `text-muted` sada pokazuje na `--ink-muted`. Fontovi: Courier Prime i Inter preko `next/font` sa `preload: false` (učitavaju se tek kad tema zatreba). Izbor se čuva u Dexie **v4** (tabela `settings`, jedan zapis `appearance`: `theme?`, `focusMode`, `typewriter`) + test v3→v4; **kopija teme u `localStorage` (`momentum:theme`) samo za prvi prikaz** — inline skripta u `<head>` je postavlja pre crtanja (autor odobrio), Dexie pobeđuje pri učitavanju. Fokus mod: dekoracija `has-focus` na bloku sa kursorom (uvek), CSS pod `.focus-mode` bledi ostale na 0,35 za 150 ms. Pisaća mašina: posle svakog pomeranja kursora `requestAnimationFrame` skroluje `<main>` da red bude na sredini (tolerancija 12 px), dno teksta dobija `pb-[50vh]`. Obrisan zaostali `src/app/write/[sceneId]/page.tsx`.

- 2026-10-01: **ZADATAK_UI U0 (odluke autora).** Novi `docs/PRODUCT.md` je izvor istine za raspored i funkcije. **AI paleta je izbačena sa svim alatima** (Treba mi impuls, Poguraj me, Zakomplikuj, Šta mi nedostaje, Vrati me u priču, Zamisli scenu, Sprint) i prečicom `Ctrl+/` — kod se uklanja u U1; beleške o paleti gore su istorija. Ghost se ne dira: dopune se pojavljuju same posle pauze, `↑↓` bira, `Tab` prihvata, `/` je običan znak. „Slash meni” u „Izbačeno” = meni u stilu Hemingway editora. Provera jezika ostaje tačno kako radi (automatski, podvlake odmah); odložene podvlake su odbačene. Effort po pozivu: `AI_EFFORT_STUCK=low`, `AI_EFFORT_TIRON=medium`, `AI_EFFORT_SESSION_END=low`, `AI_EFFORT_MEMORY=medium`, bez `temperature` kod Tirona — tabela u `AI_PROMPTS.md`. Dodata U7 (ocena jezika). Redosled: U0 → U1 → Resume → U2–U7 → Tiron T0–T7.
- 2026-10-01: **U1:** obrisani `components/spark/`, dugme „✦ Treba mi impuls” (footer ima samo „reči danas”), `Ctrl/Cmd+/` i podsetnik „Zapeo si?” (prazan pasus sada ne dobija ništa; `cursorSituation` i dalje vraća `"empty"`, samo se na to ne reaguje). `SPARK_MODES = ["resume", "ghost"]`; `push`/`complicate`/`missing` → 400. `PushSchema` → `GhostSchema`. Sistem promptovi i korisničke poruke za ghost i resume provereni **znak po znak identični** pre/posle. Testovi za uklonjene modove prebačeni na ghost (iste granice) i resume (pravila za pitanja). `SparkAnchor` → `PopoverAnchor` u `ProofPopover.tsx`. `copy.write` sada kaže „poglavlje” umesto „scena”. `joinStarter` ostaje (ghost ga koristi).
- 2026-10-01: **Odluke autora za ZADATAK_Tiron:** (1) memorija knjige ide samo u „Zapeo sam” i Tiron pozive, nikad u ghost; (2) Resume ima jedno pitanje — sa `lastWin` „Prošli put / Za danas” i bez AI poziva `resume`, a `resume` je rezerva kad `lastWin` ne postoji; (3) nema „Obećanja” — `StoryMemory` = characters, places, openThreads; (4) „Nacrt 1” nije iznad naslova: u traci „Nacrt 1 · Sačuvano” (tooltip „Nacrt 1 — ovo niko ne čita”), u praznom prvom poglavlju nove knjige placeholder „Nacrt 1 · ovo niko ne čita. Napiši scenu koju već vidiš u glavi — može biti bilo koja.”, nestaje posle „Označi kraj nacrta”; (5) `Book.genre` se definiše u T1.
- 2026-10-01: **Faza 4 (Resume), odluke autora:** tekst bez roda („Knjiga te čeka.”, „Ovde je priča stala ranije danas / juče / pre N dana:” — isti kalendarski dan posle 6 h = „ranije danas”; 1, 21, 31… dan, ostalo dana). Knjiga sa 0 reči → uvek editor. Prazna poslednja rečenica → bez citata, linije i reda „Ovde je priča stala…”. Kursor u zoni fusnota → kraj glavnog teksta. Keš pitanja po `partId:hash`. Siže od 3 reda iz mode `resume` se ne prikazuje (PRODUCT: jedno pitanje). Tehnički: šema dokumenta je izdvojena u `components/editor/contentSchema.ts` (`contentExtensions` / `docFromJSON` / `restorablePos`), editor je koristi istim redosledom pluginova kao pre; kursor se postavlja preko TipTap `autofocus: broj` (i skroluje do njega). `openPart` vraća `resumeCursor` (samo za poslednje pisani deo, `cursorPos > 0`). `hashText` = FNV-1a 32 bit. Bez promene baze. Ako AI nije podešen ili padne, Resume radi bez pitanja.
- 2026-10-02: **U2 (odluke autora):** ghost ne radi u naslovima, **provera jezika u naslovima ostaje** (kao 2026-09-30; ZADATAK_UI ispravljen). ⛶ u U2 samo uključuje/isključuje Fullscreen API (paneli i traka na vrhu su U6); dugme T dolazi u U5. Bez Playwright-a: privremeni prekidač „Rastavljanje reči (privremeno)” u ···, autor pravi screenshotove. Tehnički: nova zavisnost `@tiptap/extension-text-align` **3.31.3** (zakucana na verziju ostatka TipTap-a — 3.31.4 traži noviji `@tiptap/core`); tipovi paragraph + heading, levo/centar/obostrano, levo se ne upisuje u JSON → bez Dexie verzije (stari sadržaj se čita isto, test). Ugrađene prečice TextAlign-a (`Ctrl+Shift+L/E/R/J`) isključene. Stil pasusa: `components/editor/blockStyle.ts` — Citat = pasus u `blockquote`; svaki drugi stil prvo izlazi iz citata; poravnanje se čuva pri promeni stila; u fusnoti stil/poravnanje su onemogućeni. **AltGr:** `Ctrl+Alt+0/1/2` se ne hvata kad je `getModifierState("AltGraph")` ili kad raspored otkuca znak umesto cifre (srpski AltGr+1 = `~`, mrtav taster) — znak ima prednost. Na Windows-u sa srpskim rasporedom Ctrl+Alt i AltGr verovatno ne mogu da se razlikuju, pa tamo prečice ustupaju znaku (isto ponašanje kao ProseMirror keymap); na US rasporedu i Mac-u (`Cmd+Option`, po `event.code`) rade. **Autor da proveri na svom rasporedu.** Traka: `EditorToolbar` + `ToolbarMenu` (↑↓ u meniju, Esc nazad na dugme, klik van / Tab dalje zatvara; jedan meni otvoren u isto vreme). Bledi posle 1,5 s neprekidnog kucanja (pauza > 2 s resetuje), vraća se na pomeranje miša ≥ 4 px (pisaća mašina izaziva lažni `mousemove`), fokus u traci i `Alt+F10`; nikad dok je meni otvoren; `prefers-reduced-motion` bez animacije. ··· sada ima samo Dopune, Provera jezika, privremeni prekidač i Sve knjige. Naslov poglavlja je iz trake prešao bledo iznad teksta do U3. Stari H1 (naslov poglavlja u sadržaju) sada izgleda kao Naslov 1 (levo, veći) umesto centriranog verzala — U3 ga migrira. `lang` editora `sr` → `sr-Latn`. **Ispravka (prijava autora):** pisaća mašina je pri označavanju mišem skrolovala tekst ispod miša pa se selekcija „bežala” do kraja teksta (greška iz Faze 7) — sada miš nikad ne skroluje dok je pritisnut ni dok postoji selekcija. Jedan klik (bez prevlačenja) centrira red posle 300 ms (`TYPEWRITER_CLICK_DELAY_MS`) — ranije bi pomerio tekst ispod drugog klika duplog klika; dupli/trostruki klik i prevlačenje ne pomeraju ništa (autor tražio). Kucanje i strelice centriraju kao pre. Druga ispravka: klik nije radio jer `pointerup.detail` je uvek 0 — sada `mousedown`/`mouseup`; i pri otvaranju poglavlja / uključivanju ⌨ više se ne centrira (tekst je skakao na sredinu i naslov nije bio vidljiv) — centrira tek kucanje, strelice ili klik.
- 2026-10-02: **Odluka autora: obostrano poravnanje ostaje, sa rastavljanjem reči** (proverio u svom browseru — „odlično”). `hyphens: auto` važi samo za obostrano poravnate blokove (`[style*="text-align: justify"]`), `lang="sr-Latn"` na editoru. Prekidač „Rastavljanje reči” ostaje u ··· kao stalna opcija (autor tražio), podrazumevano uključen, `localStorage` `momentum:hyphens` (UI podešavanje, kao Dopune).
- 2026-10-02: **Odluka autora: poglavlje se uvek otvara od početka** (kursor na početku, skrol na vrhu) — menja Fazu 4 („editor tačno na kursoru”, „Nastavi da pišeš vraća kursor”). Autor prijavio da se otvaralo na kraju ili „od sredine”. `Editor` ima `autofocus: "start"`; uklonjeni `initialCursor`, `savedCursor` i `OpenedPart.resumeCursor` (+ 2 testa). `ResumeState.cursorPos` i dalje se čuva — Resume ekran ga koristi za kontekst pitanja i poslednju rečenicu. Pravilo 6 h i Resume ekran se ne menjaju.
- 2026-10-02: **U3:** naslov dela je `<input>` iznad editora (`ChapterTitle.tsx`), ne čvor u dokumentu — font teme, ~1,9rem, centriran, rimski broj sitno iznad (samo poglavlja), placeholder „Naslov poglavlja”. Svaki taster → `renamePart` odmah (bez debounce-a; Dexie redom izvršava upise). Panel dobija `currentTitle` za otvoreni deo (prikaz i polje za preimenovanje), pa promena u tekstu menja panel bez ponovnog učitavanja; preimenovanje/premeštanje u panelu → `refreshTitles` čita naslov i broj iz baze. Naslov za ghost (`chapterTitle`) se računa iz istog stanja. `Enter`/`↓` u naslovu → `focus("start")`; `↑` u prvom redu **prvog tekstualnog bloka** (i u citatu) → naslov, kursor na kraj naslova; sivi tekst i dalje ima prednost za `↑`. Uvodni/završni deo sme da ostane bez naslova iz polja (panel tada pokazuje „Bez naslova”). **Dexie v5** `upgradeTitleHeadings`: briše prvi blok samo ako je Naslov 1 i tekst mu je (bez razlike u velikim slovima i razmacima) jednak `title`, „Poglavlje N · title” ili „N · title”; prazan H1 i H1 koji nije prvi ostaju; ako ostane prazan dokument → prazan pasus; `wordCount` umanjen za reči naslova („reči danas” ne ide ispod 0 — `wordsDelta`). Test v4→v5 sa 7 slučajeva. `Part.title` se pri migraciji ne menja (briše se samo identičan naslov).
- 2026-10-02: **U4 (odluke autora):** (a) ne može da se obriše samo poslednje *poglavlje*; uvodni/završni delovi uvek mogu; (b) traka „Poništi” dole u sredini, novo brisanje dok je traka prikazana čini prethodno trajnim. Nove zavisnosti: `@dnd-kit/core`, `@dnd-kit/sortable` (iz ZADATAK-a) i `@dnd-kit/utilities` (CSS transform, isti autor). Prevlačenje: `SortableParts.tsx`, jedan `DndContext` po grupi (pa ništa ne prelazi u drugu grupu), PointerSensor sa pragom 5 px (klik ostaje klik), bez KeyboardSensor-a — tastatura i dalje `Alt+↑/↓`. Ostali redovi se razmiču 200 ms ease, prevučeni red je `DragOverlay` sa senkom iz teme, a na njegovom mestu stoji tanka linija (mesto spuštanja). Novi redosled se prikazuje odmah (pre upisa), pa nema skoka nazad. Rimski broj se kratko pretopi kad se promeni (ključ = broj, ne naziv). Najave za čitač ekrana na srpskom. `prefers-reduced-motion` gasi sve animacije. `⋮` (postojeći `ToolbarMenu`) — Preimenuj / Obriši; „Obriši” za poslednje poglavlje je `aria-disabled` sa tooltipom (ne `disabled`, da bi se tooltip video). Potvrda u panelu „Obrisati ‚Kofer’ (3.214 reči)?”, fokus na „Odustani”, Esc odustaje; 0 reči → bez potvrde. **Dexie v6** (`Part.deletedAt?`, bez upgrade-a) + test v5→v6. Brisanje otvorenog dela: prvo `flush()` autosave-a, pa brisanje, pa prethodni deo (ili sledeći); „Poništi” tada vraća i u taj deo. `savePart` za deo koji čeka „Poništi” ne pomera zbir reči. Aktivni deo u panelu je podebljan. Napomena: „reči danas” u footeru se osveži tek pri sledećem otvaranju dela (zbir ostalih delova se računa pri otvaranju).
- 2026-10-02: **U5 (odluke autora):** desni panel u U5 ima **samo sekciju Tiron** — Knjiga, Za kasnije i Jezik nemaju podatke dok ih ne naprave T2/T3/U7 (pravilo: nema praznih sekcija ni „uskoro”); pamćenje skupljenih sekcija u Dexie dolazi sa prvom sekcijom koja se skuplja — šema baze se u U5 ne menja. Prečica `Ctrl/Cmd+Shift+\` (`event.code === "Backslash"` + Shift; hvata i `|`), dugme `T` u traci bez tačkice (šapati su T5); stanje panela u `sessionStorage` (`momentum:tironOpen`), panel ne uzima fokus pri otvaranju. Mode `stuck`: sistem prompt = `tiron` (doslovno iz ZADATAK_Tiron) + `stuck` iz jezičkog modula, **bez** uredničkog zajedničkog dela; prompt izričito: „Postavi pitanje o OVOJ sceni, ne opšti savet o pisanju” i „Pitanje mora da se završi upitnikom”. **Pitanje se ne odseca:** > 200 znakova ili bez `?` → guardrail odbija → jedan ponovni pokušaj. Manje od 30 reči glavnog teksta pre kursora → bez poziva, poruka „Napiši prvo par rečenica…”. `avoid` = poslednjih ≤ 5 pitanja (server prima najviše 5). Effort `AI_EFFORT_STUCK` (podrazumevano `low`, dodato u `.env.example`), bez temperature; log `[stuck] effort=… ms in cached out`. Klik mišem na „Zapeo sam”/„Još jedno” ne uzima fokus iz teksta (`mousedown` preventDefault); odgovor je u `aria-live="polite"` zoni; Esc u panelu vraća fokus u editor (ProseMirror čuva selekciju, `focus()` vraća kursor gde je bio). Novi klik otkazuje zahtev koji još čeka. Memorija knjige i `heart.ending` se dodaju u T1/T2.

## Utisci iz korišćenja (ti upisuješ)
<!-- šta smeta, šta fali, šta nikad ne koristiš -->
