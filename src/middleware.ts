import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Gate for the admin panel and for every write to the archive.
 *
 * Reads stay public: the catalogue and `GET /api/entries` are the point of
 * the archive. Anything that creates, changes or deletes a record, and every
 * extraction request, needs a session — extraction because it spends money at
 * the AI provider.
 */
const PUBLIC_READ_PREFIXES = ["/api/entries"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Without these there would be no way to sign in.
  const openPaths = [
    "/admin/login",
    "/admin/register",
    "/api/admin/session",
    "/api/admin/register",
  ];
  if (openPaths.includes(pathname)) return NextResponse.next();

  const isPublicRead =
    SAFE_METHODS.has(request.method) &&
    PUBLIC_READ_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublicRead) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // A redirect would look like success to fetch(), so APIs get a status.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = "";
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/entries/:path*", "/api/extract"],
};
