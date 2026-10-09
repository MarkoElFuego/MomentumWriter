# ARCHITECTURE.md

## Pregled

```
Browser (Next.js klijent)
 ├─ TipTap editor ──► Dexie (IndexedDB)  ← sav rukopis živi lokalno
 ├─ sivi tekst, provera jezika ──► POST /api/spark ──► OpenAI API
 ├─ desni panel (Tiron, „Zapeo sam”) ──► POST /api/spark   (planirano: U5, ZADATAK_Tiron)
 └─ Resume ekran ──► Dexie (resumeState) + /api/spark (mode: resume)
```

API ključ postoji samo na serveru (`src/app/api/spark/route.ts`). Rukopis se šalje AI-ju samo kroz AI akcije (sivi tekst posle pauze, provera jezika po pasusu, Resume pitanje; kasnije „Zapeo sam” i Tiron), i nikad cela knjiga — najviše ~400 reči konteksta.

## Model podataka (Dexie, `src/lib/db/schema.ts`)

```ts
type ID = string; // crypto.randomUUID()

interface Book {
  id: ID;
  title: string;
  language: Language;  // "sr-Latn" (v2); bira jezički modul za AI i tipografiju
  createdAt: number;
  updatedAt: number;
}

// v3: knjiga je niz delova; svaki deo je jedan dokument.
type PartKind = "front" | "chapter" | "back"; // naslovna/posveta/predgovor · poglavlje · epilog/zahvalnica/beleška o autoru

interface Part {
  id: ID;
  bookId: ID;
  kind: PartKind;
  title: string;        // poglavlje: opciono ime ("" = samo broj); broj se računa (rimski) po redosledu
  order: number;        // redosled unutar vrste; razmaci 1000, 2000…; vrste idu front → chapter → back
  content: JSONContent; // TipTap JSON; scene unutar poglavlja deli čvor sceneBreak (✱ ✱ ✱)
  wordCount: number;    // keširano pri svakom save-u
  createdAt: number;
  updatedAt: number;
}

interface DailyStat {
  date: string;         // "2026-09-25" (lokalno vreme)
  bookId: ID;
  startWordTotal: number; // ukupno reči u knjizi pri prvom otvaranju tog dana
  endWordTotal: number;   // ažurira se pri save-u
}

interface ResumeState {
  bookId: ID;            // primarni ključ
  partId: ID;
  cursorPos: number;     // ProseMirror pozicija u delu
  lastSentence: string;  // poslednja rečenica pre kursora
  lastWrittenAt: number;
  openQuestion?: string; // iz AI "resume" moda, keširano
  openQuestionFor?: string; // hash konteksta za koji je pitanje generisano
}
```

