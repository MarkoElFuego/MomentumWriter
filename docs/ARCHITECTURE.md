# ARCHITECTURE.md

## Pregled

```
Browser (Next.js klijent)
 ├─ TipTap editor ──► Dexie (IndexedDB)  ← sav rukopis živi lokalno
 ├─ Spark paleta ──► POST /api/spark ──► OpenAI API
 └─ Resume ekran ──► Dexie (resumeState) + /api/spark (mode: resume)
```

API ključ postoji samo na serveru (`src/app/api/spark/route.ts`). Rukopis se šalje AI-ju samo kada korisnik eksplicitno pritisne AI akciju, i to samo ~400 reči konteksta.

## Model podataka (Dexie, `src/lib/db/schema.ts`)

```ts
type ID = string; // crypto.randomUUID()

interface Book {
  id: ID;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface Chapter {
  id: ID;
  bookId: ID;
  title: string;      // "Poglavlje VII"
  order: number;      // sortiranje; koristi razmake (1000, 2000…) za lako ubacivanje
  createdAt: number;
  updatedAt: number;
}

interface Scene {
  id: ID;
  chapterId: ID;
  bookId: ID;         // denormalizovano radi brzih upita
  title: string;
  order: number;
  content: JSONContent; // TipTap JSON
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
  sceneId: ID;
  cursorPos: number;     // ProseMirror pozicija
  lastSentence: string;  // poslednja rečenica pre kursora
  lastWrittenAt: number;
  openQuestion?: string; // iz AI "resume" moda, keširano
  openQuestionFor?: string; // hash konteksta za koji je pitanje generisano
}
```

Dexie indeksi (verzija 1):
```ts
db.version(1).stores({
  books: "id, updatedAt",
  chapters: "id, bookId, [bookId+order]",
  scenes: "id, chapterId, bookId, [chapterId+order], updatedAt",
  dailyStats: "[date+bookId], bookId",
  resumeState: "bookId",
});
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

- `onUpdate` iz TipTap-a → debounce 800 ms → `saveScene()` (content, wordCount, updatedAt) + ažuriraj `dailyStat.endWordTotal` + `resumeState`.
- `visibilitychange` (hidden) i `beforeunload` → odmah flush.
- Mali indikator statusa u `···` meniju (ne u footeru): „Sačuvano” / „Čuvam…”.

## Kada se prikazuje Resume

Pri otvaranju knjige: ako `resumeState.lastWrittenAt` je stariji od **6 sati** → `/resume?book=…`, inače direktno u editor na `sceneId` + `cursorPos`.

## Prečice

| Prečica | Akcija |
|---|---|
| `Tab` (u editoru) | Prihvati sivi tekst ako je vidljiv; inače Spark paleta na mestu kursora. `Shift+Tab` i dalje izlazi iz editora |
| `Ctrl/Cmd + →` (sivi tekst vidljiv) | Prihvati jednu reč sivog teksta |
| `↓` / `↑` (sivi tekst vidljiv, više predloga) | Sledeći / prethodni od 3 predloga; brojač „1/3” iza sivog teksta |
| `Esc` (sivi tekst vidljiv) | Skloni sivi tekst |
| `Ctrl/Cmd + J` | Spark paleta (preventDefault; testiraj u Chrome, Firefox, Safari) |
| `1`–`4` (dok je paleta otvorena) | Izbor alata |
| `Esc` | Zatvori paletu |
| `Ctrl/Cmd + \` | Prikaži/sakrij strukturu (Book → Chapter → Scene) |

Ako `Ctrl+J` ne može da se presretne u nekom browseru, rezervna prečica je `Ctrl/Cmd + K`.

## API: `POST /api/spark`

Ulaz (Zod):
```ts
{
  mode: "push" | "complicate" | "missing" | "resume",
  context: string,          // max ~3000 karaktera
  sceneTitle?: string,
  chapterTitle?: string,
  bookTitle?: string
}
```
Izlaz: vidi `docs/AI_PROMPTS.md`. Greške: `{ error: "timeout" | "invalid_response" | "rate_limited" | "server" }` — UI prikazuje poruku iz `copy.ts`.
