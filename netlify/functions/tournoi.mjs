import { hasOrganizerSession, sameOrigin } from "../lib/organizer-session.mjs";
import { isTournament } from "../lib/tournament-schema.mjs";

export async function handle(req, store, authorize) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  if (req.method === "GET") {
    const raw = await store.get("tournoi", { type: "text" });
    if (!raw) return new Response("null", { headers });
    /* ?since=N : si rien n'a changé depuis la version N, on ne renvoie presque rien (sondage léger des organisateurs) */
    const since = new URL(req.url).searchParams.get("since");
    if (since !== null) {
      try {
        if (String(JSON.parse(raw)._rev || 0) === since)
          return new Response('{"same":true}', { headers });
      } catch {
        /* on renvoie tout */
      }
    }
    return new Response(raw, { headers });
  }

  if (req.method === "PUT") {
    if (!sameOrigin(req)) return new Response("forbidden", { status: 403 });
    if (!(await authorize(req))) {
      return new Response("unauthorized", { status: 401 });
    }
    const body = await req.text();
    if (body.length > 500000) return new Response("too large", { status: 413 });
    let obj;
    try {
      obj = JSON.parse(body);
    } catch {
      return new Response("bad json", { status: 400 });
    }
    if (!isTournament(obj)) return new Response("bad format", { status: 400 });
    /* plusieurs organisateurs : chaque écriture part d'une version connue (x-base-rev). Si quelqu'un a écrit entre-temps,
       on refuse (409) et on renvoie la version actuelle pour que le navigateur fusionne puis réessaie. */
    const cur = await store.get("tournoi", { type: "text" });
    let rev = 0;
    try {
      rev = cur ? JSON.parse(cur)._rev || 0 : 0;
    } catch {
      rev = 0;
    }
    const base = req.headers.get("x-base-rev");
    if (base !== null && Number(base) !== rev)
      return new Response(cur || "null", { status: 409, headers });
    obj._rev = rev + 1;
    await store.set("tournoi", JSON.stringify(obj));
    return new Response(JSON.stringify({ rev: obj._rev }), { headers });
  }

  return new Response("method not allowed", { status: 405 });
}

export default async (req) => {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "poolnight", consistency: "strong" });
  return handle(req, store, (request) =>
    hasOrganizerSession(request, Netlify.env.get("ORGANIZER_KEY")),
  );
};

export const config = { path: "/api/tournoi" };
