# PRODUCT.md — Momentum

> Kad se nešto ovde i u drugim dokumentima razlikuje, važi ovaj fajl.

## U jednoj rečenici

**Editor za pisanje knjiga sa mentorom koji ti pomaže da je završiš.**

Obećanje korisniku: **završićeš knjigu.** Svaka funkcija se meri time da li pomaže tom obećanju.

Pozicioniranje: *AI ne piše tvoju knjigu — pomaže ti da je ti napišeš.*

## Za koga

Neko ko piše prvi ili drugi roman, uz posao, uveče. Ima ideju i volju, ali nema urednika, rok ni društvo.
Jezik: srpski prvo (latinica, ekavica). Kasnije ijekavica i ćirilica (region), pa engleski.

## Problem

Ljudi ne odustaju zbog manjka talenta, nego zbog: perfekcionizma na početku, izgubljenosti u sredini, nestalog oduševljenja, pauze iz koje se teško vraća i usamljenosti.

## Pet principa

1. **Tekst i tišina.** Editor je prazan papir. Sve ostalo je nevidljivo dok ne zatreba.
2. **Autor piše, AI pomaže.** Ništa ne ulazi u tekst bez klika autora. AI nikad ne piše pasuse.
3. **Napred, pa nazad.** Prvi nacrt se piše; prepravka dolazi posle.
4. **Napredak u priči, ne u brojkama.** Pobeda je „Petar je otvorio kofer", ne „347 reči".
5. **Nikad prekor.** Nema streak-ova, kazni, crvenih upozorenja ni krivice.

Kad nisi siguran: **„Da li bi Tiron ovo uradio?"** (vidi dole)

## Raspored ekrana

```text
┌──────────────────────────────────────────────────────────────────┐
│ ☰  Tekst ▾  B  I  ≡▾        Sačuvano        ◐  ⌨  ◎  ⛶   T•     │
├───────────┬───────────────────────────────────┬──────────────────┤
│ SADRŽAJ   │          II · Kofer               │ TIRON            │
│           │                                   │  šapat           │
│ Posveta   │   Petar je zastao ispred vrata.   │  [ Zapeo sam ]   │
│ I Vrata   │   Nije se sećao da su juče bila   │ KNJIGA        ›  │
│ II Kofer ⋮│   zaključana|                     │ ZA KASNIJE    ›  │
│ + Novo    │                                   │ JEZIK  94        │
│ 347 reči danas                                │                  │
└───────────┴───────────────────────────────────┴──────────────────┘
```

Oba panela su podrazumevano zatvorena. Gornja traka bledi dok kucaš.

### Gore — traka
- **Tekst ▾** — stil pasusa: Tekst, Naslov 1, Naslov 2, Citat
- **B**, **I**
- **≡▾** — poravnanje: levo (podrazumevano), centar, obostrano
- „Sačuvano" — bledo, u sredini
- **◐** teme · **⌨** pisaća mašina · **◎** fokus · **⛶** ceo ekran · **T** Tiron panel (tačkica = novi šapat)

### Levo — sadržaj knjige
Uvodni delovi, poglavlja (automatski I, II, III), završni delovi. Prevlačenje sa animacijom, brisanje sa potvrdom i „Poništi", preimenovanje.

### Sredina — tekst
Naslov poglavlja na vrhu (povezan sa sadržajem), tekst, prelom scene `***`, fusnote. Ghost dopune i provera jezika.

### Desno — Tiron (četiri sekcije)
1. **Tiron** — poslednji šapat, istorija, dugme **„Zapeo sam"**
2. **Knjiga** — Srce knjige, likovi, mesta, otvorene niti, sažeci poglavlja
3. **Za kasnije** — beleške za prepravku
4. **Jezik** — ocena jezika u jednom redu

## Funkcije

