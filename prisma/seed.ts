/**
 * Seeds a browsable demo archive.
 *
 * Three artists are written out by hand, so the catalogue reads like a real
 * archive rather than generated filler. The rest are composed from name,
 * venue and city pools by a seeded pseudo-random generator, which gives the
 * dashboard enough volume to show distributions while keeping every run
 * byte-for-byte identical.
 *
 * All artists, works and institutions here are fictional.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/schema";

const prisma = new PrismaClient();

type SeedEntry = {
  type: string;
  title: string;
  role?: string;
  year: number;
  endYear?: number;
  venue?: string;
  city?: string;
  country?: string;
  description?: string;
  url?: string;
  status?: string;
  confidence?: number;
  sourceText?: string;
  extractedBy?: string;
  reviewNote?: string;
};

type SeedArtist = {
  name: string;
  birthYear?: number;
  nationality?: string;
  basedIn?: string;
  website?: string;
  bio?: string;
  entries: SeedEntry[];
};

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

/** mulberry32: small, fast, and identical on every machine and run. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260921);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const chance = (probability: number) => random() < probability;
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

/* ------------------------------------------------------------------ */
/* Pools                                                               */
/* ------------------------------------------------------------------ */

const PLACES = [
  { venue: "Kunsthalle Basel", city: "Basel", country: "Switzerland" },
  { venue: "Stedelijk Museum", city: "Amsterdam", country: "Netherlands" },
  { venue: "Bergen Kunsthall", city: "Bergen", country: "Norway" },
  { venue: "Museion", city: "Bolzano", country: "Italy" },
  { venue: "Kunstverein München", city: "Munich", country: "Germany" },
  { venue: "Hebbel am Ufer", city: "Berlin", country: "Germany" },
  { venue: "Haus der Kulturen der Welt", city: "Berlin", country: "Germany" },
  { venue: "De Appel", city: "Amsterdam", country: "Netherlands" },
  { venue: "Mori Art Museum", city: "Tokyo", country: "Japan" },
  { venue: "Tokyo Arts and Space", city: "Tokyo", country: "Japan" },
  { venue: "Kumu Art Museum", city: "Tallinn", country: "Estonia" },
  { venue: "Rupert", city: "Vilnius", country: "Lithuania" },
  { venue: "Tbilisi History Museum", city: "Tbilisi", country: "Georgia" },
  { venue: "Galleria Franco Noero", city: "Turin", country: "Italy" },
  { venue: "CAC Málaga", city: "Málaga", country: "Spain" },
  { venue: "Museo Reina Sofía", city: "Madrid", country: "Spain" },
  { venue: "Gulbenkian Foundation", city: "Lisbon", country: "Portugal" },
  { venue: "Galeria Filomena Soares", city: "Lisbon", country: "Portugal" },
  { venue: "Kunsthal Charlottenborg", city: "Copenhagen", country: "Denmark" },
  { venue: "Cité internationale des arts", city: "Paris", country: "France" },
  { venue: "Palais de Tokyo", city: "Paris", country: "France" },
  { venue: "Benaki Museum", city: "Athens", country: "Greece" },
  { venue: "Hydra School Projects", city: "Hydra", country: "Greece" },
  { venue: "SALT Beyoğlu", city: "Istanbul", country: "Türkiye" },
  { venue: "Kunstverein Hamburg", city: "Hamburg", country: "Germany" },
] as const;

const TITLE_A = [
  "Slow", "Hard", "Dry", "Soft", "Wet", "Long", "Second", "Minor", "Quiet", "Counter",
  "Low", "Open", "Close", "Far", "Late", "Blind", "Salt", "Paper", "Iron", "Field",
];

const TITLE_B = [
  "Signal", "Water", "Season", "Index", "Archive", "Draft", "Hours", "Register", "Weather",
  "Ground", "Light", "Passage", "Notes", "Margin", "Record", "Interval", "Shore", "Cut",
  "Inventory", "Repair",
];

