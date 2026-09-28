# PRODUCT.md — Vizija i principi

## Pozicioniranje

> **AI writing software koji ne pokušava da napiše knjigu — nego da natera autora da je završi.**

Nije „Word + ChatGPT”. Nije ghostwriter. To je **minimalistički prostor koji pomaže čoveku da nastavi da piše**.

## Tri stuba

1. **Čist editor** — bez UI gužve. Tekst, kursor, tišina.
2. **AI sparing partner** — urednik pored stola: kad zapneš, dovrši misao rečenice koju si započeo ili ti dobaci početak sledeće; inače postavlja pitanja. Nikad ne piše pasus umesto tebe.
3. **Povratak u priču** — Resume ekran (v0.1), kasnije email koji te zove nazad kroz samu priču (v0.3).

## Ekran za pisanje

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                  Poglavlje 7  ··· │
│                       POGLAVLJE VII                              │
│             Petar je zastao ispred vrata.                        │
│             Nije se sećao da su juče bila zaključana.            │
│             |                                                    │
│      347 reči danas                          ✦ Treba mi impuls    │
└──────────────────────────────────────────────────────────────────┘
```

## AI: četiri mala alata (`Ctrl/Cmd + J`)

| Alat | Šta vraća | Primer |
|---|---|---|
| **✦ Poguraj me** | Usred rečenice: 3 načina da se dovrši *tvoja* misao (do 8 reči). Posle tačke: 3 početka sledeće rečenice (do 5 reči). Biraš jedan, ubaci se na kursor. | „…mali iznosi ali” → „nakupi se do velikog iznosa.” |
| **⚔ Zakomplikuj** | 1 neprijatno pitanje (đavolji advokat) | „Zar Petar ovo nije rešio previše lako? Koju grešku bi napravio iz ponosa?” |
| **👁 Šta mi nedostaje?** | 1 zapažanje o čulu/detalju | „Puno dijaloga, malo prostora. Šta Petar čuje iza zida?” |
| **↩ Vrati me u priču** | 3 reda sižea + otvoreno pitanje | „Poslednji put: Petar je stigao do kuće…” |

## Resume ekran

```text
Dobrodošao nazad.
Juče si stao ovde:
„Petar je spustio ruku na kvaku, ali...”
────────────────
Otvoreno pitanje:
Zašto su vrata otključana?
[ Nastavi da pišeš ]
```
Klik → editor, kursor tačno gde si stao.

## Motivacija: skoro nevidljiva

- Napredak u **stranicama** (1 stranica ≈ 300 reči), ne „12.430 / 90.000 reči”.
- Mali kalendar sa tačkicama (v0.2). Bez streak-ova, bez kazni.

## Šta NE radimo (namerno)

- Generisanje proze, „nastavi tekst”, „prepiši pasus”
- Streak, bedževi, notifikacije krivice
- Veliki AI chat panel
- LanguageTool / gramatika u v0.1
- Cloud sync, nalozi, email u v0.1

## Roadmap

- **v0.1** — editor, Book→Chapter→Scene, `Ctrl+J`/`Tab` sparing partner, Revision/Hemingway mode (pomereno iz v0.2, odluka 2026-09-28), Resume, lokalno čuvanje + autosave
- **v0.2** — `[[likovi]]`, stranice + kalendar, export (Markdown/DOCX)
- **v0.3** — nalozi (Supabase), sync, email „nezavršena rečenica” + nedeljni pregled narativa, magic link

## Test uspeha za v0.1

Ako autor (ti) **sam poželi da se svako veče vrati u editor** — pogodili smo proizvod.
