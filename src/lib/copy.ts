import { toRoman } from "@/lib/text/toRoman";

// 1, 21, 31… kvačica · 2–4, 22–24… kvačice · ostalo (i 11–14) kvačica
function count(n: number, one: string, few: string, many: string): string {
  const tens = n % 100;
  const last = n % 10;
  if (last === 1 && tens !== 11) return `${n} ${one}`;
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// Sav UI tekst na jednom mestu — ton se menja ovde, ne po komponentama.
export const copy = {
  appName: "Momentum",
  tagline: "Prostor koji ti pomaže da nastaviš da pišeš.",
  editor: {
    placeholder: "Počni ovde…",
    // Prvo poglavlje knjige bez ijedne reči (Tiron T1).
    draftPlaceholder: "Nacrt 1 · ovo niko ne čita. Napiši scenu koju već vidiš u glavi — može biti bilo koja.",
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
    tidy: "Sredi tekst",
    // Tooltip: šta tačno radi; bez selekcije radi na celom poglavlju.
    tidyHint: "Sredi tekst — razmaci, prazni redovi, iscepani pasusi, strano formatiranje (označeno ili celo poglavlje)",
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
    // Tiron T5: tri režima šapata.
    tironModes: {
      present: "Tiron: prisutan",
      quiet: "Tiron: tih",
      off: "Tiron: isključen",
    },
    tironModeHints: {
      present: "Šapće na ulasku, posle poglavlja i na kraju sesije",
      quiet: "Šapće samo na ulasku i na kraju sesije",
      off: "Ne šapće (pamćenje knjige i „Zapeo sam” rade)",
    },
    finishDraft: "Označi kraj nacrta",
    // Faza 5: sigurnosna kopija cele knjige.
    exportMarkdown: "Sačuvaj kopiju (.md)",
    exportFailed: "Kopija nije napravljena. Tekst je i dalje sačuvan ovde — pokušaj ponovo.",
    exportPdf: "Sačuvaj kao PDF (A5)",
    allBooks: "Sve knjige",
  },
  tiron: {
    panelLabel: "Tiron",
    toggle: "Tiron",
    toggleNew: "Tiron — novi šapat",
    shortcut: "Ctrl/Cmd+Shift+\\",
    // Šapati (T5).
    dismiss: "Skloni šapat",
    quoteFrom: (label: string) => `— ${label}`,
    history: "Ranije",
    showAll: (n: number) => `Prikaži sve (${n})`,
    stuck: "Zapeo sam",
    another: "Još jedno",
    thinking: "Tiron razmišlja…",
    unavailable: "Tiron trenutno ne može da odgovori.",
    tooShort: "Napiši prvo par rečenica, pa ću imati šta da pitam.",
    close: "Zatvori",
    // Sekcija „Jezik” — nikad „ocena pisanja” ni „kvalitet”.
    language: "Jezik",
    languageUp: (n: number) => `↑${n}`,
    languageDown: (n: number) => `↓${n}`,
    languageHere: (diacritics: number, grammar: number) =>
      [
        diacritics > 0 ? count(diacritics, "kvačica", "kvačice", "kvačica") : null,
        grammar > 0 ? count(grammar, "gramatika", "gramatike", "gramatika") : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .replace(/^/, "ovde: "),
    languageNext: "Sledeća podvlaka",
  },
  save: {
    saved: "Sačuvano",
    saving: "Čuvam…",
    error: "Čuvanje nije uspelo. Pokušavam ponovo…",
    // Dok knjiga ima prvi nacrt; greška se prikazuje bez ovoga.
    draft: (status: string) => `Nacrt 1 · ${status}`,
    draftHint: "Nacrt 1 — ovo niko ne čita",
  },
  // Srce knjige: ekran sa pitanjima pri pravljenju knjige i sekcija „Knjiga” u desnom panelu.
  book: {
    startLabel: "Nova knjiga",
    titlePlaceholder: "Naslov (može i kasnije)",
    titleLabel: "Naslov knjige",
    about: "O čemu je ova knjiga, u jednoj rečenici?",
    ending: "Kako se završava?",
    endingPlaceholder: "može i ‚ne znam još’",
    why: "Zašto je pišeš?",
    genre: "Žanr",
    noGenre: "—",
    genres: {
      misterija: "Misterija",
      triler: "Triler",
      fantastika: "Fantastika",
      "naučna fantastika": "Naučna fantastika",
      ljubavni: "Ljubavni",
      horor: "Horor",
      istorijski: "Istorijski",
      literarni: "Literarni",
      "za decu": "Za decu",
      drugo: "Drugo",
    },
    length: "Okvirna dužina",
    lengthUnknown: "Ne znam",
    lengths: {
      40000: "Kratak roman, ~40.000 reči",
      80000: "Roman, ~80.000 reči",
      120000: "Dug roman, ~120.000 reči",
    } as Record<number, string>,
    start: "Počni da pišeš",
    startShortcut: "Ctrl/Cmd+Enter",
    skip: "Preskoči",
    section: "Knjiga",
    heart: "Srce knjige",
    addHeart: "Dodaj srce knjige — o čemu je, kako se završava, zašto je pišeš.",
    editHeart: "Izmeni srce knjige",
    // Kratke oznake iznad odgovora u sekciji „Knjiga”.
    aboutShort: "O čemu",
    endingShort: "Kako se završava",
    whyShort: "Zašto",
    done: "Gotovo",
    // Šta Tiron pamti (T2): podsekcije u „Knjiga”.
    memoryLists: {
      characters: "Likovi",
      places: "Mesta",
      openThreads: "Otvorene niti",
    },
    addItem: "+ dodaj",
    addItemLabel: (list: string) => `Dodaj: ${list}`,
    editItem: (text: string) => `Izmeni: ${text}`,
    removeItem: (text: string) => `Obriši: ${text}`,
    itemHint: "Enter čuva · Esc odustaje · prazno briše",
    chapters: "Poglavlja",
    refresh: "Osveži",
    refreshHint: "Tiron ponovo čita ovo poglavlje",
    reading: "Tiron čita…",
    refreshUnchanged: "Ništa novo od poslednjeg čitanja.",
    refreshEmpty: "U ovom poglavlju još nema teksta.",
    refreshFailed: "Tiron sada ne može da pročita poglavlje. Pokušaj malo kasnije.",
    // Put do kraja (T7): blizu planirane dužine, ispod Srca knjige.
    draftCountdown: (pages: number) =>
      pages <= 0 ? "Planirana dužina je dostignuta." : `Još oko ${count(pages, "stranica", "stranice", "stranica")} do kraja nacrta`,
    closeThread: (text: string) => `Zatvorena nit: ${text}`,
    notFound: "Ova knjiga ne postoji.",
    loadFailed: "Knjiga trenutno ne može da se učita. Osveži stranicu.",
  },
  // Beleška za kasnije (T3): Ctrl/Cmd+Shift+L u tekstu i sekcija „Za kasnije” u desnom panelu.
  later: {
    prompt: "Šta ovde kasnije?",
    hint: "Enter čuva · Esc odustaje",
    section: "Za kasnije",
    sectionCount: (n: number) => `Za kasnije (${n})`,
    goTo: (text: string) => `Idi na mesto: „${text}”`,
    tickOff: (note: string) => `Urađeno: ${note}`,
  },
  // Kraj nacrta (T7): tih ekran, bez konfeta.
  // Faza 5: knjiga složena za štampu (A5) — PDF pravi browser.
  print: {
    chapter: (n: number) => `Poglavlje ${toRoman(n)}`,
    savePdf: "Sačuvaj kao PDF",
    hint: "U prozoru za štampu izaberi „Sačuvaj kao PDF” i isključi „Zaglavlja i podnožja”.",
    back: "Nazad u knjigu",
    notFound: "Ova knjiga ne postoji.",
    loadFailed: "Knjiga trenutno ne može da se učita. Osveži stranicu.",
    empty: "Knjiga još nema teksta za štampu.",
  },
  draftEnd: {
    confirm: "Označiti kraj nacrta?",
    confirmHint: "Knjiga posle toga više nije „Nacrt 1”. Tekst se ne menja.",
    mark: "Označi",
    cancel: "Odustani",
    title: "Kraj nacrta.",
    first: "Prva rečenica:",
    last: "Poslednja:",
    stats: (days: number, pages: number) =>
      `${count(days, "dan", "dana", "dana")} pisanja · ${count(pages, "stranica", "stranice", "stranica")}`,
    back: "Nazad u knjigu",
    notFound: "Ova knjiga ne postoji.",
    loadFailed: "Knjiga trenutno ne može da se učita. Osveži stranicu.",
  },
  library: {
    title: "Tvoje knjige",
    newBook: "Nova knjiga",
    empty: "Još nema knjiga. Kad budeš spreman, počni jednu.",
    loadFailed: "Knjige trenutno ne mogu da se učitaju. Osveži stranicu.",
    bookMenu: (title: string) => `Opcije: ${title}`,
    delete: "Obriši",
    cancel: "Odustani",
    // Ista množina kao kod delova: 1, 21, 31… reč; ostalo reči (11 je izuzetak).
    confirmDelete: (title: string, words: number) =>
      `Obrisati knjigu ‚${title}’ (${new Intl.NumberFormat("sr-Latn").format(words)} ${
        words % 10 === 1 && words % 100 !== 11 ? "reč" : "reči"
      })?`,
    bookDeleted: "Knjiga obrisana",
    undo: "Poništi",
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
    renameHint: "Dupli klik ili F2 za preimenovanje · prevuci za redosled",
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
    dragInstructions: "Prevuci mišem da promeniš redosled.",
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
    // Mala pobeda (T6), iz kraja prethodne sesije.
    lastTime: "Prošli put:",
    today: "Za danas:",
    // Posle pauze od 4+ dana — isto vodi u editor.
    tenMinutes: "Samo 10 minuta?",
    loadingQuestion: "Tražim pitanje za danas…",
    continue: "Nastavi da pišeš",
    notFound: "Ova knjiga ne postoji.",
    loadFailed: "Knjiga trenutno ne može da se učita. Osveži stranicu.",
  },
} as const;
