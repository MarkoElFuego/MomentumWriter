// Sav UI tekst na jednom mestu — ton se menja ovde, ne po komponentama.
export const copy = {
  appName: "Momentum",
  tagline: "Prostor koji ti pomaže da nastaviš da pišeš.",
  editor: {
    placeholder: "Počni ovde…",
    defaultChapterTitle: "Poglavlje I",
    menuLabel: "Meni",
    sparkButton: "✦ Treba mi impuls",
    // 1, 21, 31… reč; sve ostalo reči (11 je izuzetak)
    wordsToday: (n: number) =>
      `${n} ${n % 10 === 1 && n % 100 !== 11 ? "reč" : "reči"} danas`,
  },
  resume: {
    title: "Resume",
  },
  placeholder: {
    comingSoon: "Uskoro.",
  },
} as const;
