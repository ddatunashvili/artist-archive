import { NextResponse } from "next/server";
import { FileReadError, MAX_UPLOAD_BYTES, readCvFile, tidyExtractedText } from "@/lib/cv-file";

// The OCR and PDF readers are heavy and must not be traced into the bundle.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/extract/upload
 *
 * Multipart upload of a CV file. Returns plain text and nothing else: the
 * archivist sees what was read before any model is asked to interpret it,
 * and the file itself is never written to disk.
 *
 * Behind the same session gate as /api/extract.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `That file is too large; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  // Opt in to reading a PDF by recognition instead of its text layer.
  const forceOcr = String(form.get("ocr") ?? "") === "true";

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await readCvFile(buffer, file.name, file.type || "", { forceOcr });
    const text = tidyExtractedText(result.text);

    if (!text) {
      return NextResponse.json(
        { error: "No text could be read from that file." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text,
      method: result.method,
      pages: result.pages,
      warning: result.warning,
      characters: text.length,
      filename: file.name,
    });
  } catch (error) {
    if (error instanceof FileReadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("upload read failed:", error);
    return NextResponse.json({ error: "That file could not be read." }, { status: 500 });
  }
}
