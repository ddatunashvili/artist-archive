/**
 * Reading a CV out of an uploaded file.
 *
 * Artists send CVs as PDFs, Word documents and, often enough, as a photograph
 * or scan. Each needs a different reader, and none of them is the AI step:
 * this module's only job is to get plain text out of a file so the extractor
 * has something to work with. Nothing here is stored — the bytes live in
 * memory for the length of the request.
 *
 *   .txt .md            read directly
 *   .pdf                unpdf (pdf.js), falling back to OCR for scans
 *   .docx               mammoth
 *   images              tesseract.js OCR
 *
 * Every library here is pure JavaScript or WASM. A native module would need a
 * compiler on the host, and this app is deployed by a panel that only runs
 * `npm install && npm start`.
 */

import { resolve } from "node:path";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"];

export type FileText = {
  text: string;
  /** How the text was obtained, shown to the archivist. */
  method: "plain text" | "pdf text layer" | "pdf OCR" | "word document" | "image OCR";
  pages?: number;
  warning?: string;
};

export class FileReadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "FileReadError";
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/** A PDF of scans has a text layer that is empty or near-empty. */
function looksEmpty(text: string): boolean {
  return text.replace(/\s+/g, "").length < 40;
}

async function readPdf(bytes: Uint8Array): Promise<FileText> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  let totalPages = 0;
  let text = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    totalPages = result.totalPages;
    text = String(result.text ?? "");
  } catch {
    throw new FileReadError("That PDF could not be opened. It may be corrupt or password-protected.");
  }

  if (!looksEmpty(text)) {
    return { text, method: "pdf text layer", pages: totalPages };
  }

  // A scanned PDF carries no text layer. Rendering its pages to images for
  // OCR needs a canvas implementation, which is a native dependency, so we
  // say so plainly rather than half-working.
  throw new FileReadError(
    `This PDF has no text layer — it is ${totalPages > 0 ? `${totalPages} page${totalPages === 1 ? "" : "s"} of ` : ""}scanned images. Export a page as PNG or JPG and upload that instead; images are read with OCR.`,
  );
}

async function readDocx(buffer: Buffer): Promise<FileText> {
  const mammoth = await import("mammoth");
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, method: "word document" };
  } catch {
    throw new FileReadError("That Word document could not be read. Only .docx is supported.");
  }
}

async function readImage(buffer: Buffer): Promise<FileText> {
  const { createWorker } = await import("tesseract.js");

  // The language data (~15 MB) is fetched on first use and cached afterwards,
  // so the first OCR of a cold deployment is slower than the rest. It is kept
  // in a dedicated directory rather than the default, which is the working
  // directory - that dropped a 15 MB blob next to package.json.
  const worker = await createWorker("eng", undefined, {
    cachePath: resolve(process.cwd(), ".ocr-cache"),
  });
  try {
    const { data } = await worker.recognize(buffer);
    const text = data.text ?? "";
    if (looksEmpty(text)) {
      throw new FileReadError(
        "No readable text was found in that image. A sharper or straighter scan usually helps.",
      );
    }
    return {
      text,
      method: "image OCR",
      warning: "OCR output is rough — check the years and spellings before extracting.",
    };
  } finally {
    await worker.terminate();
  }
}

/** Dispatches on extension first, then on the browser-reported type. */
export async function readCvFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<FileText> {
  if (buffer.byteLength === 0) throw new FileReadError("That file is empty.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new FileReadError(
      `That file is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      413,
    );
  }

  const extension = extensionOf(filename);
  const type = mimeType.toLowerCase();

  if (extension === ".txt" || extension === ".md" || type.startsWith("text/")) {
    return { text: buffer.toString("utf8"), method: "plain text" };
  }

  if (extension === ".pdf" || type === "application/pdf") {
    return readPdf(new Uint8Array(buffer));
  }

  if (
    extension === ".docx" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return readDocx(buffer);
  }

  if (type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return readImage(buffer);
  }

  if (extension === ".doc") {
    throw new FileReadError("Legacy .doc files are not supported. Save as .docx or PDF.");
  }

  throw new FileReadError(
    `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
  );
}

/** Collapses the ragged whitespace that PDF and OCR output arrive with. */
export function tidyExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
