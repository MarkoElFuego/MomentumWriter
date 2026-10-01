# ZADATAK v0.2 — Momentum

> **Istorija (završeno 2026-10-01).** Paleta, Faza 1b (`Ctrl+/`) i sinonimi (Faza 6) su izbačeni — važi `docs/PRODUCT.md`, a sledeći plan je `docs/ZADATAK_UI.md`.

Agent radi **jednu fazu po razgovoru**, redom.
Pre svake faze: pročitaj `AGENTS.md`, ovaj fajl i `docs/PROGRESS.md`. Prvo plan, pa kod.

---

## Pravila koja važe za SVE faze

1. **Minimalizam.** Editor je tekst, kursor i tišina. Sve je nevidljivo dok ne zatreba. Nema novih dugmadi, panela ni funkcija van ovog fajla.
2. **AI ne ocenjuje i ne prepravlja stil.** Jedino što AI dodaje u tekst su dopune (sivi tekst, ✦ Poguraj me); jedino što menja su ispravke provere jezika. Ako neka faza liči na nešto treće — stani i pitaj.
3. **AI predlaže, autor odlučuje.** Ništa ne ulazi u tekst bez eksplicitnog prihvatanja (Tab, klik, Enter).
4. **Tekst se nikad ne gubi.** Svaka promena šeme = nova Dexie verzija + migracija + test migracije.
5. **Ne diraj ono što radi.** Ghost dopune, Spark paleta, Resume i autosave zadržavaju postojeće ponašanje osim ako faza kaže drugačije.
6. **GPT-6 Luna pravilo:** `temperature` sme da se pošalje SAMO uz `reasoning_effort: "none"`. Uz bilo koji drugi effort, `temperature`/`top_p` ne smeju biti u zahtevu (API vraća 400). Parametre uvek gradi preko jednog helpera.
7. Posle svake faze: `pnpm typecheck && pnpm lint && pnpm test` prolaze, `docs/PROGRESS.md` ažuriran, predložena commit poruka, 3–5 koraka za ručnu proveru.

---

## Faza 1 — Dokumentacija (bez koda)

Uskladi dokumentaciju sa odlukama:
- `AGENTS.md`:
  - zlatno pravilo #1 → „AI predlaže, autor odlučuje" (tekst iz pravila 3 gore; dopune ostaju kako rade: dovršetak ≤ 7 reči (najbolje 2–5), početak sledeće ≤ 5; nikad celi pasusi)
  - prečice: ghost dopune rade kao do sada, `Tab` prihvata, `↑/↓` menja predlog; AI alati (Poguraj me, Zakomplikuj, Šta mi nedostaje, Vrati me u priču) preko `Ctrl+/` i dugmeta „✦ Treba mi impuls"
  - dodaj pravila 1, 2 i 6 iz ovog fajla
  - ukloni sve reference na `Ctrl+J` i Urednik režim (Urednik se briše potpuno, ne ide ni u „kasnije”)
- `docs/ARCHITECTURE.md`, `docs/PLAN.md` i `docs/PRODUCT.md`: isto usklađivanje.
- `docs/PROGRESS.md`: dodaj faze 1b–7 iz ovog fajla kao checklist (Faza 8 je odložena).

**Gotovo kada:** nijedan dokument ne protivreči ovom fajlu.

---

## Faza 1b — Ctrl+/ otvara paletu (mala izmena koda)

- `Ctrl/Cmd+/` i dugme „✦ Treba mi impuls” otvaraju Spark paletu na kursoru. Hvata se i `event.code === "Slash"` (srpski raspored: `/` je `Shift+7`).
- Uklanja se `/` kao okidač palete (kuca se normalno) i `Ctrl/Cmd+J`.
- Podsetnik u praznom pasusu: „Zapeo si? Pritisni Ctrl+/” (Mac: ⌘/).
- Alati u paleti ostaju isti — **ZA MENJANJE**: autor razmišlja kako da ih promeni.

**Gotovo kada:** `/` se svuda kuca kao znak; `Ctrl+/` otvara paletu i na srpskom i na engleskom rasporedu; Ctrl+J ne radi ništa naše.

---

## Faza 2 — Priprema za više jezika (refaktor, bez promene ponašanja)

- `Book.language` (podrazumevano `"sr-Latn"`), Dexie migracija.
- Struktura:
  ```
  src/lib/languages/
    sr-Latn/prompts.ts      ← jezički dodaci za sve AI modove
    sr-Latn/typography.ts   ← navodnici „", crtica za dijalog, prelom scene
    index.ts                ← bira modul po book.language
  ```
