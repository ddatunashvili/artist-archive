# AI providers

## The abstraction

```ts
interface Extractor {
  readonly name: "mock" | "openai" | "openrouter";
  readonly model: string | null;
  extract(input: { text: string; artistName?: string }): Promise<ExtractionResult>;
}
```

`getExtractor()` in `src/lib/ai/index.ts` reads `AI_PROVIDER` and returns one. Everything else in
the app — the API route, the review UI, the database — only ever sees a validated
`ExtractionResult` and a provider name stored as `extractedBy`.

```
src/lib/ai/
  index.ts               getExtractor(), describeProvider()
  types.ts               Extractor interface, ExtractorError
  prompt.ts              system prompt and the requested JSON shape
  openai-compatible.ts   shared transport for /chat/completions
  openai.ts              OpenAI configuration
  openrouter.ts          OpenRouter configuration + attribution headers
  mock.ts                offline rule-based CV parser
```

## `mock` — the default

A real rule-based parser, not a stub. It recognises CV section headers
(`SOLO EXHIBITIONS`, `AWARDS AND GRANTS`, `PUBLIC COLLECTIONS`, …) to set the record type, pulls a
year or year range off the front of each line, splits the rest right-to-left into
title / venue / city / country against a country list, and derives a role from `(solo)`, `(group)`,
`curated by` and similar markers. It scores its own confidence from how much of a line it could
account for.

It exists so that:

- the archive runs with no API key and no network,
- the review UI can be demonstrated and tested deterministically,
- there is a baseline to compare a model's output against.

## `openai` and `openrouter`

Both speak the OpenAI Chat Completions API, so they share `openai-compatible.ts` and differ only in
base URL, model id and headers. Requests use `temperature: 0`, an explicit `max_tokens`, and where
supported `response_format: { type: "json_object" }`; replies are fence-stripped before parsing
because not every routed model honours JSON mode.

### Why `max_tokens` is not optional

OpenRouter prices a request against the **maximum** the model could return. Omit `max_tokens` and it
reserves the model's entire output window — 16,384 tokens for `gpt-4o-mini` — so an account without
that much credit is refused outright:

```
402  This request requires more credits, or fewer max_tokens.
     You requested up to 16384 tokens, but can only afford 1540.
```

That reads like "no credit" and is not: the actual reply costs a fraction of the reservation.
`OPENROUTER_MAX_TOKENS` (default 4000) sets the ceiling, and a 402 now says exactly which variable
to lower.

Set it high enough for the longest CV you expect — roughly 40 tokens of JSON per record.

```dotenv
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
```

```dotenv
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="sk-or-..."
OPENROUTER_MODEL="openai/gpt-4o-mini"
```

Check which one is live without exposing the key:

```bash
curl http://localhost:3000/api/extract
# {"provider":"openai","model":"gpt-4o-mini","needsKey":false}
```

## Repairing honest nulls

A model told to return strict JSON still answers truthfully when a field is not in the source. For
`2019 — Residency at Villa Medici, Rome` there is no work title, so it returns `title: null`; a CV
with no name at the top returns `artist.name: null`. Both readings are correct, and both would fail
a schema that requires strings.

`src/lib/ai/repair.ts` fills exactly those two cases before validation — deriving
"Residency at Villa Medici" from the type and institution, the same way the rule-based parser does —
and drops a record that still has no title. Everything else stays strict: a hallucinated field or a
malformed year is still rejected with its path.

## Failure handling

`ExtractorError` carries an HTTP status that the route passes through:

| Situation | Status | Shown to the reviewer |
| --- | --- | --- |
| No API key configured | 500 | "Set it in .env, or use AI_PROVIDER=mock" |
| Provider unreachable / timeout (90s) | 504 | "Could not reach …" |
| 401 / 403 from the provider | 502 | "Check the API key in your .env file" |
| 429 | 502 | "Rate limited by the provider" |
| Reply is not JSON | 502 | "Model reply was not valid JSON" |
| Reply does not match the schema | 422 | the failing field paths |
| Not enough credit for `max_tokens` | 502 | "Add credit, or lower OPENROUTER_MAX_TOKENS" |

Provider response bodies are never echoed back to the browser — they can contain the prompt, and
the prompt contains the CV.

## Adding a provider

1. Create `src/lib/ai/<name>.ts` returning an `Extractor`. If the service is OpenAI-compatible,
   wrap `createCompatibleExtractor`; otherwise implement `extract` and validate the reply with
   `ExtractionResultSchema.safeParse`.
2. Add the name to the union in `types.ts` and a case in `getExtractor()`.
3. Add its variables to `.env.example` and a getter in `src/lib/env.ts`.

No other file changes.

## Cost and privacy

- CV text is sent to the configured provider. With `mock`, nothing leaves the machine.
- Input is capped by `MAX_CV_CHARS` (default 20,000) per request.
- Keys are read from `process.env` on the server only and are never sent to the browser.
