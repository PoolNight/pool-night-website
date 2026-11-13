/* Défis entre joueurs PoolNight : stockage dans Netlify Blobs, route /api/defis.
   Variable d'environnement à définir sur Netlify : ORGANIZER_KEY (la même clé que celle de la page tournois). */

const DAY = 864e5, HOUR = 36e5, EXPIRE = 7 * DAY;
const MAX_TOTAL = 3000, MAX_PAIR_DAY = 3, MAX_PENDING_BY = 5;
const MAX_PLAYER_WEEK = 10;      /* défis (en attente + comptés) par joueur sur 7 jours */
const MAX_PENDING_ALL = 150;     /* défis en attente en même temps, tous joueurs confondus */
const IP_CREATE = 6;             /* créations de défis par heure et par adresse IP */
const IP_ANSWER = 20;            /* confirmations / annulations (réussies ou non) par heure et par IP */
const IP_ORGA_FAIL = 8;          /* mauvaises clés organisateur par heure et par IP */

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
const STATUS = ['pending', 'awaiting', 'confirmed', 'rejected', 'void'];
const LIVE = ['pending', 'awaiting', 'confirmed'];

const pub = (d, now) => {
  const { ck, dk, ...p } = d;
  if (p.status === 'pending' && now - p.t > EXPIRE) p.status = 'expired';
  return p;
};

/* limitation de débit par adresse IP (l'IP est stockée hachée) */
async function rlKey(ip, kind) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pn|' + kind + '|' + ip));
  return 'r:' + [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function rlCount(store, ip, kind, win, now) {
  if (!ip) return 0;
  const rec = await store.get(await rlKey(ip, kind), { type: 'json' });
  return rec ? rec.t.filter(x => now - x < win).length : 0;
}
async function rlAdd(store, ip, kind, win, now) {
  if (!ip) return;
  const k = await rlKey(ip, kind), rec = (await store.get(k, { type: 'json' })) || { t: [] };
  rec.t = rec.t.filter(x => now - x < win).concat(now);
  await store.setJSON(k, rec);
}

/* cœur testable : store = { get, setJSON, delete, list } (Netlify Blobs) */
export async function handle(req, store, env, now = Date.now(), ip = '') {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  const all = async () => {
    const { blobs } = await store.list({ prefix: 'd:' });
    return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
  };
  const cfg = async () => (await store.get('cfg', { type: 'json' })) || { validation: false };
  if (req.method === 'GET') {
    const c = await cfg();
    return out({ now, validation: !!c.validation, defis: (await all()).map(d => pub(d, now)).sort((a, b) => b.t - a.t) });
  }
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
    if (await rlCount(store, ip, 'create', HOUR, now) >= IP_CREATE) return err('Trop de défis envoyés depuis cette connexion. Réessaie dans une heure.', 429);
    const list = await all();
    if (list.length >= MAX_TOTAL) return err('Trop de défis enregistrés, préviens le bureau.', 507);
    const live = list.filter(d => LIVE.includes(d.status) && !(d.status === 'pending' && now - d.t > EXPIRE));
    if (live.filter(d => d.status === 'pending').length >= MAX_PENDING_ALL) return err('Trop de défis en attente de confirmation pour le moment. Réessaie plus tard.', 429);
    const pk = [pkey(a), pkey(o)].sort().join('|');
    const recent = live.filter(d => now - d.t < DAY && [pkey(d.a), pkey(d.b)].sort().join('|') === pk);
    if (recent.length >= MAX_PAIR_DAY) return err(`Maximum ${MAX_PAIR_DAY} défis par jour entre les deux mêmes joueurs.`, 429);
    for (const n of [a, o]) {
      const k = pkey(n);
      if (live.filter(d => now - d.t < EXPIRE && (pkey(d.a) === k || pkey(d.b) === k)).length >= MAX_PLAYER_WEEK)
        return err(`${n} a déjà atteint ${MAX_PLAYER_WEEK} défis sur les 7 derniers jours.`, 429);
    }
    if (live.filter(d => d.status === 'pending' && pkey(d.a) === pkey(a)).length >= MAX_PENDING_BY)
      return err('Tu as déjà trop de défis en attente de confirmation.', 429);
    await rlAdd(store, ip, 'create', HOUR, now);
    const d = { id: rnd(12), a, b: o, w, score: cleanScore(b.score), status: 'pending', t: now, ck: rnd(24), dk: rnd(24) };
    await store.setJSON('d:' + d.id, d);
    return out({ id: d.id, ck: d.ck, dk: d.dk });
  }

  if (act === 'confirm' || act === 'cancel') {
    if (await rlCount(store, ip, 'answer', HOUR, now) >= IP_ANSWER) return err('Trop de tentatives. Réessaie dans une heure.', 429);
    await rlAdd(store, ip, 'answer', HOUR, now);
    const d = await get(b.id);
    if (act === 'confirm') {
      if (!d || d.ck !== b.ck) return err('Lien invalide.', 403);
      if (d.status !== 'pending') return err('Ce défi a déjà été traité.', 409);
      if (now - d.t > EXPIRE) return err('Ce défi a expiré (plus de 7 jours).', 410);
      d.status = b.accept ? ((await cfg()).validation ? 'awaiting' : 'confirmed') : 'rejected';
      d.tc = now;
      await store.setJSON('d:' + d.id, d);
      return out({ ok: true, status: d.status });
    }
    if (!d || d.dk !== b.dk) return err('Annulation refusée.', 403);
    if (d.status !== 'pending') return err('Ce défi a déjà été traité.', 409);
    await store.delete('d:' + d.id);
    return out({ ok: true });
  }

  if (act === 'orga_update' || act === 'orga_delete' || act === 'orga_config') {
    /* anti force brute : trop de mauvaises clés => refus avant même de comparer */
    if (await rlCount(store, ip, 'orgafail', HOUR, now) >= IP_ORGA_FAIL) return err('Trop d’essais. Réessaie dans une heure.', 429);
    const key = req.headers.get('x-organizer-key');
    if (!env.ORGANIZER_KEY || key !== env.ORGANIZER_KEY) { await rlAdd(store, ip, 'orgafail', HOUR, now); return err('Clé organisateur incorrecte.', 401); }
    if (act === 'orga_config') {
      await store.setJSON('cfg', { validation: !!b.validation });
      return out({ ok: true, validation: !!b.validation });
    }
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

export default async (req, context) => {
  const { getStore } = await import('@netlify/blobs');
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '';
  return handle(req, getStore({ name: 'defis', consistency: 'strong' }), process.env, Date.now(), ip);
};

export const config = { path: '/api/defis' };
