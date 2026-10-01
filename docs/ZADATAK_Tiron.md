# ZADATAK — Tiron, mentor u Momentumu

Stavi u `docs/ZADATAK_Tiron.md`. Radi se POSLE `docs/ZADATAK_UI.md` (U0–U7). Usklađeno sa `docs/PRODUCT.md` — ako se nešto razlikuje, važi PRODUCT.md.
Jedna faza = jedan razgovor sa agentom = jedan commit.
Pre svake faze: pročitaj `AGENTS.md`, ovaj fajl i `docs/PROGRESS.md`. Prvo plan, pa kod.

---

## Ko je Tiron (ovo je duh cele funkcije)

Tiron je bio Ciceronov sekretar: zapisivao je, pamtio, uređivao i savetovao — ali govore je pisao Ciceron.
U Momentumu Tiron je **tihi mentor pored stola**: pamti tvoju knjigu, primećuje tvoj proces, šapne kad treba i ćuti kad ne treba.

Kad nisi siguran da li nešto sme: **„Da li bi Tiron ovo uradio?"**
- Tiron zapisuje, pamti, pita, podseća, ohrabruje. ✅
- Tiron ne piše tekst umesto autora, ne ocenjuje kvalitet nacrta, ne prekida dok autor kuca, ne prebacuje. ❌

---

## Pravila za sve faze

1. **Ne diraj:** naziv Momentum, ghost dopune (pojavljuju se same posle pauze, `↑↓` bira, `Tab` prihvata), proveru jezika, ocenu jezika, autosave, teme, gornju traku, levi panel i dugme „Zapeo sam" (napravljeno u ZADATAK_UI, faza U5).
2. **Minimalizam:** Tiron živi u desnom panelu i u Resume ekranu. Desni panel ima TAČNO 4 sekcije: **Tiron**, **Knjiga**, **Za kasnije**, **Jezik** — nove sekcije se ne dodaju; sve što Tiron pamti ide u „Knjiga" kao podsekcija. U editoru se pojavljuje samo tačkica pored ikonice `T` u gornjoj traci kad ima novi šapat. Nema iskačućih prozora, zvukova, ni teksta preko rukopisa.
3. **Nikad dok autor kuca.** Šapati se generišu i prikazuju samo u pauzama i na prelomnim trenucima (ulazak, kraj poglavlja, kraj sesije).
4. **Najviše 2 šapata po sesiji** (ne računajući ulazak i kraj sesije).
5. **Ton (obavezno u svakom promptu):** kratko (max 2 rečenice), toplo, više pita nego tvrdi, pohvaljuje konkretno, nikad ne broji propuste, nikad „trebalo bi", nikad poređenje sa drugim piscima, nikad ocena kvaliteta nacrta. Savremeni srpski, bez latinskih fraza i bez „gospodaru".
6. **GPT-6 Luna:** `temperature` samo uz `reasoning_effort: "none"`; uvek preko `requestParams` helpera.
7. **Tekst se nikad ne gubi:** svaka promena šeme = nova Dexie verzija + migracija + test.
8. Posle svake faze: `pnpm typecheck && pnpm lint && pnpm test`, ažuriran `docs/PROGRESS.md`, predlog commit poruke, 3–5 koraka za ručnu proveru.

---

## Faza T0 — Provera stanja i dokumentacija (bez koda)

- Proveri šta već postoji: desni panel, `StoryMemory`, `Book.genre`, ocena jezika, Resume. Napiši mi kratku listu: postoji / delimično / ne postoji. Faze ispod prilagodi tome (ne pravi ponovo ono što radi).
- `docs/PRODUCT.md` već opisuje Tirona — samo proveri da se slaže sa ovim fajlom; ako nešto fali, dodaj kratku sekciju „Put pisca" (početak → perfekcionizam → sredina → blokada → pauza → kraj).
- `AGENTS.md`: dodaj pravila 2–5 iz ovog fajla i pitanje „Da li bi Tiron ovo uradio?".
- ~~`docs/PROGRESS.md`: dodaj faze T1–T7 kao checklist.~~ — već urađeno u ZADATAK_UI U0 (T0–T7).

