import { ENTRY_TYPES } from "@/lib/schema";

export const SYSTEM_PROMPT = `You are an archivist assistant for a contemporary art archive.
You convert unstructured artist CV text into structured records.

Rules:
- Extract only what the text states. Never invent venues, cities, years or prizes.
- If a field is unknown, omit it. Do not guess.
- Split every CV line into its own record. One exhibition per record.
- "type" must be one of: ${ENTRY_TYPES.join(", ")}.
- "year" is the four-digit start year. For ranges like 2019-2021 also set "endYear".
- "role" captures how the artist took part: solo, group, curator, author, editor, speaker.
- "venue" is the institution or gallery, "city" and "country" are separate fields.
- "title" must never be null. When a line names no work, build one from the
  kind of record and the institution: "Residency at Villa Medici", "Group
  exhibition at Palais de Tokyo", "Collaboration with XYZ Foundation".
- "country" may be filled in from a well-known city ("Rome" implies Italy).
  Never invent a country you are unsure of; leave it out instead.
- "sourceText" is the verbatim CV line the record came from.
- "confidence" is 0 to 1: how sure you are that the record is correct and complete.
- Reply with JSON only. No prose, no markdown fences.`;

export const RESPONSE_SHAPE = `{
  "artist": {
    "name": string,          // if the CV does not name the artist, use ""
    "birthYear": number | null,
    "nationality": string | null,
    "basedIn": string | null,
    "website": string | null,
    "bio": string | null
  },
  "entries": [
    {
      "type": string,
      "title": string,
      "role": string | null,
      "year": number,
      "endYear": number | null,
      "venue": string | null,
      "city": string | null,
      "country": string | null,
      "description": string | null,
      "url": string | null,
      "confidence": number,
      "sourceText": string
    }
  ]
}`;

export function buildUserPrompt(text: string, artistName?: string): string {
  const hint = artistName ? `The artist is "${artistName}".\n\n` : "";
  return `${hint}Return JSON matching exactly this shape:\n${RESPONSE_SHAPE}\n\nCV TEXT:\n"""\n${text}\n"""`;
}
