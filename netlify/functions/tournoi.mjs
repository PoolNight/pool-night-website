import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";
import { blocked, fail, ipOf } from "../lib/ratelimit.mjs";

const same = (a, b) => {
  const x = Buffer.from(a || ""), y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};
/* 'ok' | 'no' | 'blocked' (trop de mauvaises clés depuis cette adresse IP) */
const check = async (req, store, ip) => {
  if (await blocked(store, ip)) return "blocked";
  const key = Netlify.env.get("ORGANIZER_KEY");
  if (!!key && same(req.headers.get("x-organizer-key"), key)) return "ok";
  await fail(store, ip);
  return "no";
};
const denied = (r) => r === "blocked"
  ? new Response("too many attempts", { status: 429 })
  : new Response("forbidden", { status: 403 });

export default async (req, context) => {
  const store = getStore({ name: "poolnight", consistency: "strong" });
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const ip = ipOf(req, context);

  if (req.method === "GET") {
    const data = await store.get("tournoi", { type: "text" });
    return new Response(data || "null", { headers });
  }

  // POST = vérifier la clé organisateur (ne renvoie jamais la clé)
  if (req.method === "POST") {
    const r = await check(req, store, ip);
    return r === "ok" ? new Response("ok", { headers }) : denied(r);
  }

  if (req.method === "PUT") {
    const r = await check(req, store, ip);
    if (r !== "ok") return denied(r);
    const body = await req.text();
    if (body.length > 500000) return new Response("too large", { status: 413 });
    try { JSON.parse(body); } catch { return new Response("bad json", { status: 400 }); }
    await store.set("tournoi", body);
    return new Response("ok", { headers });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/tournoi" };
