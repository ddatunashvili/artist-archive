import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Artist Archive",
    template: "%s — Artist Archive",
  },
  description:
    "A digital archive of artist CVs: unstructured text in, reviewed structured records out.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell">
            <div className="row">
              <div>
                <Link href="/" className="wordmark">
                  Artist Archive
                </Link>
                <div className="strapline">Exhibitions, publications, awards and residencies</div>
              </div>
              <nav>
                <Link href="/">Catalogue</Link>
                <Link href="/import">Import CV</Link>
                <Link href="/review">Review</Link>
                <Link href="/about">About</Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="shell">{children}</main>

        <footer className="site-footer shell">
          <span>Artist Archive — local prototype</span>
          <span>Records are published only after human review</span>
        </footer>
      </body>
    </html>
  );
}
