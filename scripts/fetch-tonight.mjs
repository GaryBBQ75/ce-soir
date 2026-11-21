#!/usr/bin/env node
/**
 * Génère public/data/tonight.json : les programmes diffusés ce soir (films, séries, docs, divertissement, sport) (20h30 à 1h30, heure de Paris)
 * à partir des flux XMLTV gratuits de xmltvfr.fr, enrichis par TMDB si TMDB_API_KEY est défini.
 *
 * Usage : node scripts/fetch-tonight.mjs
 * Variables : TMDB_API_KEY (optionnel)
 */
import { gunzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/data/tonight.json');

// Ordre important : une chaîne déjà vue dans un bouquet précédent garde ce bouquet.
// Les noms de fichiers Canal+ et cinéma sont à vérifier sur https://xmltvfr.fr
// Le dernier flux (toutes les chaînes) est lourd : il sert à récupérer les chaînes hors TNT.
const SOURCES = [
  { bouquet: 'tnt', url: 'https://xmltvfr.fr/xmltv/xmltv_tnt.xml.gz' },
  { bouquet: 'canal', url: 'https://xmltvfr.fr/xmltv/xmltv_canalsat.xml.gz' },
  { bouquet: 'cinema', url: 'https://xmltvfr.fr/xmltv/xmltv_cinema.xml.gz' },
  { bouquet: 'autres', url: 'https://xmltvfr.fr/xmltv/xmltv.xml.gz' },
];

/** Les chaînes Canal+ et Ciné+ sont aussi dans le flux TNT : on les range par leur nom. */
function bouquetOf(id, name, fallback) {
  const s = `${id} ${name}`;
  if (/cin[ée]\s?\+|cineplus|\bocs\b|tcm|paramount/i.test(s)) return 'cinema';
  if (/canal\s?\+|canalplus/i.test(s)) return 'canal';
  return fallback;
}

const TMDB_KEY = process.env.TMDB_API_KEY;

// ---------- Fenêtre "ce soir" en heure de Paris ----------

function parisOffset(date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  return m ? `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}` : '+01:00';
}

function tonightWindow(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now); // YYYY-MM-DD
  const off = parisOffset(now);
  const from = Date.parse(`${day}T20:30:00${off}`);
  const to = from + 5 * 3600_000; // jusqu'à 1h30
  const primeEnd = Date.parse(`${day}T22:15:00${off}`);
  return { day, from, to, primeEnd };
}

// ---------- Lecture XMLTV ----------

const decode = (s) =>
  s
    ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
    .replace(/\s+/g, ' ')
    .trim();

const attr = (attrs, name) => decode(attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]);
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`))?.[1]);
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => decode(m[1]));

function parseTime(s) {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return NaN;
  const tz = m[7] ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : '+00:00';
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`);
}

async function fetchXml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return (url.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
}

/**
 * Type de programme à partir des catégories XMLTV.
 * null = on ignore (journal, météo, jeunesse, téléachat…).
 */
function kindOf(categories) {
  const c = categories.join(' | ').toLowerCase();
  if (/\bfilm\b|movie|cin[ée]ma|t[ée]l[ée]film/.test(c)) return 'film';
  if (/journal|information|m[ée]t[ée]o|loterie|jeunesse|dessin anim|t[ée]l[ée]achat|ind[ée]termin|fin des programmes|bulletin|religi/.test(c)) return null;
  if (/s[ée]rie|feuilleton|sitcom/.test(c)) return 'serie';
  if (/sport|football|rugby|tennis|cyclisme|basket|formule|handball|boxe|golf/.test(c)) return 'sport';
  if (/documentaire|magazine|reportage|d[ée]couverte|histoire|science|nature|voyage/.test(c)) return 'doc';
  if (/divertissement|jeu|r[ée]alit[ée]|vari[ée]t[ée]|humour|spectacle|concert|th[ée][âa]tre|talk|musique|[ée]mission/.test(c)) return 'divertissement';
  return null;
}