Dexie indeksi:
```ts
db.version(1).stores({
  books: "id, updatedAt",
  chapters: "id, bookId, [bookId+order]",
  scenes: "id, chapterId, bookId, [chapterId+order], updatedAt",
  dailyStats: "[date+bookId], bookId",
  resumeState: "bookId",
});
// v2: Book.language — bez novih indeksa; .upgrade() upisuje "sr-Latn" starim knjigama
db.version(2).stores({}).upgrade(/* … */);
// v3: scene svakog poglavlja se spajaju u jedan Part (lib/db/migrations.ts):
//   redom, sceneBreak između, pravi naslov scene kao pasus u kurzivu, prazne scene i
//   automatski naslovi („Scena N”, „Poglavlje IV”) otpadaju; resumeState.sceneId → partId
//   (cursorPos = 0). Tabele chapters i scenes se brišu posle upgrade-a.
db.version(3).stores({ parts: "id, bookId", chapters: null, scenes: null }).upgrade(upgradeToParts);
// v4: tabela settings (izgled: tema, fokus, pisaća mašina)
db.version(4).stores({ settings: "key" });
// v5: naslov poglavlja ima svoje polje iznad teksta — Naslov 1 na samom početku dela
//   se briše iz teksta ako je isti kao naziv iz sadržaja (i „Poglavlje II · Kofer” /
//   „II · Kofer”, bez obzira na velika slova); wordCount se umanjuje. Bez novih indeksa.
db.version(5).stores({}).upgrade(upgradeTitleHeadings);
// v6: Part.deletedAt? — meko brisanje sa „Poništi”; opciono, bez indeksa i bez upgrade-a.
db.version(6).stores({});
// v7: proofCache (provera jezika po pasusu: key, text, corrected|null, rejected, createdAt, usedAt)
//   + opciono Part.languageScore / Book.languageScore (U7). Nova tabela, bez upgrade-a.
db.version(7).stores({ proofCache: "key, usedAt" });
// v8: opciono Book.heart {about?, ending?, why?} / targetWords? (40k/80k/120k, bez = „ne znam”) /
//   genre? (Tiron T1) + zapis "panels" u settings ({ open: ["book"] } — otvorene sekcije desnog
//   panela, podrazumevano sve skupljene). Bez indeksa i bez upgrade-a.
db.version(8).stores({});
// v9: tabela storyMemory (ključ bookId: characters / places / openThreads — stavke
//   { id, text ≤ 80, source: "ai" | "user", pinned }, ≤ 12 po listi; updatedAt, updatedAfterPartId)
//   + opciono Part.summary / summaryForHash / memoryWords i Book.bestLines (Tiron T2). Bez upgrade-a.
db.version(9).stores({ storyMemory: "bookId" });
// v10: Book.deletedAt? — meko brisanje knjige sa „Poništi” (kao delovi u v6); bez indeksa i bez upgrade-a.
db.version(10).stores({});
// v11: tabela sessions (Tiron T4): { id, bookId, partIds[], startedAt, endedAt, wordsAdded,
//   wordsDeleted, hour } — kako autor piše, nikad šta. Nova tabela, bez upgrade-a.
db.version(11).stores({ sessions: "id, bookId" });
// v12: tabela whispers (Tiron T5): { id, bookId, moment, kind, text, quote?, quotePartId?,
//   sessionId?, createdAt, dismissed, seen }. Nova tabela, bez upgrade-a.
db.version(12).stores({ whispers: "id, bookId" });
// v13: opciono ResumeState.lastWin { progress, tomorrow, sessionId, createdAt } i Whisper.waiting (T6).
//   Bez indeksa i bez upgrade-a.
db.version(13).stores({});
// v14: opciono Book.draftFinishedAt (T7). Bez indeksa i bez upgrade-a.
db.version(14).stores({});
```

Put do kraja (T7, `lib/text/draftEnd.ts`): kad je `bookPosition(ukupno, targetWords) === "kraj"` i nacrt nije završen, sekcija Knjiga ispod Srca knjige pokazuje „Još oko N stranica do kraja nacrta” (`pagesLeft`, 300 reči = stranica; ≤ 0 → „Planirana dužina je dostignuta.”) i otvorene niti iz memorije kao listu sa kvačicama (kvačica briše nit iz memorije; tada se ista lista ne ponavlja niže). `···` → „Označi kraj nacrta” → `flush` → `/draft-end?book=…&from=…` (`components/book/DraftEnd.tsx`): potvrda (Odustani u fokusu, Esc nazad), pa `finishDraft` i tih ekran — prva rečenica prvog poglavlja sa tekstom i poslednja rečenica poslednjeg (cela; bez poglavlja → svi delovi; bez fusnota), `writingDays` (dani iz `dailyStats` kad se zbir reči menjao) i `pageCount`. Posle toga traka nema „Nacrt 1 ·”, nema placeholdera „Nacrt 1 · …”, odbrojavanja ni stavke u `···`.

Resume i mala pobeda (T6): kraj sesije upisuje `lastWin` (`saveLastWin`; `savePart` ga čuva kroz `...previous`) i pravi ulazni šapat unapred (`waiting`, skriven u panelu i bez tačkice). `ResumeScreen` (`hooks/useResumeTiron.ts`, Dexie `liveQuery`): ispod poslednje rečenice „Prošli put / Za danas” iz `lastWin` — tada bez poziva `resume` — ili „Otvoreno pitanje” kao rezerva; ispod toga ulazni šapat (isporučen čekajući, šapat obrasca ili napravljen pri otvaranju — pojavi se kad stigne). Posle ≥ 4 kalendarska dana dugme glasi „Samo 10 minuta?” (vodi u editor isto). Bez AI-ja Resume radi kao pre.

