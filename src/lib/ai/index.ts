import { env } from "@/lib/env";
import { createMockExtractor } from "./mock";
import { createOpenAiExtractor } from "./openai";
import { createOpenRouterExtractor } from "./openrouter";
import type { Extractor } from "./types";

export { ExtractorError } from "./types";
export type { Extractor, ExtractInput } from "./types";
export { parseCv } from "./mock";

/**
 * Single place where a provider is chosen. Adding another backend means
 * adding a file next to this one and a case below - nothing else in the app
 * knows which model produced a record.
 */
export function getExtractor(): Extractor {
  switch (env.aiProvider) {
    case "openai":
      return createOpenAiExtractor();
    case "openrouter":
      return createOpenRouterExtractor();
    default:
      return createMockExtractor();
  }
}

/** Safe, non-secret description of the active provider for the UI. */
export function describeProvider(): { provider: string; model: string | null; needsKey: boolean } {
  const provider = env.aiProvider;
  if (provider === "openai") {
    const { model, apiKey } = env.openai;
    return { provider, model, needsKey: !apiKey };
  }
  if (provider === "openrouter") {
    const { model, apiKey } = env.openrouter;
    return { provider, model, needsKey: !apiKey };
  }
  return { provider: "mock", model: null, needsKey: false };
}
