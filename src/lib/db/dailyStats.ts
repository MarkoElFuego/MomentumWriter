import { db, type DailyStat, type ID } from "./schema";

export function getDailyStat(bookId: ID, date: string): Promise<DailyStat | undefined> {
  return db.dailyStats.get([date, bookId]);
}

/**
 * First touch of the day fixes startWordTotal; later calls return the
 * existing stat unchanged so a refresh never resets "words today".
 */
export async function ensureDailyStat(
  bookId: ID,
  date: string,
  currentTotal: number,
): Promise<DailyStat> {
  return db.transaction("rw", db.dailyStats, async () => {
    const existing = await db.dailyStats.get([date, bookId]);
    if (existing) return existing;
    const stat: DailyStat = {
      date,
      bookId,
      startWordTotal: currentTotal,
      endWordTotal: currentTotal,
    };
    await db.dailyStats.add(stat);
    return stat;
  });
}
