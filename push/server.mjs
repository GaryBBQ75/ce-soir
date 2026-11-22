// Service de notifications « Y'a quoi ce soir » (tourne sur Coolify).
// Chaque minute : lit le programme du jour et les abonnements PocketBase,
// et envoie les notifications dues (rappels, émissions suivies, films qui repassent).
import webpush from 'web-push';
import http from 'node:http';

const PB_URL = process.env.PB_URL ?? 'https://cesoir-api.57.129.170.196.sslip.io';
const PUSH_KEY = process.env.PUSH_KEY; // secret partagé avec la règle d'accès PocketBase
const DATA_URL = process.env.DATA_URL ?? 'https://raw.githubusercontent.com/GaryBBQ75/ce-soir/data/data/tonight.json';
const APP_URL = process.env.APP_URL ?? 'https://garybbq75.github.io/ce-soir/';

if (!PUSH_KEY || !process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
  console.error('Variables manquantes : PUSH_KEY, VAPID_PUBLIC, VAPID_PRIVATE');
  process.exit(1);
}
webpush.setVapidDetails('mailto:gary.legrill@gmail.com', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);

const showKey = (t) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*\*\d{4}$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const hhmm = (iso) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(':', 'h');
const dayLabel = (iso) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));

let tonight = null;
let loadedAt = 0;
async function loadTonight() {
  if (tonight && Date.now() - loadedAt < 20 * 60_000) return tonight;
  const r = await fetch(DATA_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error(`programme ${r.status}`);
  tonight = await r.json();
  loadedAt = Date.now();
  return tonight;
}

const headers = { 'x-push-key': PUSH_KEY, 'content-type': 'application/json' };
async function pb(path, init = {}) {
  const r = await fetch(`${PB_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`PocketBase ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function allSubs() {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await pb(`/api/collections/push_subs/records?perPage=200&page=${page}`);
    out.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return out;
}

async function send(sub, payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 3600 });
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await pb(`/api/collections/push_subs/records/${sub.id}`, { method: 'DELETE' }).catch(() => {});
      console.log('abonnement expiré supprimé', sub.id);
    } else console.error('envoi', e.statusCode ?? e.message);
    return false;
  }
}

let lastRun = Date.now() - 60_000;

async function tick() {
  const now = Date.now();
  const from = lastRun;
  lastRun = now;
  const t = await loadTonight();
  const chan = new Map(t.channels.map((c) => [c.id, c.name]));
  const subs = await allSubs();

  for (const sub of subs) {
    const before = (sub.notify_before ?? 10) * 60_000;
    const follows = sub.follows ?? {};
    const reminders = sub.reminders ?? {};
    const announced = { ...(sub.announced ?? {}) };
    let changed = false;

    for (const f of t.films) {
      const at = Date.parse(f.start) - before;
      if (!(at > from && at <= now)) continue;
      const key = showKey(f.title);
      const fol = follows[key];
      const followedNow = fol && fol.notify !== false && (!fol.since || Date.parse(f.start) > fol.since + 3600_000);
      if (!reminders[f.id] && !followedNow) continue;
      const mins = Math.round(before / 60_000);
      await send(sub, {
        title: f.title,
        body: `${mins > 0 ? `Dans ${mins} min` : 'Maintenant'} sur ${chan.get(f.channelId) ?? f.channel ?? ''} (${hhmm(f.start)})`,
        tag: f.id,
        url: APP_URL,
      });
    }

    // Films en alerte : prévenir une fois dès qu'une nouvelle diffusion est annoncée
    for (const [key, fol] of Object.entries(follows)) {
      if (!fol.film) continue;
      const airings = [
        ...t.films.filter((f) => showKey(f.title) === key).map((f) => [f.channelId, f.start]),
        ...(t.later?.[key] ?? []),
      ].filter(([, s]) => Date.parse(s) > now && (!fol.since || Date.parse(s) > fol.since + 3600_000));
      const next = airings.sort((a, b) => a[1].localeCompare(b[1]))[0];
      if (!next || announced[key] === next[1]) continue;
      if (await send(sub, {
        title: `${fol.title} repasse`,
        body: `${dayLabel(next[1])} à ${hhmm(next[1])} sur ${chan.get(next[0]) ?? next[0]}`,
        tag: `repasse-${key}`,
        url: APP_URL,
      })) {
        announced[key] = next[1];
        changed = true;
      }
    }

    if (changed) await pb(`/api/collections/push_subs/records/${sub.id}`, { method: 'PATCH', body: JSON.stringify({ announced }) }).catch(() => {});
  }
}

setInterval(() => tick().catch((e) => console.error('tick', e.message)), 60_000);
tick().catch((e) => console.error('tick', e.message));

// Petit point de santé pour Coolify
http.createServer((_, res) => res.end('ok')).listen(process.env.PORT ?? 3000);
console.log('Service de notifications démarré');
