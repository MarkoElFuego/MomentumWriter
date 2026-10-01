"use client";

import { useEffect, useState } from "react";
import type { PromptLine } from "@/components/resume/ResumePrompt";
import type { SparkRequest } from "@/lib/ai/schemas";
import { requestSpark } from "@/lib/ai/sparkClient";
import { copy } from "@/lib/copy";
import { saveOpenQuestion } from "@/lib/db/resume";
import type { ID } from "@/lib/db/schema";
import { HAS_WORD_CHAR } from "@/lib/text/countWords";

export interface OpenQuestionInput {
  bookId: ID;
  /** partId + context hash; a matching cached question is shown without a call. */
  key: string;
  cached: { question: string; key: string } | null;
  request: SparkRequest;
}

/** The Resume screen's one question (mode "resume"). Failures just hide it. */
export function useOpenQuestion(input: OpenQuestionInput | null): { lines: PromptLine[]; loading: boolean } {
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!input) return;
    if (input.cached?.key === input.key) {
      setQuestion(input.cached.question);
      return;
    }
    // Nothing written before the cursor — nothing to ask about.
    if (!HAS_WORD_CHAR.test(input.request.context)) return;

    const controller = new AbortController();
    setLoading(true);
    void requestSpark(input.request, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoading(false);
      if (!result.ok || !("openQuestion" in result.data)) return;
      const { openQuestion } = result.data;
      setQuestion(openQuestion);
      saveOpenQuestion(input.bookId, openQuestion, input.key).catch((error) =>
        console.error("Failed to cache the open question", error),
      );
    });
    return () => controller.abort();
  }, [input]);

  return { lines: question ? [{ label: copy.resume.openQuestion, text: question }] : [], loading };
}
