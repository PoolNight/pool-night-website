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
    const raw = await store.get("tournoi", { type: "text" });
    if (!raw) return new Response("null", { headers });
    /* ?since=N : si rien n'a changé depuis la version N, on ne renvoie presque rien (sondage léger des organisateurs) */
    const since = new URL(req.url).searchParams.get("since");
    if (since !== null) {
      try { if (String(JSON.parse(raw)._rev || 0) === since) return new Response('{"same":true}', { headers }); } catch { /* on renvoie tout */ }
    }
    return new Response(raw, { headers });
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
    let obj;
    try { obj = JSON.parse(body); } catch { return new Response("bad json", { status: 400 }); }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return new Response("bad format", { status: 400 });
    /* plusieurs organisateurs : chaque écriture part d'une version connue (x-base-rev). Si quelqu'un a écrit entre-temps,
       on refuse (409) et on renvoie la version actuelle pour que le navigateur fusionne puis réessaie. */
    const cur = await store.get("tournoi", { type: "text" });
    let rev = 0;
    try { rev = cur ? JSON.parse(cur)._rev || 0 : 0; } catch { rev = 0; }
    const base = req.headers.get("x-base-rev");
    if (base !== null && Number(base) !== rev) return new Response(cur || "null", { status: 409, headers });
    obj._rev = rev + 1;
    await store.set("tournoi", JSON.stringify(obj));
    return new Response(JSON.stringify({ rev: obj._rev }), { headers });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/tournoi" };
