import { toRoman } from "@/lib/text/toRoman";

// 1, 21, 31… kvačica · 2–4, 22–24… kvačice · ostalo (i 11–14) kvačica
function count(n: number, one: string, few: string, many: string): string {
  const tens = n % 100;
  const last = n % 10;
  if (last === 1 && tens !== 11) return `${n} ${one}`;
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** "82.314 reči", "1 reč", "21 reč". */
function wordsOf(n: number): string {
  return `${new Intl.NumberFormat("sr-Latn").format(n)} ${n % 10 === 1 && n % 100 !== 11 ? "reč" : "reči"}`;
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
      // Prečica i Markdown oznaka na početku reda — u meniju desno, sitno (POL3).
      paragraph: { name: "Tekst", shortcut: "Ctrl/Cmd+Alt+0", markdown: "" },
      heading1: { name: "Naslov 1", shortcut: "Ctrl/Cmd+Alt+1", markdown: "#" },
      heading2: { name: "Naslov 2", shortcut: "Ctrl/Cmd+Alt+2", markdown: "##" },
      quote: { name: "Citat", shortcut: "", markdown: ">" },
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
    // Prekidači: kvačica desno pokazuje da je uključeno (POL3).
    ghost: "Dopune",
    proof: "Provera jezika",
    // Samo za obostrano poravnat tekst.
    hyphens: "Rastavljanje reči",
    tiron: "Tiron",
    // Tri dugmeta u jednom redu, ovim redom.
    tironModesShort: { quiet: "tih", present: "prisutan", off: "isključen" },
    // Tiron T5: tri režima šapata.
    tironModes: {
      present: "Tiron: prisutan",
      quiet: "Tiron: tih",
      off: "Tiron: isključen",
    },
    tironModeHints: {
      present: "Šapće na ulasku, posle poglavlja i na kraju sesije",
      quiet: "Šapće samo na ulasku i na kraju sesije",
      off: "Ne šapće (pamćenje knjige i „Pomozi mi” rade)",
    },
    finishDraft: "Označi kraj nacrta",
    // Izvoz (ZADATAK_IZVOZ P4): prozor u aplikaciji.
    // Prozor nudi PDF, DOCX i EPUB.
    exportBook: "Izvezi knjigu…",
    allBooks: "Sve knjige",
  },
  tiron: {
    panelLabel: "Tiron",
    toggle: "Tiron",
    toggleNew: "Tiron — novi šapat",
    // Reč u traci umesto „T” (POL3).
    toolbarWord: "Tiron",
    shortcut: "Ctrl/Cmd+Shift+\\",
    // Šapati (T5).
    dismiss: "Skloni šapat",
    quoteFrom: (label: string) => `— ${label}`,
    history: "Ranije",
    showAll: (n: number) => `Prikaži sve (${n})`,
    stuck: "Pomozi mi",
    another: "Još jedno",
    thinking: "Tiron razmišlja…",
    unavailable: "Tiron trenutno ne može da odgovori. Pokušaj malo kasnije.",
    tooShort: "Napiši prvo par rečenica, pa ću imati šta da pitam.",
    close: "Zatvori",
    // Sekcija „Jezik” — nikad „ocena pisanja” ni „kvalitet”.
    language: "Jezik",
    languageUp: (n: number) => `↑${n}`,
    languageDown: (n: number) => `↓${n}`,
    languageHere: (diacritics: number, grammar: number) =>
      `${[
        diacritics > 0 ? count(diacritics, "kvačica", "kvačice", "kvačica") : null,
        grammar > 0 ? count(grammar, "gramatika", "gramatike", "gramatika") : null,
      ]
        .filter(Boolean)
        .join(" · ")} u ovom poglavlju`,
    languageShow: "pokaži",
    languageRing: (n: number) => `Jezik ${n}`,
    languageNext: "Sledeća podvlaka",
    // Odakle je šapat (POL2), sitno ispod njega.
    whisperFrom: { entry: "pri ulasku", pattern: "pri ulasku", chapterEnd: "posle poglavlja", sessionEnd: "kraj sesije" },
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
    // Ekran Srce knjige (POL4): jedna tiha rečenica na vrhu, naslov bez objašnjenja u polju.
    intro: "Pre prve reči — par pitanja. Sve može i kasnije.",
    titlePlaceholder: "Naslov",
    titleHint: "može i kasnije",
    titleLabel: "Naslov knjige",
    about: "O čemu je ova knjiga, u jednoj rečenici?",
    ending: "Kako se završava?",
    endingPlaceholder: "može i „ne znam još“",
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
    // Oznake na ekranu Srce knjige (POL4).
    lengthChips: { 40000: "kratak roman ~40.000", 80000: "roman ~80.000", 120000: "dug ~120.000" } as Record<number, string>,
    lengthUnknownChip: "ne znam",
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
    // "LIKOVI · 8" (verzal je u CSS-u); prazna lista bez broja.
    listCaption: (label: string, n: number) => (n ? `${label} · ${n}` : label),
    showMore: (n: number) => `još ${n}`,
    showLess: "manje",
    closeThreadHint: "Zatvori nit",
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
    refreshFailed: "Tiron trenutno ne može da pročita poglavlje. Pokušaj malo kasnije.",
    // Uvoz (I3): Tiron reads an imported book in the background.
    importReading: (done: number, total: number) => `Tiron čita knjigu · ${done} od ${total}`,
    // Put do kraja (T7): blizu planirane dužine, ispod Srca knjige.
    draftCountdown: (pages: number) =>
      pages <= 0 ? "Planirana dužina je dostignuta." : `Još oko ${count(pages, "stranica", "stranice", "stranica")} do kraja nacrta`,
    closeThread: (text: string) => `Zatvori nit: ${text}`,
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
  // ZADATAK_IZVOZ: tekst koji ide u izvezenu knjigu.
  export: {
    // Rukopis: „oko 82.000 reči” — na hiljadu, kraći tekst na stotinu.
    aboutWords: (n: number) => {
      const rounded = n >= 1000 ? Math.round(n / 1000) * 1000 : Math.max(100, Math.round(n / 100) * 100);
      return `oko ${new Intl.NumberFormat("sr-Latn").format(rounded)} reči`;
    },
    contents: "Sadržaj",
    // Prozor za izvoz (P4).
    title: "Izvoz",
    destinationLabel: "Gde ova knjiga ide?",
    destinations: {
      print: { name: "Knjiga za štampu", hint: "PDF · štamparija, samostalno izdanje, poklon primerci" },
      manuscript: { name: "Rukopis za izdavača", hint: "PDF · izdavač, agent, konkurs, lektor" },
      kdp: { name: "Amazon KDP — štampana", hint: "PDF · meki povez po KDP pravilima" },
      ebook: { name: "E-knjiga", hint: "EPUB · Kindle, Apple Books, Kobo, Google Play" },
    },
    // Amazon KDP (P6): provera pre preuzimanja i podsetnik za koricu.
    kdp: {
      trimName: (width: number, height: number) => {
        const n = (x: number) => new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 2 }).format(x);
        return `${n(width)} × ${n(height)} in`;
      },
      commonSizes: "Najčešće",
      otherSizes: "Ostale KDP veličine",
      checksLabel: "Provera za KDP",
      pagesOk: (n: number, overCream: boolean) =>
        `${count(n, "strana", "strane", "strana")} — u KDP opsegu (24–828)${overCream ? "; na krem papiru najviše 776" : ""}`,
      pagesTooFew: (n: number) => `${count(n, "strana", "strane", "strana")} — KDP traži najmanje 24`,
      pagesTooMany: (n: number) => `${count(n, "strana", "strane", "strana")} — KDP prima najviše 828`,
      trimOk: (size: string) => `Veličina ${size} je sa KDP liste`,
      blankOk: "Bez dugih nizova praznih strana",
      titleOk: "Naslov je upisan",
      titleMissing: "Knjiga se zove „Nova knjiga” — naslov menjaš u vrhu levog panela",
      authorOk: "Ime autora je upisano",
      authorMissing: "Upiši ime autora",
      cover: (pages: number) =>
        `Koricu praviš posebno u KDP Cover Creator-u ili sa dizajnerom; za hrbat ti treba broj strana: ${pages}.`,
      laying: "Slažem po KDP pravilima…",
    },
    size: "Veličina",
    sizes: { a5: "A5", "13x20": "13 × 20 cm", "6x9": "6 × 9 in (Amazon KDP)", a4: "A4" },
    toc: "Uključi sadržaj",
    cover: "Naslovnica",
    covers: { classic: "Klasična", modern: "Moderna", minimal: "Minimalistička" },
    author: "Ime autora",
    contact: "Kontakt",
    contactPlaceholder: "Email, telefon — svako u svom redu",
    spacing: "Prored",
    spacings: { oneHalf: "1,5", double: "Dupli" },
    download: "Preuzmi PDF",
    downloadDocx: "Preuzmi DOCX",
    format: "Format",
    formats: { docx: "DOCX (preporučeno)", pdf: "PDF" },
    docxPreviewNote: "Pregled je PDF; Word fajl ima isti raspored.",
    // E-knjiga (P8).
    epub: {
      cover: "Naslovnica",
      start: "Početak",
      formats: { epub: "EPUB (preporučeno)", docx: "DOCX za Kindle" },
      previewNote: "Pregled pokazuje naslovnicu; tekst slaže čitač, prema podešavanjima čitaoca.",
      downloadEpub: "Preuzmi EPUB",
    },
    downloading: "Slažem…",
    close: "Zatvori",
    preparing: "Pripremam slaganje…",
    failed: "Izvoz trenutno nije uspeo. Tekst je sačuvan — pokušaj ponovo.",
    previewLabel: "Pregled strana",
    previousPage: "Prethodna strana",
    nextPage: "Sledeća strana",
    pageOf: (n: number, total: number) => `${n} / ${total}`,
    manuscriptSuffix: "rukopis",
    // Rukopis: vrsta knjige ispod naslova; „drugo” i knjiga bez žanra nemaju red.
    manuscriptGenre: {
      literarni: "roman",
      istorijski: "istorijski roman",
      ljubavni: "ljubavni roman",
      triler: "triler",
      misterija: "misterija",
      horor: "horor",
      fantastika: "fantastika",
      "naučna fantastika": "naučna fantastika",
      "za decu": "knjiga za decu",
    } as Record<string, string | undefined>,
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
    empty: "Još nema knjiga. Prva počinje jednim klikom.",
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
    // Uvoz (ZADATAK_UVOZ I3): next to „Nova knjiga”, and under it while there are no books.
    importBook: "Uvezi knjigu",
    importFromEmpty: "ili uvezi rukopis koji već imaš",
  },
  import: {
    title: "Uvezi knjigu",
    intro: "Momentum sređuje raspored — poglavlja, naslove, kurziv, fusnote. Reči ostaju tvoje.",
    chooseFile: "Izaberi fajl",
    fileTypes: "DOCX, PDF ili TXT — ili prevuci fajl ovde",
    pasteLabel: "Nalepi tekst",
    pastePlaceholder: "Klikni ovde i nalepi tekst (Ctrl/Cmd+V)",
    reading: "Čitam rukopis…",
    pasted: (words: number) => `Nalepljeno: ${wordsOf(words)}`,
    fromFile: (name: string, words: number) => `${name} · ${wordsOf(words)}`,
    otherSource: "Drugi fajl ili tekst",
    bookTitle: "Naslov knjige",
    // "24 poglavlja · posveta · epilog · 82.314 reči"
    summary: (chapters: number, others: string[], words: number) =>
      [count(chapters, "poglavlje", "poglavlja", "poglavlja"), ...others.map((name) => name.toLocaleLowerCase("sr")), wordsOf(words)].join(" · "),
    partsLabel: "Delovi knjige",
    partWords: (words: number) => wordsOf(words),
    nothingFound: "Poglavlja nisu pronađena — ceo tekst ide u jedno poglavlje.",
    merge: "Spoji sa prethodnim",
    mergeLabel: (name: string) => `Spoji „${name}” sa prethodnim delom`,
    undoMerge: "Vrati",
    keepTitlePage: "Zadrži naslovnu stranu kao deo „Naslovna”",
    latin: "Preslovi na latinicu",
    cyrillicNote: "Provera jezika i dopune rade za latinicu.",
    tironReads: "Neka Tiron pročita knjigu",
    tironReadsHint: "Tekst se šalje AI-ju, kao i kad pišeš. Tiron će znati likove, mesta i otvorene niti.",
    warnings: {
      images: (n: number) => `${count(n, "slika je izostavljena", "slike su izostavljene", "slika je izostavljeno")} — Momentum čuva samo tekst.`,
      tables: "Tabele su pretvorene u običan tekst.",
      plainFootnotes: (n: number) => `${count(n, "fusnota nije prepoznata", "fusnote nisu prepoznate", "fusnota nije prepoznato")} — ostaju kao običan tekst.`,
      pdfFootnotes: "Fusnote iz PDF-a su uvezene kao običan tekst.",
    },
    import: "Uvezi knjigu",
    importing: "Uvozim…",
    cancel: "Odustani",
    failed: "Uvoz nije uspeo. Tvoj fajl nije promenjen.",
    readFailed: "Ovaj fajl trenutno ne može da se pročita. Pokušaj ponovo.",
    errors: {
      encoding: "Ovaj fajl nije čitljiv kao tekst. Sačuvaj ga kao UTF-8 i pokušaj ponovo.",
      unsupported: "Ovakav fajl ne može da se uveze — izaberi DOCX, PDF ili TXT.",
      empty: "U ovome nema teksta za uvoz.",
      scan: "Ovaj PDF je slika strana — nema teksta za uvoz.",
    },
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
    addPart: "+ Posveta, predgovor…",
    bookTitleHint: "Dupli klik za promenu naslova",
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
