import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ENTRY_TYPES, type EntryStatus, type EntryType } from "@/lib/schema";

export type CatalogueFilters = {
  type?: string;
  year?: string;
  country?: string;
  city?: string;
  artist?: string;
  q?: string;
  status?: EntryStatus;
};

/** Reads raw searchParams and keeps only values the schema recognises. */
export function normaliseFilters(params: Record<string, string | string[] | undefined>): CatalogueFilters {
  const one = (key: string) => {
    const value = params[key];
    const raw = Array.isArray(value) ? value[0] : value;
    const trimmed = raw?.trim();
    return trimmed ? trimmed : undefined;
  };

  const type = one("type");
  return {
    type: type && (ENTRY_TYPES as readonly string[]).includes(type) ? type : undefined,
    year: /^\d{4}$/.test(one("year") ?? "") ? one("year") : undefined,
    country: one("country"),
    city: one("city"),
    artist: one("artist"),
    q: one("q"),
  };
}

export function buildWhere(filters: CatalogueFilters): Prisma.ArchiveEntryWhereInput {
  const where: Prisma.ArchiveEntryWhereInput = {
    status: filters.status ?? "published",
  };

  if (filters.type) where.type = filters.type;
  if (filters.year) where.year = Number.parseInt(filters.year, 10);
  if (filters.country) where.country = filters.country;
  if (filters.city) where.city = filters.city;
  if (filters.artist) where.artist = { slug: filters.artist };
  if (filters.q) {
    // `contains` without a mode flag so the same query runs on SQLite and on
    // a server database.
    where.OR = [
      { title: { contains: filters.q } },
      { venue: { contains: filters.q } },
      { description: { contains: filters.q } },
      { artist: { name: { contains: filters.q } } },
    ];
  }
  return where;
}

export async function findEntries(filters: CatalogueFilters) {
  return prisma.archiveEntry.findMany({
    where: buildWhere(filters),
    orderBy: [{ year: "desc" }, { title: "asc" }],
    include: {
      artist: { select: { name: true, slug: true } },
      // Only the first image is needed for a card; the rest load on the
      // detail page.
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    take: 500,
  });
}

export type CatalogueEntry = Awaited<ReturnType<typeof findEntries>>[number];

/**
 * Distinct values for the filter controls, computed from published records
 * only so the public catalogue never leaks an unreviewed venue name.
 */
export async function getFilterOptions() {
  const published = { status: "published" } as const;

  const [types, years, countries, cities, artists] = await Promise.all([
    prisma.archiveEntry.groupBy({ by: ["type"], where: published, _count: true }),
    prisma.archiveEntry.groupBy({ by: ["year"], where: published, _count: true }),
    prisma.archiveEntry.groupBy({
      by: ["country"],
      where: { ...published, country: { not: null } },
      _count: true,
    }),
    prisma.archiveEntry.groupBy({
      by: ["city"],
      where: { ...published, city: { not: null } },
      _count: true,
    }),
    prisma.artist.findMany({
      where: { entries: { some: published } },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    types: types
      .map((row) => ({ value: row.type as EntryType, count: row._count }))
      .sort((a, b) => b.count - a.count),
    years: years.map((row) => row.year).sort((a, b) => b - a),
    countries: countries
      .map((row) => row.country as string)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    cities: cities
      .map((row) => row.city as string)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    artists,
  };
}

export async function getEntry(id: string) {
  return prisma.archiveEntry.findUnique({
    where: { id },
    include: { artist: true, images: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getPendingEntries() {
  return prisma.archiveEntry.findMany({
    where: { status: { in: ["in_review", "draft"] } },
    orderBy: [{ createdAt: "desc" }],
    include: { artist: { select: { name: true, slug: true } } },
    take: 200,
  });
}

export async function getArtistBySlug(slug: string) {
  return prisma.artist.findUnique({
    where: { slug },
    include: {
      entries: {
        where: { status: "published" },
        orderBy: [{ year: "desc" }, { title: "asc" }],
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
  });
}

export async function getArchiveStats() {
  const [published, pending, artists] = await Promise.all([
    prisma.archiveEntry.count({ where: { status: "published" } }),
    prisma.archiveEntry.count({ where: { status: { in: ["in_review", "draft"] } } }),
    prisma.artist.count(),
  ]);
  return { published, pending, artists };
}

/* ------------------------------------------------------------------ */
/* Admin reads                                                         */
/* ------------------------------------------------------------------ */

/**
 * Admin list. Unlike the public catalogue this sees every status, so the
 * status filter is explicit rather than defaulted to "published".
 */
export type AdminFilters = Omit<CatalogueFilters, "status"> & {
  status?: EntryStatus | "all";
};

export async function findAdminEntries(filters: AdminFilters) {
  const where = buildWhere({ ...filters, status: undefined });
  if (filters.status && filters.status !== "all") where.status = filters.status;
  else delete where.status;

  return prisma.archiveEntry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: { artist: { select: { name: true, slug: true } } },
    take: 500,
  });
}

export async function listArtists() {
  return prisma.artist.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { entries: true } } },
  });
}

export async function getArtistById(id: string) {
  return prisma.artist.findUnique({ where: { id } });
}

/** Artists with at least one published record, for the public index. */
export async function listPublishedArtists() {
  return prisma.artist.findMany({
    where: { entries: { some: { status: "published" } } },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { entries: { where: { status: "published" } } } },
    },
  });
}