---

## Faza T1 — Srce knjige i prvi korak

**Model:** `Book.heart = { about: string, ending: string, why: string }` (sve opciono), `Book.targetWords?: number`, `Book.genre?`: "misterija" | "triler" | "fantastika" | "naučna fantastika" | "ljubavni" | "horor" | "istorijski" | "literarni" | "za decu" | "drugo" (bira se na ovom ekranu, menja u sekciji Knjiga).

- Pri pravljenju nove knjige, jedan ekran sa tri pitanja (može „Preskoči"):
  - „O čemu je ova knjiga, u jednoj rečenici?"
  - „Kako se završava?" (placeholder: „može i ‚ne znam još'")
  - „Zašto je pišeš?"
  - ispod: izbor žanra i okvirna dužina (kratak roman ~40.000 / roman ~80.000 / dug ~120.000 / ne znam) → `targetWords`
- Srce knjige se vidi i menja u desnom panelu, u sekciji **Knjiga**, kao prva podsekcija „Srce knjige".
- Prvo prazno poglavlje nove knjige ima placeholder: „Nacrt 1 · ovo niko ne čita. Napiši scenu koju već vidiš u glavi — može biti bilo koja."
- Dok je knjiga u fazi nacrta (`draftFinishedAt` ne postoji), status čuvanja u gornjoj traci glasi „Nacrt 1 · Sačuvano" / „Nacrt 1 · Čuvam…", sa tooltipom „Nacrt 1 — ovo niko ne čita". Ništa se ne dodaje iznad naslova poglavlja.

**Gotovo kada:** nova knjiga → 3 pitanja → editor sa novim placeholderom; odgovori su u panelu i mogu da se izmene.

---

## Faza T2 — Tiron pamti: sažeci poglavlja i najjače rečenice

### Ako `StoryMemory` još ne postoji — napravi je prvo (deo ove faze)
- `StoryMemory` (jedan po knjizi): `{ bookId, characters[], places[], openThreads[], updatedAt, updatedAfterPartId }` — bez posebne liste obećanja: obećanja iz priče su otvorene niti.
  - stavka: `{ id, text (max ~80 karaktera), source: "ai" | "user", pinned: boolean }`; max 12 po listi
- `/api/spark` mode `"memory"`: ulaz = trenutna memorija + tekst poglavlja + žanr (`Book.genre` iz T1); izlaz = ažurirana memorija (Zod). Effort iz `AI_EFFORT_MEMORY`.
- Okidač: autor napusti poglavlje sa ≥500 novih reči od poslednjeg ažuriranja, ili klik „Osveži" u sekciji Knjiga. U pozadini, ne blokira pisanje.
- Stavke sa `pinned: true` (koje je autor dodao/izmenio) AI ne sme da menja ni briše.
- Prikaz u sekciji **Knjiga**: podsekcije Likovi, Mesta, Otvorene niti — jedan red po stavci, klik = izmena, × = brisanje, „+ dodaj".
- Kompaktna memorija (max ~300 tokena) se dodaje u „Zapeo sam" i Tiron pozive (šapati, kraj sesije) POSLE fiksnog sistem prompta (keš prompta i dalje radi). **Nikad u ghost pozive** — ghost se ne dira.
- Ako odgovor ne prođe Zod — zadrži staru memoriju i loguj grešku.

### Sažeci i najjače rečenice

**Model:** `Part.summary?: string` (2–3 rečenice), `Part.summaryForHash?: string`, `Book.bestLines: { partId, text, savedAt }[]`.

