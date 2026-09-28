import { toRoman } from "@/lib/text/toRoman";

// Sav UI tekst na jednom mestu — ton se menja ovde, ne po komponentama.
export const copy = {
  appName: "Momentum",
  tagline: "Prostor koji ti pomaže da nastaviš da pišeš.",
  editor: {
    placeholder: "Počni ovde…",
    menuLabel: "Meni",
    sparkButton: "✦ Treba mi impuls",
    // 1, 21, 31… reč; sve ostalo reči (11 je izuzetak)
    wordsToday: (n: number) =>
      `${n} ${n % 10 === 1 && n % 100 !== 11 ? "reč" : "reči"} danas`,
  },
  menu: {
    structure: "Struktura",
    structureShortcut: "Ctrl/Cmd+\\",
    allBooks: "Sve knjige",
  },
  save: {
    saved: "Sačuvano",
    saving: "Čuvam…",
    error: "Čuvanje nije uspelo. Pokušavam ponovo…",
  },
  library: {
    title: "Tvoje knjige",
    newBook: "Nova knjiga",
    empty: "Još nema knjiga. Kad budeš spreman, počni jednu.",
    loadFailed: "Knjige trenutno ne mogu da se učitaju. Osveži stranicu.",
  },
  structure: {
    panelLabel: "Struktura knjige",
    defaultBookTitle: "Nova knjiga",
    chapterTitle: (n: number) => `Poglavlje ${toRoman(n)}`,
    sceneTitle: (n: number) => `Scena ${n}`,
    addChapter: "+ Poglavlje",
    addScene: "+ Scena",
    renameHint: "Dupli klik ili F2 za preimenovanje",
    renameLabel: "Novi naziv",
    close: "Zatvori",
  },
  write: {
    notFound: "Ova scena ne postoji.",
    loadFailed: "Scena trenutno ne može da se učita. Osveži stranicu.",
    backToLibrary: "Nazad na knjige",
  },
  resume: {
    title: "Resume",
  },
  placeholder: {
    comingSoon: "Uskoro.",
  },
} as const;
