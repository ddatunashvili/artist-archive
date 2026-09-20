import { ExtractionResultSchema, type EntryType, type ExtractionResult } from "@/lib/schema";
import { countryForCity, isKnownCity } from "./places";
import type { ExtractInput, Extractor } from "./types";

/**
 * Deterministic, offline extractor.
 *
 * A real rule-based CV parser, not a stub. It handles the two shapes artist
 * CVs actually arrive in:
 *
 *   sectioned    SOLO EXHIBITIONS
 *                2025 Hard Water, Kunstverein München, Munich, Germany
 *
 *   prose        2019 — Residency at Villa Medici, Rome
 *                2020 — Group exhibition at Palais de Tokyo, Paris
 *
 * In the first the record type comes from the section header; in the second it
 * is stated inline and the institution follows "at" or "with". Both end up as
 * the same structured record.
 *
 * It exists so the archive runs with no API key, so the review UI can be
 * exercised deterministically, and so there is a baseline to compare a model's
 * output against.
 */

/**
 * Type markers that appear inside a line rather than as a section header.
 * Order matters: the most specific phrase wins, so "group exhibition" is not
 * read as a plain "exhibition".
 */
const INLINE_TYPE_RULES: { pattern: RegExp; type: EntryType; role?: string }[] = [
  { pattern: /\bsolo\s+(?:exhibition|show|presentation)\b/i, type: "exhibition", role: "solo" },
  {
    pattern: /\b(?:group|two[- ]person|duo)\s+(?:exhibition|show)\b/i,
    type: "exhibition",
    role: "group",
  },
  { pattern: /\bartist[- ]in[- ]residence\b|\bresidenc(?:y|ies)\b/i, type: "residency" },
  { pattern: /\bcollaborat(?:ion|ed|ing|ive)\b|\bpartnership\b/i, type: "collaboration" },
  { pattern: /\bcommission(?:ed|s)?\b/i, type: "commission" },
  { pattern: /\b(?:biennial|biennale|triennial|art fair)\b/i, type: "exhibition" },
  { pattern: /\b(?:exhibition|showcase)\b/i, type: "exhibition" },
  { pattern: /\b(?:award|prize|grant|fellowship|nomination|bursary)\b/i, type: "award" },
  { pattern: /\b(?:publication|catalogue|catalog|monograph|essay)\b/i, type: "publication" },
  { pattern: /\b(?:screening|film festival)\b/i, type: "screening" },
  { pattern: /\b(?:artist talk|lecture|panel|symposium|keynote|conference)\b/i, type: "talk" },
  { pattern: /\bperformance\b/i, type: "performance" },
  { pattern: /\b(?:MFA|BFA|PhD|diploma|postgraduate)\b/, type: "education" },
  { pattern: /\b(?:acquired|acquisition|permanent collection)\b/i, type: "collection" },
];

/** Section headers, which set the type for every line beneath them. */
const SECTION_RULES: { pattern: RegExp; type: EntryType; role?: string }[] = [
  { pattern: /\bsolo\b.*\b(exhibition|show|presentation)/i, type: "exhibition", role: "solo" },
  {
    pattern: /\b(group|two[- ]person|duo)\b.*\b(exhibition|show)/i,
    type: "exhibition",
    role: "group",
  },
  { pattern: /\b(exhibition|show)s?\b/i, type: "exhibition" },
  { pattern: /\b(biennial|biennale|triennial)s?\b/i, type: "exhibition" },
  { pattern: /\bcollaborations?\b/i, type: "collaboration" },
  { pattern: /\bcommissions?\b/i, type: "commission" },
  {
    pattern: /\b(publication|bibliography|catalogue|catalog|book|press|writing)s?\b/i,
    type: "publication",
  },
  { pattern: /\b(award|grant|prize|fellowship|honou?r|nomination)s?\b/i, type: "award" },
  { pattern: /\bresidenc(y|ies)\b/i, type: "residency" },
  { pattern: /\b(education|studies|academic|training)\b/i, type: "education" },
  { pattern: /\bcollections?\b/i, type: "collection" },
  { pattern: /\b(screening|film|video programme|program)s?\b/i, type: "screening" },
  { pattern: /\b(talk|lecture|panel|symposium|conference|teaching)s?\b/i, type: "talk" },
  { pattern: /\bperformances?\b/i, type: "performance" },
];

