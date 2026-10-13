# ZADATAK — Uvoz knjige (DOCX, nalepljen tekst, TXT, PDF)

Radi se PRE `ZADATAK_POLISH.md`.
Jedna faza = jedan razgovor = jedan commit. Pre svake faze: pročitaj `AGENTS.md`, `docs/PRODUCT.md`, ovaj fajl i `docs/PROGRESS.md`. Prvo plan, pa kod.

## Cilj

Pisac koji je knjigu već počeo u Wordu, Google Docs-u ili negde drugde prenosi je u Momentum jednim prozorom:
**izabere fajl ili nalepi tekst → vidi kako je Momentum podelio knjigu → „Uvezi knjigu" → piše dalje.**

Momentum sam sređuje **raspored** (poglavlja, uvodni i završni delovi, naslovi, kurziv, bold, fusnote, prelomi scena). **Reči ostaju autorove.**

| Izvor | Kvalitet | Šta se čuva |
|---|---|---|
| **DOCX** (Word, LibreOffice, Google Docs → „Preuzmi kao .docx") | najbolji | naslovi, kurziv, bold, centriran red, prave fusnote |
| **Nalepi tekst** (iz Worda, Google Docs-a…) | dobar | kurziv, bold, naslovi; fusnote samo ako su prepoznatljive |
| **TXT** | osnovni | samo tekst; poglavlja po oznakama („Poglavlje 3", „III") |
| **PDF** (Faza I4) | najslabiji | samo PDF sa tekstom (ne sken); kurziv delimično; fusnote kao običan tekst |

Sve se dešava lokalno u browseru — fajl i tekst ne napuštaju računar (osim ako autor uključi „Neka Tiron pročita knjigu", Faza I3).

## Pravila

1. **Uvoz menja raspored, nikad reči.** Dozvoljeno je samo:
   - skidanje oznake poglavlja („Poglavlje 3:", „III ·") — broj računa Momentum, naziv ostaje;
   - čišćenje kao „Sredi tekst" (razmaci, prazni redovi, iscepani redovi, liste → pasusi) — **koristi postojeći `tidyBlocks`**, ne pravi novi;
   - u PDF-u: brojevi strana i tekuća zaglavlja/podnožja.
2. **Nijedna reč se ne gubi.** `wordAudit` poredi reči izvora i uvezene knjige; razlika sme da bude samo ono iz pravila 1. Šta ne može da se prepozna (fusnota, tabela) ostaje kao običan tekst — nikad ne nestaje. Jedini izuzetak su slike (Momentum ih nema); pregled kaže koliko ih je izostavljeno.
3. **Bez AI-ja u uvozu.** Delove prepoznaju pravila, autor potvrđuje u pregledu.
4. **Uvoz nije pisanje.** Ne upisuje „reči danas", sesije (T4), `ResumeState` ni šapate. Posle uvoza „reči danas" = 0, Tiron ne misli da je autor danas napisao 80.000 reči.
5. **Isti format kao editor.** Sve ide kroz istu šemu dokumenta (`contentExtensions` / ProseMirror parser) kao lepljenje u editor — uvezeno poglavlje je isto kao napisano u Momentumu (fusnote, prelom scene, beleške za kasnije, provera jezika rade).
6. Biblioteke za DOCX i PDF se učitavaju **lenjo** (tek kad se izabere fajl), hostovane lokalno, ne sa CDN-a. Nova zavisnost = obrazloženje u 5 redova (veličina, održavanje, rad u browseru) pre koda.
7. Autorovi probni rukopisi idu u `scripts/import-samples/` — fascikla je u `.gitignore` (privatno).
8. **Ne diraj:** editor, ghost, proveru jezika, Tirona (osim čitanja iz I3), izvoz, levi i desni panel.
9. Tekst u `copy.ts`, bez roda. Tekst se nikad ne gubi: promena šeme = nova Dexie verzija + migracija + test.
10. Posle svake faze: `pnpm typecheck && pnpm lint && pnpm test`, ažuriran `docs/PROGRESS.md`, predlog commit poruke, 3–5 koraka za ručnu proveru.

---

## Faza I0 — Dokumentacija (bez koda)

**Uvoz:**
- `docs/PRODUCT.md`: u „Funkcije" nova podsekcija **Uvoz** (izvori iz tabele gore, pravilo „raspored da, reči ne"); u „Put pisca", red Početak: „već imaš početak u Wordu → Uvezi knjigu".
- `docs/ARCHITECTURE.md`: kratak opis `lib/import/` (popuni posle I1–I4).

**Usklađivanje zastarelog** (ranije planirano kao POL0):
- `PRODUCT.md`: iz „Posle verzije 1.0" ukloni izvoz (urađen); crtež rasporeda — „Nacrt 1 · Sačuvano" i `···` u traci.
- `ARCHITECTURE.md` → „Autosave": status čuvanja je u gornjoj traci (od U2), ne u `···` meniju.
- `PLAN.md` → „Kasnije": ukloni „Export u DOCX".
- `PROGRESS.md`: novo zaglavlje — trenutna faza ZADATAK_UVOZ, posle njega ZADATAK_POLISH; dodaj I0–I4 kao checklist.

**Gotovo kada:** nijedan dokument ne opisuje stanje koje ne postoji.

---

## Faza I1 — Jezgro (bez UI-ja)

`src/lib/import/` — čiste funkcije sa testovima:

- **`fromHtml.ts`** — HTML → TipTap JSON blokovi istom šemom kao editor:
  - kurziv, bold (i iz `style` atributa — Google Docs), naslovi h1 → Naslov 1, h2 i niže → Naslov 2, citat, centriran red
  - fusnote: superskript veza ka listi na kraju (oblik koji daju DOCX konverter i Google Docs) → `footnoteRef` + fusnota u zoni **tog dela**; neprepoznata fusnota ostaje kao tekst („[1]" i tekst na kraju)
- **`fromText.ts`** — običan tekst → pasusi. Ako tekst ima prazne redove između pasusa, nov red bez praznog reda je iscepan red (spaja se); inače svaki red je pasus.
- **`chapterHeading.ts`** — da li je blok naslov dela, i šta ostaje kao naziv:
  - **stil naslova u izvoru** (h1 / Heading 1…) ima prednost: deli se po najvišem nivou naslova koji se javlja **bar 2 puta**
  - bez stilova: kratak samostalan pasus (≤ 10 reči) po obrascu koji se u tekstu javlja **bar 2 puta**:
    „Poglavlje 3", „POGLAVLJE III", „Poglavlje treće", „Treće poglavlje", „Glava 3", „Chapter 3", „3", „3.", „III", „III.", „3. Kofer", „III · Kofer", „III – Kofer", „Poglavlje 3: Kofer"
  - broj se skida, naziv ostaje (`Part.title`); „Poglavlje 3" → prazan naziv (ostaje samo rimski broj, kao i sada)
  - dijalog (počinje crticom ili navodnikom) i obična rečenica sa tačkom **nikad** nisu naslov („3 dana kasnije." nije poglavlje)
- **`splitBook.ts`** — blokovi → `ImportedPart[]` `{ kind, title, content, words, firstSentence }`:
  - Posveta, Predgovor, Prolog, Uvod → uvodni deo (samo pre prvog poglavlja); Epilog, Pogovor, Zahvalnica, Zahvalnost, Beleška o autoru, O autoru → završni deo (samo posle poslednjeg poglavlja)
  - tekst pre prvog dela: ≤ 60 reči → **naslovna strana** (predlog naslova knjige; podrazumevano se ne uvozi, autor može da je zadrži kao deo „Naslovna"); duže → uvodni deo bez naslova
  - „Deo prvi" / „Prvi deo" (nivo iznad poglavlja — Momentum ga nema) → Naslov 1 na početku sledećeg poglavlja
  - pasus koji sadrži samo `***`, `* * *`, `*`, `#`, `§`, `~`, `✱ ✱ ✱` i slično → prelom scene
  - ništa nije prepoznato → jedno poglavlje sa celim tekstom
  - `mergeWithPrevious(parts, i)` — za ispravku u pregledu (I3)
- **`wordAudit.ts`** — pravilo 2; koristi se u svakom testu uvoza.
- **`lib/db/importBook.ts`** — jedna Dexie transakcija: `Book` + delovi (`order` sa razmacima 1000), `wordCount` po delu, `DailyStat` za danas sa `startWordTotal = endWordTotal = ukupno`. **Bez** `savePart`, sesija, `ResumeState` i šapata (pravilo 4).

**Testovi:** svaki obrazac naslova i lažni naslovi („3 dana kasnije.", „— Treće?"); dokument sa i bez stilova naslova; uvodni i završni delovi; naslovna strana; „Deo prvi"; prelom scene; fusnota usred rečenice i fusnota sa kurzivom; ništa prepoznato; spajanje; `wordAudit` na svakom slučaju; posle `importBook`: „reči danas" = 0, nema sesije, nema šapata, knjiga se otvara u editoru (ne na Resume).

**Gotovo kada:** testovi prolaze; nijedan test ne gubi reč.

---

## Faza I2 — Izvori: DOCX, nalepljen tekst, TXT

- **DOCX → HTML** (sa fusnotama i endnotama): izaberi gotov konverter (npr. `mammoth`) ili sopstveni parser preko `jszip` (već u projektu iz P8 — DOCX je ZIP sa XML-om, kao EPUB). Obrazloži u 5 redova. Lenjo učitano.
- **Nalepljen tekst:** čita `clipboardData` (HTML ako postoji, inače običan tekst). Nalepljen tekst se **ne prikazuje ceo** (80.000 reči usporava stranicu) — samo „Nalepljeno: 82.314 reči".
- **TXT:** UTF-8; ako nije ispravan UTF-8 → Windows-1250 (stari srpski fajlovi); ako ni to ne uspe — poruka.
- **Ćirilica** (predlog, potvrđuje autor): ako je više od pola slova ćirilica → u pregledu „Preslovi na latinicu" (podrazumevano uključeno; preslovljavanje je bez gubitka). Bez preslovljavanja tekst se uvozi kakav jeste, uz napomenu da provera jezika i dopune rade za latinicu.
- **Upozorenja** za pregled: izostavljene slike (N), tabele pretvorene u tekst, fusnote kao običan tekst.
- Izmeri čitanje knjige od ~80.000 reči (probna knjiga iz P0). Ako blokira stranicu duže od ~2 s — predloži rešenje pre koda.

**Testovi:**
- **Povratni put:** probna knjiga → izvoz „Rukopis za izdavača (DOCX)" (P7) → uvoz → isti delovi, nazivi, redosled, fusnote, kurziv; reči iste (bez naslovne strane rukopisa). Isto za „DOCX za Kindle" (P8).
- DOCX napravljen bibliotekom `docx` (već u projektu): sa stilom Heading 1 i bez stilova (samo pasusi „Poglavlje N").
- TXT u Windows-1250 sa č ć đ š ž.

**Ručno (autor):** uzorci u `scripts/import-samples/` — rukopis iz Worda, Google Docs „Preuzmi kao .docx", lepljenje iz Google Docs-a i iz Worda.

**Gotovo kada:** povratni put je bez razlike; autorovi uzorci daju tačna poglavlja.

---

## Faza I3 — Prozor za uvoz

**Ulaz:**
- Biblioteka: pored „Nova knjiga" tiho dugme **„Uvezi knjigu"**.
- Prazna biblioteka: „Nova knjiga" ostaje glavno dugme, ispod tih link „ili uvezi rukopis koji već imaš".

**Prozor** (`<dialog>`, isti izgled kao prozor za izvoz, prati temu):
1. **Izvor:** „Izaberi fajl" (DOCX, TXT; PDF posle I4) ili prevuci fajl u prozor · „Nalepi tekst" (zona, `Ctrl+V`). Dok čita: „Čitam rukopis…".
2. **Pregled:**
   - naslov knjige — iz naslovne strane, metapodataka DOCX-a ili imena fajla; može da se izmeni
   - zbir: „24 poglavlja · posveta · epilog · 82.314 reči"
   - lista delova, jedan red po delu: „I · Kofer · 3.214 reči · „Petar je zastao…"" (uvodni i završni delovi samo naziv)
   - na svakom redu tiho „Spoji sa prethodnim" (i „Vrati" dok je prozor otvoren)
   - upozorenja iz I2
   - ništa nije prepoznato: „Nisam našao poglavlja — ceo tekst ide u jedno poglavlje."
   - **„Neka Tiron pročita knjigu"** (predlog: podrazumevano uključeno, potvrđuje autor), ispod sitno: „Tekst se šalje AI-ju, kao i kad pišeš. Tiron će znati likove, mesta i otvorene niti."
3. **„Uvezi knjigu"** (Enter) → `importBook` → `/start?book=…` (Srce knjige, naslov već upisan; „Preskoči" radi kao i do sada) → prvo poglavlje.

- Esc zatvara; fokus ostaje u prozoru.
- Greška → „Uvoz nije uspeo. Tvoj fajl nije promenjen." + detalj u konzoli. Nikad poluuvezena knjiga (jedna transakcija).

**Tiron čita** (ako je uključeno):
- posle uvoza, u pozadini, deo po deo, **postojećim čitanjem iz T2** (`updateMemory`), najviše jedan zahtev istovremeno
- ovo čitanje **ne pravi šapate kraja poglavlja** (T5)
- u sekciji Knjiga jedan tih red dok traje: „Tiron čita knjigu · 5 od 24"
- zatvoren tab → nastavlja pri sledećem otvaranju knjige (Dexie pamti dokle je stigao — nova Dexie verzija + test ako treba novo polje)

**Gotovo kada:** uvezem svoj rukopis iz Worda i iz Google Docs-a (fajl i lepljenje) → tačna poglavlja; posle Srca knjige pišem dalje; „reči danas" = 0; spajanje u pregledu radi; Tiron posle čitanja zna likove iz knjige.

---

## Faza I4 — PDF

- Biblioteka `pdfjs-dist` (ili bolja — obrazloži), lenjo, lokalno, u Web Workeru.
- Redovi → pasusi: po razmaku između redova i uvlačenju prvog reda; rastavljene reči na kraju reda se spajaju (pravilo iz „Sredi tekst").
- Uklanjaju se brojevi strana i tekuća zaglavlja/podnožja: red koji se ponavlja na ≥ 30% strana, ili red koji je samo broj.
- Kurziv i bold iz imena fonta, kad postoji; naslovi po veličini slova (veće od teksta → kandidat za naslov dela, dalje važe pravila iz I1).
- Fusnote ostaju kao običan tekst na mestu gde su na strani; upozorenje u pregledu: „Fusnote iz PDF-a su uvezene kao običan tekst."
- PDF bez teksta (sken): „Ovaj PDF je slika strana — nema teksta za uvoz."

**Testovi:** povratni put — probna knjiga → izvoz „Knjiga za štampu" (A5) i „Rukopis (PDF)" → uvoz → isti broj poglavlja i nazivi, reči ±1% (fusnote), u tekstu nema brojeva strana ni tekućih zaglavlja.

**Gotovo kada:** povratni put prolazi; autorov PDF uzorak daje čitljiv tekst sa tačnim poglavljima.

---

## Van ovog zadatka (NE raditi)

Uvoz u postojeću knjigu (dodavanje poglavlja) · „Podeli poglavlje ovde" u editoru · EPUB, RTF, ODT, Scrivener · OCR skeniranih PDF-ova · slike · AI prepoznavanje poglavlja · zamena navodnika i crtica za dijalog (može kasnije kao opcija u „Sredi tekst") · ćirilica kao jezik knjige · izmene editora, panela i izvoza.