const MIN_DURATION = 20; // minutes : écarte les programmes courts

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Genres : même logique que src/genres.ts
const GENRE_MAP = [
  [/com[ée]die|comedy/i, 'Comédie'], [/action/i, 'Action'], [/aventure|adventure/i, 'Aventure'],
  [/anim/i, 'Animation'], [/famil|jeunesse|enfant/i, 'Famille'], [/horreur|horror|[ée]pouvante/i, 'Horreur'],
  [/thriller|suspense|myst[eè]re/i, 'Thriller'], [/policier|crime|polar|gangster/i, 'Policier'],
  [/science|sci-?fi/i, 'Science-fiction'], [/fantas/i, 'Fantastique'], [/romance|romanti|sentiment/i, 'Romance'],
  [/musical|musique|music/i, 'Musical'], [/western/i, 'Western'], [/guerre|war/i, 'Guerre'],
  [/histo|biopic|biograph/i, 'Histoire'], [/documentaire|documentary/i, 'Documentaire'], [/drame|drama|dramatique/i, 'Drame'],
];
function genres(raw) {
  const out = new Set();
  for (const r of raw) for (const part of r.split(/[:,/]/)) {
    for (const [re, label] of GENRE_MAP) if (re.test(part)) out.add(label);
  }
  return [...out];
}

function parseSource(xml, bouquet, win, channels, films, seenChannel) {
  for (const m of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/g)) {
    const id = attr(m[1], 'id');
    if (!id) continue;
    const name = tag(m[2], 'display-name') ?? id;
    if (!channels.has(id)) channels.set(id, name);
    // Une chaîne appartient au premier flux où on la voit (TNT avant les autres)
    if (!seenChannel.has(id)) seenChannel.set(id, { source: bouquet, bouquet: bouquetOf(id, name, bouquet) });
  }
  for (const m of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const start = parseTime(attr(m[1], 'start'));
    if (!(start >= win.from && start < win.to)) continue;
    const body = m[2];
    const cats = tags(body, 'category');
    const kind = kindOf(cats);
    if (!kind) continue;
    const channelId = attr(m[1], 'channel');
    if (!channelId) continue;
    if (!seenChannel.has(channelId)) seenChannel.set(channelId, { source: bouquet, bouquet: bouquetOf(channelId, channelId, bouquet) });
    const ch = seenChannel.get(channelId);
    if (ch.source !== bouquet) continue; // déjà lue dans un flux précédent

    const stop = parseTime(attr(m[1], 'stop'));
    if (Number.isFinite(stop) && (stop - start) / 60000 < MIN_DURATION) continue;
    const title = tag(body, 'title') ?? 'Sans titre';
    const key = `${channelId}-${start}`;
    if (films.has(key)) continue;
    const credits = body.match(/<credits>([\s\S]*?)<\/credits>/)?.[1] ?? '';
    films.set(key, {
      id: `${slug(channelId)}-${slug(title)}-${new Date(start).toISOString().slice(11, 16).replace(':', '')}`,
      kind,
      title,
      subTitle: tag(body, 'sub-title'),
      year: tag(body, 'date')?.slice(0, 4),
      channel: channels.get(channelId) ?? channelId,
      channelId,
      bouquet: ch.bouquet,
      start: new Date(start).toISOString(),
      stop: Number.isFinite(stop) ? new Date(stop).toISOString() : undefined,
      durationMin: Number.isFinite(stop) ? Math.round((stop - start) / 60000) : undefined,
      genres: genres(cats),
      directors: tags(credits, 'director').filter(Boolean),
      cast: tags(credits, 'actor').filter(Boolean).slice(0, 6),
      synopsis: tag(body, 'desc'),
      poster: body.match(/<icon\b[^>]*src="([^"]+)"/)?.[1],
      part: start < win.primeEnd ? 'prime' : 'seconde',
    });
  }
}

// ---------- Enrichissement TMDB (optionnel) ----------

