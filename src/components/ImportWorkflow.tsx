"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  ExtractedEntrySchema,
  PublishRequestSchema,
  fieldErrors,
  type EntryType,
} from "@/lib/schema";

type Row = {
  include: boolean;
  type: string;
  title: string;
  role: string;
  year: string;
  endYear: string;
  venue: string;
  city: string;
  country: string;
  url: string;
  description: string;
  confidence: number | null;
  sourceText: string;
};

type ArtistForm = {
  name: string;
  birthYear: string;
  nationality: string;
  basedIn: string;
  website: string;
  bio: string;
};

type Step = "paste" | "review" | "done";

const EMPTY_ARTIST: ArtistForm = {
  name: "",
  birthYear: "",
  nationality: "",
  basedIn: "",
  website: "",
  bio: "",
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** A row is sent as-is; Zod does the trimming and coercion on both ends. */
function rowToEntry(row: Row) {
  return {
    type: row.type,
    title: row.title,
    role: row.role,
    year: row.year,
    endYear: row.endYear,
    venue: row.venue,
    city: row.city,
    country: row.country,
    url: row.url,
    description: row.description,
    confidence: row.confidence ?? undefined,
    sourceText: row.sourceText,
  };
}

export function ImportWorkflow({ provider }: { provider: { provider: string; model: string | null; needsKey: boolean } }) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("paste");
  const [cv, setCv] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [result, setResult] = useState<{ saved: number; status: string; slug: string } | null>(null);

  const [artist, setArtist] = useState<ArtistForm>(EMPTY_ARTIST);
  const [rows, setRows] = useState<Row[]>([]);
  const [extractedBy, setExtractedBy] = useState("manual");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [reviewer, setReviewer] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const kept = rows.filter((row) => row.include).length;

  async function loadSample(file: string) {
    const response = await fetch(file);
    setCv(await response.text());
    setError(null);
    setFileNote(null);
  }

  /**
   * Reads a dropped or chosen file into the textarea.
   *
   * The text lands in the box rather than going straight to the model, so the
   * archivist can see exactly what was read — that matters most for OCR,
   * where a bad scan is obvious in the text long before it is obvious in the
   * extracted records.
   */
  async function readFile(file: File) {
    setReading(true);
    setError(null);
    setIssues([]);
    setFileNote(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/extract/upload", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "That file could not be read.");
        return;
      }

      setCv(payload.text);
      setFileNote(
        [
          `Read ${payload.filename} via ${payload.method}`,
          payload.pages ? `${payload.pages} page${payload.pages === 1 ? "" : "s"}` : null,
          `${payload.characters.toLocaleString()} characters`,
        ]
          .filter(Boolean)
          .join(" · ") + (payload.warning ? ` — ${payload.warning}` : ""),
      );
    } catch {
      setError("Could not upload that file.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function runExtraction() {
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cv, artistName: nameHint || undefined }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Extraction failed.");
        if (Array.isArray(payload.details)) {
          setIssues(payload.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`));
        }
        return;
      }

      setExtractedBy(payload.provider ?? "manual");
      setArtist({
        name: text(payload.result.artist.name),
        birthYear: text(payload.result.artist.birthYear),
        nationality: text(payload.result.artist.nationality),
        basedIn: text(payload.result.artist.basedIn),
        website: text(payload.result.artist.website),
        bio: text(payload.result.artist.bio),
      });
      setRows(
        payload.result.entries.map(
          (entry: Record<string, unknown>): Row => ({
            include: true,
            type: text(entry.type) || "other",
            title: text(entry.title),
            role: text(entry.role),
            year: text(entry.year),
            endYear: text(entry.endYear),
            venue: text(entry.venue),
            city: text(entry.city),
            country: text(entry.country),
            url: text(entry.url),
            description: text(entry.description),
            confidence: typeof entry.confidence === "number" ? entry.confidence : null,
            sourceText: text(entry.sourceText),
          }),
        ),
      );
      setStep("review");
    } catch {
      setError("Could not reach the extraction endpoint.");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save(status: "in_review" | "published") {
    setBusy(true);
    setError(null);
    setIssues([]);

    const entries = rows.filter((row) => row.include).map(rowToEntry);
    const payload = {
      artist: {
        name: artist.name,
        birthYear: artist.birthYear,
        nationality: artist.nationality,
        basedIn: artist.basedIn,
        website: artist.website,
        bio: artist.bio,
      },
      entries,
      status,
      reviewedBy: reviewer || undefined,
      reviewNote: reviewNote || undefined,
      extractedBy,
    };

    // Validate in the browser first so the reviewer sees problems next to the
    // fields; the API validates the same schema again before writing.
    const check = PublishRequestSchema.safeParse(payload);
    if (!check.success) {
      setIssues(fieldErrors(check.error).map((issue) => `${issue.path}: ${issue.message}`));
      setError("Fix the highlighted fields before saving.");
      setBusy(false);
      return;
    }
    if (status === "published" && !reviewer.trim()) {
      setError("Enter your name as reviewer before publishing.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Save failed.");
        if (Array.isArray(body.details)) {
          setIssues(body.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`));
        }
        return;
      }
      setResult({ saved: body.saved, status: body.status, slug: body.artist.slug });
      setStep("done");
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(false);
    }
  }

  function rowError(row: Row): string | null {
    if (!row.include) return null;
    const check = ExtractedEntrySchema.safeParse(rowToEntry(row));
    return check.success ? null : fieldErrors(check.error)[0].message;
  }

  return (
    <div className="stack">
      <div className="steps">
        <span className={step === "paste" ? "on" : ""}>1 · Paste CV</span>
        <span>→</span>
        <span className={step === "review" ? "on" : ""}>2 · Human review</span>
        <span>→</span>
        <span className={step === "done" ? "on" : ""}>3 · Saved</span>
      </div>

      {error && (
        <div className="notice error">
          {error}
          {issues.length > 0 && (
            <ul className="errors">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === "paste" && (
        <>
          <div className="notice">
            Extractor: <strong>{provider.provider}</strong>
            {provider.model ? ` · ${provider.model}` : " · rule-based, no API key needed"}
            {provider.needsKey && " — no API key set, requests will fail. Add one to .env."}
          </div>

          <div
            className={`dropzone${dragging ? " on" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void readFile(file);
            }}
          >
            <input
              ref={fileInput}
              id="cv-file"
              type="file"
              accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
              disabled={reading || busy}
              hidden
            />
            <strong>{reading ? "Reading the file…" : "Drop a CV here"}</strong>
            <span>
              PDF, Word, plain text, or a photo or scan of a printed page — or{" "}
              <button
                type="button"
                className="linklike"
                onClick={() => fileInput.current?.click()}
                disabled={reading || busy}
              >
                choose a file
              </button>
              . Nothing is stored; only the text is kept.
            </span>
          </div>

          {fileNote && <div className="notice ok">{fileNote}</div>}

          <div className="field">
            <label htmlFor="cv">Unstructured CV text</label>
            <textarea
              id="cv"
              rows={16}
              value={cv}
              onChange={(event) => setCv(event.target.value)}
              placeholder={"Paste a CV here, e.g.\n\n2024 Slow Signal, Kunsthalle Basel, Basel, Switzerland (solo)"}
            />
          </div>

          <div className="field">
            <label htmlFor="hint">Artist name (optional, if the CV omits it)</label>
            <input id="hint" value={nameHint} onChange={(event) => setNameHint(event.target.value)} />
          </div>

          <div className="actions">
            <button type="button" onClick={runExtraction} disabled={busy || cv.trim().length < 20}>
              {busy ? "Extracting…" : "Extract records"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => loadSample("/brief-cv.txt")}
              disabled={busy}
            >
              Load short example
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => loadSample("/sample-cv.txt")}
              disabled={busy}
            >
              Load full CV
            </button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <div className="notice">
            {rows.length} records proposed by <strong>{extractedBy}</strong>. Nothing is stored yet.
            Correct anything wrong, untick what should not enter the archive, then save.
          </div>

          <h2>Artist</h2>
          <div className="review-card">
            <div className="grid">
              <div className="field">
                <label htmlFor="artist-name">Name</label>
                <input
                  id="artist-name"
                  value={artist.name}
                  onChange={(event) => setArtist({ ...artist, name: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="artist-born">Born</label>
                <input
                  id="artist-born"
                  value={artist.birthYear}
                  onChange={(event) => setArtist({ ...artist, birthYear: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="artist-nat">Nationality</label>
                <input
                  id="artist-nat"
                  value={artist.nationality}
                  onChange={(event) => setArtist({ ...artist, nationality: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="artist-based">Based in</label>
                <input
                  id="artist-based"
                  value={artist.basedIn}
                  onChange={(event) => setArtist({ ...artist, basedIn: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="artist-web">Website</label>
                <input
                  id="artist-web"
                  value={artist.website}
                  onChange={(event) => setArtist({ ...artist, website: event.target.value })}
                />
              </div>
            </div>
          </div>

          <h2>Records ({kept} of {rows.length} kept)</h2>
          <div className="stack">
            {rows.map((row, index) => {
              const problem = rowError(row);
              return (
                <div key={index} className={`review-card${row.include ? "" : " dropped"}`}>
                  <div className="card-head">
                    <label style={{ display: "flex", gap: 8, alignItems: "center", textTransform: "none" }}>
                      <input
                        type="checkbox"
                        style={{ minWidth: 0 }}
                        checked={row.include}
                        onChange={(event) => updateRow(index, { include: event.target.checked })}
                      />
                      Include in archive
                    </label>
                    <span className="tag">
                      {row.confidence === null
                        ? "no score"
                        : `confidence ${Math.round(row.confidence * 100)}%`}
                    </span>
                  </div>

                  <div className="grid">
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label>Title</label>
                      <input value={row.title} onChange={(event) => updateRow(index, { title: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>Type</label>
                      <select value={row.type} onChange={(event) => updateRow(index, { type: event.target.value })}>
                        {ENTRY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {ENTRY_TYPE_LABELS[type as EntryType]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Role</label>
                      <input value={row.role} onChange={(event) => updateRow(index, { role: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>Year</label>
                      <input value={row.year} onChange={(event) => updateRow(index, { year: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>End year</label>
                      <input
                        value={row.endYear}
                        onChange={(event) => updateRow(index, { endYear: event.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Venue</label>
                      <input value={row.venue} onChange={(event) => updateRow(index, { venue: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>City</label>
                      <input value={row.city} onChange={(event) => updateRow(index, { city: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>Country</label>
                      <input
                        value={row.country}
                        onChange={(event) => updateRow(index, { country: event.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Link</label>
                      <input value={row.url} onChange={(event) => updateRow(index, { url: event.target.value })} />
                    </div>
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label>Description</label>
                      <input
                        value={row.description}
                        onChange={(event) => updateRow(index, { description: event.target.value })}
                      />
                    </div>
                  </div>

                  {row.sourceText && (
                    <blockquote className="source" style={{ marginTop: 12 }}>
                      {row.sourceText}
                    </blockquote>
                  )}
                  {problem && <ul className="errors"><li>{problem}</li></ul>}
                </div>
              );
            })}
          </div>

          <h2>Sign-off</h2>
          <div className="review-card">
            <div className="grid">
              <div className="field">
                <label htmlFor="reviewer">Reviewer name (required to publish)</label>
                <input id="reviewer" value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="note">Review note</label>
                <input id="note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 14 }}>
              <button type="button" onClick={() => save("published")} disabled={busy || kept === 0}>
                {busy ? "Saving…" : "Approve & publish"}
              </button>
              <button type="button" className="ghost" onClick={() => save("in_review")} disabled={busy || kept === 0}>
                Save to review queue
              </button>
              <button type="button" className="ghost" onClick={() => setStep("paste")} disabled={busy}>
                Back
              </button>
            </div>
          </div>
        </>
      )}

      {step === "done" && result && (
        <>
          <div className="notice ok">
            Saved {result.saved} {result.saved === 1 ? "record" : "records"} with status{" "}
            <strong>{result.status}</strong>.
          </div>
          <div className="actions">
            <a className="button" href={`/artists/${result.slug}`}>
              View artist
            </a>
            {result.status !== "published" && (
              <a className="button ghost" href="/admin/review">
                Open review queue
              </a>
            )}
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setStep("paste");
                setCv("");
                setNameHint("");
                setRows([]);
                setArtist(EMPTY_ARTIST);
                setResult(null);
                setReviewNote("");
              }}
            >
              Import another CV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
