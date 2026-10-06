import { docFromJSON } from "@/components/editor/contentSchema";
import { mainTextEnd } from "@/components/editor/footnotes";
import { WHISPER_TEXT_WORDS, type TironRequest } from "@/lib/ai/tiron";
import { requestTiron } from "@/lib/ai/sparkClient";
import { cleanHeart, getBook } from "@/lib/db/books";
import { compactMemory, getMemory } from "@/lib/db/memory";
import { chapterNumber, getPart, listParts, partLabel } from "@/lib/db/parts";
import type { ID, Part, Session, WhisperMoment } from "@/lib/db/schema";
import { getSignals, listSessions } from "@/lib/db/sessions";
import { addWhisper, chapterEndsInSession, listWhispers, patternToday, sessionEndSaid } from "@/lib/db/whispers";
import { pickPattern } from "@/lib/process/patterns";
import { isSessionOver } from "@/lib/process/signals";
import { momentAllowed, readTironMode } from "@/lib/tironMode";
import { extractContext } from "@/lib/text/extractContext";

/** "2 per session" counts only these; entering and the end of a session are free. */
export const CHAPTER_END_PER_SESSION = 2;
/** A session too small to look back on gets no closing whisper. */
export const SESSION_END_MIN_WORDS = 100;
/** Entering twice in a row (a reload, Resume → back) doesn't greet twice. */
const ENTRY_COOLDOWN_MS = 60 * 60 * 1_000;
/** The panel needs only a handful of summaries to know where the story is. */
const MAX_SUMMARIES = 30;

export type WhisperOutcome = "said" | "skipped" | "failed";

export type WhisperTarget =
  /** Entering the book (Resume). */
  | { moment: "entry"; bookId: ID }
  /** Left a part after Tiron read it (T2). */
  | { moment: "chapterEnd"; partId: ID }
  /** The session is over (or was, when the tab closed). */
  | { moment: "sessionEnd"; session: Session };

// One request per book and moment at a time: StrictMode, a reload and the
// minute check must not ask twice for the same whisper.
const inFlight = new Map<string, Promise<WhisperOutcome>>();

export function requestWhisper(target: WhisperTarget, now = Date.now()): Promise<WhisperOutcome> {
  const key = `${target.moment}:${"bookId" in target ? target.bookId : "partId" in target ? target.partId : target.session.id}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const run = whisper(target, now)
    .catch((error) => {
      console.error("[tiron] whisper failed", error);
      return "failed" as const;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

function textOf(part: Part, language: Parameters<typeof docFromJSON>[1]): string {
  const doc = docFromJSON(part.content, language);
  const end = mainTextEnd(doc);
  return extractContext(doc, end, WHISPER_TEXT_WORDS);
}

async function whisper(target: WhisperTarget, now: number): Promise<WhisperOutcome> {
  const mode = readTironMode();
  if (!momentAllowed(mode, target.moment)) return "skipped";

  // Which book, which part, which session.
  let bookId: ID;
  let partId: ID | undefined;
  let session: Session | undefined;
  if (target.moment === "entry") {
    bookId = target.bookId;
  } else if (target.moment === "chapterEnd") {
    const part = await getPart(target.partId);
    if (!part) return "skipped";
    bookId = part.bookId;
    partId = part.id;
    session = (await listSessions(bookId)).at(-1);
    if (session && (await chapterEndsInSession(bookId, session.id)) >= CHAPTER_END_PER_SESSION) return "skipped";
  } else {
    session = target.session;
    bookId = session.bookId;
    partId = session.partIds.at(-1);
    if (session.wordsAdded < SESSION_END_MIN_WORDS || (await sessionEndSaid(bookId, session.id))) return "skipped";
  }

  const book = await getBook(bookId);
  if (!book) return "skipped";
  const [parts, whispers] = await Promise.all([listParts(bookId), listWhispers(bookId)]);
  partId ??= parts.find((part) => part.kind === "chapter")?.id ?? parts[0]?.id;
  if (!partId) return "skipped";

  let moment: WhisperMoment = target.moment;
  const signals = await getSignals(bookId, partId, now);
  let pattern: ReturnType<typeof pickPattern> = null;
  if (moment === "entry") {
    if (whispers.some((w) => (w.moment === "entry" || w.moment === "pattern") && now - w.createdAt < ENTRY_COOLDOWN_MS)) {
      return "skipped";
    }
    // A pattern takes the place of the greeting — at most one a day.
    if (signals && !(await patternToday(bookId, now))) pattern = pickPattern(signals);
    if (pattern) moment = "pattern";
  }

  const label = (part: Part) => partLabel(part, chapterNumber(parts, part.id));
  const heart = cleanHeart(book.heart);
  const summaries = parts
    .filter((part) => part.summary)
    .slice(-MAX_SUMMARIES)
    .map((part) => ({ label: label(part), summary: part.summary!.slice(0, 800) }));
  // Best lines of parts that still exist.
  const alive = new Set(parts.map((part) => part.id));
  const bestLines = (book.bestLines ?? []).filter((line) => alive.has(line.partId));
  const memory = compactMemory(await getMemory(bookId));
  const textPart = partId ? parts.find((part) => part.id === partId) : undefined;

  // What each moment gets (docs/ZADATAK_Tiron.md → T5).
  const wants = {
    heart: moment !== "sessionEnd",
    memory: moment !== "pattern",
    summaries: moment !== "pattern",
    signals: moment !== "chapterEnd",
    text: moment === "chapterEnd" || moment === "sessionEnd",
    bestLines: moment === "pattern",
  };

  const request: TironRequest = {
    mode: "tiron",
    moment,
    bookTitle: book.title,
    language: book.language,
    ...(pattern ? { pattern } : {}),
    ...(wants.heart && heart ? { heart } : {}),
    ...(wants.memory && memory ? { memory } : {}),
    ...(wants.summaries && summaries.length ? { summaries } : {}),
    ...(wants.signals && signals ? { signals } : {}),
    ...(wants.text && textPart ? { text: textOf(textPart, book.language).slice(0, 15_000) } : {}),
    ...(wants.bestLines && bestLines.length ? { bestLines: bestLines.slice(-60).map((line) => line.text.slice(0, 600)) } : {}),
    previous: whispers.slice(0, 5).map((w) => w.text.slice(0, 300)),
  };

  const result = await requestTiron(request);
  if (!result.ok) {
    console.warn(`[tiron] no whisper (${result.status})`);
    return "failed";
  }
  const quoted = result.data.quote ? bestLines.find((line) => line.text === result.data.quote) : undefined;
  await addWhisper({
    bookId,
    moment,
    kind: result.data.kind,
    text: result.data.whisper,
    ...(quoted ? { quote: quoted.text, quotePartId: quoted.partId } : {}),
    ...(session ? { sessionId: session.id } : {}),
    createdAt: now,
  });
  return "said";
}

/**
 * The end of the book's last session, if it is over and has no whisper yet —
 * also the one left behind by a closed tab (author's decision 2026-10-06).
 */
export async function whisperSessionEndIfDue(bookId: ID, hiddenSince?: number, now = Date.now()): Promise<WhisperOutcome> {
  const session = (await listSessions(bookId)).at(-1);
  if (!session || !isSessionOver(session.endedAt, now, hiddenSince)) return "skipped";
  return requestWhisper({ moment: "sessionEnd", session }, now);
}
