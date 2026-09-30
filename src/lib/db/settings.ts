import { db, type Appearance } from "./schema";

export const DEFAULT_APPEARANCE: Appearance = { key: "appearance", focusMode: false, typewriter: false };

export async function getAppearance(): Promise<Appearance> {
  return (await db.settings.get("appearance")) ?? DEFAULT_APPEARANCE;
}

/** Saves only what changed; the rest keeps its stored (or default) value. */
export async function saveAppearance(change: Partial<Omit<Appearance, "key">>): Promise<Appearance> {
  return db.transaction("rw", db.settings, async () => {
    const next = { ...(await getAppearance()), ...change, key: "appearance" as const };
    await db.settings.put(next);
    return next;
  });
}
