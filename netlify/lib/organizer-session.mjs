import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "__Host-pn_organizer";
const MAX_AGE = 8 * 60 * 60;
const COOKIE_OPTIONS = "Path=/; Secure; HttpOnly; SameSite=Strict";

export function sameOrigin(req) {
  return req.headers.get("origin") === new URL(req.url).origin;
}

export function matchesOrganizerKey(candidate, secret) {
  if (!secret || typeof candidate !== "string") return false;
  const supplied = Buffer.from(candidate);
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function sessionKey(req, secret) {
  const cookie = req.headers.get("cookie") || "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return secret && /^[a-f0-9]{64}$/.test(value || "")
    ? storeKey(value, secret)
    : null;
}

function storeKey(value, secret) {
  return "session:" + createHmac("sha256", secret).update(value).digest("hex");
}

async function sessionStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "organizer-sessions", consistency: "strong" });
}

export async function hasOrganizerSession(
  req,
  secret,
  store,
  now = Date.now(),
) {
  const key = sessionKey(req, secret);
  if (!key) return false;
  const sessions = store || (await sessionStore());
  const expiresAt = await sessions.get(key, { type: "json" });
  if (typeof expiresAt !== "number") return false;
  if (expiresAt > now) return true;
  await sessions.delete(key);
  return false;
}

export async function createOrganizerSession(secret, store, now = Date.now()) {
  const sessions = store || (await sessionStore());
  const value = randomBytes(32).toString("hex");
  await sessions.setJSON(storeKey(value, secret), now + MAX_AGE * 1000);
  return COOKIE + "=" + value + "; Max-Age=" + MAX_AGE + "; " + COOKIE_OPTIONS;
}

export async function clearOrganizerSession(req, secret, store) {
  const key = sessionKey(req, secret);
  if (key) await (store || (await sessionStore())).delete(key);
  return COOKIE + "=; Max-Age=0; " + COOKIE_OPTIONS;
}
