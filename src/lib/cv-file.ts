/**
 * Reading a CV out of an uploaded file.
 *
 * Artists send CVs as PDFs, Word documents and, often enough, as a photograph
 * or a scan. Each needs a different reader, and none of them is the AI step:
 * this module's only job is to get plain text out of a file so the extractor
 * has something to work with. Nothing here is stored — the bytes live in
 * memory for the length of the request.
 *
 *   .txt .md            read directly
 *   .pdf                text layer via unpdf, or OCR of rendered pages
 *   .docx               mammoth
 *   images              OCR
 *
 * Every library is pure JavaScript, WASM, or ships prebuilt binaries. A
 * module needing a compiler would not install on the deployment host, which
 * only runs `npm install && npm start`.
 */

import { resolve } from "node:path";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"];

/** OCR runs at roughly a second a page; a CV past this is not a CV. */
const MAX_OCR_PAGES = 15;

export type FileText = {
  text: string;
  /**
   * How the text was obtained, shown to the archivist. Worded for a reader
   * rather than a developer: which reader ran is not their concern.
   */
  method: "plain text" | "PDF" | "Word document" | "photo or scan" | "scanned PDF";
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

/**
 * One OCR worker, reused across pages.
 *
 * Starting a worker costs more than reading a page, so a ten-page scan with a
 * worker per page would spend most of its time on setup. The language data
 * (~5 MB) is fetched on first use and cached in .ocr-cache rather than the
 * working directory, which is the default and drops the blob next to
 * package.json.
 */
async function withOcr<T>(
  run: (read: (image: Buffer | Uint8Array) => Promise<string>) => Promise<T>,
): Promise<T> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    cachePath: resolve(process.cwd(), ".ocr-cache"),
  });

  try {
    return await run(async (image) => {
      const { data } = await worker.recognize(Buffer.from(image));
      return data.text ?? "";
    });
  } finally {
    await worker.terminate();
  }
}

/** Renders each page to an image and reads it. */
async function ocrPdf(bytes: Uint8Array, totalPages: number): Promise<FileText> {
  const { renderPageAsImage } = await import("unpdf");
  const pages = Math.min(totalPages, MAX_OCR_PAGES);

  const text = await withOcr(async (read) => {
    const parts: string[] = [];
    for (let page = 1; page <= pages; page += 1) {
      // A fresh copy per call: pdf.js detaches the buffer it is handed.
      const image = await renderPageAsImage(new Uint8Array(bytes), page, {
        scale: 2,
        canvasImport: () => import("@napi-rs/canvas"),
      });
      parts.push(await read(new Uint8Array(image)));
    }
    return parts.join("\n\n");
  });

  if (looksEmpty(text)) {
    throw new FileReadError("No readable text was found in that PDF.");
  }

  const skipped = totalPages - pages;
  return {
    text,
    method: "scanned PDF",
    pages,
    warning: [
      "Text read from a scan can be rough — check the years and spellings.",
      skipped > 0 ? `Only the first ${pages} of ${totalPages} pages were read.` : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function readPdf(bytes: Uint8Array, forceOcr: boolean): Promise<FileText> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  let totalPages = 0;
  let text = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(pdf, { mergePages: true });
    totalPages = result.totalPages;
    text = String(result.text ?? "");
  } catch {
    throw new FileReadError(
      "That PDF could not be opened. It may be corrupt or password-protected.",
    );
  }

  // The text layer is exact when it exists, so it wins unless recognition was
  // asked for. A PDF of scans has none, and then OCR is the only way in.
  if (!forceOcr && !looksEmpty(text)) {
    return { text, method: "PDF", pages: totalPages };
  }

  return ocrPdf(bytes, totalPages || 1);
}

async function readDocx(buffer: Buffer): Promise<FileText> {
  const mammoth = await import("mammoth");
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, method: "Word document" };
  } catch {
    throw new FileReadError("That Word document could not be read. Only .docx is supported.");
  }
}

async function readImage(buffer: Buffer): Promise<FileText> {
  const text = await withOcr((read) => read(buffer));

  if (looksEmpty(text)) {
    throw new FileReadError(
      "No readable text was found in that image. A sharper, straighter photo usually helps.",
    );
  }

  return {
    text,
    method: "photo or scan",
    warning: "Text read from an image can be rough — check the years and spellings.",
  };
}

/** Dispatches on extension first, then on the browser-reported type. */
export async function readCvFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  options: { forceOcr?: boolean } = {},
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
  const forceOcr = options.forceOcr === true;

  if (extension === ".txt" || extension === ".md" || type.startsWith("text/")) {
    // Nothing to recognise: the characters are already there.
    return { text: buffer.toString("utf8"), method: "plain text" };
  }

  if (extension === ".pdf" || type === "application/pdf") {
    return readPdf(new Uint8Array(buffer), forceOcr);
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

  throw new FileReadError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}.`);
}

/** Collapses the ragged whitespace that PDF and scanned text arrive with. */
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