Šapati (T5): okidači i kontekst su u `docs/AI_PROMPTS.md` → mode `tiron`; logika u `components/tiron/whisper.ts` (`requestWhisper`, `whisperSessionEndIfDue`; jedan zahtev po trenutku u isto vreme). Okidači: `ResumeScreen` (zaostali kraj sesije, pa ulazak/obrazac), izlazak iz dela u `WriteScreen` (posle `updateStoryMemory === "updated"` → `chapterEnd`), `hooks/useSessionEnd.ts` (provera svakog minuta + `visibilitychange`). Prikaz: `hooks/useWhispers.ts` (Dexie `liveQuery`) → sekcija Tiron u panelu (`components/tiron/Whispers.tsx`): najnoviji nesklonjen šapat gore (serif, citat u kurzivu sa „— II · Kofer”, `×` = `dismissed`), dugme „Zapeo sam”, ispod „Ranije” (10, pa „Prikaži sve”). Tačkica pored `T` dok postoji neviđen šapat i panel je zatvoren; otvaranje panela ih označava viđenim (`seen`). Tačkica je u traci koja bledi dok autor kuca. Režim u `···` (`lib/tironMode.ts`, `localStorage`): prisutan / tih / isključen — isključen gasi samo šapate (memorija i „Zapeo sam” rade). `purgeDeletedBooks` briše i šapate.

Sesije i signali (T4): `savePart` u istoj transakciji zove `recordActivity` (`lib/db/sessions.ts`): razlika broja reči dela prema prethodnom čuvanju ide u `wordsAdded` / `wordsDeleted`; čuvanje < 30 min (`SESSION_GAP_MS`) posle poslednjeg u toj knjizi produžava sesiju (`endedAt`, `partIds`), inače počinje nova (`hour` = lokalni sat). „Kraj sesije” (20 min bez čuvanja, tab skriven 10 min, zatvaranje — `isSessionOver`) je trenutak za šapat u T5; sesija se tada ne zatvara zapisom, pa povratak pre 30 min nastavlja istu. `lib/process/signals.ts` (čiste funkcije): `daysSinceLastSession` (kalendarski dani), `sessionsLast7Days`, `rewriteRatio` (poslednje 3), `restartsOfCurrentPart` (neto < 150 reči), `bookPosition` (< 25% / ≤ 80% / više, null bez `targetWords`), `typicalHour`, `trend` (null ispod 6 sesija). `getSignals(bookId, partId)`; u dev režimu editor pri otvaranju dela ispiše `[signals] {…}` u konzolu. Ništa od ovoga se ne prikazuje u UI-ju i ne šalje na server. `purgeDeletedBooks` briše i sesije.

Brisanje knjige (odluka autora 2026-10-06): u biblioteci `⋮` → „Obriši” → potvrda sa brojem reči (prazna knjiga bez potvrde) → `deleteBook` upisuje `deletedAt`; `listBooks`, `getBook` i `openPart` je od tog trenutka ne vide. Traka „Knjiga obrisana · Poništi” 10 s (isti modul `hooks/useUndoDelete.ts`, `PendingDelete` ima i `kind: "book"`). `purgeDeletedBooks` (uz `purgeDeletedParts`, kad istekne „Poništi” i pri otvaranju biblioteke/editora) trajno briše knjigu, njene delove, `dailyStats`, `resumeState` i `storyMemory`; `proofCache` je po tekstu i ističe sam.

Srce knjige (T1): „Nova knjiga” → `createBook` → `/start?book=…` (`components/book/StartScreen.tsx`): naslov (neobavezan, prazno = „Nova knjiga”), 3 pitanja, žanr i dužina, sve neobavezno; „Počni da pišeš” (`Ctrl/Cmd+Enter`) upisuje kroz `updateBook` (`cleanHeart` seče razmake i izbacuje prazne odgovore), „Preskoči” ne upisuje ništa; oba idu na prvo poglavlje preko `router.replace`. Stare knjige i preskočena pitanja → sekcija „Knjiga ›” u desnom panelu (`components/tiron/BookSection.tsx`), gde se svaka izmena odmah upisuje. Kraj knjige ide samo u „Zapeo sam” (`knownEnding`: „ne znam…” se ne šalje), nikad u ghost.

Tiron pamti (T2): `lib/db/memory.ts` (repo, spajanje, `compactMemory`), `components/tiron/updateMemory.ts` (čita sačuvan deo iz Dexie-a — radi i posle unmount-a editora; isti deo se ne šalje dvaput u isto vreme), `hooks/useStoryMemory.ts` (Dexie `liveQuery`: memorija i sažeci se pojavljuju u panelu i kad čitanje završi posle prelaska u drugo poglavlje), prikaz u `components/tiron/BookMemory.tsx` (Likovi / Mesta / Otvorene niti uvek sa „+ dodaj”, Poglavlja samo kad postoji sažetak, „Osveži”). Izmena ili dodavanje stavke = `source: "user"`, `pinned: true`. Najjače rečenice se ne prikazuju (koristi ih T5). Detalji poziva: `docs/AI_PROMPTS.md` → mode `memory`.

