Pregledaj izmene od poslednjeg commita (`git diff` i `git status`) i proveri ih protiv `AGENTS.md`:

- [ ] Da li išta od AI-ja ulazi u rukopis bez eksplicitnog prihvatanja, ili duže od kraja rečenice (dovršetak ≤ 7 reči, početak ≤ 5)? Da li se postojeći tekst menja van provere jezika ili bez Prihvati/Odbaci? (mora biti NE)
- [ ] Da li se kritika/ocene pojavljuju dok se piše (ili igde ocenjuju kvalitet nacrta)? (mora biti NE)
- [ ] Da li je na ekranu za pisanje dodat neki novi element bez odobrenja?
- [ ] Da li postoji način da se tekst izgubi (nema autosave, nema migracije, greška se guta)?
- [ ] Da li se server kod / API ključ importuje u klijent?
- [ ] Da li je dodata funkcija iz kasnije faze?
- [ ] Da li je UI tekst u `src/lib/copy.ts` i na srpskom?
- [ ] Da li prolaze `pnpm typecheck`, `pnpm lint`, `pnpm test`?

Za svaku stavku: ✅ ili ❌ + fajl/linija + predlog popravke. Ne menjaj kod dok ne potvrdim.
