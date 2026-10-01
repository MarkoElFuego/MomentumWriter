import { toRoman } from "@/lib/text/toRoman";

// Sav UI tekst na jednom mestu — ton se menja ovde, ne po komponentama.
export const copy = {
  appName: "Momentum",
  tagline: "Prostor koji ti pomaže da nastaviš da pišeš.",
  editor: {
    placeholder: "Počni ovde…",
    menuLabel: "Meni",
    // 1, 21, 31… reč; sve ostalo reči (11 je izuzetak)
    wordsToday: (n: number) =>
      `${n} ${n % 10 === 1 && n % 100 !== 11 ? "reč" : "reči"} danas`,
  },
  footnotes: {
    label: "Fusnote",
    placeholder: "Tekst fusnote…  Esc vraća u tekst",
    refLabel: (n: number) => `Fusnota ${n}`,
  },
  proofread: {
    label: "Ispravka",
    accept: "Prihvati",
    reject: "Odbaci",
    acceptDiacritics: (n: number) => `Prihvati sve kvačice u pasusu (${n})`,
    describe: (from: string, to: string) => `${from} u ${to}`,
  },
  menu: {
    structure: "Struktura",
    structureShortcut: "Ctrl/Cmd+\\",
    ghostOn: "Dopune: uključene",
    ghostOff: "Dopune: isključene",
    proofOn: "Provera jezika: uključena",
    proofOff: "Provera jezika: isključena",
    themes: "Tema",
    themeNames: { papir: "Papir", noc: "Noć", masina: "Mašina", magla: "Magla" },
    focusOn: "Fokus mod: uključen",
    focusOff: "Fokus mod: isključen",
    typewriterOn: "Pisaća mašina: uključena",
    typewriterOff: "Pisaća mašina: isključena",
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
    // Chapters number themselves; the optional name follows the number.
    chapterHeading: (n: number, title: string) =>
      title ? `Poglavlje ${toRoman(n)} · ${title}` : `Poglavlje ${toRoman(n)}`,
    chapterLabel: (n: number, title: string) => (title ? `${toRoman(n)} · ${title}` : toRoman(n)),
    untitledPart: "Bez naslova",
    frontMatter: "Uvodni delovi",
    chapters: "Poglavlja",
    backMatter: "Završni delovi",
    addChapter: "+ Novo poglavlje",
    addPart: "+ Dodaj deo",
    partPresets: {
      front: ["Naslovna", "Posveta", "Predgovor"],
      back: ["Epilog", "Zahvalnica", "Beleška o autoru"],
    },
    renameHint: "Dupli klik ili F2 za preimenovanje · prevuci ili Alt+↑/↓ za redosled",
    renameLabel: "Novi naziv",
    close: "Zatvori",
  },
  write: {
    notFound: "Ovo poglavlje ne postoji.",
    loadFailed: "Poglavlje trenutno ne može da se učita. Osveži stranicu.",
    backToLibrary: "Nazad na knjige",
  },
  resume: {
    title: "Knjiga te čeka.",
    // Same calendar day after 6 h+ = "ranije danas"; 1, 21, 31… dan, everything else (11 too) dana.
    stoppedAt: (days: number) => {
      if (days <= 0) return "Ovde je priča stala ranije danas:";
      if (days === 1) return "Ovde je priča stala juče:";
      return `Ovde je priča stala pre ${days} ${days % 10 === 1 && days % 100 !== 11 ? "dan" : "dana"}:`;
    },
    openQuestion: "Otvoreno pitanje:",
    loadingQuestion: "Tražim pitanje za danas…",
    continue: "Nastavi da pišeš",
    notFound: "Ova knjiga ne postoji.",
    loadFailed: "Knjiga trenutno ne može da se učita. Osveži stranicu.",
  },
} as const;