const FIRST_NAMES = [
  "Nino", "Mateo", "Ayaka", "Lena", "Ivo", "Selin", "Tomás", "Hana", "Noor", "Elias",
  "Marta", "Ruben", "Iris", "Kostas", "Amara", "Jonas", "Vera", "Dario", "Freja", "Yusuf",
];

const LAST_NAMES = [
  "Abashidze", "Ferrán", "Morioka", "Marchetti", "Horvat", "Demir", "Rocha", "Nakamura",
  "Haddad", "Lindqvist", "Vasquez", "Oliveira", "Lehmann", "Pappas", "Okonkwo", "Brandt",
  "Ilić", "Costa", "Nielsen", "Karaca",
];

const ORIGINS = [
  { nationality: "Greece", basedIn: "Athens" },
  { nationality: "Germany", basedIn: "Berlin" },
  { nationality: "Portugal", basedIn: "Lisbon" },
  { nationality: "Japan", basedIn: "Tokyo" },
  { nationality: "Netherlands", basedIn: "Amsterdam" },
  { nationality: "Italy", basedIn: "Turin" },
  { nationality: "Georgia", basedIn: "Tbilisi" },
  { nationality: "Türkiye", basedIn: "Istanbul" },
  { nationality: "Sweden", basedIn: "Stockholm" },
  { nationality: "Spain", basedIn: "Madrid" },
];

const BIO_OPENERS = [
  "Works across sound, moving image and printed matter.",
  "Makes long-duration performances built from administrative routine.",
  "Casts industrial residue and photographs its slow collapse.",
  "Uses archival photography as unstable, decaying material.",
  "Builds low-power electronics for rooms rather than for screens.",
  "Writes, edits and occasionally exhibits the editing itself.",
];

const BIO_CLOSERS = [
  "The work treats the archive as something that drifts rather than holds.",
  "Recent projects circle repair, maintenance and the labour they hide.",
  "Each piece is made to change over the length of its exhibition.",
  "Documentation is treated as a medium, not as a by-product.",
  "The resulting records are deliberately incomplete.",
];

const AWARD_NAMES = [
  "Mondriaan Fonds Project Grant", "Premio Cairo", "Ars Viva Prize", "EDP Foundation Prize",
  "Tbilisi Contemporary Prize", "DAAD Fellowship", "Kone Foundation Grant", "Prix Découverte",
];

const JOURNALS = [
  "Spike Art Magazine", "Metropolis M", "Texte zur Kunst", "Frieze", "Mousse Magazine",
  "Roma Publications", "Sistema Solar", "Sternberg Press",
];

const SCHOOLS = [
  { venue: "Sandberg Instituut", city: "Amsterdam", country: "Netherlands" },
  { venue: "Städelschule", city: "Frankfurt", country: "Germany" },
  { venue: "Accademia Albertina", city: "Turin", country: "Italy" },
  { venue: "Tokyo University of the Arts", city: "Tokyo", country: "Japan" },
  { venue: "Athens School of Fine Arts", city: "Athens", country: "Greece" },
];

const WEIGHTED_TYPES = [
  ...Array<string>(9).fill("exhibition"),
  ...Array<string>(3).fill("publication"),
  ...Array<string>(3).fill("award"),
  ...Array<string>(2).fill("residency"),
  ...Array<string>(2).fill("talk"),
  "screening",
  "performance",
  "collection",
];

const REVIEWERS = ["archive editor", "m. ferrán", "a. morioka", "n. abashidze"];
const EXTRACTORS = [
  ...Array<string>(5).fill("manual"),
  ...Array<string>(4).fill("mock"),
  ...Array<string>(2).fill("openrouter"),
  "openai",
];

/* ------------------------------------------------------------------ */
/* Hand-written artists                                                */
/* ------------------------------------------------------------------ */

