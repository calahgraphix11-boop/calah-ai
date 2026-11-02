import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const configuredPin = process.env.WORKSPACE_PIN;
  const secret = process.env.WORKSPACE_SESSION_SECRET;
  if (!configuredPin || !secret) return NextResponse.json({ error: "Access is not configured." }, { status: 503 });

  let body: { pin?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const submittedPin = typeof body.pin === "string" ? body.pin : "";
  if (!safeEqual(submittedPin, configuredPin)) return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });

  const expires = String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7);
  const token = expires + "." + await signature(expires, secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
