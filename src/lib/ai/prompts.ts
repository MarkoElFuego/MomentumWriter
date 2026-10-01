// Prompt texts mirror docs/AI_PROMPTS.md — change them there first.
import { lastSentence } from "@/lib/text/lastSentence";
import { endsMidSentence } from "@/lib/text/sentences";
import { getLanguage, type Language, type LanguagePrompts } from "@/lib/languages";

// "ghost" is the automatic gray completion while typing; "resume" the Resume screen's question.
export const SPARK_MODES = ["resume", "ghost"] as const;
export type SparkMode = (typeof SPARK_MODES)[number];

const basePrompt = (lang: LanguagePrompts) => `Ti si iskusan književni urednik koji sedi pored autora dok piše.
${lang.writer}

APSOLUTNA PRAVILA:
- NIKADA ne piši celu rečenicu proze, pasus, dijalog ili opis koji autor može da prepiše.
- Osim kad se izričito traži početak rečenice, daješ samo pitanja, pravce i zapažanja. Obraćaš se autoru, ne čitaocu.
- Svaka stavka je najviše jedna do dve kratke rečenice.
- Koristi imena i detalje iz konteksta da budeš konkretan, ne generičan.
- Odgovaraš ISKLJUČIVO validnim JSON-om, bez markdowna i bez teksta van JSON-a.`;

const MODE_PROMPTS: Record<SparkMode, (lang: LanguagePrompts) => string> = {
  ghost: (lang) => `Autor upravo piše. Tvoj predlog se prikazuje sivo posle kursora i autor ga prihvata ili ignoriše. U delu ---KURSOR--- piše da li je kursor USRED rečenice ili POSLE završene rečenice.

Ako je kursor USRED rečenice:
- Pročitaj nedovršenu rečenicu i tekst pre nje i razumi šta autor hoće da kaže (poređenje, suprotnost posle „ali”, posledicu, nabrajanje…).
- Ponudi TAČNO 3 nastavka koji dovršavaju TU misao — logično, gramatički ispravno, kao da ih je autor napisao.
- Dužina: najbolje 2–5 reči; kraće je bolje ako je misao dovršena; NIKAD više od 7 reči.
- Prvi je najprirodniji, očekivan nastavak. Drugi je blag obrt iste misli. Treći dovršava misao kroz čulni detalj (zvuk, dodir, miris, svetlo).
- Stavi tačku samo ako se rečenica tu prirodno završava; nikad ne počinji novu rečenicu.
- Svaka stavka ima "kind":"finish".

Ako je kursor POSLE završene rečenice:
- Predloži samo POČETAK sledeće rečenice, 2–5 reči, tri različita pravca — bez tačke na kraju; rečenicu završava autor.
- "inner" (misao, emocija, strah lika), "outer" (događaj, prekid, nova osoba ili predmet), "shift" (perspektiva, čulo, vreme, ritam).
- Počni velikim slovom, kao nova rečenica.

Uvek:
- Tekst počinje tačno od kursora; ne ponavljaj reči koje su već napisane.
- ${lang.sameScript}

Format:
{"items":[{"kind":"finish","text":"..."},{"kind":"finish","text":"..."},{"kind":"finish","text":"..."}]}
ili
{"items":[{"kind":"inner","text":"..."},{"kind":"outer","text":"..."},{"kind":"shift","text":"..."}]}`,

  resume: () => `Autor se vraća posle pauze. Na osnovu teksta:
1) napiši siže u TAČNO 3 kratka reda (šta se dogodilo, gde je lik sada, šta je nerešeno) — kao beleške urednika, u prošlom vremenu, bez književnog stila;
2) postavi JEDNO otvoreno pitanje koje vuče scenu napred.

Format:
{"summary":["...","...","..."],"openQuestion":"..."}`,
};

export function buildSystemPrompt(mode: SparkMode, language?: Language): string {
  const lang = getLanguage(language).prompts;
  return `${basePrompt(lang)}\n\n${MODE_PROMPTS[mode](lang)}`;
}

export interface SparkContext {
  bookTitle: string;
  chapterTitle: string;
  context: string;
}

export function buildUserMessage(
  mode: SparkMode,
  { bookTitle, chapterTitle, context }: SparkContext,
): string {
  const message = `Knjiga: ${bookTitle}\nPoglavlje: ${chapterTitle}\n\n---TEKST---\n${context}`;
  if (mode !== "ghost") return message;
  // Spelled out so the model finishes the author's thought instead of guessing where it stands.
  const cursor = endsMidSentence(context)
    ? `USRED rečenice. Nedovršena rečenica: „${lastSentence(context)}”`
    : "POSLE završene rečenice — sledi nova rečenica.";
  return `${message}\n\n---KURSOR---\n${cursor}`;
}

// gpt-6-luna is a reasoning model: it rejects any temperature other than the
// default, and its hidden reasoning counts toward the token cap — 400 would
// leave nothing for the answer. The schema keeps the visible reply short.
export const MAX_COMPLETION_TOKENS = 1200;
