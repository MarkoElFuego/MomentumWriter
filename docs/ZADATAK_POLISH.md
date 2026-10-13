# ZADATAK — Poliranje UI i UX

Radi se POSLE `docs/ZADATAK_UVOZ.md`.
Referentna stranica: `docs/reference/tiron-panel-referenca.html` — otvori je u browseru (dvoklik); ima izbor sve četiri teme. Ona je **cilj izgleda**, ne kod za kopiranje: prenesi izgled u postojeće komponente.

Jedna faza = jedan razgovor = jedan commit. Pre svake faze: pročitaj `AGENTS.md`, `docs/PRODUCT.md`, ovaj fajl i `docs/PROGRESS.md`. Prvo plan, pa kod.

## Cilj

Momentum treba da izgleda savremeno i toplo, a da ostane tih. Danas je sve iste težine i iste sive boje: oko nema čega da se uhvati, pa deluje staromodno. Rešenje nije više stvari na ekranu, nego **hijerarhija** (šta je važno, šta je sporedno) i **jedna boja naglaska** po temi, korišćena štedljivo.

## Pravila

1. **Samo poliranje.** Nema novih funkcija, ekrana ni podešavanja. Desni panel ostaje na 4 sekcije.
2. **Ne diraj logiku:** ghost dopune, provera jezika i njen keš, Tironovi AI pozivi i memorija, uvoz, izvoz, autosave. Menja se izgled i raspored, ne ponašanje — osim gde ovaj fajl izričito kaže.
3. **Boje samo iz teme** (CSS promenljive). Nigde fiksne boje u komponentama. Naglasak (`--accent`) nikad ne znači grešku ili upozorenje i nikad nije crven.
4. Svaka ikonica: tooltip (naziv + prečica) i `aria-label`. Sve dostupno tastaturom. Animacije poštuju `prefers-reduced-motion`.
5. Tekst u `copy.ts`, bez roda.
6. Tekst se nikad ne gubi: ako zatreba promena šeme — nova Dexie verzija + migracija + test (u ovom zadatku ne bi trebalo da zatreba).
7. Posle svake faze: `pnpm typecheck && pnpm lint && pnpm test`, ažuriran `docs/PROGRESS.md`, predlog commit poruke, koraci za ručnu proveru **u sve četiri teme**.

## Odluke autora (2026-10-13) — upiši ih u PROGRESS.md → „Odluke"

- **Papir** dobija svetlosivu pozadinu (bio je krem, isti kao Mašina); **Magla** postaje hladnija plavo-siva da se ne poklopi sa Papirom.
- Svaka tema dobija **jednu boju naglaska**.
- **Desni panel** po referentnoj stranici: likovi sa inicijalom, mesta kao oznake, niti sa kružićem, ocena jezika kao prsten.
- **Strelica kod ocene jezika ostaje** i kad ocena padne (↑3 i ↓3, kao do sada).
- **Naziv „Likovi" se ne menja** (ni za publicistiku).
- **Prazna knjiga:** sekcija Knjiga prikazuje samo Srce knjige dok knjiga nema ni jednu reč i memorija je prazna. *Menja odluku iz T2 (2026-10-06).*
- **„0 reči danas" se ne prikazuje** dok je danas 0 reči. *Menja U6.*
- **Izbor teme:** kvadrati „Aa" u boji i fontu teme, sa imenom ispod (umesto kružića).
- **`T` u traci postaje reč „Tiron"** (tiha slova), tačkica za novi šapat ostaje.
- **¶ „Sredi tekst"** ostaje u traci, ali sa ikonicom metlice (¶ u Wordu znači „prikaži skrivene znakove").
- **„Ctrl/Cmd"** u menijima ostaje kako jeste (odluka 2026-09-29), samo se meni proširi.

---

## Faza POL1 — Teme, naglasak, izbor teme, trake za pomeranje

**Boje** (`src/styles/themes.css`). Polazne vrednosti — konačne su one koje prođu test kontrasta:

| Tema | `--paper` | `--accent` | Napomena |
|---|---|---|---|
| papir | `#F4F4F2` (bilo `#F7F3EA`) | `#2F6E6A` tamnozelenoplava | `--ink`, `--ink-muted`, `--ghost` podesi da prođu test na novoj pozadini |
| noc | ostaje | `#D4A35A` ćilibar | |
| masina | ostaje `#EDE8DC` | `#2E4A7A` plava kao traka pisaće mašine | |
| magla | `#E3E8EC` (bilo `#E8EBED`) | `#3F6788` škriljac | `--ink` po potrebi malo hladniji |

