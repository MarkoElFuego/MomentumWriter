# ZADATAK — UI čišćenje i konačan raspored

Jedna faza = jedan razgovor = jedan commit.
Pre svake faze: pročitaj `AGENTS.md`, `docs/PRODUCT.md`, ovaj fajl i `docs/PROGRESS.md`. Prvo plan, pa kod.

## Pravila za sve faze

1. `docs/PRODUCT.md` je izvor istine za raspored i listu funkcija.
2. **Ne diraj:** naziv Momentum, ghost dopune (same posle pauze, `↑↓` bira, `Tab` prihvata; `/` je običan znak), proveru jezika, ocenu jezika, autosave, Resume ekran, teme, fusnote, prelom scene.
3. Ništa novo van ovog fajla. Ako nešto fali — pitaj.
4. Tekst se nikad ne gubi: promena šeme = nova Dexie verzija + migracija + test.
5. GPT-6 Luna: `temperature` samo uz `reasoning_effort: "none"`; sve preko `requestParams` helpera.
6. Svaka ikonica: tooltip (naziv + prečica) i `aria-label`. Sve akcije dostupne tastaturom. Animacije poštuju `prefers-reduced-motion`.
7. Posle svake faze: `pnpm typecheck && pnpm lint && pnpm test`, ažuriran `docs/PROGRESS.md`, predlog commit poruke, 3–5 koraka za ručnu proveru.

---

## Faza U0 — Dokumentacija (bez koda)

