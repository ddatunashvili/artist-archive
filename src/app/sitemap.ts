import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Only published records are listed; drafts must never be indexed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, artists] = await Promise.all([
    prisma.archiveEntry.findMany({
      where: { status: "published" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.artist.findMany({
      where: { entries: { some: { status: "published" } } },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: site.url, changeFrequency: "daily", priority: 1 },
    { url: `${site.url}/artists`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site.url}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];

  return [
    ...staticPages,
    ...artists.map((artist) => ({
      url: `${site.url}/artists/${artist.slug}`,
      lastModified: artist.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...entries.map((entry) => ({
      url: `${site.url}/entries/${entry.id}`,
      lastModified: entry.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
