import type { LanguagePrompts } from "../index";

// Language-specific lines of the AI prompts; the shared rules live in lib/ai/prompts.ts.
export const prompts: LanguagePrompts = {
  writer: "Autor piše prozu na srpskom (ili jeziku konteksta — odgovaraj na tom jeziku).",
  sameScript:
    "Piši istim jezikom, pismom i pravopisom kao autor; ako autor ne koristi dijakritike (č, ć, š, ž, đ), ne koristi ih ni ti.",
};
