import { db, type ID, type ResumeState } from "./schema";

export function getResumeState(bookId: ID): Promise<ResumeState | undefined> {
  return db.resumeState.get(bookId);
}
