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
```

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

`/` je običan znak. Na srpskom rasporedu `Ctrl+\` se hvata i po `event.code === "Backslash"` (taster „ž”).

`Ctrl+Alt+cifra` se ne hvata kad je `AltGraph` aktivan ili kad raspored otkuca znak (srpski: AltGr+1 = `~`, često kao mrtav taster) — Windows prijavljuje AltGr kao Ctrl+Alt. Na Mac-u (`Cmd+Option`) odlučuje `event.code`. Poravnanje nema prečice (samo traka).

Planirano: Tiron T3: `Ctrl+Shift+N` beleška za kasnije.

## API: `POST /api/spark`

Ulaz (Zod):
```ts
{
  mode: "resume" | "ghost",  // "proofread" ima svoju šemu; "stuck" (U5) i Tiron modovi dolaze kasnije; ostalo → 400
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