### Editor
- 4 teme (Papir, Noć, Mašina, Magla) — menjaju samo boje i font
- Fokus mod, pisaća mašina skrol, ceo ekran
- Stilovi: Tekst, Naslov 1, Naslov 2, Citat · B, I · poravnanje
- Prelom scene, fusnote
- Autosave, sve lokalno (IndexedDB)

### Pomoć u rečenici
- **Ghost dopune** — 3 predloga za kraj rečenice; pojavljuju se same posle pauze, `↑↓` bira, `Tab` prihvata; `/` je običan znak
- **Provera jezika** — kvačice (tačkasta linija) i gramatika (talasasta), klik ispravlja
- **Ocena jezika** — samo za poglavlja koja su iza tebe, nikad za ono koje upravo pišeš

### Tiron — mentor
Tiron je bio Ciceronov sekretar: zapisivao, pamtio i savetovao — ali govore je pisao Ciceron.
- **Pamti:** Srce knjige (o čemu je, kako se završava, zašto je pišeš), likove, mesta, otvorene niti, sažetke poglavlja, najjače rečenice autora
- **Šapuće:** pri ulasku, na kraju poglavlja, kad primeti obrazac (vrtenje u krug, pad u sredini, duga pauza), na kraju sesije
- **Zapeo sam:** jedno pitanje za trenutnu scenu, na klik
- **Beleška za kasnije:** `Ctrl+Shift+N` — zapiši problem umesto da ga popravljaš
- **Kraj nacrta:** tih ekran sa prvom i poslednjom rečenicom knjige

Tiron: kratak, topao, više pita nego tvrdi, pohvaljuje konkretno, nikad ne ocenjuje kvalitet nacrta, nikad ne piše tekst umesto autora, nikad ne šapuće dok autor kuca.

### Povratak
**Resume ekran:** gde si stao, šta si prošli put pomerio u priči, jedno pitanje za danas.

## Dnevna petlja

```text
ULAZAK    Resume: "Prošli put: Petar je našao kofer. Za danas: Šta je u koferu?"
   ↓
PISANJE   ghost dopune · Zapeo sam · beleška za kasnije
   ↓
IZLAZAK   Tiron: šta se danas pomerilo u priči
   ↓
SUTRA     to postaje sledeći ulazak
```

## Šta Momentum NIJE

Nije ghostwriter. Nije Scrivener sa sto opcija. Nije Grammarly za mejlove. Nije Duolingo sa plamenčićima. Nije urednik koji ocenjuje nacrt.

## Izbačeno (ne vraćati bez odluke autora proizvoda)

AI paleta i svi njeni alati (Treba mi impuls, Poguraj me, Zakomplikuj, Šta mi nedostaje, Vrati me u priču, Zamisli scenu, Sprint) i prečica `Ctrl+/` · sinonimi · slash meni (meni u stilu Hemingway editora) · Urednik režim · odložene podvlake (podvlake tek kada pasus ostane iza autora) — odbačeno; provera ostaje kao sada.

## Posle verzije 1.0 (tek kad zatreba)

Urednik (otključava se posle kraja nacrta) · čitanje naglas · izvoz DOCX/EPUB/PDF · nalozi i sync · email podsetnici · ijekavica i ćirilica · engleski.

## Rizici koje pratimo

- **Rast funkcija** — najveća pretnja minimalizmu. Panel ostaje na 4 sekcije.
- **Privatnost** — rukopis ide na AI API; mora jasno da piše šta se šalje i da AI može da se isključi.
- **Jedan provajder** — svi AI pozivi idu kroz jedan helper, da zamena modela bude moguća.
- **Tržište** — srpski je prednost ali malo tržište; rano proveriti spremnost na plaćanje.

## Kako znamo da radi

- Da li se autor vraća (dani pisanja nedeljno)
- Da li ide napred (nove reči naspram prepravki)
- Da li završava poglavlja
- Kasnije, sa korisnicima: **koliko ljudi završi nacrt**
