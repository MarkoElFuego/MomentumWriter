import { copy } from "@/lib/copy";

/**
 * The language score as a ring (POL2): a quiet track, the arc in the theme's
 * accent, the number inside. The arc moves (400 ms) only when the score changes
 * — never with prefers-reduced-motion.
 */
export function ScoreRing({ value, size = 44 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * c;
  const mid = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={copy.tiron.languageRing(value)} className="shrink-0">
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        transform={`rotate(-90 ${mid} ${mid})`}
        className="score-ring-arc"
      />
      <text x={mid} y={mid + 4.5} textAnchor="middle" fontSize="13" fontWeight={500} fill="var(--ink)" className="tabular-nums">
        {value}
      </text>
    </svg>
  );
}
