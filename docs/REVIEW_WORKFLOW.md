# Human review workflow

The point of the prototype: **an AI proposes, a person decides.** Nothing reaches the public
catalogue automatically.

## Statuses

| Status | Meaning | Visible in catalogue |
| --- | --- | --- |
| `draft` | Saved, not yet submitted for review | No |
| `in_review` | Waiting for a decision | No |
| `published` | Approved by a named reviewer | Yes |
| `rejected` | Declined; kept for the record | No |

## Step 1 — Extraction produces a proposal, not a record

`POST /api/extract` runs the configured provider and returns candidate records. It performs **no
database writes at all**. If the model returns something that does not fit
`ExtractionResultSchema`, the request fails with `422` and the field errors, and the reviewer sees
them rather than a half-filled form.

Each candidate carries:

- `sourceText` — the verbatim CV line it came from
- `confidence` — 0–1, from the model or from the mock parser's own heuristics
- the provider name, stored as `extractedBy`

## Step 2 — The reviewer corrects the proposal

On `/import`, every candidate is an editable row. The reviewer can:

- fix any field (type, title, role, year, end year, venue, city, country, link, description)
- untick a row so it is never written
- edit the artist record the extractor inferred

Each row is validated live against `ExtractedEntrySchema`; the error appears under the row.
The source CV line is shown beneath every row, so a correction can be checked against the original
without leaving the page.

Then the reviewer chooses:

- **Save to review queue** → everything is stored as `in_review`
- **Approve & publish** → stored as `published`, and a reviewer name is **required**

## Step 3 — The queue is a second pair of eyes

`/review` lists everything in `in_review` and `draft`, newest first, with the confidence score
flagged when it is below 70%. A reviewer enters their name once, then publishes or rejects each
record, optionally with a note.

`PATCH /api/entries/[id]` refuses `status: "published"` without `reviewedBy`. The name and
timestamp are stamped onto the record, and both are shown on the detail page under *Provenance*.

## Gates, in order

1. `ExtractRequestSchema` — input length and shape
2. `ExtractionResultSchema` — the model's reply must match the archive schema
3. Browser-side `PublishRequestSchema` — the reviewer sees problems next to the fields
4. Server-side `PublishRequestSchema` — the API never trusts the client
5. Reviewer name required for any transition to `published`

## Suggested policy for real use

The prototype does not enforce these; they are the obvious next step once accounts exist.

- Require a different reviewer at step 3 than the one who imported at step 2.
- Auto-route anything below a confidence threshold to the queue instead of allowing direct publish.
- Keep `rejected` records rather than deleting them, so the same bad line is not re-imported twice.