// Enough coverage for CV tails; anything unmatched simply stays part of the venue.
const COUNTRIES = new Set([
  "afghanistan", "albania", "algeria", "argentina", "armenia", "australia", "austria",
  "azerbaijan", "bangladesh", "belarus", "belgium", "bolivia", "bosnia", "brazil",
  "bulgaria", "cambodia", "canada", "chile", "china", "colombia", "croatia", "cuba",
  "cyprus", "czech republic", "czechia", "denmark", "ecuador", "egypt", "estonia",
  "ethiopia", "finland", "france", "georgia", "germany", "ghana", "greece", "hungary",
  "iceland", "india", "indonesia", "iran", "iraq", "ireland", "israel", "italy",
  "japan", "jordan", "kazakhstan", "kenya", "korea", "south korea", "kosovo", "kuwait",
  "latvia", "lebanon", "lithuania", "luxembourg", "malaysia", "mexico", "moldova",
  "mongolia", "montenegro", "morocco", "netherlands", "new zealand", "nigeria",
  "north macedonia", "norway", "pakistan", "palestine", "peru", "philippines",
  "poland", "portugal", "qatar", "romania", "russia", "saudi arabia", "senegal",
  "serbia", "singapore", "slovakia", "slovenia", "south africa", "spain", "sweden",
  "switzerland", "taiwan", "thailand", "tunisia", "turkey", "türkiye", "uae",
  "uganda", "ukraine", "united arab emirates", "united kingdom", "uk",
  "united states", "usa", "us", "uruguay", "uzbekistan", "venezuela", "vietnam",
]);

const ROLE_HINTS: { pattern: RegExp; role: string }[] = [
  { pattern: /\bsolo\b/i, role: "solo" },
  { pattern: /\b(group|two[- ]person|duo)\b/i, role: "group" },
  { pattern: /\bcurat(ed|or)\b/i, role: "curator" },
  { pattern: /\b(author|written by)\b/i, role: "author" },
  { pattern: /\beditor\b/i, role: "editor" },
  { pattern: /\b(speaker|keynote|panellist|panelist)\b/i, role: "speaker" },
];

const YEAR_PREFIX = /^\s*\(?(\d{4})\s*(?:[–—‑-]\s*(\d{4}|present|ongoing))?\)?\s*[.,:;|\t-]*\s*/i;
const URL_IN_TEXT = /\bhttps?:\/\/\S+|\bwww\.[^\s,;]+/i;

/** "Residency at Villa Medici, Rome" -> descriptor, connector, remainder. */
const AT_INSTITUTION = /^(.*?)\s+(at|with|for)\s+(.+)$/i;

/** A quoted work title anywhere in the line. */
const QUOTED_TITLE = /[“‘"](.+?)[”’"]/;

function matchInlineType(line: string): { type: EntryType; role?: string } | null {
  for (const rule of INLINE_TYPE_RULES) {
    if (rule.pattern.test(line)) return { type: rule.type, role: rule.role };
  }
  return null;
}

function matchSection(line: string): { type: EntryType; role?: string } | null {
  for (const rule of SECTION_RULES) {
    if (rule.pattern.test(line)) return { type: rule.type, role: rule.role };
  }
  return null;
}

function looksLikeHeader(line: string): boolean {
  if (/\d{4}/.test(line)) return false;
  if (line.length > 60) return false;
  const stripped = line.replace(/[^a-z]/gi, "");
  if (stripped.length < 3) return false;
  const isUpper = stripped === stripped.toUpperCase();
  return isUpper || SECTION_RULES.some((rule) => rule.pattern.test(line));
}

