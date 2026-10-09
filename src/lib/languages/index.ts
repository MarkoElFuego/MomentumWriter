import { prompts as srLatnPrompts } from "./sr-Latn/prompts";
import { typography as srLatnTypography } from "./sr-Latn/typography";

// Adding a language: see docs/ARCHITECTURE.md → "Dodavanje novog jezika".
export const LANGUAGES = ["sr-Latn"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "sr-Latn";

export interface LanguagePrompts {
  /** Who writes and in which language; follows the shared role line. */
  writer: string;
  /** Ghost: match the author's language, script and spelling. */
  sameScript: string;
  /** Proofread system prompt — always identical, so the provider can cache it. */
  proofreader: string;
  /** Tiron's voice and rules — the start of every Tiron prompt (stuck now, whispers in T5). */
  tiron: string;
  /** „Pomozi mi”: the task after the Tiron rules. */
  stuck: string;
  /** Story memory, chapter summary and strongest sentence (T2) — read in the background. */
  memory: string;
  /** Tiron's whisper (T5): the task after the Tiron rules, per moment and pattern. */
  whisper: string;
}

export interface Typography {
  quoteOpen: string;
  quoteClose: string;
  dialogueDash: string;
  sceneBreak: string;
}

export interface LanguageModule {
  prompts: LanguagePrompts;
  typography: Typography;
}

const MODULES: Record<Language, LanguageModule> = {
  "sr-Latn": { prompts: srLatnPrompts, typography: srLatnTypography },
};

export function getLanguage(language: Language = DEFAULT_LANGUAGE): LanguageModule {
  return MODULES[language];
}