- Zajednička pravila promptova ostaju u `src/lib/ai/prompts.ts`; jezički dodatak se dodaje po `book.language`.
- Helper `src/lib/ai/requestParams.ts`: gradi parametre zahteva i izbacuje `temperature` kad effort nije `"none"`. Test za to.
- Sav UI tekst iz komponenti premesti u `src/lib/copy.ts`.
- U `docs/ARCHITECTURE.md` opiši korake za dodavanje novog jezika.

**Gotovo kada:** aplikacija radi identično kao pre; svi testovi prolaze.

---

## Faza 3 — Struktura knjige: poglavlja umesto scena

**Pre početka:** reci mi da napravim izvoz (backup) svih knjiga.

- Model: `Book → Part`, `Part.kind = "front" | "chapter" | "back"`.
  - front: naslovna, posveta, predgovor · back: epilog, zahvalnica, beleška o autoru
- Migracija: sve scene jednog poglavlja spoji u jedan dokument, redom, sa prelomom scene između njih. Naslov svake scene sačuvaj kao pasus u kurzivu na mestu preloma. `ResumeState` i `DailyStat` prebaci na `partId`.
- Test migracije: 2 poglavlja × 3 scene → sav tekst i redosled sačuvani.
- Panel (`Ctrl+\`) = sadržaj knjige: uvodni delovi / poglavlja sa automatskim rimskim brojevima / završni delovi; „+ Novo poglavlje", „+ Dodaj deo"; prevlačenje menja redosled; preimenovanje duplim klikom.
- Ruta `/write/[partId]`.
- `***` u praznom redu → čvor `sceneBreak`, prikaz `✱ ✱ ✱` centrirano.

**Gotovo kada:** stare knjige su tu bez gubitka teksta; „Novo poglavlje" odmah otvara poglavlje za pisanje; nema više praznih „scena".

---

## Faza 4 — Fusnote

- `Ctrl+Shift+F` ubacuje fusnotu (superscript broj) na poziciji kursora.
- Tekst fusnote se uređuje u zoni na dnu poglavlja; `Esc` vraća kursor iza broja.
- Automatsko prenumerisanje po redosledu u dokumentu.
- Hover na broj → tooltip sa tekstom fusnote.
- Brisanje broja briše i fusnotu; jedan `Ctrl+Z` vraća oboje.
- Ghost i provera jezika ne rade unutar fusnote.

**Gotovo kada:** 3 fusnote, brisanje srednje → ostale postaju 1 i 2; undo vraća.

---

## Faza 5 — Provera jezika (dijakritici + gramatika)

### 5a. Test skripta — PRVO ovo, pošalji mi izlaz pre UI-ja
- `scripts/proofread-cases.json`: ~15 slučajeva `{ input, expected }`:
  ošišana latinica; dvosmislene reči po kontekstu (kuca/kuća, sto/što, cas/čas); reči sa legitimnim „dj" (odjednom, podjednako, nadjačati — NE smeju postati „đ"); padeži; „nisam/nesam"; zarez; dijalog sa žargonom koji se NE sme dirati; potpuno ispravan pasus (mora ostati identičan).
- `pnpm eval:proofread` pokreće sve slučajeve u dve varijante:
  - **A:** effort `none` + temperature `0.2`
  - **B:** effort `low`, bez temperature
- Izlaz: tabela A vs B — tačne ispravke, pogrešne izmene, propuštene greške, prosečno ms, prosečno output tokena.

### 5b. Implementacija (varijantu biram ja posle 5a)
- Okidač: Enter posle pasusa → `/api/spark` mode `"proofread"` za prethodni pasus. Ne šalji ponovo ako se pasus nije promenio (hash).
- Model vraća **ceo ispravljen pasus kao čist tekst**. Sistem prompt (uvek identičan, na početku, radi keširanja):
  „Ti si lektor za srpski jezik (latinica). Ispravi SAMO pravopisne i gramatičke greške i dodaj nedostajuće dijakritike (č, ć, š, ž, đ). NE menjaj stil, redosled reči, izbor reči niti žargon u dijalozima. Ako je pasus ispravan, vrati ga identičnog. Vrati isključivo ispravljen pasus, bez objašnjenja, navodnika ili markdowna."
- `src/lib/text/proofDiff.ts`: diff po rečima → `{ from, to, start, end, type }`, `type = "diacritic"` ako se razlikuje samo po kvačicama, inače `"grammar"`.
  - odbaci ispravku ako reč nije slična originalu (Levenshtein > 3 ili > 40% dužine)
  - odbaci ceo odgovor ako se broj reči razlikuje > 20%
- Prikaz: tačkasta podvlaka = dijakritik, talasasta = gramatika. Klik → popover „cesto → često" [Prihvati] [Odbaci], plus „Prihvati sve kvačice u pasusu". Izmena reči briše njenu podvlaku.
- Podešavanje u `···`: „Provera jezika: uključena / isključena".
- Log po pozivu: `[proofread] 812ms in=486 cached=0 out=231`.
- Testovi za `proofDiff`.

**Gotovo kada:** pasus bez kvačica + Enter → za ~2 s podvlake; prihvatanje i odbijanje rade; ghost radi kao pre.

---

## Faza 6 — Sinonimi

> **ODLOŽENO (2026-09-30, odluka autora):** preskačemo za sada — ne raditi dok autor ne vrati fazu. Sledeća je Faza 7.

- Selekcija TAČNO jedne reči (dupli klik) → mali BubbleMenu sa dugmetom „≈ Sinonimi". Isto radi `Alt+S`. Zahtev ide tek na klik/prečicu.
- Klik na reč sa podvlakom provere jezika i dalje otvara ispravku.
- `/api/spark` mode `"synonyms"`: ulaz = reč + cela rečenica; effort `none`, temperature `0.3`.
  Izlaz: `{"synonyms":[{"word":"...","note":"jače|blaže|formalnije|razgovorno|arhaično|null"}]}` — 5–8 sinonima **u istom padežu, rodu, broju i vremenu** kao original, po značenju iz rečenice.
- Zod validacija; odbaci stavke duže od 2 reči i identične originalu.
- Popover ispod reči; strelice + Enter ili klik menja reč (jedan `Ctrl+Z` vraća); `Esc` zatvara; čuva veliko početno slovo.
- Keš u memoriji po (reč + rečenica). Log trajanja i tokena.

**Gotovo kada:** „uplašenog" u rečenici → sinonimi u akuzativu muškog roda.

---

## Faza 7 — Vizuelne teme

Tema menja SAMO boje i font. Bez tekstura, slika i ukrasa.

- `src/styles/themes.css`, promenljive na `<html data-theme="...">`:
  `--paper`, `--ink`, `--ink-muted`, `--ghost`, `--underline-diacritic`, `--underline-grammar`, `--font-text`

  | Tema | paper | ink | ink-muted | ghost | font |
  |---|---|---|---|---|---|
  | papir | #F7F3EA | #2B2A26 | #A39B8B | #B8B0A0 | Literata → Georgia |
  | noc | #1B1C1F | #D9D6CE | #6B6964 | #5E5C58 | Literata → Georgia |
  | masina | #EDE8DC | #2F2D29 | #9C9483 | #ABA392 | Courier Prime → monospace |
  | magla | #E8EBED | #2B3237 | #8E979E | #A5AEB5 | Inter → system-ui |

- Fontovi preko `next/font`.
- Podrazumevano `papir`; ako je sistem u tamnom režimu → `noc`. Izbor se pamti u Dexie.
- U `···` meniju: 4 mala kružića u boji papira. Bez posebne stranice.
- Dva prekidača u istom meniju:
  - **Fokus mod:** pasusi osim trenutnog na opacity 0.35, prelaz 150 ms
  - **Pisaća mašina skrol:** red sa kursorom uvek oko sredine ekrana
- Proveri kontrast teksta i ghosta u svakoj temi.

**Gotovo kada:** promena teme je trenutna, pamti se posle refresha, ghost i podvlake su čitljivi u svim temama.

---

## Faza 8 — Troškovi ghost dopuna (ODLOŽENO)

> Dopune sada rade dobro — ne dira se dok autor ne odluči (2026-09-29).

- Keširaj ghost odgovor po tekstu pre kursora; isti tekst → bez novog poziva.
- Sistem prompt za ghost uvek identičan i na početku zahteva (keširanje prompta).
- Loguj `usage` za svaki ghost poziv: `[ghost] 1840ms in=512 cached=384 out=96`.
- Dodaj env `AI_GHOST_EFFORT` (`low` | `none`) da mogu sam da uporedim kvalitet i cenu.

**Gotovo kada:** posle 30 minuta pisanja u logu vidim broj poziva, keširane tokene i prosečno vreme.

---

## Van ovog zadatka (NE raditi)

Ocene i kritika teksta · prepravljanje stila · novi jezici (samo priprema iz Faze 2) · nalozi, sync, email · export u DOCX.