function detectRole(line: string): string | undefined {
  const parenthetical = /\(([^)]{2,40})\)\s*$/.exec(line);
  const haystack = parenthetical ? parenthetical[1] : line;
  for (const hint of ROLE_HINTS) {
    if (hint.pattern.test(haystack)) return hint.role;
  }
  return undefined;
}

type Place = {
  city?: string;
  country?: string;
  /** True when the country came from the city lookup, not from the CV. */
  countryInferred: boolean;
  /** Anything before the place that was not consumed. */
  remainder: string[];
};

/**
 * Reads a place off the end of a comma-separated tail.
 *
 * A country is only taken when it is named; a city is only taken when it is
 * one we know, so an unrecognised trailing word stays part of the venue rather
 * than being invented into a location. When the CV gives a city but no country
 * the country is looked up — that is a fact about the world, not a guess about
 * the artist — and flagged as inferred.
 */
function readPlace(parts: string[], keepAtLeast: number): Place {
  const remainder = [...parts];
  let country: string | undefined;
  let city: string | undefined;

  const last = () => remainder[remainder.length - 1];

  if (remainder.length > keepAtLeast && COUNTRIES.has(last().toLowerCase())) {
    country = remainder.pop();
  }
  if (remainder.length > keepAtLeast && (country !== undefined || isKnownCity(last()))) {
    city = remainder.pop();
  }

  let countryInferred = false;
  if (!country && city) {
    const looked = countryForCity(city);
    if (looked) {
      country = looked;
      countryInferred = true;
    }
  }

  return { city, country, countryInferred, remainder };
}

type ParsedLine = {
  title: string;
  venue?: string;
  city?: string;
  country?: string;
  countryInferred: boolean;
  /** Type stated in the line itself, if any. */
  inline?: { type: EntryType; role?: string };
};

/**
 * Prose form: "<descriptor> at|with <institution>, <city>[, <country>]".
 *
 * Only accepted when the descriptor is itself a type phrase, so an ordinary
 * title containing the word "at" is not torn apart.
 */
