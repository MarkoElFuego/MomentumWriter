import { db, type Appearance, type PanelSection, type PanelSettings } from "./schema";

export const DEFAULT_APPEARANCE: Appearance = { key: "appearance", focusMode: false, typewriter: false };

export async function getAppearance(): Promise<Appearance> {
  return ((await db.settings.get("appearance")) as Appearance | undefined) ?? DEFAULT_APPEARANCE;
}

/** Saves only what changed; the rest keeps its stored (or default) value. */
export async function saveAppearance(change: Partial<Omit<Appearance, "key">>): Promise<Appearance> {
  return db.transaction("rw", db.settings, async () => {
    const next = { ...(await getAppearance()), ...change, key: "appearance" as const };
    await db.settings.put(next);
    return next;
  });
}

/** Right panel sections the author left open; every section starts collapsed. */
export async function getOpenSections(): Promise<PanelSection[]> {
  return ((await db.settings.get("panels")) as PanelSettings | undefined)?.open ?? [];
}

export async function setSectionOpen(section: PanelSection, open: boolean): Promise<PanelSection[]> {
  return db.transaction("rw", db.settings, async () => {
    const rest = (await getOpenSections()).filter((name) => name !== section);
    const next: PanelSettings = { key: "panels", open: open ? [...rest, section] : rest };
    await db.settings.put(next);
    return next.open;
  });
}
