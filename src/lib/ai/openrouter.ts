import { env } from "@/lib/env";
import { createCompatibleExtractor } from "./openai-compatible";
import type { Extractor } from "./types";

/**
 * OpenRouter exposes the same Chat Completions surface as OpenAI, plus two
 * optional attribution headers. Not every routed model supports JSON mode,
 * so the prompt also demands JSON and the reply is fence-stripped.
 */
export function createOpenRouterExtractor(): Extractor {
  const { apiKey, model, baseUrl, siteUrl, appName, maxTokens } = env.openrouter;
  return createCompatibleExtractor({
    name: "openrouter",
    apiKey,
    model,
    baseUrl,
    maxTokens,
    extraHeaders: {
      "HTTP-Referer": siteUrl,
      "X-Title": appName,
    },
  });
}
