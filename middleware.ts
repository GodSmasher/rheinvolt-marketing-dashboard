import { NextRequest, NextResponse } from "next/server";

export const config = { matcher: ["/((?!_next|api/health|favicon.ico).*)"] };

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
      if (u === user && p === pass) return NextResponse.next();
    }
  }
  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="HomeServe Dashboard"' },
  });
}