- Kada se ažurira memorija poglavlja (postojeći okidač: napuštanje poglavlja sa ≥500 novih reči ili „Osveži"), isti poziv vraća i:
  - `summary`: 2–3 rečenice, šta se dogodilo, kao beleška urednika, bez književnog stila
  - `bestLine`: jedna rečenica iz poglavlja koja je najjača
- **`bestLine` mora biti TAČAN citat** iz teksta poglavlja. Ako se ne nađe doslovno u tekstu — odbaci je. Max 1 po poglavlju (nova zamenjuje staru za to poglavlje).
- Sekcija **Knjiga** dobija podsekciju „Poglavlja" sa sažecima (jedan red po poglavlju, klik razvija).
- Najjače rečenice se NE prikazuju stalno — koristi ih Tiron (T5).

**Gotovo kada:** posle dva poglavlja panel ima dva sažetka; `bestLines` sadrži dve rečenice koje se doslovno nalaze u tekstu.

---

## Faza T3 — Beleška za kasnije

Lek za perfekcionizam: umesto da popravljaš, zapišeš i ideš dalje.

- `Ctrl+Shift+N` nad selekcijom ili na poziciji kursora → mali input „Šta ovde kasnije?" → Enter.
- Tekst dobija tihu oznaku (bleda pozadina u boji teme), TipTap mark `laterNote` sa `{ id, note, createdAt, done }`.
- Hover na oznaku → tooltip sa beleškom.
- Sekcija **Za kasnije** — lista beleški cele knjige (poglavlje + beleška), klik vodi na mesto u tekstu, kvačica = `done` (oznaka nestaje).
- Ghost i provera jezika rade normalno i u označenom tekstu.

**Gotovo kada:** 3 beleške u 2 poglavlja → sve u panelu, klik vodi na tačno mesto, štikliranje uklanja oznaku.

---

## Faza T4 — Signali procesa (lokalno, bez AI-ja, bez slanja teksta)

**Model:** `Session { id, bookId, partId[], startedAt, endedAt, wordsAdded, wordsDeleted, hour }`.

- **Sesija** počinje prvim kucanjem posle ≥30 min neaktivnosti; završava se posle 20 min neaktivnosti, ili kad je tab skriven >10 min, ili pri zatvaranju.
- `wordsAdded` / `wordsDeleted` iz razlika pri autosave-u (aproksimacija je dovoljna).
- `src/lib/process/signals.ts` računa:
  - `daysSinceLastSession`, `sessionsLast7Days`
  - `rewriteRatio` poslednje 3 sesije = deleted / (added + deleted)
  - `restartsOfCurrentPart` = broj sesija na istom poglavlju sa malim neto napretkom (< 150 reči)
  - `bookPosition`: `"početak" | "sredina" | "kraj"` (ukupno reči / `targetWords`: <25% / 25–80% / >80%)
  - `typicalHour` (najčešći sat pisanja)
  - `trend`: pad ako su poslednje 3 sesije kraće od proseka za >50%
- Testovi za svaku funkciju.

**Gotovo kada:** u konzoli (dev) mogu da vidim objekat signala za trenutnu knjigu; testovi prolaze.

---

## Faza T5 — Tiron šapuće

### Trenuci i kontekst

| Trenutak | Okidač | Kontekst koji se šalje |
|---|---|---|
| Ulazak | Resume ekran | Srce knjige, memorija, sažeci, signali, poslednjih 5 šapata |
| Kraj poglavlja | autor napusti poglavlje sa ≥500 novih reči (posle T2 ažuriranja) | Srce knjige, memorija, sažeci, poslednjih ~1500 reči poglavlja |
| Obrazac procesa | pri ulasku, ako signal pređe prag (dole) | Srce knjige, signali, najjače rečenice |
| Kraj sesije | kraj sesije (T4) | memorija, sažeci, tekst napisan u sesiji (max ~1500 reči), signali |

„Memorija" = `StoryMemory` (likovi, mesta, otvorene niti); obećanja iz priče su otvorene niti.

**Pragovi za obrasce** (najviše jedan obrazac po danu):
- `rewriteRatio > 0.5` i `restartsOfCurrentPart >= 3` → perfekcionizam: ohrabri da ide napred, predloži belešku za kasnije
- `bookPosition == "sredina"` i `trend == pad` → podseti na `heart.why` i pokaži jednu najjaču rečenicu („Ovo si ti napisao.")
- `daysSinceLastSession >= 4` → bez prebacivanja; predloži malu sesiju („Samo 10 minuta danas?")
- `bookPosition == "kraj"` → konkretan pogled na otvorene niti koje treba zatvoriti

### API: `/api/spark` mode `"tiron"`
- Ulaz: `{ moment, context }`. Effort iz `AI_EFFORT_TIRON` (podrazumevano `medium`), bez temperature.
- Izlaz (Zod): `{ "whisper": string (max 220), "kind": "story" | "process" | "win" | "why", "quote"?: string }`
  - `quote` samo iz `bestLines` (proveri da postoji)
- Guardrail: odbaci ako šapat počinje dijaloškom crticom/navodnikom, ima >2 rečenice, ili sadrži reči ocene kvaliteta („loše", „slabo", „dosadno", „greška u pisanju").

### Sistem prompt (u `src/lib/languages/sr-Latn/prompts.ts`, deo „tiron")
```
Ti si Tiron, tihi mentor pored pisca, kao Ciceronov sekretar: pamtiš njegovu knjigu i njegov proces,
ali knjigu piše on.
Pravila:
- Najviše dve kratke rečenice. Savremeni srpski. Bez latinskih fraza.
- Više pitaš nego što tvrdiš. Pohvaljuješ konkretno (šta tačno radi), nikad generički.
- Ovo je prvi nacrt: nikad ne ocenjuješ kvalitet pisanja.
- Nikad ne brojiš propuste, ne kažeš "trebalo bi", ne porediš sa drugim piscima.
- Nikad ne pišeš rečenice priče umesto autora.
- Koristi imena, mesta i otvorene niti iz konteksta — budi konkretan za OVU knjigu.
- Ne ponavljaj ništa iz prethodnih šapata.
Odgovaraš isključivo JSON-om po zadatom formatu.
```

### Prikaz
- Desni panel, sekcija **„Tiron"** na vrhu: poslednji šapat (veći), ispod istorija (sitno, poslednjih 10, ostalo „Prikaži sve").
- Ispod šapata ostaje dugme „Zapeo sam" iz U5 (ne menjaj ga).
- Kad stigne novi šapat a panel je zatvoren: mala tačkica pored ikonice `T` u gornjoj traci. Klik otvara panel. Bez animacije koja privlači pažnju.
- Šapat sa `quote`: citat u kurzivu ispod šapata, sa „— poglavlje III".
- `×` sklanja šapat iz vrha (ostaje u istoriji).
- Podešavanje u `···`: **Tiron: tih / prisutan / isključen**
  - tih = samo ulazak i kraj sesije
  - prisutan = svi trenuci (podrazumevano)
  - isključen = ništa, ni API pozivi
- Model: `Whisper { id, bookId, moment, kind, text, quote?, createdAt, dismissed }`.
- Log: `[tiron] moment=… effort=… ms in cached out`.

**Gotovo kada:** posle poglavlja dobijam šapat koji pominje lika ili otvorenu nit iz moje knjige; 3 prepravke istog poglavlja → sutra ohrabrenje da idem napred; nijedan šapat se ne pojavljuje dok kucam.

---

## Faza T6 — Mala pobeda i Resume

- Effort iz `AI_EFFORT_SESSION_END` (podrazumevano `low`).
- Šapat **kraja sesije** ima posebnu strukturu (Zod): `{ "progress": string, "tomorrow": string }`
  - `progress`: šta se pomerilo u PRIČI (ne broj reči), npr. „Petar je ušao u kuću i našao kofer."
  - `tomorrow`: jedna konkretna stvar za sledeći put, kao pitanje, npr. „Šta je u koferu?"
- Čuva se u `ResumeState.lastWin`.
- Resume ekran (postojeći) dobija, ispod poslednje rečenice:
  ```
  Prošli put: Petar je ušao u kuću i našao kofer.
  Za danas: Šta je u koferu?
  ```
  plus šapat ulaska ispod, ako postoji. **Šapat ulaska se generiše u pozadini na KRAJU prethodne sesije** (isti trenutak kao mala pobeda) i čuva kao `Whisper` sa `moment: "entry"`; Resume ga samo prikazuje, bez čekanja. Ako ne postoji, generiši ga pri otvaranju kao fallback. Posle pauze ≥4 dana dugme dobija tekst: „Samo 10 minuta?" (vodi u editor kao i obično).
- **Resume ima jedno pitanje:** kad `ResumeState.lastWin` postoji, prikazuje se „Prošli put / Za danas" i AI poziv mode `"resume"` se **ne šalje**. Mode `"resume"` („Otvoreno pitanje") ostaje samo kao rezerva kad `lastWin` ne postoji.
- Ako AI ne odgovori — Resume radi bez ovih redova, kao i sada.

**Gotovo kada:** završim sesiju, sutra na Resume vidim šta sam juče pomerio i pitanje za danas.

---

## Faza T7 — Put do kraja

- Kad je `bookPosition == "kraj"`: u sekciji **Knjiga**, odmah ispod Srca knjige, sitno: „Još oko 30 stranica do kraja nacrta" (1 stranica = 300 reči, iz `targetWords`) i lista otvorenih niti iz memorije (`StoryMemory.openThreads`) kao checklist.
- U `···` meniju: **„Označi kraj nacrta"** → potvrda → tih ekran:
  ```
  Kraj nacrta.

  Prva rečenica:   „…"
  Poslednja:       „…"

  42 dana pisanja · 268 stranica
  ```
  Bez konfeta i animacija. Dugme „Nazad u knjigu".
- `Book.draftFinishedAt` se upisuje; oznaka „Nacrt 1 ·" nestaje iz gornje trake (status čuvanja je opet samo „Sačuvano" / „Čuvam…").

**Gotovo kada:** na test knjizi sa malim `targetWords` vidim odbrojavanje, a „Označi kraj nacrta" prikazuje prvu i poslednju rečenicu tačno.

---

## Van ovog zadatka (NE raditi)

Urednik režim (ocene scena, beleške na margini) · AI paleta i njeni alati (Poguraj me, Zakomplikuj, Šta mi nedostaje, Zamisli scenu, Sprint…) · čitanje naglas · sinonimi · email i notifikacije · nalozi i sync · novi jezici · nove sekcije desnog panela · bilo kakve izmene ghost dopuna, provere i ocene jezika.

---

## Reasoning effort (GPT-6 Luna) — bez temperature ni u jednom pozivu

| Env | Podrazumevano | Poziv | Zašto |
|---|---|---|---|
| `AI_EFFORT_STUCK` | `low` | „Zapeo sam" (U5) | autor čeka, brzina je bitna |
| `AI_EFFORT_TIRON` | `medium` | šapati: ulazak, kraj poglavlja, obrazac procesa | povezuje Srce knjige, memoriju, sažetke i signale; radi u pozadini |
| `AI_EFFORT_SESSION_END` | `low` | mala pobeda na kraju sesije | jednostavno sažimanje |
| `AI_EFFORT_MEMORY` | `medium` | memorija, sažeci, najjača rečenica | tačnost izvlačenja; greška kvari sve ostale pozive |

Sve ide kroz `requestParams` helper. Dodaj u `.env.example` i u `docs/AI_PROMPTS.md` (tabela mode → effort → zašto).

## Procena troška (za orijentaciju)

Tiron pravi ~3–6 poziva po sesiji (ulazak, kraj poglavlja, kraj sesije, „Zapeo sam"), po ~2.000–3.000 tokena ulaza. Sa Lunom je to delić centa po sesiji — i dalje manje od ghost dopuna.
