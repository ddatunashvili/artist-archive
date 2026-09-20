/**
 * Server-side environment access.
 *
 * Every secret is read from process.env at call time. Nothing here is
 * exported to the client bundle and no value is ever logged.
 */

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type AiProviderName = "mock" | "openai" | "openrouter";

export function aiProviderName(): AiProviderName {
  const value = str("AI_PROVIDER", "mock").toLowerCase();
  if (value === "openai" || value === "openrouter") return value;
  return "mock";
}

export const env = {
  get aiProvider(): AiProviderName {
    return aiProviderName();
  },
  get openai() {
    return {
      apiKey: str("OPENAI_API_KEY"),
      model: str("OPENAI_MODEL", "gpt-4o-mini"),
      baseUrl: str("OPENAI_BASE_URL", "https://api.openai.com/v1"),
      maxTokens: int("OPENAI_MAX_TOKENS", 4000),
    };
  },
  get openrouter() {
    return {
      apiKey: str("OPENROUTER_API_KEY"),
      model: str("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
      baseUrl: str("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
      maxTokens: int("OPENROUTER_MAX_TOKENS", 4000),
      siteUrl: str("OPENROUTER_SITE_URL", "http://localhost:3000"),
      appName: str("OPENROUTER_APP_NAME", "Artist Archive"),
    };
  },
  get maxCvChars(): number {
    return int("MAX_CV_CHARS", 20_000);
  },
};