„Sredi tekst" (¶ u traci, odluka autora 2026-10-06): `components/editor/tidyText.ts` — čista `tidyBlocks` (razmaci/tabovi/meke crtice, prazni pasusi, `hardBreak` → razmak, PDF redovi se spajaju kad prethodni ne završava rečenicu a sledeći počinje malim slovom, „rastav-" + „ljeno" → „rastavljeno", liste → pasusi, oznake osim bold/kurziv otpadaju; naslovi, citat, poravnanje, `sceneBreak` i brojevi fusnota ostaju) i `tidyTr` (selekcija proširena na cele blokove ili ceo glavni tekst, jedna `replaceWith` transakcija = jedan `Ctrl+Z`; zona fusnota se ne dira; u fusnoti onemogućeno). Bez AI-ja.

Izvoz (ZADATAK_IZVOZ): sve lokalno u browseru. `lib/export/typst/` — `buildBook` (knjiga → odeljci u Typst markup-u, `fromTiptap` + `escape`), šabloni `templates/print.typ.ts` (Knjiga za štampu) i `templates/manuscript.typ.ts` (Rukopis), `worker.ts` (kompajler typst.ts + renderer u Web Workeru, WASM i Literata iz `public/`, učitavaju se tek pri prvom izvozu), `client.ts` (`compilePdf`, `previewPage` — jedna strana kao SVG, `pageSvg.ts` je iseca iz renderera; pad kompajlera → nov worker i još jedan pokušaj). UI: `··· → Izvezi PDF…` → `components/export/ExportDialog.tsx` (`<dialog>`: odredišta, podešavanja, pregled strana na belom papiru, „Preuzmi PDF”). Ime i kontakt za rukopis se pamte u knjizi (`Book.author`, `Book.contact`, Dexie v15). Imena fajlova: `lib/export/fileName.ts`. Proba i merenja: `/dev/typst` (samo dev), `pnpm measure:typst`.

Ocena jezika (U7, `lib/text/languageScore.ts`): pri izlasku iz dela (unmount ekrana ili sakriven tab) `useProofread().stats()` daje reči **proverenih** pasusa i otvorene podvlake; ako je provereno ≥ 50% reči dela, `saveLanguageScore` upisuje `Part.languageScore` i preračunava `Book.languageScore` (prosek po rečima, čuva `previous` za ↑/↓). Deo otvoren u editoru se nikad ne računa. Prikaz: sekcija „Jezik” u Tiron panelu — `Jezik 94 ↑3`, ispod (samo ako ovde ima podvlaka) „ovde: 4 kvačice · 1 gramatika”; klik → sledeća podvlaka sa otvorenim popoverom. Bez ocene knjige sekcije nema.

Brisanje dela: `deletePart` upisuje `deletedAt`; `listParts`, `getPart`, `openPart` i zbirovi reči ga od tog trenutka ne vide. „Poništi” (10 s, `UNDO_DELETE_MS`) briše `deletedAt` — deo je na istom mestu jer mu se `order` ne menja. `purgeDeletedParts` trajno briše delove obrisane pre ≥ 10 s (i `ResumeState` ako je pokazivao na njih); zove se kad istekne „Poništi” i pri svakom otvaranju liste knjiga ili editora. Ponuda „Poništi” je u modulu `hooks/useUndoDelete.ts` (ne u stanju komponente), jer brisanje otvorenog dela vodi na susedni i ekran se ponovo montira. Poslednje poglavlje knjige ne može da se obriše (`canDeletePart`); uvodni i završni delovi uvek mogu.

Naslov dela (`Part.title`) se uređuje u polju iznad editora (`components/editor/ChapterTitle.tsx`), ne u TipTap dokumentu; poglavlja imaju rimski broj sitno iznad. Svaki taster se odmah upisuje (`renamePart`), panel za otvoreni deo prikazuje vrednost iz editora uživo, a preimenovanje u panelu javlja `onChanged` pa editor ponovo čita naslov. `Enter`/`↓` u naslovu → početak teksta; `↑` u prvom redu teksta → naslov.
Svaka promena šeme = nova `db.version(n)` sa `.upgrade()` — nikad ne menjaj postojeću verziju.

