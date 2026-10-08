# ZADATAK — Izvoz knjige (PDF, Amazon KDP, DOCX, EPUB)

Jedna faza = jedan razgovor = jedan commit. Prvo plan, pa kod.

## Cilj

Savršen izvoz bez browserovog prozora za štampu: klik → pregled u aplikaciji → preuzimanje.
Pisac ne bira formate nego **odredište** — „gde ova knjiga ide?":

| Odredište | Format | Za šta |
|---|---|---|
| **Knjiga za štampu** | PDF | lokalna štamparija, samostalno izdanje, poklon primerci |
| **Amazon KDP — štampana** | PDF | KDP paperback/hardcover, po KDP pravilima |
| **E-knjiga** | EPUB (+ DOCX) | Amazon Kindle (KDP), Apple Books, Kobo, Google Play |
| **Rukopis za izdavača** | DOCX (+ PDF) | slanje izdavaču, agentu, na konkurs, lektoru |

PDF se pravi preko Typst-a, DOCX i EPUB u JavaScriptu — sve lokalno u browseru.
Sve se dešava lokalno u browseru (Typst kompajler kao WASM) — rukopis ne napušta računar, nema servera.

## Pravila

1. Ne diraj editor, ghost, proveru jezika, Tirona, panele.
2. Typst WASM i fontovi se učitavaju **lenjo** — tek kad korisnik otvori izvoz. Ne smeju da uspore otvaranje aplikacije.
3. WASM i fontove hostuj lokalno (`public/`), ne sa CDN-a, da izvoz radi i bez interneta.
4. Sav tekst iz rukopisa koji ide u Typst izvor mora biti **escapovan** (`#`, `*`, `_`, `$`, `@`, `<`, `[`, `]`, `\`, `` ` `` i sl.). Testovi za ovo su obavezni — nijedan znak iz knjige ne sme da pokvari slaganje.
5. Posle svake faze: `pnpm typecheck && pnpm lint && pnpm test`, PROGRESS, commit poruka, koraci za ručnu proveru.

---

## Faza P0 — Proba (bez UI-ja)

- Izaberi biblioteku: `@myriaddreamin/typst.ts` ili `typst-wasm`. Napiši mi u 5 redova razlog (veličina, održavanje, API, rad u Web Workeru).
- Dev stranica `/dev/typst` (samo u dev modu): Typst izvor sa srpskim tekstom (č ć đ š ž), jednom fusnotom i obostranim poravnanjem → PDF za preuzimanje.
- Rastavljanje: `#set text(lang: "hr")` za latinicu (Typst ima srpska pravila samo za ćirilicu; hrvatska su za latinicu ista). Za `sr-Cyrl` u budućnosti: `lang: "sr"`.
- Izmeri: veličinu WASM-a i fontova, vreme prvog učitavanja, vreme kompajliranja knjige od ~80.000 reči (napravi test knjigu iz lorem teksta). Kompajliranje ide u **Web Worker**.
- Javi mi brojeve i pošalji PDF pre Faze P1.

**Gotovo kada:** PDF sa fusnotom na dnu strane, ispravnim dijakriticima i rastavljanjem; poznati brojevi za veličinu i brzinu.

---

## Faza P1 — Pretvaranje knjige u Typst

`src/lib/export/typst/` — čiste funkcije, bez UI-ja, sa testovima:

- `escape.ts` — escapovanje teksta (pravilo 4).
- `fromTiptap.ts` — TipTap JSON → Typst markup:
  pasus, Naslov 1/2, citat, **bold**, *kurziv*, poravnanje (centar se poštuje; levo/obostrano određuje šablon), prelom scene, fusnota → `#footnote[...]` na mestu broja.
- `buildBook.ts` — cela knjiga: redosled delova, prazni delovi se preskaču, poglavlja zadržavaju brojeve iz editora.
- Šabloni (`templates/print.typ.ts`, `templates/manuscript.typ.ts`) kao TypeScript funkcije koje vraćaju Typst izvor sa parametrima (veličina, font, autor…).

Testovi: svaki tip čvora; fusnota usred rečenice; fusnota sa kurzivom; tekst sa `#`, `*`, `$`, `@`; prazna poglavlja; posveta; prelom scene.

---

## Faza P2 — Šablon „Knjiga za štampu"

