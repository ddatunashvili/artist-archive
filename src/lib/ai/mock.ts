import { ExtractionResultSchema, type EntryType, type ExtractionResult } from "@/lib/schema";
import type { ExtractInput, Extractor } from "./types";

/**
 * Deterministic, offline extractor.
 *
 * It is a real rule-based CV parser, not a stub: section headers set the
 * record type, and each line is split into year / title / venue / city /
 * country. It exists so the archive runs with no API key, and so the review
 * UI can be exercised in tests and demos without network calls.
 */

const SECTION_RULES: { pattern: RegExp; type: EntryType; role?: string }[] = [
  { pattern: /\bsolo\b.*\b(exhibition|show|presentation)/i, type: "exhibition", role: "solo" },
  { pattern: /\b(group|two[- ]person|duo)\b.*\b(exhibition|show)/i, type: "exhibition", role: "group" },
  { pattern: /\b(exhibition|show)s?\b/i, type: "exhibition" },
  { pattern: /\b(biennial|biennale|triennial)s?\b/i, type: "exhibition" },
  { pattern: /\b(publication|bibliography|catalogue|catalog|book|press|writing)s?\b/i, type: "publication" },
  { pattern: /\b(award|grant|prize|fellowship|honou?r|nomination)s?\b/i, type: "award" },
  { pattern: /\bresidenc(y|ies)\b/i, type: "residency" },
  { pattern: /\b(education|studies|academic|training)\b/i, type: "education" },
  { pattern: /\bcollections?\b/i, type: "collection" },
  { pattern: /\b(screening|film|video programme|program)s?\b/i, type: "screening" },
  { pattern: /\b(talk|lecture|panel|symposium|conference|teaching)s?\b/i, type: "talk" },
  { pattern: /\bperformances?\b/i, type: "performance" },
];

// Enough coverage for CV tails; anything unmatched simply stays part of the venue.
const COUNTRIES = new Set(
  [
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
  ],
);

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

function looksLikeHeader(line: string): boolean {
  if (/\d{4}/.test(line)) return false;
  if (line.length > 60) return false;
  const stripped = line.replace(/[^a-z]/gi, "");
  if (stripped.length < 3) return false;
  const isUpper = stripped === stripped.toUpperCase();
  return isUpper || SECTION_RULES.some((rule) => rule.pattern.test(line));
}

function matchSection(line: string): { type: EntryType; role?: string } | null {
  for (const rule of SECTION_RULES) {
    if (rule.pattern.test(line)) return { type: rule.type, role: rule.role };
  }
  return null;
}

function detectRole(line: string): string | undefined {
  const parenthetical = /\(([^)]{2,40})\)\s*$/.exec(line);
  const haystack = parenthetical ? parenthetical[1] : line;
  for (const hint of ROLE_HINTS) {
    if (hint.pattern.test(haystack)) return hint.role;
  }
  return undefined;
}

/** Splits "Title, Venue, City, Country" into its parts, right to left. */
function splitPlace(rest: string): {
  title: string;
  venue?: string;
  city?: string;
  country?: string;
} {
  const parts = rest
    .split(/\s*[,;]\s*|\s+[–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { title: rest.trim() };

  let country: string | undefined;
  if (parts.length > 1 && COUNTRIES.has(parts[parts.length - 1].toLowerCase())) {
    country = parts.pop();
  }

  const title = parts.shift() ?? rest.trim();
  let city: string | undefined;
  let venue: string | undefined;

  if (parts.length === 1) {
    // "Title, Venue" or, when a country was present, "Title, City".
    if (country) city = parts[0];
    else venue = parts[0];
  } else if (parts.length >= 2) {
    city = parts.pop();
    venue = parts.join(", ");
  }

  return { title, venue, city, country };
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
  let currentType: EntryType = "other";
  let currentRole: string | undefined;
  let sectionKnown = false;

  const entries: ExtractionResult["entries"] = [];

  for (let index = header.consumed; index < lines.length; index += 1) {
    const line = lines[index];

    if (looksLikeHeader(line)) {
      const section = matchSection(line);
      if (section) {
        currentType = section.type;
        currentRole = section.role;
        sectionKnown = true;
      } else {
        currentType = "other";
        currentRole = undefined;
        sectionKnown = false;
      }
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
    const endYear = endYearRaw && /^\d{4}$/.test(endYearRaw) ? Number.parseInt(endYearRaw, 10) : undefined;

    let rest = yearMatch ? line.slice(yearMatch[0].length) : line.replace(loose![0], "").trim();
    const url = URL_IN_TEXT.exec(rest)?.[0];
    if (url) rest = rest.replace(url, "").trim();

    const role = detectRole(line) ?? currentRole;
    rest = rest.replace(/\s*\((solo|group|two[- ]person|duo)\)\s*$/i, "").trim();
    rest = rest.replace(/^[,;.\-–—\s]+/, "");
    if (!rest) continue;

    const place = splitPlace(rest);
    if (!place.title) continue;

    let confidence = 0.55;
    if (sectionKnown) confidence += 0.15;
    if (place.venue) confidence += 0.1;
    if (place.city) confidence += 0.1;
    if (place.country) confidence += 0.05;
    if (yearMatch) confidence += 0.05;

    entries.push({
      type: currentType,
      title: place.title,
      role,
      year,
      endYear,
      venue: place.venue,
      city: place.city,
      country: place.country,
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