## Ključne funkcije

| Fajl | Funkcija | Napomena |
|---|---|---|
| `lib/text/countWords.ts` | `countWords(text)` | Radi sa ćirilicom i latinicom; `split(/\s+/)` posle trim, ignoriše samostalnu interpunkciju |
| `lib/text/extractContext.ts` | `extractContext(doc, pos, maxWords)` | Tekst pre kursora, poslednjih N reči, poštuje granice pasusa |
| `lib/text/lastSentence.ts` | `lastSentence(text)` | Za Resume; max ~160 karaktera, dodaj „…” ako je sečeno |
| `lib/stats/today.ts` | `wordsToday(bookId)` | `max(0, endWordTotal − startWordTotal)` |
| `lib/stats/pages.ts` | `toPages(words)` | `Math.floor(words / 300)` (v0.2) |

## Autosave

- `onUpdate` iz TipTap-a → debounce 800 ms → `savePart()` (content, wordCount, updatedAt) + ažuriraj `dailyStat.endWordTotal` + `resumeState`.
- `visibilitychange` (hidden) i `beforeunload` → odmah flush.
- Mali indikator statusa u `···` meniju (ne u footeru): „Sačuvano” / „Čuvam…”.

## Kada se prikazuje Resume

Pri otvaranju knjige (`bookEntry` u `lib/db/resume.ts`): knjiga bez ijedne reči → editor (prvo poglavlje); `resumeState.lastWrittenAt` stariji od **6 sati** (`RESUME_AFTER_MS`) → `/resume?book=…`; inače editor na `partId` (obrisan deo / nema stanja → prvo poglavlje).

Poglavlje se u editoru **uvek otvara od početka** (kursor na početku teksta, odluka autora 2026-10-02) — `cursorPos` se više ne vraća u editor; služi Resume ekranu za kontekst pitanja. `restorablePos` (`components/editor/contentSchema.ts`) pomera poziciju iz zone fusnota na kraj glavnog teksta, a `0` znači „nepoznato” → kraj teksta. Resume ekran čita sačuvan sadržaj istom šemom (`docFromJSON`), pa su pozicije iste kao u editoru.

Resume ekran: „Knjiga te čeka.” · „Ovde je priča stala ranije danas / juče / pre N dana:” (kalendarski dani) · citat poslednje rečenice + linija (ne prikazuje se ako je rečenica prazna) · slot `ResumePrompt` („Otvoreno pitanje:”, mode `resume`, keš u `openQuestion`/`openQuestionFor` po ključu `partId:hash(konteksta)`; greška → slot se sakrije) · „Nastavi da pišeš” radi odmah. U T6 isti slot prikazuje „Prošli put / Za danas” umesto pitanja.

## Prečice

| Prečica | Akcija |
|---|---|
| `Tab` (u editoru) | Prihvati sivi tekst ako je vidljiv; inače ne radi ništa (ne izbacuje iz editora). `Shift+Tab` i dalje izlazi iz editora |
| `Ctrl/Cmd + →` (sivi tekst vidljiv) | Prihvati jednu reč sivog teksta |
| `↓` / `↑` (sivi tekst vidljiv, više predloga) | Sledeći / prethodni od 3 predloga; brojač „1/3” iza sivog teksta |
| `Esc` (sivi tekst vidljiv) | Skloni sivi tekst |
| `Alt + Enter` (na podvučenoj reči) | Popover provere jezika (Enter prihvata, Esc nazad u tekst) |
| `Ctrl + Shift + F` | Ubaci fusnotu; `Esc`/`Enter` u fusnoti vraća iza broja |
| `Ctrl/Cmd + \` | Prikaži/sakrij sadržaj knjige (uvodni delovi / poglavlja / završni delovi) |
| `Ctrl/Cmd + Shift + \` | Prikaži/sakrij Tiron panel (desno); ne uzima fokus |
| `Esc` (fokus u Tiron panelu) | Nazad u tekst, kursor tamo gde je bio |
| `F2` / dupli klik (u panelu) | Preimenuj deo |
| `***` u praznom pasusu | Prelom scene `✱ ✱ ✱` |
| `Ctrl/Cmd + B` / `I` | Podebljano / kurziv |
| `Ctrl/Cmd + Alt + 0` / `1` / `2` | Tekst / Naslov 1 / Naslov 2 (AltGr znak ima prednost — vidi ispod) |
| `# ` `## ` `> ` na početku reda | Naslov 1 / Naslov 2 / Citat |
| `Alt + F10` | Fokus na gornju traku (traka se vraća ako je izbledela) |
| `Ctrl/Cmd + Shift + L` | Beleška za kasnije na selekciji ili reči kod kursora; u belešci → izmena njenog teksta (T3). `Ctrl+Shift+N` samo dodatno — Chrome/Edge ga ne puštaju stranici |

