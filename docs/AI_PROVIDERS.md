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
base URL, model id and headers. Requests use `temperature: 0` and, where supported,
`response_format: { type: "json_object" }`; replies are fence-stripped before parsing because not
every routed model honours JSON mode.

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