- Zameni `docs/PRODUCT.md` novom verzijom (dobićeš je od mene).
- `AGENTS.md`: uskladi prečice i listu funkcija sa PRODUCT.md; dodaj sekciju „Izbačeno" (kopija iz PRODUCT.md); obriši sve reference na AI paletu, `Ctrl+/`, `Ctrl+J`, „Treba mi impuls", sinonime.
- `docs/ZADATAK_Tiron.md`:
  - obriši fazu **T7** (Zamisli scenu, Sprint)
  - u **T5** desni panel ima tačno 4 sekcije: Tiron, Knjiga, Za kasnije, Jezik (Srce knjige, likovi, mesta, niti, obećanja i sažeci idu u „Knjiga")
  - napomena da dugme „Zapeo sam" pravi faza U5 ovog fajla
- `docs/PROGRESS.md`: dodaj U1–U7.

**Gotovo kada:** nijedan dokument ne pominje paletu ni izbačene alate kao nešto što postoji ili se planira.

---

## Faza U1 — Uklanjanje AI palete

- Ukloni: paletu (komponente, stil, state), prečice `Ctrl+/`, `Ctrl+J`, `Ctrl+K` za paletu, dugme „✦ Treba mi impuls", hint „Zapeo si? …" na praznom pasusu, alate Zamisli scenu i Sprint ako postoje.
- API modove `push`, `complicate`, `missing`, `imagine` ukloni iz `/api/spark` i iz promptova/šema/testova.
- **ZADRŽI** mode `resume` (koristi ga Resume ekran) i sve ostale modove koje koriste ghost, provera jezika i Tiron.
- Ukloni nekorišćene tekstove iz `copy.ts`.
- `grep` na kraju: nema više referenci na uklonjene stvari.

**Gotovo kada:** aplikacija radi kao pre, bez palete; ghost, provera jezika i Resume rade; testovi prolaze.

---

## Faza U2 — Gornja traka i formatiranje

### Raspored trake
```
☰  Tekst ▾  B  I  ≡▾        Sačuvano        ◐  ⌨  ◎  ⛶   T•
```
- `☰` — otvara/zatvara levi panel (sadržaj) · prečica `Ctrl+\`
- **Tekst ▾** — meni stila pasusa: Tekst, Naslov 1, Naslov 2, Citat. Uvek prikazuje stil pasusa u kom je kursor.
- **B**, **I** — aktivno stanje vidljivo kad je kursor u boldovanom/kurziv tekstu
- **≡▾** — meni poravnanja: levo, centar, obostrano; ikonica prikazuje trenutno poravnanje
- **Sačuvano / Čuvam…** — bledo, centrirano (premesti iz `···` menija). Prikaz „Nacrt 1 · Sačuvano" (tooltip „Nacrt 1 — ovo niko ne čita") dolazi tek sa ZADATAK_Tiron T1 — u U2 samo „Sačuvano" / „Čuvam…".
- `◐` teme (mali meni sa 4 kružića) · `⌨` pisaća mašina · `◎` fokus · `⛶` ceo ekran — prekidači sa vidljivim aktivnim stanjem
- `T` — otvara/zatvara Tiron panel; tačkica kad postoji novi šapat (ako Tiron šapati još ne postoje, bez tačkice)
- Ako `···` meni posle ovoga ostane sa podešavanjima (Provera jezika, Tiron tih/prisutan/isključen), zadrži ga kao poslednju ikonicu desno.

### Ponašanje trake
- Bledi (opacity → 0, 300 ms) posle ~1,5 s kucanja.
- Vraća se na pomeranje miša, na fokus trake tastaturom (`Alt+F10` ili `Tab` iz trake) i kad je bilo koji njen meni otvoren.
- Nikad ne nestaje dok je meni otvoren.

### Formatiranje (TipTap)
- Heading nivoi 1 i 2, Blockquote, Bold, Italic, TextAlign (`@tiptap/extension-text-align`, tipovi: paragraph, heading).
- Prečice: `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `Ctrl/Cmd+Alt+1` (Naslov 1), `Ctrl/Cmd+Alt+2` (Naslov 2), `Ctrl/Cmd+Alt+0` (Tekst).
- Markdown skraćenice na početku reda: `# ` → Naslov 1, `## ` → Naslov 2, `> ` → Citat.
- **Ghost dopune ne rade u naslovima; provera jezika radi** (odluka 2026-09-30).
- Stil naslova i citata iz aktivne teme (font, veličina, bleda vertikalna linija za citat) — bez boja van teme.

### Obostrano poravnanje
- Probaj `hyphens: auto` sa `lang="sr-Latn"` na editoru u Chrome, Firefox i Safari.
- Napravi mi 2 screenshota pasusa obostrano poravnatog (sa i bez hyphens) i reci u kojim browserima rastavljanje radi.
- Ako rastavljanje za srpski ne radi dobro — opcija „obostrano" se ne prikazuje u editoru (ostaje za budući izvoz). Odluku donosim ja posle screenshotova.

**Gotovo kada:** svi stilovi rade iz trake, prečicama i Markdown skraćenicama; traka bledi dok kucam i vraća se na miš; ghost ne radi u naslovu.

---

## Faza U3 — Naslov poglavlja povezan sa sadržajem

- Na vrhu svakog poglavlja: naslov poglavlja kao **poseban input iznad editora** (ne čvor u TipTap dokumentu), stilizovan kao naslov iz teme, sa rimskim brojem iznad sitno (npr. „II").
- Vrednost = `Part.title`. Izmena ovde menja naziv u levom panelu i obrnuto (isti izvor podataka, bez kašnjenja).
- `Enter` u naslovu prebacuje kursor na početak teksta. `↑` na prvom redu teksta vraća u naslov.
- Uvodni/završni delovi (Posveta, Epilog…) imaju naslov bez rimskog broja.
- Prazan naslov → placeholder „Naslov poglavlja".
- Ako postoji stari sadržaj gde je naslov poglavlja ubačen kao H1 na početku dokumenta: migracija ga prebacuje u `Part.title` i uklanja iz teksta (samo ako je identičan nazivu iz sadržaja). Test migracije.

**Gotovo kada:** promenim naslov u tekstu → odmah se menja levo; promenim levo → odmah u tekstu.

---

## Faza U4 — Levi panel: brisanje i animirano prevlačenje

### Prevlačenje
- `@dnd-kit/core` + `@dnd-kit/sortable` (nova zavisnost — opravdana: pristupačan drag & drop sa animacijama).
- Tokom prevlačenja ostala poglavlja se glatko razmiču (~200 ms ease), tanka linija pokazuje mesto spuštanja, prevučeni red je blago podignut (senka/opacity iz teme).
- Rimski brojevi se ažuriraju posle spuštanja, sa kratkim prelazom.
- Poglavlja se mogu premeštati samo unutar svoje grupe (uvodni / poglavlja / završni).
- Tastatura: fokus na poglavlje + `Alt+↑/↓` pomera ga.
- Redosled se čuva odmah (Dexie).

### Brisanje
- `⋮` pored naslova (vidljiv na hover i fokus) → meni: Preimenuj, Obriši.
- Potvrda: „Obrisati ‚Kofer' (3.214 reči)?" [Obriši] [Odustani]. Prazno poglavlje (0 reči) se briše bez potvrde.
- Posle brisanja: traka u dnu ekrana „Poglavlje obrisano · Poništi" 10 sekundi. Poništi vraća poglavlje na isto mesto sa svim sadržajem, beleškama za kasnije i fusnotama.
- Implementacija: soft delete (`deletedAt`), trajno brisanje posle 10 s ili pri sledećem pokretanju aplikacije.
- Ako je obrisano poglavlje bilo otvoreno → otvori susedno (prethodno, ako ne postoji onda sledeće). Poslednje poglavlje u knjizi ne može da se obriše (stavka „Obriši" je onemogućena, tooltip objašnjava).
- `ResumeState`, sažeci i ostali podaci vezani za obrisano poglavlje se ažuriraju/brišu zajedno sa trajnim brisanjem.

### Ostalo
- Aktivno poglavlje naglašeno (težina fonta ili bleda pozadina iz teme), bez dodatnih ikonica.
- Preimenovanje: dupli klik ili `⋮` → Preimenuj.

**Gotovo kada:** prevučem III ispred I → animacija, brojevi tačni, redosled ostaje posle refresha; obrišem poglavlje sa tekstom → Poništi ga vraća kompletno.

---

## Faza U5 — Desni panel: 4 sekcije i „Zapeo sam"

### Struktura panela
1. **Tiron** — uvek otvoren na vrhu: poslednji šapat (ako šapati postoje), ispod dugme **„Zapeo sam"**, ispod odgovor.
2. **Knjiga ›** — skupljena; unutra: Srce knjige, Likovi, Mesta, Otvorene niti, Poglavlja (sažeci). Prikaži samo podsekcije za koje podaci postoje.
3. **Za kasnije ›** — skupljena; beleške za kasnije (ako ta funkcija još ne postoji, sekcija se ne prikazuje).
4. **Jezik** — jedan red: ocena + broj otvorenih ispravki; klik vodi na sledeću podvlaku (ako ocena još ne postoji, sekcija se ne prikazuje).
- Stanje skupljeno/otvoreno po sekciji pamti u Dexie.
- **Nema praznih sekcija ni „uskoro" placeholdera.**

### „Zapeo sam"
- `/api/spark` mode `"stuck"`: kontekst = poslednjih ~400 reči pre kursora + kompaktna memorija knjige (ako postoji) + `heart.ending` (ako postoji).
- Effort `low` (`AI_EFFORT_STUCK`), bez temperature.
- Izlaz (Zod): `{ "question": string }` — JEDNO pitanje (max 200 karaktera) koje autoru otvara sledeći korak u trenutnoj sceni, koristeći imena i otvorene niti iz konteksta. Nikad tekst priče.
- Guardrail: odbaci ako počinje dijaloškom crticom/navodnikom ili ima više od 2 rečenice.
- Prompt u `src/lib/languages/sr-Latn/prompts.ts`, u Tironovom tonu (kratko, toplo, pita).
- Prikaz: pitanje ispod dugmeta, ispod sitan link „Još jedno" (novi poziv, prethodno pitanje se šalje kao „ne ponavljaj"). Skeleton dok čeka. Greška → „Tiron trenutno ne može da odgovori." bez pada.
- Fokus se NE prebacuje iz editora kad se klikne dugme mišem (autor nastavlja da kuca gde je bio).
- Log: `[stuck] effort=low ms in cached out`.

**Gotovo kada:** usred scene kliknem „Zapeo sam" → za ~2 s pitanje koje pominje lika iz moje knjige; „Još jedno" daje drugačije pitanje; kursor ostaje u tekstu.

---

## Faza U6 — Fokus, ceo ekran, footer, uski ekrani

- **◎ Fokus:** pasusi osim trenutnog na opacity 0.35 (150 ms). Paneli i traka ostaju kakvi jesu.
- **⛶ Ceo ekran:** Fullscreen API; oba panela se zatvaraju; traka se pojavljuje samo kad je miš u gornjih ~40px; `Esc` izlazi (i paneli se vraćaju u prethodno stanje).
- **⌨ Pisaća mašina:** postojeće ponašanje, samo premešteno u traku.
- **Footer:** „347 reči danas" sitno dole levo, bledi zajedno sa trakom.
- **Uski ekrani:** ako bi kolona teksta bila uža od ~60 karaktera, paneli se otvaraju PREKO teksta (overlay sa blagom senkom), klik van panela ga zatvara.
- Kolona teksta: max ~66 karaktera, uvek centrirana u slobodnom prostoru.

**Gotovo kada:** na laptopu sa 1366px širine oba panela + tekst se ponašaju lepo; ceo ekran radi i `Esc` vraća sve kako je bilo.

---

## Faza U7 — Ocena jezika (bez novih AI poziva)

- `src/lib/text/languageScore.ts`: ulaz = broj reči + otvorene (neprihvaćene, neodbačene) ispravke iz provere jezika.
  Težine: diacritic = 1, grammar = 3. Ocena = 100 − round(ponderisane greške na 100 reči × 5), u opsegu 0–100.
- Ocena se NE računa za poglavlje otvoreno u editoru — za njega u panelu piše „u izradi".
  Računa se i čuva kad autor napusti poglavlje; ažurira se kad se kasnije prihvate/odbiju ispravke u tom poglavlju.
- Ocena knjige = prosek poglavlja koja imaju ocenu, ponderisan brojem reči. Čuvaj prethodnu vrednost za prikaz promene (↑3 / ↓2).
- Prikaz: sekcija „Jezik" u desnom panelu, jedan red: ocena knjige, promena, broj kvačica i gramatičkih ispravki. Klik vodi na sledeću podvlaku. Boje iz teme, bez crvene.
- U `copy.ts` naziv je „Jezik" — nikad „ocena pisanja" ili „kvalitet".
- Testovi: bez grešaka = 100; kvačice obaraju manje od gramatike; prazno poglavlje = bez ocene; otvoreno poglavlje se ne računa.

---

## Van ovog zadatka (NE raditi)

Bilo kakva izmena ghost dopuna i provere jezika · Tiron šapati (to je `ZADATAK_Tiron.md`) · izvoz · novi jezici · paleta i njeni alati · sinonimi · Urednik.

---

## Dodatak — reasoning effort za Tiron pozive (GPT-6 Luna)

Bez `temperature` ni u jednom Tiron pozivu. `none` se ne koristi nigde kod Tirona (mora da razmišlja o kontekstu); `high` i više je preskupo i presporo za šapat od dve rečenice.

| Poziv | Env promenljiva | Effort | Zašto |
|---|---|---|---|
| Zapeo sam | `AI_EFFORT_STUCK` | `low` | Autor čeka sa rukama na tastaturi (~2 s). Kratko pitanje vezano za poslednjih 400 reči. |
| Šapati (ulazak, kraj poglavlja, obrazac procesa) | `AI_EFFORT_TIRON` | `medium` | Povezuje Srce knjige, memoriju, sažetke, signale i prethodne šapate; ne sme biti generičan. Radi u pozadini. |
| Kraj sesije (mala pobeda) | `AI_EFFORT_SESSION_END` | `low` | Sažima ono što je upravo napisano. |
| Ažuriranje memorije, sažeci, najjača rečenica | `AI_EFFORT_MEMORY` | `medium` | Čita celo poglavlje i mora tačno da izvuče likove i niti — greška ovde kvari sve ostale pozive. Radi u pozadini. |

- Podrazumevane vrednosti su i u kodu i u `.env.example`.
- Svi idu kroz `requestParams` helper (`temperature` se automatski izbacuje jer effort nije `none`).
- Ulazni šapat se generiše u pozadini na **kraju** sesije i čuva u Dexie (Whisper sa `moment: "entry"`); Resume ga samo prikazuje. Ako ne postoji, generiše se pri otvaranju kao fallback.
- Log sadrži effort: `[tiron] moment=… effort=medium ms in cached out`.
- `docs/AI_PROMPTS.md` dobija tabelu: mode → effort → zašto.