const FEATURED: SeedArtist[] = [
  {
    // The four lines from the original brief, parsed exactly as the extractor
    // reads them, so the reference case is visible in the archive on first run.
    name: "Claire Vasseur",
    birthYear: 1988,
    nationality: "France",
    basedIn: "Paris",
    bio: "Reference record set. Every entry below was produced from the four-line CV in public/brief-cv.txt, which you can paste back into the import page to reproduce them.",
    entries: [
      {
        type: "residency",
        title: "Residency at Villa Medici",
        year: 2019,
        venue: "Villa Medici",
        city: "Rome",
        country: "Italy",
        description:
          "Six-month studio residency at the French Academy in Rome. Country inferred from the city; the source line named only Rome.",
        status: "published",
        confidence: 0.87,
        sourceText: "2019 — Residency at Villa Medici, Rome",
        extractedBy: "mock",
      },
      {
        type: "exhibition",
        title: "Group exhibition at Palais de Tokyo",
        role: "group",
        year: 2020,
        venue: "Palais de Tokyo",
        city: "Paris",
        country: "France",
        status: "published",
        confidence: 0.92,
        sourceText: "2020 — Group exhibition at Palais de Tokyo, Paris",
        extractedBy: "mock",
      },
      {
        type: "collaboration",
        title: "Collaboration with XYZ Foundation",
        year: 2021,
        venue: "XYZ Foundation",
        city: "London",
        country: "United Kingdom",
        description: "Joint commission developed with the foundation's research programme.",
        status: "published",
        confidence: 0.87,
        sourceText: "2021 — Collaboration with XYZ Foundation, London",
        extractedBy: "mock",
      },
      {
        type: "exhibition",
        title: "Solo exhibition at Gallery ABC",
        role: "solo",
        year: 2022,
        venue: "Gallery ABC",
        city: "Berlin",
        country: "Germany",
        status: "published",
        confidence: 0.92,
        sourceText: "2022 — Solo exhibition at Gallery ABC, Berlin",
        extractedBy: "mock",
      },
    ],
  },
  {
    name: "Nino Abashidze",
    birthYear: 1986,
    nationality: "Georgia",
    basedIn: "Tbilisi",
    website: "https://example.org/nino-abashidze",
    bio: "Works with sound, archival photography and low-power electronics. Her installations treat the archive itself as unstable material, prone to drift and decay.",
    entries: [
      {
        type: "exhibition",
        title: "Slow Signal",
        role: "solo",
        year: 2024,
        venue: "Kunsthalle Basel",
        city: "Basel",
        country: "Switzerland",
        description:
          "Eight-channel sound installation built from degraded field recordings made along the Black Sea coast.",
        status: "published",
        confidence: 0.94,
        sourceText: "2024 Slow Signal, Kunsthalle Basel, Basel, Switzerland (solo)",
      },
      {
        type: "exhibition",
        title: "Weather and Other Documents",
        role: "group",
        year: 2023,
        venue: "Tbilisi History Museum",
        city: "Tbilisi",
        country: "Georgia",
        status: "published",
        confidence: 0.88,
      },
      {
        type: "residency",
        title: "Rupert Residency",
        year: 2021,
        endYear: 2022,
        venue: "Rupert",
        city: "Vilnius",
        country: "Lithuania",
        status: "published",
        confidence: 0.9,
      },
      {
        type: "publication",
        title: "Notes on a Failing Tape",
        role: "author",
        year: 2023,
        venue: "Spike Art Magazine",
        city: "Berlin",
        country: "Germany",
        description:
          "Essay on preservation as an aesthetic decision rather than a technical one.",
        status: "published",
        confidence: 0.79,
      },
      {
        type: "education",
        title: "MFA, Sound Arts",
        year: 2010,
        endYear: 2012,
        venue: "Tbilisi State Academy of Arts",
        city: "Tbilisi",
        country: "Georgia",
        status: "published",
        confidence: 0.91,
      },
      {
        type: "collection",
        title: "Permanent collection acquisition",
        year: 2024,
        venue: "Kunsthalle Basel",
        city: "Basel",
        country: "Switzerland",
        status: "in_review",
        confidence: 0.61,
        sourceText: "2024 acquired, Kunsthalle Basel collection",
        extractedBy: "mock",
      },
    ],
  },
  {
    name: "Mateo Ferrán",
    birthYear: 1979,
    nationality: "Spain",
    basedIn: "Lisbon",
    bio: "Sculptor and printmaker. Casts industrial offcuts in pigmented plaster, then photographs their slow collapse over exhibition periods.",
    entries: [
      {
        type: "exhibition",
        title: "Ballast",
        role: "solo",
        year: 2025,
        venue: "Galeria Filomena Soares",
        city: "Lisbon",
        country: "Portugal",
        status: "published",
        confidence: 0.93,
      },
      {
        type: "exhibition",
        title: "Material Witness",
        role: "group",
        year: 2024,
        venue: "Museo Reina Sofía",
        city: "Madrid",
        country: "Spain",
        status: "published",
        confidence: 0.9,
      },
      {
        type: "talk",
        title: "On Casting What Is Left Over",
        role: "speaker",
        year: 2023,
        venue: "Gulbenkian Foundation",
        city: "Lisbon",
        country: "Portugal",
        status: "published",
        confidence: 0.8,
      },
      {
        type: "publication",
        title: "Ballast (exhibition catalogue)",
        role: "editor",
        year: 2025,
        venue: "Sistema Solar",
        city: "Lisbon",
        country: "Portugal",
        status: "in_review",
        confidence: 0.58,
        sourceText: "2025 Ballast, cat., Sistema Solar, Lisbon",
        extractedBy: "mock",
      },
    ],
  },
  {
    name: "Ayaka Morioka",
    birthYear: 1992,
    nationality: "Japan",
    basedIn: "Berlin",
    website: "https://example.org/ayaka-morioka",
    bio: "Performance and moving image. Long-duration works that rehearse administrative procedures — queuing, filing, stamping — until they lose meaning.",
    entries: [
      {
        type: "performance",
        title: "Counter Hours",
        year: 2025,
        venue: "Hebbel am Ufer",
        city: "Berlin",
        country: "Germany",
        description: "Six-hour performance staged inside a replica municipal office.",
        status: "published",
        confidence: 0.92,
      },
      {
        type: "exhibition",
        title: "Paperwork",
        role: "solo",
        year: 2024,
        venue: "Kunstverein Hamburg",
        city: "Hamburg",
        country: "Germany",
        status: "published",
        confidence: 0.89,
      },
      {
        type: "screening",
        title: "Form 14B",
        year: 2023,
        venue: "International Film Festival Rotterdam",
        city: "Rotterdam",
        country: "Netherlands",
        status: "published",
        confidence: 0.83,
      },
      {
        type: "residency",
        title: "DAAD Artists-in-Berlin Programme",
        year: 2022,
        endYear: 2023,
        city: "Berlin",
        country: "Germany",
        status: "published",
        confidence: 0.86,
      },
      {
        type: "award",
        title: "Ars Viva Prize",
        year: 2024,
        country: "Germany",
        status: "in_review",
        confidence: 0.54,
        sourceText: "2024 Ars Viva",
        extractedBy: "openrouter",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Generated artists                                                   */
/* ------------------------------------------------------------------ */

function makeEntry(type: string): SeedEntry {
  const year = between(2009, 2026);
  const place = pick(PLACES);
  const title = `${pick(TITLE_A)} ${pick(TITLE_B)}`;

  const base: SeedEntry = { type, title, year };

  if (type === "exhibition") {
    base.role = chance(0.35) ? "solo" : "group";
    base.venue = place.venue;
    base.city = place.city;
    base.country = place.country;
  } else if (type === "publication") {
    base.role = chance(0.6) ? "author" : "editor";
    base.venue = pick(JOURNALS);
    base.city = place.city;
    base.country = place.country;
  } else if (type === "award") {
    base.title = pick(AWARD_NAMES);
    base.city = place.city;
    base.country = place.country;
  } else if (type === "residency") {
    base.venue = place.venue;
    base.city = place.city;
    base.country = place.country;
    base.endYear = year + 1;
  } else if (type === "education") {
    const school = pick(SCHOOLS);
    base.title = chance(0.5) ? "MFA Fine Art" : "BA Fine Art";
    base.venue = school.venue;
    base.city = school.city;
    base.country = school.country;
    base.endYear = year + 2;
  } else if (type === "talk") {
    base.role = "speaker";
    base.venue = place.venue;
    base.city = place.city;
    base.country = place.country;
  } else {
    base.venue = place.venue;
    base.city = place.city;
    base.country = place.country;
  }

  const extractedBy = pick(EXTRACTORS);
  base.extractedBy = extractedBy;

  // Hand-entered records carry no score; extracted ones do.
  if (extractedBy !== "manual") {
    base.confidence = Number((0.45 + random() * 0.5).toFixed(2));
    base.sourceText = `${year} ${base.title}${base.venue ? `, ${base.venue}` : ""}${
      base.city ? `, ${base.city}` : ""
    }${base.country ? `, ${base.country}` : ""}`;
  }

  // Most of the archive is published; a tail is still moving through review.
  const roll = random();
  if (roll < 0.82) base.status = "published";
  else if (roll < 0.94) base.status = "in_review";
  else if (roll < 0.98) base.status = "draft";
  else base.status = "rejected";

  if (base.status === "rejected") base.reviewNote = "Duplicate of an existing record.";
  if (chance(0.18)) {
    base.description = `${pick(BIO_OPENERS)} ${pick(BIO_CLOSERS)}`;
  }
  if (chance(0.22)) {
    base.url = `https://example.org/${slugify(base.title)}-${year}`;
  }

  return base;
}

function makeArtist(index: number): SeedArtist {
  const origin = pick(ORIGINS);
  const name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${
    LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length]
  }`;

  const entries: SeedEntry[] = [makeEntry("education")];
  const count = between(5, 14);
  for (let i = 0; i < count; i += 1) entries.push(makeEntry(pick(WEIGHTED_TYPES)));

  return {
    name,
    birthYear: between(1968, 1996),
    nationality: origin.nationality,
    basedIn: origin.basedIn,
    website: chance(0.4) ? `https://example.org/${slugify(name)}` : undefined,
    bio: `${pick(BIO_OPENERS)} ${pick(BIO_CLOSERS)}`,
    entries,
  };
}

const GENERATED_ARTISTS = 12;

/* ------------------------------------------------------------------ */

async function main() {
  const artists: SeedArtist[] = [...FEATURED];
  const taken = new Set(FEATURED.map((artist) => slugify(artist.name)));

  for (let index = 0; artists.length < FEATURED.length + GENERATED_ARTISTS; index += 1) {
    const artist = makeArtist(index);
    const slug = slugify(artist.name);
    if (taken.has(slug)) continue; // the name pools can collide
    taken.add(slug);
    artists.push(artist);
  }

  let totalEntries = 0;

  // Idempotent: artists are keyed by slug and their entries are replaced, so
  // `npm run db:seed` can be run repeatedly without duplicating anything.
  for (const seed of artists) {
    const slug = slugify(seed.name);
    const data = {
      name: seed.name,
      birthYear: seed.birthYear,
      nationality: seed.nationality,
      basedIn: seed.basedIn,
      website: seed.website,
      bio: seed.bio,
    };

    const artist = await prisma.artist.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });

    await prisma.archiveEntry.deleteMany({ where: { artistId: artist.id } });
    await prisma.archiveEntry.createMany({
      data: seed.entries.map((entry) => {
        const reviewed = entry.status === "published" || entry.status === "rejected";
        return {
          artistId: artist.id,
          type: entry.type,
          title: entry.title,
          role: entry.role,
          year: entry.year,
          endYear: entry.endYear,
          venue: entry.venue,
          city: entry.city,
          country: entry.country,
          description: entry.description,
          url: entry.url,
          status: entry.status ?? "published",
          confidence: entry.confidence,
          sourceText: entry.sourceText,
          reviewNote: entry.reviewNote,
          extractedBy: entry.extractedBy ?? "manual",
          reviewedBy: reviewed ? pick(REVIEWERS) : null,
          reviewedAt: reviewed
            ? new Date(Date.now() - between(0, 120) * 24 * 60 * 60 * 1000)
            : null,
        };
      }),
    });

    totalEntries += seed.entries.length;
    console.log(`seeded ${seed.name} (${seed.entries.length} entries)`);
  }

  console.log(`\n${artists.length} artists, ${totalEntries} records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