function parseProseForm(rest: string): ParsedLine | null {
  const match = AT_INSTITUTION.exec(rest);
  if (!match) return null;

  const [, descriptor, connector, tail] = match;
  const inline = matchInlineType(descriptor);
  if (!inline) return null;

  const parts = tail
    .split(/\s*[,;]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  // Keep at least the institution.
  const place = readPlace(parts, 1);
  const venue = place.remainder.join(", ") || undefined;
  if (!venue) return null;

  const quoted = QUOTED_TITLE.exec(rest)?.[1]?.trim();

  return {
    title: quoted || `${descriptor.trim()} ${connector.toLowerCase()} ${venue}`,
    venue,
    city: place.city,
    country: place.country,
    countryInferred: place.countryInferred,
    inline,
  };
}

/** Sectioned form: "Title, Venue, City, Country". */
function parseListForm(rest: string): ParsedLine | null {
  const parts = rest
    .split(/\s*[,;]\s*|\s+[–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  // Keep at least the title.
  const place = readPlace(parts, 1);
  const title = place.remainder.shift();
  if (!title) return null;

  return {
    title,
    venue: place.remainder.join(", ") || undefined,
    city: place.city,
    country: place.country,
    countryInferred: place.countryInferred,
  };
}

function parseArtistHeader(lines: string[]): {
  name?: string;
  birthYear?: number;
  nationality?: string;
  basedIn?: string;
  website?: string;
  bio?: string;
  consumed: number;
} {
  const result: ReturnType<typeof parseArtistHeader> = { consumed: 0 };
  const bioParts: string[] = [];

  for (let index = 0; index < Math.min(lines.length, 8); index += 1) {
    const line = lines[index];
    if (matchSection(line) && looksLikeHeader(line)) break;

    const born = /\bb(?:orn)?\.?\s*(\d{4})(?:\s+in\s+([^.;]+))?/i.exec(line);
    const based = /\blives?(?:\s+and\s+works?)?\s+in\s+([^.;]+)/i.exec(line);
    const url = URL_IN_TEXT.exec(line);

    if (!result.name && !born && !based && !url && !/\d{4}/.test(line) && line.length < 80) {
      result.name = line.replace(/[,.]$/, "").trim();
      result.consumed = index + 1;
      continue;
    }
    if (born) {
      result.birthYear = Number.parseInt(born[1], 10);
      if (born[2]) {
        const place = born[2].trim();
        result.nationality = place.split(",").pop()?.trim();
      }
      result.consumed = index + 1;
    }
    if (based) {
      result.basedIn = based[1].trim().replace(/[.,]$/, "");
      result.consumed = index + 1;
    }
    if (url) {
      result.website = url[0];
      result.consumed = index + 1;
    }
    if (born || based) bioParts.push(line.trim());
  }

  if (bioParts.length) result.bio = bioParts.join(" ");
  return result;
}

export function parseCv(text: string, artistName?: string): ExtractionResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const header = parseArtistHeader(lines);
  let sectionType: EntryType = "other";
  let sectionRole: string | undefined;
  let sectionKnown = false;

  const entries: ExtractionResult["entries"] = [];

  for (let index = header.consumed; index < lines.length; index += 1) {
    const line = lines[index];

    if (looksLikeHeader(line)) {
      const section = matchSection(line);
      sectionType = section?.type ?? "other";
      sectionRole = section?.role;
      sectionKnown = section !== null;
      continue;
    }

    const yearMatch = YEAR_PREFIX.exec(line);
    const loose = yearMatch ? null : /\b(\d{4})\b/.exec(line);
    const year = yearMatch
      ? Number.parseInt(yearMatch[1], 10)
      : loose
        ? Number.parseInt(loose[1], 10)
        : undefined;
    if (year === undefined) continue;

    const endYearRaw = yearMatch?.[2];
    const endYear =
      endYearRaw && /^\d{4}$/.test(endYearRaw) ? Number.parseInt(endYearRaw, 10) : undefined;

    let rest = yearMatch ? line.slice(yearMatch[0].length) : line.replace(loose![0], "").trim();
    const url = URL_IN_TEXT.exec(rest)?.[0];
    if (url) rest = rest.replace(url, "").trim();

    rest = rest.replace(/\s*\((solo|group|two[- ]person|duo)\)\s*$/i, "").trim();
    // Leading separators left by "2019 — ..." and friends.
    rest = rest.replace(/^[,;.:\-–—\s]+/, "");
    if (!rest) continue;

    const parsed = parseProseForm(rest) ?? parseListForm(rest);
    if (!parsed || !parsed.title) continue;

    const type = parsed.inline?.type ?? sectionType;
    const role = detectRole(line) ?? parsed.inline?.role ?? sectionRole;

    let confidence = 0.55;
    if (sectionKnown || parsed.inline) confidence += 0.15;
    if (parsed.venue) confidence += 0.1;
    if (parsed.city) confidence += 0.1;
    if (parsed.country) confidence += parsed.countryInferred ? 0.02 : 0.05;
    if (yearMatch) confidence += 0.05;

    entries.push({
      type,
      title: parsed.title,
      role,
      year,
      endYear,
      venue: parsed.venue,
      city: parsed.city,
      country: parsed.country,
      url,
      description: undefined,
      confidence: Math.min(0.95, Number(confidence.toFixed(2))),
      sourceText: line,
    });
  }

  return ExtractionResultSchema.parse({
    artist: {
      name: artistName || header.name || "Untitled artist",
      birthYear: header.birthYear,
      nationality: header.nationality,
      basedIn: header.basedIn,
      website: header.website,
      bio: header.bio,
    },
    entries,
  });
}

export function createMockExtractor(): Extractor {
  return {
    name: "mock",
    model: null,
    async extract({ text, artistName }: ExtractInput) {
      return parseCv(text, artistName);
    },
  };
}
