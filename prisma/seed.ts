/**
 * Seeds a small but realistic archive so the catalogue is browsable on first
 * run. Fictional artists; any resemblance to real practices is coincidental.
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

const ARTISTS: SeedArtist[] = [
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
        type: "exhibition",
        title: "The Long Now",
        role: "group",
        year: 2022,
        venue: "Kumu Art Museum",
        city: "Tallinn",
        country: "Estonia",
        status: "published",
        confidence: 0.86,
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
        type: "award",
        title: "Tbilisi Contemporary Prize",
        year: 2023,
        city: "Tbilisi",
        country: "Georgia",
        status: "published",
        confidence: 0.82,
      },
      {
        type: "publication",
        title: "Notes on a Failing Tape",
        role: "author",
        year: 2023,
        venue: "Spike Art Magazine",
        city: "Berlin",
        country: "Germany",
        description: "Essay on preservation as an aesthetic decision rather than a technical one.",
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
        type: "exhibition",
        title: "Dry Season",
        role: "solo",
        year: 2021,
        venue: "CAC Málaga",
        city: "Málaga",
        country: "Spain",
        status: "published",
        confidence: 0.87,
      },
      {
        type: "screening",
        title: "Collapse Studies I–IV",
        year: 2022,
        venue: "Doclisboa",
        city: "Lisbon",
        country: "Portugal",
        status: "published",
        confidence: 0.74,
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
        type: "award",
        title: "EDP Foundation New Artists Prize",
        year: 2020,
        city: "Lisbon",
        country: "Portugal",
        status: "published",
        confidence: 0.85,
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
        type: "exhibition",
        title: "Soft Bureaucracies",
        role: "group",
        year: 2023,
        venue: "Mori Art Museum",
        city: "Tokyo",
        country: "Japan",
        status: "published",
        confidence: 0.88,
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
        type: "education",
        title: "BA, Intermedia Art",
        year: 2011,
        endYear: 2015,
        venue: "Tokyo University of the Arts",
        city: "Tokyo",
        country: "Japan",
        status: "published",
        confidence: 0.9,
      },
      {
        type: "talk",
        title: "The Aesthetics of Waiting",
        role: "speaker",
        year: 2024,
        venue: "Haus der Kulturen der Welt",
        city: "Berlin",
        country: "Germany",
        status: "published",
        confidence: 0.77,
      },
      {
        type: "award",
        title: "Ars Viva Prize",
        year: 2024,
        country: "Germany",
        status: "in_review",
        confidence: 0.54,
        sourceText: "2024 Ars Viva",
      },
    ],
  },
];

async function main() {
  // Seeding is idempotent: artists are keyed by slug and their entries are
  // replaced, so `npm run db:seed` can be run repeatedly.
  for (const seed of ARTISTS) {
    const slug = slugify(seed.name);
    const artist = await prisma.artist.upsert({
      where: { slug },
      update: {
        name: seed.name,
        birthYear: seed.birthYear,
        nationality: seed.nationality,
        basedIn: seed.basedIn,
        website: seed.website,
        bio: seed.bio,
      },
      create: {
        slug,
        name: seed.name,
        birthYear: seed.birthYear,
        nationality: seed.nationality,
        basedIn: seed.basedIn,
        website: seed.website,
        bio: seed.bio,
      },
    });

    await prisma.archiveEntry.deleteMany({ where: { artistId: artist.id } });
    await prisma.archiveEntry.createMany({
      data: seed.entries.map((entry) => ({
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
        extractedBy: "manual",
        reviewedBy: entry.status === "in_review" ? null : "archive editor",
        reviewedAt: entry.status === "in_review" ? null : new Date(),
      })),
    });

    console.log(`seeded ${seed.name} (${seed.entries.length} entries)`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
