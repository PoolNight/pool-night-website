/* Défis entre joueurs PoolNight : stockage dans Netlify Blobs, route /api/defis.
   Variable d'environnement à définir sur Netlify : ORGANIZER_KEY (la même clé que celle de la page tournois). */

const DAY = 864e5, EXPIRE = 7 * DAY, MAX_TOTAL = 3000, MAX_PAIR_DAY = 3, MAX_PENDING_BY = 5;
const H = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,x-organizer-key',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};
const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const err = (m, s = 400) => out({ error: m }, s);

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pkey = n => norm(n).split(/\s+/).sort().join(' ');
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
const cleanScore = s => String(s == null ? '' : s).replace(/[^0-9 :\-–]/g, '').trim().slice(0, 10);
const rnd = n => crypto.randomUUID().replace(/-/g, '').slice(0, n);
const STATUS = ['pending', 'confirmed', 'rejected', 'void'];

const pub = (d, now) => {
  const { ck, dk, ...p } = d;
  if (p.status === 'pending' && now - p.t > EXPIRE) p.status = 'expired';
  return p;
};

/* cœur testable : store = { get, setJSON, delete, list } (Netlify Blobs) */
export async function handle(req, store, env, now = Date.now()) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  const all = async () => {
    const { blobs } = await store.list({ prefix: 'd:' });
    return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
  };
  if (req.method === 'GET') return out({ now, defis: (await all()).map(d => pub(d, now)).sort((a, b) => b.t - a.t) });
  if (req.method !== 'POST') return err('Méthode non autorisée', 405);

  let b;
  try { b = await req.json(); } catch (e) { return err('Requête invalide'); }
  const act = b && b.action;
  const get = id => /^[a-f0-9]{12}$/.test(String(id)) ? store.get('d:' + id, { type: 'json' }) : null;

  if (act === 'create') {
    const a = clean(b.a), o = clean(b.b), w = b.w;
    if (a.length < 2 || o.length < 2) return err('Renseigne ton nom et celui de ton adversaire.');
    if (pkey(a) === pkey(o)) return err('Tu ne peux pas te défier toi-même.');
    if (w !== 0 && w !== 1) return err('Résultat invalide.');
    const list = await all();
    if (list.length >= MAX_TOTAL) return err('Trop de défis enregistrés, préviens le bureau.', 507);
    const pk = [pkey(a), pkey(o)].sort().join('|');
    const recent = list.filter(d => now - d.t < DAY && (d.status === 'pending' || d.status === 'confirmed') && [pkey(d.a), pkey(d.b)].sort().join('|') === pk);
    if (recent.length >= MAX_PAIR_DAY) return err(`Maximum ${MAX_PAIR_DAY} défis par jour entre les deux mêmes joueurs.`, 429);
    if (list.filter(d => d.status === 'pending' && now - d.t < EXPIRE && pkey(d.a) === pkey(a)).length >= MAX_PENDING_BY)
      return err('Tu as déjà trop de défis en attente de confirmation.', 429);
    const d = { id: rnd(12), a, b: o, w, score: cleanScore(b.score), status: 'pending', t: now, ck: rnd(24), dk: rnd(24) };
    await store.setJSON('d:' + d.id, d);
    return out({ id: d.id, ck: d.ck, dk: d.dk });
  }

  if (act === 'confirm') {
    const d = await get(b.id);
    if (!d || d.ck !== b.ck) return err('Lien invalide.', 403);
    if (d.status !== 'pending') return err('Ce défi a déjà été traité.', 409);
    if (now - d.t > EXPIRE) return err('Ce défi a expiré (plus de 7 jours).', 410);
    d.status = b.accept ? 'confirmed' : 'rejected';
    d.tc = now;
    await store.setJSON('d:' + d.id, d);
    return out({ ok: true, status: d.status });
  }

  if (act === 'cancel') {
    const d = await get(b.id);
    if (!d || d.dk !== b.dk) return err('Annulation refusée.', 403);
    if (d.status !== 'pending') return err('Ce défi a déjà été traité.', 409);
    await store.delete('d:' + d.id);
    return out({ ok: true });
  }

  if (act === 'orga_update' || act === 'orga_delete') {
    const key = req.headers.get('x-organizer-key');
    if (!env.ORGANIZER_KEY || key !== env.ORGANIZER_KEY) return err('Clé organisateur incorrecte.', 401);
    const d = await get(b.id);
    if (!d) return err('Défi introuvable.', 404);
    if (act === 'orga_delete') { await store.delete('d:' + d.id); return out({ ok: true }); }
    const a = clean(b.a), o = clean(b.b);
    if (a.length < 2 || o.length < 2 || pkey(a) === pkey(o)) return err('Noms invalides.');
    if (b.w !== 0 && b.w !== 1) return err('Résultat invalide.');
    if (!STATUS.includes(b.status)) return err('Statut invalide.');
    if (b.status === 'confirmed' && d.status !== 'confirmed') d.tc = now;
    Object.assign(d, { a, b: o, w: b.w, score: cleanScore(b.score), status: b.status, edited: true });
    await store.setJSON('d:' + d.id, d);
    return out({ ok: true });
  }
  return err('Action inconnue.');
}

export default async (req) => {
  const { getStore } = await import('@netlify/blobs');
  return handle(req, getStore('defis'), process.env);
};

export const config = { path: '/api/defis' };
