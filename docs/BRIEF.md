# The brief, answered

The request was to show an approach: how AI turns an unstructured CV into
structured content, what the data structure is, and what a browsable catalogue
and detail page look like.

## The reference case

```
2019 — Residency at Villa Medici, Rome
2020 — Group exhibition at Palais de Tokyo, Paris
2021 — Collaboration with XYZ Foundation, London
2022 — Solo exhibition at Gallery ABC, Berlin
```

That file is [`public/brief-cv.txt`](../public/brief-cv.txt). Paste it into
`/admin/import`, or press **Load short example**, and the extractor returns:

| year | type | role | title | venue (institution) | city | country |
| --- | --- | --- | --- | --- | --- | --- |
| 2019 | residency | — | Residency at Villa Medici | Villa Medici | Rome | Italy |
| 2020 | exhibition | group | Group exhibition at Palais de Tokyo | Palais de Tokyo | Paris | France |
| 2021 | collaboration | — | Collaboration with XYZ Foundation | XYZ Foundation | London | United Kingdom |
| 2022 | exhibition | solo | Solo exhibition at Gallery ABC | Gallery ABC | Berlin | Germany |

The same four records are seeded under the artist **Claire Vasseur**, so they
are in the archive on first run.

Three things are worth pointing at:

- **`type` and `role` are separate.** "Solo exhibition" and "Group exhibition"
  are the same kind of event with a different relationship to the artist.
  Collapsing them into two types would make "all exhibitions" unfilterable.
- **The institution is its own field**, not part of the title. A catalogue
  needs to count shows at Palais de Tokyo.
- **Country is inferred from the city.** The CV says "Rome", not "Italy". A
  city-to-country lookup is a fact about the world, so it is safe to infer,
  unlike a venue or a date. It is inferred, never guessed: an unrecognised city
  yields no country rather than a plausible-looking wrong one.

## What is extracted

```jsonc
{
  "artist": { "name", "birthYear", "nationality", "basedIn", "website", "bio" },
  "entries": [
    {
      "type",        // exhibition | residency | collaboration | commission |
                     // publication | award | education | collection |
                     // screening | talk | performance | other
      "role",        // solo | group | curator | author | editor | speaker
      "title",
      "year", "endYear",
      "venue",       // the institution
      "city", "country",
      "description",
      "url",
      "images": [{ "url", "alt", "credit" }],

      // provenance, attached to every record
      "confidence",  // 0-1
      "sourceText",  // the verbatim CV line
      "extractedBy"  // mock | openai | openrouter | manual
    }
  ]
}
```

The full contract is [`src/lib/schema.ts`](../src/lib/schema.ts) as Zod
schemas, which are also the runtime validation — the types and the checks
cannot drift apart.

## What is automated, and what is not

**Automated.** Splitting the text into records, classifying the type, pulling
out year / institution / city, deriving role, resolving country from city,
normalising `"1998"`, `1998` and `"1998–2000"` into a year and an end year, and
discarding `"n/a"`.

**Not automated.** Publishing. Extraction writes nothing: `POST /api/extract`
returns candidates, a human corrects them, and only then are they stored.
Publishing requires a reviewer's name, which is kept on the record. Anything
the model returns that does not match the schema is rejected with field paths
rather than quietly stored.

**Not attempted.** Images. A CV has none, so they are an archivist's job; the
model is never asked to find them. Records without one show a generated cover,
marked "no image yet" so the gap is visible rather than disguised.

## Where the AI sits

`AI_PROVIDER` selects one of three implementations behind a single interface
([`docs/AI_PROVIDERS.md`](AI_PROVIDERS.md)):

- `openai` and `openrouter` — a real model, prompted for JSON at temperature 0
- `mock` — a rule-based parser, no key and no network

`mock` is the default deliberately. It handles both CV shapes (prose lines as
above, and sectioned CVs with `SOLO EXHIBITIONS` headers), it is deterministic
so the review UI can be tested, and it is the baseline a model has to beat. The
seams are identical: both return the same validated `ExtractionResult`, and
every record stores which one produced it.

## The pages

| Page | What it is |
| --- | --- |
| `/` | Visual catalogue. Card grid by default, dense index view as an alternative, filters by type, year, country, city, artist and free text — all in the URL, so any view is linkable |
| `/entries/[id]` | One experience: images, description, every field, and the CV line it came from |
| `/artists/[slug]` | One artist's records, grouped back into CV sections |
| `/admin` | Dashboard, CRUD, review queue, CV import |

## What I would do next

- Image upload rather than URLs, with derivative sizes.
- A confidence threshold that routes low-scoring records straight to review.
- Per-user accounts, so "reviewed by" is an identity rather than a typed name.
- Deduplication on import: the same show listed in two CVs should merge.
- The country lookup is a hardcoded list; a gazetteer would cover the tail.
