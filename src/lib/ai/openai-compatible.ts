import { ExtractionResultSchema, fieldErrors } from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { repairExtraction } from "./repair";
import { ExtractorError, type ExtractInput, type Extractor } from "./types";

/**
 * Shared transport for any OpenAI-compatible /chat/completions endpoint.
 * OpenAI and OpenRouter differ only in base URL, model id and headers, so the
 * concrete providers are thin wrappers around this.
 */
export interface CompatibleConfig {
  name: Extractor["name"];
  apiKey: string;
  model: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
  /** Some gateways reject response_format; set false to fall back to prompting. */
  jsonMode?: boolean;
  /**
   * Ceiling on the reply.
   *
   * Not optional in practice: OpenRouter reserves the model full output
   * window when this is absent, so a request is priced at the maximum the
   * model could ever produce. An account with a small balance is then
   * refused with 402 even though the actual reply would cost a fraction of
   * it. Sending an explicit ceiling prices the request honestly.
   */
  maxTokens: number;
}

const TIMEOUT_MS = 90_000;

/** Strips ```json fences and any prose around the JSON object. */
function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new ExtractorError("Model reply contained no JSON object.");
  }
  return body.slice(start, end + 1);
}

export function createCompatibleExtractor(config: CompatibleConfig): Extractor {
  if (!config.apiKey) {
    throw new ExtractorError(
      `No API key configured for "${config.name}". Set it in .env, or use AI_PROVIDER="mock".`,
      500,
    );
  }

  return {
    name: config.name,
    model: config.model,

    async extract({ text, artistName }: ExtractInput) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            ...config.extraHeaders,
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0,
            max_tokens: config.maxTokens,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserPrompt(text, artistName) },
            ],
            ...(config.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
          }),
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new ExtractorError(
          aborted ? "The model took too long to respond." : `Could not reach ${config.name}.`,
          504,
        );
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // Body may contain the request echo; never surface it verbatim.
        const status = response.status;
        const hint =
          status === 401 || status === 403
            ? "Check the API key in your .env file."
            : status === 429
              ? "Rate limited by the provider."
              : status === 402
                ? `Not enough credit for a reply of up to ${config.maxTokens} tokens. Add credit, or lower ${config.name === "openrouter" ? "OPENROUTER_MAX_TOKENS" : "OPENAI_MAX_TOKENS"}.`
                : "";
        throw new ExtractorError(`${config.name} returned HTTP ${status}. ${hint}`.trim(), 502);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new ExtractorError("Model returned an empty reply.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(content));
      } catch {
        throw new ExtractorError("Model reply was not valid JSON.");
      }

      // Fill the fields a model honestly returns as null before validating.
      const result = ExtractionResultSchema.safeParse(repairExtraction(parsed, artistName));
      if (!result.success) {
        throw new ExtractorError(
          "Model reply did not match the archive schema.",
          422,
          fieldErrors(result.error),
        );
      }

      if (!result.data.artist.name && artistName) {
        result.data.artist.name = artistName;
      }
      return result.data;
    },
  };
}
