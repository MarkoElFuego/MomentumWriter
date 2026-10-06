# AI_PROMPTS.md — Sistem promptovi i formati

Zajednička pravila žive u `src/lib/ai/prompts.ts`, a jezički redovi u `src/lib/languages/<jezik>/prompts.ts` (bira se po `book.language`). Ispod je prompt za `sr-Latn`; redovi „Autor piše prozu na srpskom…” i „Piši istim jezikom, pismom…” dolaze iz jezičkog modula. Zod šeme u `src/lib/ai/schemas.ts`.

## Zajednički deo (prepend za sve modove)

```
Ti si iskusan književni urednik koji sedi pored autora dok piše.
Autor piše prozu na srpskom (ili jeziku konteksta — odgovaraj na tom jeziku).

APSOLUTNA PRAVILA:
- NIKADA ne piši celu rečenicu proze, pasus, dijalog ili opis koji autor može da prepiše.
- Osim kad se izričito traži početak rečenice, daješ samo pitanja, pravce i zapažanja. Obraćaš se autoru, ne čitaocu.
- Svaka stavka je najviše jedna do dve kratke rečenice.
- Koristi imena i detalje iz konteksta da budeš konkretan, ne generičan.
- Odgovaraš ISKLJUČIVO validnim JSON-om, bez markdowna i bez teksta van JSON-a.
```

## mode: `ghost` — sivi tekst dok pišeš

Klijent ga traži sam, po stanju kursora u trenutnom pasusu (`cursorSituation` u `lib/text/ghost.ts`; pauze u `lib/timing.ts`):

| Stanje | Pauza | Šta |
|---|---|---|
| usred rečenice | 1500 ms | dovršetak (≤ 7 reči, najbolje 2–5, `kind: finish`) |
| posle završene rečenice (`. ! ? …` ili zatvoren navodnik `”` `»`) | 3000 ms | početak sledeće (2–5 reči, bez tačke, inner/outer/shift) |
| prazan pasus | — | ništa: **bez API poziva** i bez podsetnika |

Kontekst `AI_GHOST_CONTEXT_WORDS` (~150 reči), 1 pokušaj, timeout 6 s, `reasoning_effort` iz `AI_GHOST_REASONING_EFFORT` (podrazumevano `none`). Guardrail po stanju kursora (`endsMidSentence`, vidi „Guardrail”). Korisnička poruka na kraju dobija `---KURSOR---` sa „USRED rečenice. Nedovršena rečenica: „…”” ili „POSLE završene rečenice”. Pri prihvatanju `joinStarter` dodaje razmak posle tačke ako ga nema.

```
Autor upravo piše. Tvoj predlog se prikazuje sivo posle kursora i autor ga prihvata ili ignoriše. U delu ---KURSOR--- piše da li je kursor USRED rečenice ili POSLE završene rečenice.

Ako je kursor USRED rečenice:
- Pročitaj nedovršenu rečenicu i tekst pre nje i razumi šta autor hoće da kaže (poređenje, suprotnost posle „ali”, posledicu, nabrajanje…).
- Ponudi TAČNO 3 nastavka koji dovršavaju TU misao — logično, gramatički ispravno, kao da ih je autor napisao.
- Dužina: najbolje 2–5 reči; kraće je bolje ako je misao dovršena; NIKAD više od 7 reči.
- Prvi je najprirodniji, očekivan nastavak. Drugi je blag obrt iste misli. Treći dovršava misao kroz čulni detalj (zvuk, dodir, miris, svetlo).
- Stavi tačku samo ako se rečenica tu prirodno završava; nikad ne počinji novu rečenicu.
- Svaka stavka ima "kind":"finish".

Ako je kursor POSLE završene rečenice:
- Predloži samo POČETAK sledeće rečenice, 2–5 reči, tri različita pravca — bez tačke na kraju; rečenicu završava autor.
- "inner" (misao, emocija, strah lika), "outer" (događaj, prekid, nova osoba ili predmet), "shift" (perspektiva, čulo, vreme, ritam).
- Počni velikim slovom, kao nova rečenica.

Uvek:
- Tekst počinje tačno od kursora; ne ponavljaj reči koje su već napisane.
- Piši istim jezikom, pismom i pravopisom kao autor; ako autor ne koristi dijakritike (č, ć, š, ž, đ), ne koristi ih ni ti.

Format:
{"items":[{"kind":"finish","text":"..."},{"kind":"finish","text":"..."},{"kind":"finish","text":"..."}]}
ili
{"items":[{"kind":"inner","text":"..."},{"kind":"outer","text":"..."},{"kind":"shift","text":"..."}]}
```

## mode: `resume` — Resume ekran („Otvoreno pitanje”)

