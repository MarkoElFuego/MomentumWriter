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
  // Gornja traka: naziv je i aria-label, naziv + prečica je tooltip.
  toolbar: {
    label: "Traka sa alatima",
    structure: "Sadržaj",
    structureShortcut: "Ctrl/Cmd+\\",
    blockStyle: "Stil pasusa",
    blockStyles: {
      paragraph: { name: "Tekst", shortcut: "Ctrl/Cmd+Alt+0" },
      heading1: { name: "Naslov 1", shortcut: "Ctrl/Cmd+Alt+1 · # " },
      heading2: { name: "Naslov 2", shortcut: "Ctrl/Cmd+Alt+2 · ## " },
      quote: { name: "Citat", shortcut: "> " },
    },
    bold: "Podebljano",
    boldShortcut: "Ctrl/Cmd+B",
    italic: "Kurziv",
    italicShortcut: "Ctrl/Cmd+I",
    align: "Poravnanje",
    alignments: { left: "Levo", center: "Centar", justify: "Obostrano" },
    themes: "Tema",
    themeNames: { papir: "Papir", noc: "Noć", masina: "Mašina", magla: "Magla" },
    typewriter: "Pisaća mašina",
    focus: "Fokus",
    fullscreen: "Ceo ekran",
    shortcutsHint: "Alt+F10",
    withShortcut: (name: string, shortcut: string) => `${name} (${shortcut})`,
  },
  menu: {
    ghostOn: "Dopune: uključene",
    ghostOff: "Dopune: isključene",
    proofOn: "Provera jezika: uključena",
    proofOff: "Provera jezika: isključena",
    // Samo za obostrano poravnat tekst.
    hyphensOn: "Rastavljanje reči: uključeno",
    hyphensOff: "Rastavljanje reči: isključeno",
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
    titlePlaceholder: "Naslov poglavlja",
    chapterTitleLabel: (n: number) => `Naslov poglavlja ${toRoman(n)}`,
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
    partMenu: (name: string) => `Opcije: ${name}`,
    rename: "Preimenuj",
    delete: "Obriši",
    cancel: "Odustani",
    cantDeleteLast: "Poslednje poglavlje ne može da se obriše.",
    // 1, 21, 31… reč; sve ostalo reči (11 je izuzetak); hiljade sa tačkom: 3.214
    confirmDelete: (name: string, words: number) =>
      `Obrisati ‚${name}’ (${new Intl.NumberFormat("sr-Latn").format(words)} ${
        words % 10 === 1 && words % 100 !== 11 ? "reč" : "reči"
      })?`,
    chapterDeleted: "Poglavlje obrisano",
    partDeleted: "Deo obrisan",
    undo: "Poništi",
    dragInstructions: "Prevuci mišem da promeniš redosled, ili fokusiraj deo i pritisni Alt+↑/↓.",
    dragStart: (name: string) => `Podignuto: ${name}.`,
    dragOver: (name: string, over: string) => `${name} je iznad: ${over}.`,
    dragEnd: (name: string) => `Spušteno: ${name}.`,
    dragCancel: (name: string) => `Vraćeno na mesto: ${name}.`,
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