async function tmdb(path, params) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params ?? {})) if (v) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${path} : HTTP ${res.status}`);
  return res.json();
}

/** Séries enchaînées sur la même chaîne : un seul bloc "3 épisodes". */
function mergeEpisodes(list) {
  const out = [];
  for (const f of list) {
    const prev = out.findLast((p) => p.channelId === f.channelId);
    if (prev && prev.kind === 'serie' && f.kind === 'serie' && prev.title === f.title && prev.stop && Math.abs(Date.parse(f.start) - Date.parse(prev.stop)) < 10 * 60000) {
      prev.stop = f.stop ?? prev.stop;
      prev.durationMin = Math.round((Date.parse(prev.stop) - Date.parse(prev.start)) / 60000);
      prev.episodes = (prev.episodes ?? 1) + 1;
      continue;
    }
    out.push(f);
  }
  return out;
}

async function enrichSerie(film) {
  try {
    const hit = (await tmdb('/search/tv', { query: film.title })).results?.[0];
    if (!hit) return film;
    return {
      ...film,
      tmdbId: hit.id,
      synopsis: film.synopsis || hit.overview,
      poster: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : film.poster,
      rating: hit.vote_count > 50 ? Math.round(hit.vote_average * 10) / 10 : undefined,
    };
  } catch (e) {
    console.warn(`TMDB : ${film.title} : ${e.message}`);
    return film;
  }
}

async function enrich(film) {
  if (film.kind === 'serie') return enrichSerie(film);
  if (film.kind !== 'film') return film; // docs, émissions, sport : on garde les infos XMLTV
  try {
    const search = await tmdb('/search/movie', { query: film.title, year: film.year, region: 'FR' });
    const hit = search.results?.[0];
    if (!hit) return film;
    const details = await tmdb(`/movie/${hit.id}`, { append_to_response: 'credits' });
    const directors = details.credits?.crew?.filter((c) => c.job === 'Director').map((c) => c.name) ?? [];
    const cast = details.credits?.cast?.slice(0, 6).map((c) => c.name) ?? [];
    return {
      ...film,
      tmdbId: hit.id,
      year: film.year ?? details.release_date?.slice(0, 4),
      genres: film.genres.length ? film.genres : genres(details.genres?.map((g) => g.name) ?? []),
      directors: film.directors.length ? film.directors : directors,
      cast: film.cast.length ? film.cast : cast,
      synopsis: details.overview || film.synopsis,
      poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : film.poster,
      rating: details.vote_count > 50 ? Math.round(details.vote_average * 10) / 10 : undefined,
    };
  } catch (e) {
    console.warn(`TMDB : ${film.title} : ${e.message}`);
    return film;
  }
}

// ---------- Main ----------

const win = tonightWindow();
const channels = new Map();
const films = new Map();
const seenChannel = new Map();

for (const src of SOURCES) {
  try {
    console.log(`Lecture ${src.url}`);
    parseSource(await fetchXml(src.url), src.bouquet, win, channels, films, seenChannel);
  } catch (e) {
    console.warn(`Source ignorée : ${e.message}`);
  }
}

let list = mergeEpisodes([...films.values()].sort((a, b) => a.start.localeCompare(b.start)));
const byKind = list.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {});
console.log(`${list.length} programmes trouvés pour le ${win.day}`, byKind);

if (list.length === 0) {
  console.error('Aucun programme trouvé : tonight.json n\'est pas modifié.');
  process.exit(1);
}

if (TMDB_KEY) {
  const out = [];
  for (const f of list) out.push(await enrich(f)); // séquentiel pour rester sous la limite de l'API
  list = out;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      date: win.day,
      generatedAt: new Date().toISOString(),
      source: 'xmltv',
      channels: [...seenChannel.entries()].map(([id, c]) => ({ id, name: channels.get(id) ?? id, bouquet: c.bouquet })),
      films: list,
    },
    null,
    1,
  ),
);
console.log(`Écrit : ${OUT}`);