```
Autor se vraća posle pauze. Na osnovu teksta:
1) napiši siže u TAČNO 3 kratka reda (šta se dogodilo, gde je lik sada, šta je nerešeno) — kao beleške urednika, u prošlom vremenu, bez književnog stila;
2) postavi JEDNO otvoreno pitanje koje vuče scenu napred.

Format:
{"summary":["...","...","..."],"openQuestion":"..."}
```

## mode: `proofread` — provera jezika (v0.2 Faza 5)

Ne koristi zajednički deo ni JSON. Sistem prompt je jezički (`lib/languages/sr-Latn/prompts.ts` → `proofreader`) i uvek identičan:

```
Ti si lektor za srpski jezik (latinica). Ispravi SAMO pravopisne i gramatičke greške i dodaj nedostajuće dijakritike (č, ć, š, ž, đ). NE menjaj stil, redosled reči, izbor reči niti žargon u dijalozima. Ako je pasus ispravan, vrati ga identičnog. Vrati isključivo ispravljen pasus, bez objašnjenja, navodnika ili markdowna.
```

User poruka: samo tekst pasusa (najviše 400 reči). Odgovor: ceo ispravljen pasus kao čist tekst → server vraća `{ corrected }`. Tekst se **nikad ne ubacuje** — klijent ga pretvara u ispravke po rečima (`lib/text/proofDiff.ts`).

- Parametri (varijanta A iz 5a): `reasoning_effort: "none"`, `temperature: 0.2`, `response_format: text`. 1 pokušaj, timeout 10 s.
- Umesto guardraila: ceo odgovor se odbacuje ako je model **prepričao** pasus — manje od polovine reči odgovora (bez kvačica, velikih slova i interpunkcije, redom) postoji u originalu (`isProofreadOf`). Izbačen duplikat rečenice prolazi. Server tada vraća 502 i klijent taj tekst više ne šalje; pojedinačna ispravka se odbacuje ako je udaljenost (bez kvačica, `đ` = `dj`) > 3 ili > 40% dužine reči. Pored zamena reč-za-reč nude se i male ispravke od više reči: spojene/razdvojene reči („kapkeDosao” → „kapke. Došao”), zamena kratkih reči („je” → „su”) i do 3 dodate/izbačene kratke reči (≤ 4 slova), koje se kače na susednu nepromenjenu reč („njega” → „za njega”). Veće izmene (izbačena rečenica, nova duga reč) se ne nude — to je uređivanje, ne lektura.
- Server skida ```-ograde i navodnike oko celog odgovora (osim ako ih je autor napisao).
- Log: `[proofread] 812ms in=486 cached=0 out=231`.
- **Keš (U7):** rezultat se čuva po pasusu u Dexie `proofCache` — ključ `v1:sr-Latn:<FNV-1a hash teksta>` (tekst se čuva i proverava zbog sudara), `corrected` (ili `null` kad je server odbio pasus), odbačene ispravke `{from, to, start}` i `usedAt`. Redosled: memorija sesije → Dexie → API. Prihvati / „Prihvati sve kvačice” odmah upisuju zapis za **novi** tekst pasusa sa istim `corrected` i pomerenim odbačenim ispravkama, pa preostale podvlake ne traže novi poziv. Zapisi neupotrebljeni 90 dana (po `usedAt`) brišu se pri pokretanju. `PROOF_CACHE_VERSION` u `lib/ai/proofread.ts` — **promeni ga kad menjaš prompt ili model za proveru.**

## mode: `stuck` — „Zapeo sam” (U5, desni panel)

Klik na „Zapeo sam” (ili „Još jedno”). Klijent (`hooks/useStuck.ts`) šalje ~400 reči glavnog teksta pre kursora (bez fusnota); ako ih ima **manje od 30 — nema poziva**, prikaže se „Napiši prvo par rečenica, pa ću imati šta da pitam.”. „Još jedno” šalje poslednjih **najviše 5** pitanja u polju `avoid`, a korisnička poruka dobija `---NE PONAVLJAJ---` sa njima. Ako je u Srcu knjige upisan kraj (`heart.ending`, polje `ending`, najviše 1000 znakova; „ne znam…” se ne šalje), korisnička poruka posle `---TEKST---` dobija `---KAKO SE KNJIGA ZAVRŠAVA---` (T1). Kraj knjige se **nikad** ne šalje uz ghost. Od T2 i kompaktna memorija knjige (`compactMemory`, ≤ 1200 znakova ≈ 300 tokena, polje `memory`, najviše 1500) ide u `---ŠTA TIRON PAMTI---` posle kraja, pre `---NE PONAVLJAJ---` — takođe nikad uz ghost.

Sistem prompt **nema** urednički zajednički deo — to je Tiron: `tiron` + `stuck` iz `src/lib/languages/sr-Latn/prompts.ts`. Effort `AI_EFFORT_STUCK` (podrazumevano `low`), bez temperature, 2 pokušaja, timeout 15 s. Log: `[stuck] effort=low 1840ms in=… cached=… out=…`.

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

Autor je zapeo i pritisnuo „Zapeo sam”. U delu ---TEKST--- je ono što je napisao pre kursora. Postavi mu JEDNO pitanje koje otvara sledeći korak u sceni koju upravo piše.
- Postavi pitanje o OVOJ sceni, ne opšti savet o pisanju.
- Oslanjaj se na imena likova, mesta, predmete i ono što je nerešeno u tekstu.
- Pitanje je kratko, najviše 200 znakova. Pitanje mora da se završi upitnikom.
- Ne predlaži rečenice priče i ne odgovaraj umesto autora — pitanje ostavlja odluku njemu.
- Ako postoji deo ---NE PONAVLJAJ---, pitaj nešto drugo od navedenih pitanja (drugi lik, drugi ugao, druga prepreka).
- Ako postoji deo ---KAKO SE KNJIGA ZAVRŠAVA---, neka pitanje vodi scenu korak bliže tom kraju, ali kraj ne prepričavaj i ne pominji ga u pitanju.
- Piši istim jezikom i pismom kao autor; ako autor ne koristi dijakritike (č, ć, š, ž, đ), ne koristi ih ni ti.

Format:
{"question":"..."}
```

