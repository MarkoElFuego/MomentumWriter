// P0 (ZADATAK_IZVOZ): Typst sources for the trial — a short Serbian sample and
// a ~80.000-word book for timing. Used only by /dev/typst and the measuring script.

const PAGE = `#set page(
  paper: "a5",
  margin: (inside: 19mm, outside: 15mm, top: 18mm, bottom: 20mm),
  numbering: "1",
)
#set text(font: "Literata", size: 10.5pt, lang: "hr")
#set par(justify: true, leading: 0.62em, spacing: 0.62em, first-line-indent: 1.2em)
#set footnote.entry(separator: line(length: 30%, stroke: 0.4pt))
#show heading.where(level: 1): it => {
  pagebreak(to: "odd", weak: true)
  v(30mm)
  align(center, text(size: 15pt, weight: "regular", it.body))
  v(12mm)
}
`;

/** One page with diacritics, a footnote and justified text. */
export function probeSource(): string {
  return `${PAGE}
= Dolazak

Đorđe je čekao na železničkoj stanici, ćuteći, dok je kiša šibala po krovovima. Žuta svetlost iz čekaonice padala je na šine, a on je brojao vagone koji su odlazili prema jugu.#footnote[Stanica je zatvorena pedesetih godina, ali se zgrada i danas vidi sa puta za _Čačak_.] Nije znao koliko će dugo ostati, niti da li će ga iko prepoznati posle toliko godina.

Šešir mu je bio mokar, kaput težak. Čuo je kako neko iza njega izgovara njegovo ime — tiho, kao da se plaši odgovora. Okrenuo se. Ćerka gostioničara stajala je na vratima sa fenjerom u ruci i gledala ga kao da gleda duha koji se vratio da naplati stari dug.

„Došli ste”, rekla je. „Svi su govorili da nećete.”

Neprepoznatljivost, nepredvidivost i nezaboravnost — duge reči koje moraju da se rastave na kraju reda, inače poravnanje ostavlja rupe između reči u uskim kolonama ovakve knjige.
`;
}

const WORDS =
  "kiša prozor tišina žena čovek grad reka put kuća sećanje jutro veče ruka glas pismo vrata svetlost senka zid stanica voz čaša hleb ogledalo ključ đak šuma polje ćošak ulica most nebo zvezda more obala vetar sneg lišće dvorište stepenice soba krevet sto stolica knjiga reč pogled osmeh suza strah nada ljubav mržnja istina laž san buđenje majka otac brat sestra prijatelj neprijatelj čekao gledao rekla ćutao hodao trčao pisao čitao zaboravio sećao razumeo tiho polako naglo opet nikad uvek ovde tamo daleko blizu".split(
    " ",
  );

/** A deterministic pseudo-random word stream, so every run compiles the same book. */
function words(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return WORDS[state % WORDS.length]!;
  };
}

function paragraph(next: () => string, length: number): string {
  const out: string[] = [];
  let sentence = 0;
  for (let i = 0; i < length; i++) {
    let word = next();
    if (sentence === 0) word = word[0]!.toUpperCase() + word.slice(1);
    sentence++;
    const end = sentence > 6 && (i % 11 === 0 || sentence > 16);
    out.push(end ? `${word}.` : i % 9 === 4 ? `${word},` : word);
    if (end) sentence = 0;
  }
  const text = out.join(" ");
  return /[.]$/.test(text) ? text : `${text.replace(/,$/, "")}.`;
}

/** ~`totalWords` words in `chapters` chapters, two footnotes per chapter. */
export function bookSource(totalWords = 80_000, chapters = 30): string {
  const next = words(42);
  const perChapter = Math.round(totalWords / chapters);
  const parts = [PAGE];
  for (let c = 1; c <= chapters; c++) {
    parts.push(`= Poglavlje ${c}\n`);
    let written = 0;
    let p = 0;
    while (written < perChapter) {
      const length = 60 + ((c * 7 + p * 13) % 80);
      let text = paragraph(next, length);
      if (p === 2 || p === 9) text += `#footnote[${paragraph(next, 14)}]`;
      parts.push(text + "\n");
      written += length;
      p++;
    }
  }
  return parts.join("\n");
}
