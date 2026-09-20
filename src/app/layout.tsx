import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { absoluteUrl, jsonLd, site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "aeitos",
    "art archive",
    "artist CV",
    "exhibition history",
    "contemporary art",
    "artist records",
    "structured archive",
  ],
  authors: [{ name: site.shortName, url: site.url }],
  creator: site.shortName,
  publisher: site.shortName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
    locale: site.locale,
    images: [{ url: site.ogImage, width: 2500, height: 840, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [site.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

const organisationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.shortName,
  url: site.url,
  logo: absoluteUrl(site.logo),
  description: site.description,
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
  description: site.description,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${site.url}/?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organisationLd) }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(websiteLd) }} />

        <header className="site-header">
          <div className="shell">
            <div className="row">
              <div>
                <Link href="/" className="wordmark" aria-label={`${site.shortName} — home`}>
                  {/* Sized by .wordmark img, which scales with the viewport. */}
                  <Image
                    src={site.logo}
                    alt={site.shortName}
                    width={2500}
                    height={840}
                    priority
                    sizes="(max-width: 680px) 60vw, 34vw"
                  />
                </Link>
                <div className="strapline">archive — {site.tagline.toLowerCase()}</div>
              </div>
              <nav>
                <Link href="/">Catalogue</Link>
                <Link href="/artists">Artists</Link>
                <Link href="/about">About</Link>
                <Link href="/admin">Admin</Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="shell">{children}</main>

        <footer className="site-footer shell">
          <span>© {new Date().getFullYear()} aeitos, all rights reserved</span>
          <span>Records are published only after human review</span>
        </footer>
      </body>
    </html>
  );
}
