import { NextResponse } from "next/server";
import { ExtractorError, getExtractor, describeProvider } from "@/lib/ai";
import { env } from "@/lib/env";
import { ExtractRequestSchema, fieldErrors } from "@/lib/schema";

/**
 * POST /api/extract
 * Unstructured CV text in, Zod-validated draft records out.
 * Nothing is written to the database here - a human reviews first.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  if (parsed.data.text.length > env.maxCvChars) {
    return NextResponse.json(
      {
        error: `CV text is ${parsed.data.text.length} characters; the limit is ${env.maxCvChars}. Split it into parts.`,
      },
      { status: 413 },
    );
  }

  try {
    const extractor = getExtractor();
    const result = await extractor.extract(parsed.data);
    return NextResponse.json({
      provider: extractor.name,
      model: extractor.model,
      entryCount: result.entries.length,
      result,
    });
  } catch (error) {
    if (error instanceof ExtractorError) {
      return NextResponse.json(
        { error: error.message, details: error.details, provider: describeProvider().provider },
        { status: error.status },
      );
    }
    console.error("extract failed:", error);
    return NextResponse.json({ error: "Extraction failed." }, { status: 500 });
  }
}

/** GET /api/extract - which provider is wired up, without exposing keys. */
export async function GET() {
  return NextResponse.json(describeProvider());
}