Nove promenljive (u svakoj temi ili izvedene):
```css
--accent-soft: color-mix(in srgb, var(--accent) 14%, var(--paper));  /* podloga inicijala, hover na kvačici */
--rule: color-mix(in srgb, var(--ink) 12%, transparent);             /* tanke linije */
--hover: color-mix(in srgb, var(--ink) 6%, transparent);             /* hover redova */
```
- Tailwind `@theme inline`: dodaj `accent`, `accent-soft`, `rule` (kao što već postoje `paper`, `ink`, `muted`).
- Ako `color-mix` nije podržan u nekom ciljnom browseru — izračunaj vrednosti po temi i upiši ih kao hex.
- **Test kontrasta** (`lib/themes.test.ts`, postojeći) proširi: `--accent` na `--paper` ≥ 4,5 (koristi se i za tekst „pokaži"), `--accent` na `--accent-soft` ≥ 4,5 (slovo u inicijalu). Postojeće granice za ink / ink-muted / ghost / podvlake važe i za nove pozadine.
- Ako se menja i podrazumevana boja pre učitavanja (inline skripta u `<head>`, `localStorage momentum:theme`) — uskladi.

**Izbor teme** (meni `◐`): četiri kvadrata ~52 px, u boji papira i mastila te teme, „Aa" u fontu teme, ime ispod sitno; izabrana tema ima okvir u boji naglaska. Strelice levo/desno menjaju izbor (radio grupa), Enter/Esc zatvara. Boje kvadrata čitaj iz iste tabele tema (ne dupliraj hex u komponenti).

**Trake za pomeranje** (sve teme, ceo app): tanke, u boji mastila 25%, providna staza; `color-scheme: dark` za Noć, `light` za ostale (da i sistemske kontrole prate temu).
```css
* { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--ink) 25%, transparent) transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--ink) 25%, transparent); border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }
```

**Gotovo kada:** Papir, Mašina i Magla se razlikuju na prvi pogled; u Noći nema svetle trake za pomeranje; izbor teme pokazuje ime i font; test kontrasta prolazi za sve četiri teme.

---

## Faza POL2 — Desni panel (Tiron) po referentnoj stranici

Komponente: `components/tiron/Whispers.tsx`, `BookSection.tsx`, `BookMemory.tsx`, sekcija Jezik, `LaterSection.tsx` (samo zajednički stil naslova). Raspored sekcija i ponašanje (skupljanje, pamćenje, okidači) se ne menjaju.

**Naslovi sekcija i podsekcija:** sitno, verzal, razmaknuto, `--ink-muted`, sa brojem stavki: „LIKOVI · 8", „OTVORENE NITI · 2". Između sekcija tanka linija `--rule`.

**Tironov šapat** (najnoviji): font teksta knjige, kurziv, ~14,5 px, levo tanka linija (2 px) u boji naglaska; ispod sitno odakle je („posle poglavlja I", „pri ulasku", „kraj sesije" — iz `moment`, tekst u `copy.ts`). Citat (`quote`) ostaje ispod, kao i sada. Istorija („Ranije") ostaje sitna i tiha.

**„Pomozi mi":** ostaje neutralno dugme preko cele širine (ne u boji naglaska — naglasak nije za dugmad).

**Likovi:**
- red = krug 28 px sa inicijalom (`--accent-soft` podloga, `--accent` slovo) + **ime** (font teksta knjige, 14 px, `--ink`) + opis ispod (12 px, `--ink-muted`)
- stavka je jedan tekst („Ime — opis") → `splitItem` (dole); bez crte ceo tekst je ime
- inicijal: `initialOf` (dole) — Lj, Nj, Dž su jedno slovo
- prikazuje prva **4**, zatim tiho „još N" / „manje" (stanje samo u komponenti)
- svi inicijali iste boje — boje ne znače ništa, pa ih nema više
- klik na red = izmena (kao do sada), `×` na hover/fokus desno (kao do sada)

**Mesta:** oznake (čipovi) sa samo imenom i malom ikonicom mesta; ceo tekst u tooltipu; klik = izmena, `×` na hover; posle **6** — „još N".

**Otvorene niti:** kružić ispred svake niti je **kvačica** — klik zatvara nit (briše je iz memorije, isto kao današnje `×`, koje se za niti uklanja); klik na tekst = izmena. Hover na kružić: okvir i podloga u boji naglaska. Pri kraju knjige (T7) niti i dalje stoje ispod odbrojavanja — ista komponenta.

**Poglavlja (sažeci):** rimski broj sitno levo, sažetak jedan red, klik razvija (kao do sada).

**Srce knjige i „+ dodaj":** tiho, `--ink-muted`; „+ dodaj" jednom po listi, ispod liste.

**Prazna knjiga (odluka autora):** dok knjiga nema nijednu reč **i** memorija je prazna, sekcija Knjiga prikazuje samo red Srca knjige. Likovi / Mesta / Otvorene niti (sa „+ dodaj") pojave se čim knjiga ima tekst ili memorija ima stavku. „Osveži" se ne prikazuje dok knjiga nema tekst.

**Jezik:** prsten 44 px (siva staza `--rule`, luk `--accent`, broj u sredini), desno „Jezik ↑3" (strelica i pad, kao do sada — odluka autora), ispod (samo kad ovde ima podvlaka) „1 kvačica u ovom poglavlju · pokaži"; „pokaži" (u boji naglaska) i klik na red vode na sledeću podvlaku kao i sada. Luk se animira 400 ms samo kad se ocena promeni (bez animacije uz `prefers-reduced-motion`). `aria-label` prstena: „Jezik 95". Množina kvačica/gramatika kao i sada.

**Testovi:** `initialOf` i `splitItem` (slučajevi ispod); render testovi postojećih komponenti ažurirani (likovi: prva 4 + „još N"; nit: kvačica zatvara; prazna knjiga: samo Srce).

**Gotovo kada:** panel na probnoj knjizi („Deset trovača") izgleda kao referentna stranica u sve četiri teme; imena likova se vide na prvi pogled; prazna nova knjiga u panelu pokazuje samo Srce knjige.

---

## Faza POL3 — Gornja traka i meniji

- **„Tekst ▾"**: meni dovoljno širok da se ništa ne lomi (`min-width` ~15rem, `white-space: nowrap`); naziv levo, prečica desno sitno i bledo, Markdown oznaka (`#`, `##`, `>`) iza nje još bleđe.
- **Poravnanje ▾**: izabrano poravnanje ima kvačicu.
- **`T` → „Tiron"**: reč, ~13 px, `--ink-muted`; aktivna (panel otvoren) — `--ink`; tačkica za novi šapat u boji naglaska. Tooltip „Tiron (Ctrl+Shift+\\)".
- **¶ → ikonica metlice** iz biblioteke ikonica koju projekat već koristi (ako je nema — jednostavan SVG); tooltip „Sredi tekst".
- **Meni `···`** — grupe odvojene tankom linijom, prekidači sa kvačicom desno umesto „: uključene":
  ```
  Dopune                         ✓
  Provera jezika                 ✓
  Rastavljanje reči              ✓
  ─────────────────────────────────
  Tiron      [tih · prisutan · isključen]
  ─────────────────────────────────
  Izvezi knjigu…
  Označi kraj nacrta
  ─────────────────────────────────
  Sve knjige
  ```
  Tiron je jedan red sa tri dugmeta (radio grupa, `aria-pressed`), izabrano na podlozi `--accent-soft`. „Izvezi PDF…" → „Izvezi knjigu…" (prozor već nudi PDF, DOCX i EPUB). Ponašanje stavki se ne menja.
- **„0 reči danas"**: ne prikazuje se dok je danas 0 reči (odluka autora); od prve reči sve kao do sada.

**Gotovo kada:** nijedan meni ne lomi tekst; `···` se čita na prvi pogled; prazna strana nema nijednu brojku.

---

## Faza POL4 — Prvi utisak: Srce knjige i levi panel

**Ekran Srce knjige** (`components/book/StartScreen.tsx`):
- Na vrhu jedna tiha rečenica: „Pre prve reči — par pitanja. Sve može i kasnije."
- Polje naslova: placeholder samo „Naslov", u boji placeholdera (bleđe od `--ink-muted`), ispod sitno „može i kasnije".
- „Kako se završava?" — placeholder „može i „ne znam još“" (srpski navodnici; bilo `‚ne znam još’`). Ostala pitanja bez primera.
- **Žanr i Okvirna dužina**: umesto sistemskih padajućih menija — oznake (čipovi) kao radio grupa, isti stil kao mesta u panelu; izabrana na `--accent-soft` sa okvirom u boji naglaska; strelice menjaju izbor. Dužina: „kratak roman ~40.000 · roman ~80.000 · dug ~120.000 · ne znam". Žanr: 10 postojećih vrednosti, prelamaju se u više redova.
- „Počni da pišeš" i „Preskoči" ostaju kako jesu.

**Levi panel:**
- „+ Dodaj deo" → „+ Posveta, predgovor…" (ponašanje isto).
- Naslov knjige u vrhu panela: tooltip „Dupli klik za promenu naslova".
- Aktivno poglavlje: tanka linija levo u boji naglaska (umesto samo debljih slova).

**Gotovo kada:** ekran Srce knjige nema nijednu sistemsku kontrolu i jasno kaže da je sve neobavezno; levi panel jasno pokazuje gde si.

---

## Referentni kod

Izgled je u `docs/reference/tiron-panel-referenca.html`. Ispod su pomoćne funkcije i dva dela komponenti kao polazna tačka — prilagodi ih postojećim komponentama, imenima klasa i Tailwind-u.

### `lib/text/memoryItem.ts`
```ts
/** Stavka memorije je jedan tekst („Lokusta — otrovačica iz Galije”). Ime je do prve crte ili dve tačke. */
export function splitItem(text: string): { name: string; desc: string } {
  const t = text.trim();
  const m = t.match(/^(.+?)\s+[—–-]\s+(.+)$/) ?? t.match(/^(.+?):\s+(.+)$/);
  return m ? { name: m[1]!.trim(), desc: m[2]!.trim() } : { name: t, desc: "" };
}

/** Inicijal za krug. Srpski dvoslovi (Lj, Nj, Dž) su jedno slovo. */
export function initialOf(name: string): string {
  const t = name.trim();
  const two = t.slice(0, 2);
  if (/^(lj|nj|dž)$/iu.test(two)) return two[0]!.toUpperCase() + two[1]!.toLowerCase();
  return t.charAt(0).toUpperCase();
}
```
Testovi: „Lokusta — otrovačica iz Galije" → Lokusta / otrovačica iz Galije · „Galija: Lokustino poreklo" → Galija / Lokustino poreklo · „Klaudije" → Klaudije / "" · „Jean-Luc — prijatelj" (crtica u imenu bez razmaka ostaje u imenu) · „Ljubica — sestra" → Lj · „Džonatan" → Dž · „Njegoš" → Nj · „Đorđe" → Đ · „ana" → A.

### Prsten za jezik
```tsx
export function ScoreRing({ value, size = 44 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = size / 2 - stroke; // 44 → 18, kao u referenci
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * c;
  const mid = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={copy.tiron.languageRing(value)}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
      <circle
        cx={mid} cy={mid} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`} transform={`rotate(-90 ${mid} ${mid})`}
        className="transition-[stroke-dasharray] duration-[400ms] motion-reduce:transition-none"
      />
      <text x={mid} y={mid + 4.5} textAnchor="middle" fontSize="13" fontWeight={500} fill="var(--ink)">{value}</text>
    </svg>
  );
}
```

### Red lika
```tsx
function PersonRow({ item, onEdit, onRemove }: { item: MemoryItem; onEdit: () => void; onRemove: () => void }) {
  const { name, desc } = splitItem(item.text);
  return (
    <div className="group -mx-1.5 flex items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-[var(--hover)]">
      <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
        {initialOf(name)}
      </span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left" title={copy.tiron.editItem}>
        <span className="block font-[family-name:var(--font-text)] text-[14px] leading-snug text-ink">{name}</span>
        {desc && <span className="block text-xs leading-snug text-muted">{desc}</span>}
      </button>
      <button type="button" onClick={onRemove} aria-label={copy.tiron.removeItem(name)}
        className="opacity-0 text-muted group-hover:opacity-100 focus-visible:opacity-100">×</button>
    </div>
  );
}
```
Isti obrazac (inicijal + ime + opis) ne koristi se za mesta i niti — mesta su čipovi, niti su redovi sa kružićem.

---

## Van ovog zadatka (NE raditi)

Nove funkcije i podešavanja · promena naziva „Likovi" · logika ghost dopuna, provere jezika, Tirona, uvoza i izvoza · fusnota u pregledu izvoza (otvoreno od P4, čeka autora) · ekrani koji nisu ovde navedeni (Resume, prozor za izvoz, prozor za uvoz, kraj nacrta) — oni idu u sledeću turu poliranja, posle snimaka sa pravim tekstom i utisaka iz 7 večeri pisanja.
