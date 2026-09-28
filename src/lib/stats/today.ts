import { getDailyStat } from "@/lib/db/dailyStats";
import type { ID } from "@/lib/db/schema";

// Local date, not UTC — "today" must flip at the writer's midnight.
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function wordsDelta(startWordTotal: number, currentTotal: number): number {
  return Math.max(0, currentTotal - startWordTotal);
}

export async function wordsToday(bookId: ID, date: string = localDateKey()): Promise<number> {
  const stat = await getDailyStat(bookId, date);
  return stat ? wordsDelta(stat.startWordTotal, stat.endWordTotal) : 0;
}
