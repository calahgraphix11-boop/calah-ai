import { NextResponse } from "next/server";

const COOKIE_NAME = "ncc_access";

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function middleware(request: Request) {
  const secret = process.env.WORKSPACE_SESSION_SECRET;
  const token = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
  if (secret && token) {
    const [expires, supplied] = token.split(".");
    const validExpiry = /^\d+$/.test(expires || "") && Number(expires) > Math.floor(Date.now() / 1000);
    if (validExpiry && supplied && safeEqual(supplied, await signature(expires, secret))) return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/?locked=1", request.url));
}

export const config = {
  matcher: ["/((?!api/unlock|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"]
};