`/` je običan znak. Na srpskom rasporedu `Ctrl+\` se hvata i po `event.code === "Backslash"` (taster „ž”).

`Ctrl+Alt+cifra` se ne hvata kad je `AltGraph` aktivan ili kad raspored otkuca znak (srpski: AltGr+1 = `~`, često kao mrtav taster) — Windows prijavljuje AltGr kao Ctrl+Alt. Na Mac-u (`Cmd+Option`) odlučuje `event.code`. Poravnanje nema prečice (samo traka).

Beleška za kasnije (T3, `components/editor/laterNote.ts`): TipTap oznaka `laterNote` `{ id, note, createdAt }` u JSON-u dela (kao fusnote — bez Dexie verzije), deo `contentExtensions`, pa je čitaju i Resume i Tironovo čitanje poglavlja. `inclusive: false`. Bez selekcije ide na reč kod kursora (ili reč neposredno pre njega); u fusnoti i praznom redu se ne dodaje. Popover „Šta ovde kasnije?” (`LaterNotePopover.tsx`), Enter = jedan korak istorije. Sekcija „Za kasnije (N) ›” (`components/tiron/LaterSection.tsx`, `hooks/useLaterNotes.ts`): otvoren deo uživo iz editora, ostali iz Dexie (`liveQuery` + `collectLaterNotes` iz `lib/text/laterNotes.ts`), jedan red po `id`. Klik → kursor na početak beleške (u drugom delu posle `flush` i prelaza; modul-stanje preživi remount). Kvačica skida oznaku: u otvorenom delu transakcijom (`Ctrl+Z` vraća), u zatvorenom `removeLaterNoteFromPart` (samo oznaka iz sačuvanog JSON-a, bez `Ctrl+Z`). „Sredi tekst” čuva `laterNote`.

## API: `POST /api/spark`

Ulaz (Zod):
```ts
{
  mode: "resume" | "ghost" | "stuck",  // "proofread" i "memory" (T2) imaju svoje šeme; ostalo → 400
  context: string,          // max ~3000 karaktera
  chapterTitle?: string,    // naslov otvorenog dela: „Poglavlje IV · Dolazak”, „Posveta”
  bookTitle?: string,
  language?: "sr-Latn"      // iz book.language; bez njega važi DEFAULT_LANGUAGE
}
```
Izlaz: vidi `docs/AI_PROMPTS.md`. Greške: `{ error: "timeout" | "invalid_response" | "rate_limited" | "server" }` — UI prikazuje poruku iz `copy.ts`.

## Jezici (`src/lib/languages/`)

```
src/lib/languages/
  index.ts                 # LANGUAGES, DEFAULT_LANGUAGE, getLanguage(book.language)
  sr-Latn/prompts.ts       # jezički redovi AI promptova
  sr-Latn/typography.ts    # navodnici „ ”, crta za dijalog, prelom scene
```

Zajednička pravila promptova ostaju u `lib/ai/prompts.ts`; `buildSystemPrompt(mode, language)` ubacuje jezičke redove iz modula. UI tekst (`copy.ts`) je za sada samo srpski — jezik knjige ne menja jezik aplikacije.

### Dodavanje novog jezika

1. Napravi `src/lib/languages/<kod>/prompts.ts` i `typography.ts` po uzoru na `sr-Latn` (isti tipovi: `LanguagePrompts`, `Typography`).
2. U `index.ts` dodaj kod u `LANGUAGES` i modul u `MODULES` — TypeScript javlja ako nešto fali.
3. Ako jezik ima drugačija pravila za kraj rečenice ili navodnike, proveri `lib/text/sentences.ts` (`endsSentence`) i dodaj testove.
4. Dodaj izbor jezika pri pravljenju knjige (UI) — tek kad bude potreban; `Book.language` već postoji, pa migracija nije potrebna.
5. Pokreni `pnpm test` i ručno probaj sivi tekst i proveru jezika na tekstu tog jezika.
