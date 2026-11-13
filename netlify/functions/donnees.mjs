/* Données du site principal (évènements + résultats de tournois) et affiches d'évènements, dans Netlify Blobs.
   GET  /api/donnees            -> données publiées (ou "null" si rien n'a encore été publié)
   PUT  /api/donnees            -> publier (clé organisateur)
   GET  /api/affiche/ev-<n>.jpg -> affiche
   PUT  /api/affiche/ev-<n>.jpg -> téléverser une affiche JPEG (clé organisateur) */
import { timingSafeEqual } from "node:crypto";
import { blocked, fail, ipOf } from "../lib/ratelimit.mjs";

const same = (a, b) => {
  const x = Buffer.from(a || ""), y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};
const J = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const txt = (m, s) => new Response(m, { status: s, headers: { "Cache-Control": "no-store" } });

export async function handle(req, store, orgKey, ip = "") {
  const url = new URL(req.url), p = url.pathname;
  const auth = async () => {
    if (await blocked(store, ip)) return txt("too many attempts", 429);
    if (orgKey && same(req.headers.get("x-organizer-key"), orgKey)) return null;
    await fail(store, ip);
    return txt("forbidden", 403);
  };

  if (p === "/api/donnees") {
    if (req.method === "GET") return new Response((await store.get("data", { type: "text" })) || "null", { headers: J });
    if (req.method === "PUT") {
      const bad = await auth(); if (bad) return bad;
      const body = await req.text();
      if (body.length > 400000) return txt("too large", 413);
      let d; try { d = JSON.parse(body); } catch { return txt("bad json", 400); }
      if (!d || !Array.isArray(d.events) || d.events.length > 300 || (d.results && (!Array.isArray(d.results) || d.results.length > 400)))
        return txt("bad format", 400);
      await store.set("data", JSON.stringify({ events: d.events, results: d.results || [] }));
      return new Response("ok", { headers: J });
    }
    return txt("method not allowed", 405);
  }

  const m = p.match(/^\/api\/affiche\/(ev-\d{10,16}\.jpg)$/);
  if (m) {
    const key = "img:" + m[1];
    if (req.method === "GET") {
      const buf = await store.get(key, { type: "arrayBuffer" });
      if (!buf) return txt("not found", 404);
      return new Response(buf, { headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" } });
    }
    if (req.method === "PUT") {
      const bad = await auth(); if (bad) return bad;
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 900000) return txt("too large", 413);
      const b = new Uint8Array(buf);
      if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return txt("not a jpeg", 400);
      await store.set(key, buf);
      return new Response("ok", { headers: J });
    }
    return txt("method not allowed", 405);
  }
  return txt("not found", 404);
}

export default async (req, context) => {
  const { getStore } = await import("@netlify/blobs");
  return handle(req, getStore({ name: "site", consistency: "strong" }), Netlify.env.get("ORGANIZER_KEY"), ipOf(req, context));
};

export const config = { path: ["/api/donnees", "/api/affiche/*"] };