## mode: `memory` — Tiron pamti (T2)

Pozadinski poziv, ništa ne čeka na njega. Okidač (`components/tiron/updateMemory.ts`): autor napusti deo (unmount editora, posle `flush`-a autosave-a) i deo ima **≥ 500 reči razlike** od poslednjeg čitanja (`Part.memoryWords`), ili klik „Osveži” u sekciji Knjiga (bez praga). Tekst koji je već pročitan (`Part.summaryForHash` = `hashText` glavnog teksta) se **nikad** ne šalje ponovo. Šalje se glavni tekst dela bez fusnota, najviše **8.000 reči** (duže → poslednjih 8.000 celim pasusima, `MEMORY_CHAPTER_WORDS`).

Svoja šema (kao proofread): `{ mode: "memory", text, memory, pinned, bookTitle, chapterTitle, genre?, language? }` — `memory` su AI stavke, `pinned` stavke koje je autor upisao/izmenio (liste `characters`, `places`, `openThreads`, ≤ 12 × ≤ 80 znakova). Sistem prompt: `memory` iz `src/lib/languages/sr-Latn/prompts.ts` (nije Tironov glas — urednikove beleške). Korisnička poruka: zaglavlje (Knjiga / Žanr / Poglavlje), `---TRENUTNA MEMORIJA---`, `---AUTOR UPISAO---`, `---POGLAVLJE---`.

Izlaz: `{"characters":[…],"places":[…],"openThreads":[…],"summary":"…","bestLine":"…"}`. Predugačke stavke se seku na 80, višak preko 12 otpada, `summary` se seče na 600. **`bestLine` mora biti doslovan citat** — sme da se razlikuje samo u razmacima/prelomima reda (`isExactQuote`); inače se izbacuje, a ostatak ostaje. Loš JSON / bez `summary` → jedan ponovni pokušaj, pa 502 — klijent zadržava staru memoriju i loguje `[memory] kept the old memory`.

Spajanje (`applyMemoryResult`, jedna transakcija): AI stavke se zamenjuju novim, **zakucane (`pinned`) ostaju iste i prve**, AI stavka jednaka zakucanoj otpada, max 12; `Part.summary` / `summaryForHash` / `memoryWords`; `Book.bestLines` — jedna po delu, nova zamenjuje staru (bez nove ostaje stara). Effort `AI_EFFORT_MEMORY` (podrazumevano `medium`), bez temperature, `max_completion_tokens` 4000, timeout 45 s. Log: `[memory] effort=medium … ms in=… cached=… out=…`.

## Zod šeme

```ts
export const ResumeSchema = z.object({
  summary: z.array(z.string().min(3).max(160)).length(3),
  openQuestion: z.string().min(3).max(220),
});

// stuck: pitanje se NIKAD ne odseca (odsečeno pitanje bez „?” izgleda kao greška) —
// guardrail odbija duže od 200 znakova, pa ide jedan ponovni pokušaj.
export const StuckSchema = z.object({ question: z.string().trim().min(3) });
```

## Guardrail (server, `src/lib/ai/guardrail.ts`)

