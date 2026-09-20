import type { Metadata } from "next";
import Link from "next/link";
import { describeProvider } from "@/lib/ai";
import { getArchiveStats } from "@/lib/queries";

export const metadata: Metadata = { title: "About" };
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const stats = await getArchiveStats();
  const provider = describeProvider();

  return (
    <article>
      <h1>About this archive</h1>
      <p className="lede">
        A prototype for turning artist CVs — the least structured document in the art world — into a
        catalogue that can be filtered, cited and linked.
      </p>

      <h2>How a record gets in</h2>
      <ol style={{ maxWidth: "62ch", paddingLeft: 20 }}>
        <li>An archivist pastes raw CV text on the <Link href="/admin/import">import</Link> page.</li>
        <li>The configured extractor proposes structured records. Nothing is stored yet.</li>
        <li>Every field is validated against the archive schema, and rejected if it does not fit.</li>
        <li>A human corrects the proposal, drops what should not be kept, and signs off by name.</li>
        <li>
          Records saved as <em>in review</em> wait in the{" "}
          <Link href="/admin/review">review queue</Link> for a second decision before they appear publicly.
        </li>
      </ol>

      <h2>Provenance</h2>
      <p style={{ maxWidth: "62ch" }}>
        Each record keeps the CV line it came from, the extractor that produced it, a confidence
        score and the name of the reviewer who approved it. A record can always be traced back to
        the sentence that created it.
      </p>

      <h2>Current state</h2>
      <dl className="facts">
        <dt>Published records</dt>
        <dd>{stats.published}</dd>
        <dt>Awaiting review</dt>
        <dd>{stats.pending}</dd>
        <dt>Artists</dt>
        <dd>{stats.artists}</dd>
        <dt>Extractor</dt>
        <dd>
          {provider.provider}
          {provider.model ? ` · ${provider.model}` : " · rule-based, offline"}
        </dd>
      </dl>
    </article>
  );
}