- Veličine: **A5**, **13 × 20 cm**, **6 × 9 in** (Amazon KDP), **A4**.
- Ogledalske margine (šira unutrašnja), proporcionalno veličini.
- Font iz teme knjige ako je serif (Literata), inače Literata; 10,5–11 pt za A5, prored ~1,35.
- Obostrano, rastavljanje uključeno, prvi red pasusa uvučen (osim prvog posle naslova i preloma scene), bez razmaka između pasusa.
- Redosled: naslovna strana → prazna poleđina → posveta (sama, kurziv, bez naslova) → ostali uvodni delovi → sadržaj (opciono) → poglavlja → završni delovi.
- Svaki deo počinje na **neparnoj (desnoj)** strani; iznad naslova sitno „POGLAVLJE IV".
- Tekuće zaglavlje: parne strane naslov knjige, neparne naslov poglavlja; nema zaglavlja na prvoj strani poglavlja ni na uvodnim stranama.
- Broj strane dole u sredini; ne na naslovnoj, poleđini i praznim stranama.
- Fusnote na dnu strane, sitnije, sa tankom linijom.
- Prelom scene: `✱ ✱ ✱` centrirano.
- Sprečavanje udovica i siročadi (jedan red pasusa sam na vrhu/dnu strane) ako Typst verzija to podržava — javi šta je moguće.
- Fontovi su ugrađeni u PDF.

---

## Faza P3 — Šablon „Rukopis za izdavača"

Standardni format rukopisa:
- **A4**, margine 2,5 cm, serif 12 pt (npr. Literata ili Times-sličan font sa srpskim slovima), prored 1,5 (izbor: 1,5 ili dupli).
- Poravnanje **levo**, **bez rastavljanja**, prvi red uvučen ~1,25 cm, bez razmaka između pasusa.
- Naslovna strana: gore levo ime autora i kontakt (email, telefon — opciono); gore desno „oko 82.000 reči" (zaokruženo na hiljadu); na sredini NASLOV i „roman" (žanr) i ime autora.
- Zaglavlje na svakoj strani osim naslovne, desno: `Prezime / NASLOV / 12`.
- Svako poglavlje na novoj strani, naslov oko trećine strane, „Poglavlje IV" i naziv.
- Prelom scene: `#` centrirano.
- Fusnote na dnu strane.
- Bez sadržaja, bez tekućih naslova poglavlja, bez ukrasa.

---

## Faza P4 — Prozor za izvoz u aplikaciji (prvo samo PDF odredišta)

Zamenjuje sadašnje stavke u `···` meniju. **Ukloni Markdown izvoz** i sadašnji izvoz preko štampe (fajlove, rute, copy, testove koji više nisu potrebni).

- `··· → Izvezi PDF…` otvara **prozor u aplikaciji** (ne novi tab):
  - levo: **kartice odredišta** iz tabele „Cilj" (u P4 rade Knjiga za štampu i Rukopis-PDF; ostale kartice se dodaju u svojim fazama — bez „uskoro" kartica), zatim podešavanja izabranog odredišta: veličina (za štampu), prored (za rukopis), „Uključi sadržaj" (za štampu), polja **Ime autora** i **Kontakt** (za rukopis; pamte se po knjizi — `Book.author`, `Book.contact`, Dexie migracija)
  - desno: **pregled strana** (prve 3–4 strane kao slike/SVG iz Typst-a; listanje strelicama), osvežava se kad se promeni izbor (debounce)
  - dugme **Preuzmi PDF** → fajl `Naslov-knjige.pdf` (rukopis: `Prezime-Naslov-rukopis.pdf`)
- Dok se Typst učitava prvi put: tihi indikator „Pripremam slaganje…"; posle toga je brzo.
- Greška u kompajliranju → poruka „Izvoz trenutno nije uspeo." + detalj u konzoli; nikad prazan PDF.
- Prozor prati temu; pregled strana je uvek na belom papiru.
- Tastatura: Esc zatvara, Enter = Preuzmi.

**Gotovo kada:** izvezem istu knjigu kao A5 knjigu i kao A4 rukopis bez ikakvog browserovog prozora; fusnote su na dnu strane u oba; pregled se slaže sa preuzetim PDF-om.

---

## Faza P5 — Tipografska naslovnica

- Automatska naslovnica za „Knjigu za štampu": naslov, ime autora, bez slike; tri jednostavna stila (klasičan centriran, moderan levo poravnat, minimalistički) — izbor u prozoru za izvoz.
- Samo za PDF unutrašnjosti knjige (prva strana). Prava korica za štampariju (sa hrbatom i bleed-om) **nije** deo ovog zadatka.

