/* Anti force brute de la clé organisateur : 8 mauvaises clés par heure et par adresse IP (IP stockée hachée). */
const HOUR = 36e5, LIMIT = 8;
async function k(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pn|orgafail|' + ip));
  return 'r:' + [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}
export const ipOf = (req, context) => (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '';
export async function blocked(store, ip, now = Date.now()) {
  if (!ip) return false;
  const rec = await store.get(await k(ip), { type: 'json' });
  return !!rec && rec.t.filter(x => now - x < HOUR).length >= LIMIT;
}
export async function fail(store, ip, now = Date.now()) {
  if (!ip) return;
  const key = await k(ip), rec = (await store.get(key, { type: 'json' })) || { t: [] };
  rec.t = rec.t.filter(x => now - x < HOUR).concat(now);
  await store.setJSON(key, rec);
}
