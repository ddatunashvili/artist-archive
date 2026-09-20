import { env } from "@/lib/env";
import { createCompatibleExtractor } from "./openai-compatible";
import type { Extractor } from "./types";

/** OpenAI Chat Completions. Key and model come from the environment only. */
export function createOpenAiExtractor(): Extractor {
  const { apiKey, model, baseUrl, maxTokens } = env.openai;
  return createCompatibleExtractor({ name: "openai", apiKey, model, baseUrl, maxTokens });
}
