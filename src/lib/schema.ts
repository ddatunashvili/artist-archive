import { z } from "zod";

/**
 * The contract between the AI extractor, the human review step and the
 * database. Anything the model returns must survive these schemas before a
 * reviewer ever sees it, and again before it is written.
 */

export const ENTRY_TYPES = [
  "exhibition",
  "publication",
  "award",
  "residency",
  "education",
  "collection",
  "screening",
  "talk",
  "performance",
  "other",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  exhibition: "Exhibition",
  publication: "Publication",
  award: "Award & Grant",
  residency: "Residency",
  education: "Education",
  collection: "Collection",
  screening: "Screening",
  talk: "Talk & Lecture",
  performance: "Performance",
  other: "Other",
};

export const ENTRY_STATUSES = ["draft", "in_review", "published", "rejected"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  rejected: "Rejected",
};

const MIN_YEAR = 1000;
const MAX_YEAR = new Date().getFullYear() + 5;

/** Trims strings and turns "", "n/a", "unknown" and null into undefined. */
const optionalText = (max = 500) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (trimmed === "" || /^(n\/?a|unknown|null|none)$/i.test(trimmed)) return undefined;
    return trimmed;
  }, z.string().max(max).optional());

/** Accepts 1998, "1998", "1998–2000" (takes the first year) or nothing. */
const yearValue = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Math.trunc(value);
  if (typeof value === "string") {
    const match = /\d{4}/.exec(value);
    return match ? Number.parseInt(match[0], 10) : undefined;
  }
  return value;
}, z.number().int().min(MIN_YEAR).max(MAX_YEAR).optional());

const urlValue = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().url().max(500).optional());

const entryTypeValue = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalised = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, EntryType> = {
    solo_exhibition: "exhibition",
    group_exhibition: "exhibition",
    show: "exhibition",
    exhibitions: "exhibition",
    book: "publication",
    catalogue: "publication",
    press: "publication",
    grant: "award",
    prize: "award",
    fellowship: "award",
    residencies: "residency",
    degree: "education",
    studies: "education",
    public_collection: "collection",
    film: "screening",
    lecture: "talk",
    artist_talk: "talk",
    panel: "talk",
  };
  return aliases[normalised] ?? normalised;
}, z.enum(ENTRY_TYPES).catch("other"));

/** A single record as proposed by the extractor. */
export const ExtractedEntrySchema = z.object({
  type: entryTypeValue,
  title: z.string().trim().min(1, "Title is required").max(300),
  role: optionalText(120),
  year: yearValue.refine((value) => value !== undefined, { message: "Year is required" }),
  endYear: yearValue,
  venue: optionalText(200),
  city: optionalText(120),
  country: optionalText(120),
  description: optionalText(2000),
  url: urlValue,
  confidence: z.preprocess(
    (value) => (typeof value === "string" ? Number.parseFloat(value) : value),
    z.number().min(0).max(1).optional(),
  ),
  sourceText: optionalText(1000),
});

export type ExtractedEntry = z.infer<typeof ExtractedEntrySchema>;

export const ExtractedArtistSchema = z.object({
  name: z.string().trim().min(1, "Artist name is required").max(200),
  birthYear: yearValue,
  deathYear: yearValue,
  nationality: optionalText(120),
  basedIn: optionalText(120),
  website: urlValue,
  bio: optionalText(3000),
});

export type ExtractedArtist = z.infer<typeof ExtractedArtistSchema>;

/** What an AI provider must return, before any human sees it. */
export const ExtractionResultSchema = z.object({
  artist: ExtractedArtistSchema,
  entries: z.array(ExtractedEntrySchema).max(500),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** Request body for POST /api/extract */
export const ExtractRequestSchema = z.object({
  text: z.string().trim().min(20, "Paste at least a few lines of CV text").max(100_000),
  artistName: optionalText(200),
});

/** Request body for POST /api/entries - the reviewed, human-approved payload. */
export const PublishRequestSchema = z.object({
  artist: ExtractedArtistSchema,
  entries: z.array(ExtractedEntrySchema).min(1, "Keep at least one entry"),
  /// Reviewer decision for the whole batch. Nothing reaches the public
  /// catalogue unless this is explicitly "published".
  status: z.enum(ENTRY_STATUSES).default("in_review"),
  reviewedBy: optionalText(120),
  reviewNote: optionalText(1000),
  extractedBy: optionalText(40),
});

export type PublishRequest = z.infer<typeof PublishRequestSchema>;

/** Request body for PATCH /api/entries/[id] - single-record review action. */
export const EntryReviewSchema = z.object({
  status: z.enum(ENTRY_STATUSES).optional(),
  reviewedBy: optionalText(120),
  reviewNote: optionalText(1000),
  patch: ExtractedEntrySchema.partial().optional(),
});

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Flattens a ZodError into `field path -> message` pairs for the review UI. */
export function fieldErrors(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
