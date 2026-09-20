/**
 * Site-wide identity and SEO defaults.
 *
 * The public origin comes from APP_URL so staging, production and localhost
 * each emit their own canonical URLs without a code change.
 */

const fallbackUrl = "http://localhost:3000";

function normalise(url: string): string {
  return url.replace(/\/+$/, "");
}

export const site = {
  name: "aeitos archive",
  shortName: "aeitos",
  tagline: "Gathering what remains",
  description:
    "The aeitos archive: exhibitions, publications, awards and residencies, extracted from artist CVs, checked by hand, and published as structured, citable records.",
  url: normalise(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || fallbackUrl),
  locale: "en_GB",
  logo: "/aeitos-logo.png",
  ogImage: "/aeitos-logo.png",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Renders a JSON-LD block. Next escapes the string, so it is inlined raw. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