**ghost:** svaka stavka se proverava posebno — loše i duplikati se izbacuju, a odgovor se odbija (ghost nema retry, ništa se ne prikazuje) tek kad ne ostane nijedna. Šema prima 1–3 stavke (najviše 80 znakova, bez odsecanja na 220). Stavka je loša ako:
- **kursor usred rečenice** (`endsMidSentence`): ima više od 7 reči, više od jedne rečenice ili novi red;
- **kursor posle završene rečenice**: ima više od 5 reči, završava se sa `.` `!` `?` `…` ili sadrži novi red;
- sadrži 8+ uzastopnih reči identičnih kontekstu.

**stuck:** pre opštih pravila ispod — odbija se pitanje duže od 200 znakova (`stuck-too-long`) i odgovor koji se ne završava upitnikom (dozvoljen je zatvoren navodnik/zagrada posle `?`; `stuck-not-question`).

**Ostali modovi (resume, stuck, kasnije Tiron):** posle Zod validacije, odbaci ceo odgovor (→ jedan retry, pa greška) ako bilo koja stavka sadrži 8+ uzastopnih reči identičnih kontekstu (kopiranje teksta), ima više od 2 rečenice ili počinje navodnikom/crticom za dijalog (`„`, `"`, `—`, `–`).

Pre parsiranja: skini ```json ograde ako postoje.

## Reasoning effort po modu (GPT-6 Luna)

Effort se čita iz env promenljive (podrazumevana vrednost u kodu i u `.env.example`) i ide kroz `buildRequestParams`. `none` se ne koristi nigde kod Tirona (mora da razmišlja o kontekstu), a `high` i više je preskupo i presporo za odgovor od dve rečenice.

| Mode | Env | Effort | Temperature | Zašto |
|---|---|---|---|---|
| `ghost` | `AI_GHOST_REASONING_EFFORT` | `none` | — | Pojavljuje se dok autor piše; mora biti brz (sa `low` je trajao 4–8 s). |
| `proofread` | — (varijanta A iz 5a) | `none` | `0.2` | Lektura je mehanička; A je bila tačnija i 2× jeftinija od B. |
| `resume` | — (podrazumevano) | podrazumevano | — | Postojeće ponašanje, ne menja se. |
| `stuck` (U5) | `AI_EFFORT_STUCK` | `low` | — | Autor čeka sa rukama na tastaturi (~2 s). Kratko pitanje vezano za poslednjih 400 reči. |
| `tiron` — ulazak, kraj poglavlja, obrazac procesa (T5) | `AI_EFFORT_TIRON` | `medium` | — | Povezuje Srce knjige, memoriju, sažetke, signale i prethodne šapate; ne sme biti generičan. Radi u pozadini. |
| kraj sesije / mala pobeda (T6) | `AI_EFFORT_SESSION_END` | `low` | — | Sažima ono što je upravo napisano. |
| `memory` — memorija, sažeci, najjača rečenica (T2) | `AI_EFFORT_MEMORY` | `medium` | — | Čita celo poglavlje i mora tačno da izvuče likove i niti — greška ovde kvari sve ostale pozive. Radi u pozadini. |

Ulazni šapat se generiše u pozadini na **kraju** sesije i čuva u Dexie (`Whisper` sa `moment: "entry"`); Resume ga samo prikazuje, a ako ne postoji, generiše ga pri otvaranju. Log sadrži effort: `[tiron] moment=… effort=medium ms in cached out`, `[stuck] effort=low ms in cached out`.

## Parametri poziva

- `model: process.env.AI_MODEL`
- `max_completion_tokens: 1200` — gpt-6-luna je model koji „razmišlja”, a skriveno razmišljanje se računa u limit; vidljiv odgovor i dalje drži šema
- parametri se grade samo preko `buildRequestParams` (`src/lib/ai/requestParams.ts`): `temperature`/`top_p` idu **samo** uz `reasoning_effort: "none"`, inače gpt-6-luna vraća 400. `temperature` šalje samo proofread (0.2).
- Korisnička poruka: `Knjiga: {bookTitle}\nPoglavlje: {chapterTitle}\n\n---TEKST---\n{context}`

## Testni slučajevi (Vitest, `schemas.test.ts` + `guardrail.test.ts`)

- ✅ Ghost posle tačke: validna 3 početka · ❌ početak od 6 reči / početak koji je cela rečenica sa tačkom
- ✅ Ghost usred rečenice: dovršetak sa tačkom · ❌ dovršetak od 9 reči ili koji počinje novu rečenicu
- ❌ Stavka koja je dijalog: `„Ne diraj to”, rekao je Petar.`
- ❌ Stavka koja ponavlja poslednju rečenicu konteksta
- ✅ Odgovor u ```json ogradama se ispravno parsira
