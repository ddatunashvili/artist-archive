import { prisma } from "@/lib/db";
import type { EntryStatus, EntryType } from "@/lib/schema";

/**
 * Dashboard aggregates.
 *
 * Everything is a groupBy or a count, so the whole dashboard is a handful of
 * indexed queries rather than a full table read into JavaScript.
 */

export type Bucket<T = string> = { key: T; count: number };

function toBuckets<T extends string | number>(
  rows: { _count: number }[],
  pick: (row: never) => T,
): Bucket<T>[] {
  return rows
    .map((row) => ({ key: pick(row as never), count: row._count }))
    .filter((bucket) => bucket.key !== null && bucket.key !== undefined);
}

export async function getDashboard() {
  const [
    totalEntries,
    totalArtists,
    statusRows,
    typeRows,
    yearRows,
    countryRows,
    venueRows,
    extractorRows,
    confidence,
    lowConfidence,
    withPlace,
    withSource,
    withLink,
    recent,
    recentlyReviewed,
  ] = await Promise.all([
    prisma.archiveEntry.count(),
    prisma.artist.count(),
    prisma.archiveEntry.groupBy({ by: ["status"], _count: true }),
    prisma.archiveEntry.groupBy({ by: ["type"], _count: true }),
    prisma.archiveEntry.groupBy({ by: ["year"], _count: true }),
    prisma.archiveEntry.groupBy({
      by: ["country"],
      where: { country: { not: null } },
      _count: true,
    }),
    prisma.archiveEntry.groupBy({ by: ["venue"], where: { venue: { not: null } }, _count: true }),
    prisma.archiveEntry.groupBy({ by: ["extractedBy"], _count: true }),
    prisma.archiveEntry.aggregate({ _avg: { confidence: true } }),
    prisma.archiveEntry.count({ where: { confidence: { lt: 0.7 } } }),
    prisma.archiveEntry.count({ where: { country: { not: null } } }),
    prisma.archiveEntry.count({ where: { sourceText: { not: null } } }),
    prisma.archiveEntry.count({ where: { url: { not: null } } }),
    prisma.archiveEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { artist: { select: { name: true, slug: true } } },
    }),
    prisma.archiveEntry.count({
      where: { reviewedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const byStatus = toBuckets<EntryStatus>(statusRows, (row) => row["status"]);
  const status = (name: EntryStatus) => byStatus.find((b) => b.key === name)?.count ?? 0;

  const byYear = toBuckets<number>(yearRows, (row) => row["year"]).sort((a, b) => a.key - b.key);

  return {
    totals: {
      entries: totalEntries,
      artists: totalArtists,
      published: status("published"),
      inReview: status("in_review") + status("draft"),
      rejected: status("rejected"),
    },
    byStatus,
    byType: toBuckets<EntryType>(typeRows, (row) => row["type"]).sort((a, b) => b.count - a.count),
    byYear,
    byCountry: toBuckets<string>(countryRows, (row) => row["country"])
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topVenues: toBuckets<string>(venueRows, (row) => row["venue"])
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    byExtractor: toBuckets<string>(extractorRows, (row) => row["extractedBy"] ?? "manual").sort(
      (a, b) => b.count - a.count,
    ),
    quality: {
      averageConfidence: confidence._avg.confidence,
      lowConfidence,
      placeCoverage: totalEntries ? withPlace / totalEntries : 0,
      sourceCoverage: totalEntries ? withSource / totalEntries : 0,
      linkCoverage: totalEntries ? withLink / totalEntries : 0,
    },
    recent,
    recentlyReviewed,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
