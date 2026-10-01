import { copy } from "@/lib/copy";

export interface PromptLine {
  label: string;
  text: string;
}

/**
 * The "for today" slot of the Resume screen. Today it holds the open question;
 * later the last win ("Prošli put / Za danas") fills the same slot with two lines.
 * Nothing to show and nothing coming → the section is simply not there.
 */
export function ResumePrompt({ lines, loading }: { lines: PromptLine[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-8 space-y-3" aria-busy="true">
        <span className="sr-only">{copy.resume.loadingQuestion}</span>
        <div className="h-3 w-28 rounded bg-current opacity-10 motion-safe:animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-current opacity-10 motion-safe:animate-pulse" />
      </div>
    );
  }
  if (lines.length === 0) return null;
  return (
    <dl className="mt-8 space-y-4">
      {lines.map(({ label, text }) => (
        <div key={label}>
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="mt-1 font-serif text-lg">{text}</dd>
        </div>
      ))}
    </dl>
  );
}