---

## Faza P6 — Amazon KDP, štampana knjiga (PDF)

Nova kartica „Amazon KDP — štampana". Koristi šablon iz P2, sa KDP pravilima:
- **Pre kodiranja proveri trenutna pravila u KDP pomoći** (trim sizes, margine, minimalni broj strana) i javi mi ih; ne oslanjaj se na pamćenje.
- Veličine: najčešće KDP (5 × 8, 5,25 × 8, 5,5 × 8,5, 6 × 9 in) + ostale sa KDP liste u padajućem meniju.
- **Unutrašnja margina raste sa brojem strana** (po KDP tabeli); spoljašnje ≥ KDP minimuma. Pošto broj strana zavisi od margine, složi dvaput: prvo proceni broj strana, izaberi marginu, složi ponovo; ako se pređe granica, složi treći put.
- Bez bleed-a (tekst knjige ne ide do ivice).
- Fontovi ugrađeni, bez lozinke i bez komentara u PDF-u.
- **Provera pre preuzimanja** (lista sa ✓ / ⚠): broj strana u KDP opsegu; veličina iz KDP liste; prazne strane na kraju nisu predugačak niz; naslov i autor popunjeni.
- U prozoru: broj strana i podsetnik „Koricu praviš posebno u KDP Cover Creator-u ili sa dizajnerom; za hrbat ti treba broj strana: N."
- Ime fajla: `Naslov-KDP-6x9.pdf`.

**Gotovo kada:** PDF prođe KDP previewer bez grešaka o marginama (proveru u KDP-u radim ja).

---

## Faza P7 — Rukopis za izdavača (DOCX)

Kartica „Rukopis za izdavača" dobija izbor **DOCX (preporučeno) / PDF**; DOCX je podrazumevan.
- Biblioteka `docx` (npm) u browseru, lenjo učitana.
- Isti format kao P3: A4, 12 pt serif, prored 1,5/dupli, levo, uvučen prvi red, naslovna strana sa kontaktom i brojem reči, zaglavlje `Prezime / NASLOV / strana` (Word polje za broj strane), poglavlja na novoj strani, prelom scene `#`.
- **Prave Word fusnote** (ne tekst na kraju).
- Koristi Word stilove (Normal, Heading 1, Heading 2, Quote) umesto ručnog formatiranja — izdavaču i lektoru je lakše da menjaju.
- Bold i kurziv sačuvani; jezik dokumenta `sr-Latn-RS` (Word provera pravopisa).
- Testovi: otvori generisani fajl preko `docx`/`mammoth` u testu i proveri fusnote, stilove i redosled.

**Gotovo kada:** DOCX se otvara u Wordu, LibreOffice-u i Google Docs-u, fusnote su prave fusnote, stilovi su ispravni.

---

## Faza P8 — E-knjiga (EPUB 3)

Kartica „E-knjiga".
- EPUB 3 pravljen u JavaScriptu (npr. `jszip` + sopstveni šabloni; ili gotova biblioteka — obrazloži izbor).
- Svako poglavlje kao poseban XHTML; navigacija (sadržaj) automatski; metapodaci: naslov, autor, jezik `sr-Latn`, datum.
- Naslovnica: tipografska iz P5, kao slika (PNG iz Typst-a), dok ne postoji otpremanje naslovnice.
- Fusnote kao EPUB 3 napomene (`epub:type="noteref"` / `"footnote"`) — na Kindle-u i Apple Books iskaču kao prozorčić.
- Jednostavan CSS: bez fiksnih fontova i veličina (čitač bira), uvučen prvi red, prelom scene centriran.
- Provera: pokreni `epubcheck` (dev zavisnost ili CI) na test knjizi; bez grešaka.
- Ista kartica nudi i „DOCX za Kindle" (pojednostavljen DOCX bez zaglavlja i brojeva strana) za one koji ga više vole.
- Ime fajla: `Naslov.epub`.

**Gotovo kada:** EPUB prolazi epubcheck, otvara se u Apple Books / Calibre-u, i KDP ga prihvata bez upozorenja (proveru u KDP-u radim ja).

---

## Van ovog zadatka (kasnije)

Otpremanje sopstvene naslovnice · generisanje naslovnice · korice za KDP i štampariju (hrbat, bleed, PDF/X) · ćirilica · izvoz pojedinačnog poglavlja (za konkurse i beta-čitaoce).
