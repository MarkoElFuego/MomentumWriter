# ARCHITECTURE.md

## Pregled

```
Browser (Next.js klijent)
 ├─ TipTap editor ──► Dexie (IndexedDB)  ← sav rukopis živi lokalno
 ├─ Spark paleta ──► POST /api/spark ──► OpenAI API
 └─ Resume ekran ──► Dexie (resumeState) + /api/spark (mode: resume)
```

API ključ postoji samo na serveru (`src/app/api/spark/route.ts`). Rukopis se šalje AI-ju samo kroz AI akcije (paleta, sivi tekst posle pauze, u v0.2 provera jezika za završen pasus), i nikad cela knjiga — najviše ~400 reči konteksta.

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
```
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

Pri otvaranju knjige: ako `resumeState.lastWrittenAt` je stariji od **6 sati** → `/resume?book=…`, inače direktno u editor na `partId` + `cursorPos`.

## Prečice

| Prečica | Akcija |
|---|---|
| `Ctrl/Cmd + /` ili klik na „✦ Treba mi impuls” | Spark paleta na mestu kursora (opet zatvara). `/` se kuca normalno |
| `Tab` (u editoru) | Prihvati sivi tekst ako je vidljiv; inače ne radi ništa (ne izbacuje iz editora). `Shift+Tab` i dalje izlazi iz editora |
| `Ctrl/Cmd + →` (sivi tekst vidljiv) | Prihvati jednu reč sivog teksta |
| `↓` / `↑` (sivi tekst vidljiv, više predloga) | Sledeći / prethodni od 3 predloga; brojač „1/3” iza sivog teksta |
| `Esc` (sivi tekst vidljiv) | Skloni sivi tekst |
| `1`–`4` (dok je paleta otvorena) | Izbor alata |
| `Esc` | Zatvori paletu |
| `Ctrl/Cmd + \` | Prikaži/sakrij sadržaj knjige (uvodni delovi / poglavlja / završni delovi) |
| `F2` / dupli klik (u panelu) | Preimenuj deo |
| `Alt + ↑/↓` (u panelu) | Pomeri deo unutar njegove grupe (isto kao prevlačenje) |
| `***` u praznom pasusu | Prelom scene `✱ ✱ ✱` |

Na srpskom rasporedu `/` je `Shift+7` — prečica se hvata i po `event.code === "Slash"`, kao `Ctrl+\` po `"Backslash"`.

## API: `POST /api/spark`

Ulaz (Zod):
```ts
{
  mode: "push" | "complicate" | "missing" | "resume" | "ghost",
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
5. Pokreni `pnpm test` i ručno probaj sivi tekst i ✦ Poguraj me na tekstu tog jezika.
