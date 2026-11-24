import {
  clearOrganizerSession,
  createOrganizerSession,
  hasOrganizerSession,
  matchesOrganizerKey,
  sameOrigin,
} from "../lib/organizer-session.mjs";
import { blocked, fail, ipOf } from "../lib/ratelimit.mjs";

function respond(status, cookie) {
  const headers = { "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status, headers });
}

export async function handle(req, secret, ip, store) {
  if (req.method === "GET") {
    return respond((await hasOrganizerSession(req, secret, store)) ? 204 : 401);
  }
  if (req.method !== "POST" && req.method !== "DELETE") return respond(405);
  if (!sameOrigin(req)) return respond(403);
  if (req.method === "DELETE") {
    return respond(204, await clearOrganizerSession(req, secret, store));
  }

  if (await blocked(store, ip)) return respond(429);
  if (!matchesOrganizerKey(req.headers.get("x-organizer-key"), secret)) {
    await fail(store, ip);
    return respond(401);
  }

  await clearOrganizerSession(req, secret, store);
  return respond(204, await createOrganizerSession(secret, store));
}

export default async (req, context) => {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "organizer-sessions", consistency: "strong" });
  return handle(
    req,
    Netlify.env.get("ORGANIZER_KEY"),
    ipOf(req, context),
    store,
  );
};

export const config = { path: "/api/organisateur" };
