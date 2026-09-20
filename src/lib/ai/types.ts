import type { ExtractionResult } from "@/lib/schema";

export interface ExtractInput {
  /** Raw, unstructured CV text pasted by an archivist. */
  text: string;
  /** Optional hint when the CV omits the artist's name. */
  artistName?: string;
}

export interface Extractor {
  /** Provider id, stored on each record for provenance. */
  readonly name: "mock" | "openai" | "openrouter";
  /** Model identifier, or null for the rule-based mock. */
  readonly model: string | null;
  /** Returns Zod-validated structured data, or throws ExtractorError. */
  extract(input: ExtractInput): Promise<ExtractionResult>;
}

export class ExtractorError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ExtractorError";
  }
}
