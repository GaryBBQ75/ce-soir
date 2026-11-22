#!/usr/bin/env node
/**
 * Génère data/tonight.json : tous les programmes de la journée (6h à 2h, heure de Paris)
 * sur les chaînes françaises, avec leur type (film, série, doc, divertissement, sport, autre). (20h30 à 1h30, heure de Paris)
 * à partir des flux XMLTV gratuits de xmltvfr.fr, enrichis par TMDB si TMDB_API_KEY est défini.
 *
 * Usage : node scripts/fetch-tonight.mjs
 * Variables : TMDB_API_KEY (optionnel)
 */
import { gunzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, process.env.OUT_DIR ?? 'public');
const OUT = resolve(OUT_DIR, 'data/tonight.json');
const POSTERS_DIR = resolve(OUT_DIR, 'posters');

// Ordre important : une chaîne déjà vue dans un bouquet précédent garde ce bouquet.
// Les noms de fichiers Canal+ et cinéma sont à vérifier sur https://xmltvfr.fr
// Le flux TNT d'abord (ordre des numéros de chaîne), puis le flux complet pour le reste.
const SOURCES = [
  { source: 'tnt', url: 'https://xmltvfr.fr/xmltv/xmltv_tnt.xml.gz' },
  { source: 'all', url: 'https://xmltvfr.fr/xmltv/xmltv.xml.gz' },
];

/**
 * Range chaque chaîne dans un vrai bouquet français, ou l'écarte (null) :
 * chaînes étrangères, locales, outre-mer, adultes, décalées (+1), doublons 4K, multiplex sport…
 */
function bouquetOf(id, name, source) {
  const s = `${id} ${name}`;
  if (!/\.fr$/i.test(id)) return null;
  if (/dorcel|penthouse|playboy|hustler|pink ?x|pinktv|man ?x|xxl|brazzers|vivid|adulte/i.test(s)) return null;
  if (/\+ ?1\b|plus1|4k|uhd|\blive ?\d|360 ?- ?\d|360 \d|max \d|ligue 1\+ ?\d|dazn [3-9]|sport live|24\/24|radio|astrocenter|m6 international|tv5 ?monde|trace|nollywood|africa|afrique|maroc|antilles|guadeloupe|martinique|guyane|r[ée]union|mayotte|polyn[ée]sie|cal[ée]donie|tahiti|wallis|miquelon|1[èe]re|pulaagu|^a\+|canal partag/i.test(s)) return null;
  if (/france ?3 ?-|france 3 nouvelle|bfm (?!tv|business|grands|2\b)|t[ée]l[ée] ?(grenoble|nantes|bocal|sud|paese)|tv ?(7|8|78|rennes|tours|vend[ée]e|pi|sud|2com)\b|tl7|tebeo|t[ée]b[ée]|vosges|maurienne|lmtv|lyon capitale|via ?mirabelle|vi[aà] ?(atv|mat[ée]l[ée])|w[ée]o|8 mont blanc|7 a limoges|angers|montreuil|canal ?(9|21|32)\b|bip ?tv|union tv|tv monaco|corse|alsace|normandie|marseille|toulon|lyon|nice|lille|littoral|alpes|haute-provence/i.test(s)) return null;

  if (source === 'tnt' && !/canal|plan[eè]te|paris ?premi/i.test(s)) return 'tnt';
  if (/canal\s?\+|canalplus/i.test(s) && !/kids/i.test(s)) return 'canal';
  if (/cin[ée]\s?\+|cineplus|\bocs\b|tcm|paramount|^\S+ action$|\baction\b|cin[ée] western|drive ?in/i.test(s)) return 'cinema';
  if (/bein|rmc ?sport(?! ?talk)|eurosport|dazn|ligue 1\+|golf\+|equidia|sport\+|automoto|motorvision|infosport|fight ?sports|sport en france|olympia|chaine evenement|evenements sports/i.test(s)) return 'sport';
  if (/disney|nickelodeon|nicktoons|cartoon|boomerang|canal ?j\b|tiji|piwi|t[ée]l[ée]toon|dreamworks|baby ?tv|cartoonito|pitchoun|canal\+ ?kids|mangas|gulli/i.test(s)) return 'jeunesse';
  if (/discovery|investigation|national geographic|natgeo|ushua|histoire|science ?(et|&) ?vie|esprit ?sorcier|museum|plan[eè]te|rmc ?(myst|wow|mecanic|alerte|j'irai|decouverte)|grands reportages|france ?tv ?docs|animaux|chasse|seasons|trek|nautical|cheval|dog ?& ?cat|crime district|my ?zen|souvenirs|\bina\b|tlc|maritima|bbc earth/i.test(s)) return 'decouverte';
  if (/\bmtv|mcm|mezzo|melody|m6 ?music|nrj ?hits|rfm ?tv|clubbing|stingray|djazz|classica|vh1|cstar hits|zouk|mfm|bblack|music|olplay/i.test(s)) return 'musique';
  if (/france ?24|bfm|i24|euronews|cgtn|tech ?& ?co|20 ?minutes|figaro|europe ?1|rmc talk|cnews|meteo|demain ?tv|kto|lci|franceinfo|al jazeera/i.test(s)) return 'info';
  if (/marmiton|sant[ée]|maison|luxe|fashion|auto ?plus|mieux|lucky ?jack|mgg|ginx|gong|men'?s ?up|elle ?girl/i.test(s)) return 'lifestyle';
  if (/paris ?premi|t[ée]va|rtl ?9|13[eè]?me ?rue|sci-?fi|syfy|warner|breizh|s[ée]rie ?club|comedy|ab ?1|ab ?3|abx|polar|com[ée]die|novelas|france ?tv ?s[ée]ries|sundance|eurochannel|bravo|sony|adult ?swim|exo/i.test(s)) return 'series';
  return 'box';
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
  // Entre minuit et 4h, on est encore "ce soir" : on prend la journée de la veille
  const hour = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(now);
  const ref = hour < 4 ? new Date(now.getTime() - 5 * 3600_000) : now;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ref); // YYYY-MM-DD
  const off = parisOffset(now);
  const from = Date.parse(`${day}T06:00:00${off}`);
  const to = from + 20 * 3600_000; // jusqu'à 2h du matin
  const primeStart = Date.parse(`${day}T20:30:00${off}`);
  const primeEnd = Date.parse(`${day}T22:15:00${off}`);
  return { day, from, to, primeStart, primeEnd };
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
    .replace(/\\"/g, '"')
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
  if (/ind[ée]termin|fin des programmes/.test(c)) return null;
  if (/jeunesse|dessin anim|enfant|kids|cartoon/.test(c)) return 'jeunesse';
  if (/\bfilm\b|movie|cin[ée]ma|t[ée]l[ée]film/.test(c)) return 'film';
  if (/journal|information|actualit|d[ée]bat|politique|bulletin|\binfo\b/.test(c)) return 'info';
  if (/m[ée]t[ée]o|loterie|t[ée]l[ée]achat|religi|programme court/.test(c)) return 'autre';
  if (/s[ée]rie|feuilleton|sitcom/.test(c)) return 'serie';
  if (/sport|football|rugby|tennis|cyclisme|basket|formule|handball|boxe|golf|ski|athl[ée]tisme|moto|auto|[ée]quitation|hippisme|natation|volley|combat|mma|catch/.test(c)) return 'sport';
  if (/spectacle|concert|humour|one.?man|th[ée][âa]tre|op[ée]ra|ballet|danse|cirque|musique classique|festival/.test(c)) return 'spectacle';
  if (/documentaire|magazine|reportage|d[ée]couverte|histoire|science|nature|voyage|soci[ée]t[ée]/.test(c)) return 'doc';
  if (/divertissement|\bjeux?\b|r[ée]alit[ée]|vari[ée]t[ée]|talk|musique|clip|[ée]mission/.test(c)) return 'divertissement';
  // "autre" : gardé pour la grille des chaînes, jamais proposé en suggestion
  return 'autre';
}


function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Genres : même logique que src/genres.ts
// Sous-genres : genres de film, sports, thèmes de docs. Même logique que src/genres.ts
const GENRE_MAP = [
  // Films et séries
  [/com[ée]die|comedy/i, 'Comédie'], [/\baction\b/i, 'Action'], [/aventure|adventure/i, 'Aventure'],
  [/animation|anim[ée]/i, 'Animation'], [/famil/i, 'Famille'], [/horreur|horror|[ée]pouvante/i, 'Horreur'],
  [/thriller|suspense|myst[eè]re/i, 'Thriller'], [/policier|crime|polar|gangster|criminel|enqu[êe]te/i, 'Policier'],
  [/science.?fiction|sci-?fi|anticipation/i, 'Science-fiction'], [/fantas/i, 'Fantastique'], [/romance|romanti|sentiment/i, 'Romance'],
  [/com[ée]die musicale|musical/i, 'Musical'], [/western/i, 'Western'], [/guerre|\bwar\b/i, 'Guerre'],
  [/histo|biopic|biograph/i, 'Histoire'], [/drame|drama|dramatique/i, 'Drame'],
  // Sports
  [/football|foot\b|ligue 1|soccer/i, 'Foot'], [/rugby/i, 'Rugby'], [/tennis/i, 'Tennis'], [/basket/i, 'Basket'],
  [/handball/i, 'Handball'], [/cyclisme|v[ée]lo/i, 'Cyclisme'], [/formule|f1\b|auto|moto|rallye/i, 'Auto-moto'],
  [/golf/i, 'Golf'], [/boxe|mma|combat|catch|arts martiaux/i, 'Combat'], [/ski|biathlon|sports? d'hiver|patinage/i, 'Sports d\'hiver'],
  [/[ée]quitation|hippisme|turf|course hippique/i, 'Hippisme'], [/athl[ée]tisme/i, 'Athlétisme'], [/voile|nautisme|surf/i, 'Glisse et voile'],
  // Docs et magazines
  [/nature|animal|animaux|faune|environnement|[ée]cologie/i, 'Nature'], [/voyage|d[ée]couverte|g[ée]ographie/i, 'Voyage'],
  [/science(?!.?fiction)|technolog|sant[ée]|m[ée]decine/i, 'Sciences'], [/soci[ée]t[ée]|reportage/i, 'Société'],
  [/cuisine|gastronom/i, 'Cuisine'], [/maison|d[ée]co|jardin/i, 'Maison'], [/\barts?\b|culture|patrimoine/i, 'Culture'],
  // Spectacles
  [/humour|one.?man|stand.?up/i, 'Humour'], [/concert|musique|rock|pop|rap|jazz/i, 'Concert'], [/th[ée][âa]tre/i, 'Théâtre'],
  [/op[ée]ra|classique|ballet|danse/i, 'Classique et danse'],
  // Divertissement
  [/\bjeux?\b/i, 'Jeux'], [/r[ée]alit[ée]/i, 'Télé-réalité'], [/talk|plateau/i, 'Talk-show'], [/vari[ée]t[ée]/i, 'Variétés'],
];
function genres(raw) {
  const out = new Set();
  for (const r of raw) for (const part of r.split(/[:,/]/)) {
    for (const [re, label] of GENRE_MAP) if (re.test(part)) out.add(label);
  }
  return [...out];
}

/**
 * Infos détaillées XMLTV : signalétique CSA, notes presse, pays, saison/épisode,
 * rôles des acteurs, présentateurs, scénaristes, qualité, sous-titres, inédit/rediffusion.
 */
function extras(body, credits, kind) {
  if (kind === 'autre') return {};
  const out = {};
  const csa = body.match(/<rating\b[^>]*>\s*<value>([^<]+)<\/value>/)?.[1]?.trim();
  const m = csa?.match(/-?\s*(10|12|16|18)/);
  if (m) out.csa = `-${m[1]}`;
  const stars = [...body.matchAll(/<star-rating\b([^>]*)>\s*<value>([^<]+)<\/value>/g)]
    .map((r) => {
      const [v, max] = r[2].split('/').map(Number);
      return Number.isFinite(v) && max ? { source: attr(r[1], 'system') || 'Presse', score: Math.round((v / max) * 100) / 10, display: `${v}/${max}` } : null;
    })
    .filter(Boolean);
  if (stars.length) out.ratings = stars;
  const country = tag(body, 'country');
  if (country) out.country = country;
  const ep = body.match(/<episode-num\b[^>]*system="xmltv_ns"[^>]*>([^<]+)<\/episode-num>/)?.[1];
  if (ep) {
    const [se, e] = ep.split('.');
    const sn = parseInt(se, 10);
    const en = parseInt(e, 10);
    if (Number.isFinite(sn)) out.season = sn + 1;
    if (Number.isFinite(en)) out.episode = en + 1;
  } else {
    const on = body.match(/<episode-num\b[^>]*>S(\d+)\s*E(\d+)/i);
    if (on) Object.assign(out, { season: +on[1], episode: +on[2] });
  }
  const actors = [...credits.matchAll(/<actor\b([^>]*)>([\s\S]*?)<\/actor>/g)]
    .map((a) => ({ name: decode(a[2]), role: attr(a[1], 'role') }))
    .filter((a) => a.name)
    .slice(0, 12);
  if (actors.length) out.castDetails = actors;
  const crew = [];
  for (const [t, job] of [['presenter', 'Présentation'], ['writer', 'Scénario'], ['composer', 'Musique'], ['producer', 'Production'], ['guest', 'Invité']]) {
    for (const n of tags(credits, t).slice(0, 4)) if (n) crew.push({ job, name: n });
  }
  if (crew.length) out.crew = crew;
  const flags = {};
  if (/<previously-shown/.test(body)) flags.rerun = true;
  if (/<premiere|<new\s*\/?>/.test(body)) flags.premiere = true;
  if (/<quality>\s*(HDTV|HD|UHD|4K)/i.test(body)) flags.hd = true;
  if (/<subtitles\b[^>]*type="(teletext|onscreen)"/.test(body)) flags.subtitles = true;
  if (/audio-?description|<audio>[\s\S]*?described/i.test(body)) flags.audioDescription = true;
  if (/\bVOST|version originale/i.test(body)) flags.vost = true;
  if (Object.keys(flags).length) out.flags = flags;
  return out;
}

function parseSource(xml, source, win, channels, films, seenChannel) {
  for (const m of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/g)) {
    const id = attr(m[1], 'id');
    if (!id) continue;
    const name = tag(m[2], 'display-name') ?? id;
    if (!channels.has(id)) channels.set(id, name);
    if (!logos.has(id)) {
      const icon = m[2].match(/<icon\b[^>]*src="([^"]+)"/)?.[1];
      if (icon) logos.set(id, icon);
    }
    // Une chaîne appartient au premier flux où on la voit (TNT avant les autres)
    if (!seenChannel.has(id)) seenChannel.set(id, { source, bouquet: bouquetOf(id, name, source) });
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
    if (!seenChannel.has(channelId)) seenChannel.set(channelId, { source, bouquet: bouquetOf(channelId, channelId, source) });
    const ch = seenChannel.get(channelId);
    if (!ch.bouquet || ch.source !== source) continue; // chaîne écartée, ou déjà lue dans un flux précédent
    if (/adulte|charme|[ée]rotique|\bx\b/i.test(cats.join(' '))) continue;

    const stop = parseTime(attr(m[1], 'stop'));
    const title = tag(body, 'title') ?? 'Sans titre';
    const key = `${channelId}-${start}`;
    if (films.has(key)) continue;
    const credits = body.match(/<credits>([\s\S]*?)<\/credits>/)?.[1] ?? '';
    const evening = start >= win.primeStart;
    films.set(key, {
      ...extras(body, credits, kind),
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
      directors: kind === 'autre' ? [] : tags(credits, 'director').filter(Boolean),
      cast: kind === 'autre' ? [] : tags(credits, 'actor').filter(Boolean).slice(0, 6),
      // Résumé plus long le soir (là où on lit les fiches), plus court en journée pour alléger le fichier
      synopsis: tag(body, 'desc')?.slice(0, kind === 'autre' ? 200 : evening ? 900 : 320),
      poster: kind === 'autre' ? undefined : body.match(/<icon\b[^>]*src="([^"]+)"/)?.[1],
      part: start < win.primeStart ? 'jour' : start < win.primeEnd ? 'prime' : 'seconde',
    });
  }
}

// ---------- Enrichissement TMDB (optionnel) ----------

async function tmdb(path, params) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'fr-FR');
  url.searchParams.set('include_video_language', 'fr,en');
  for (const [k, v] of Object.entries(params ?? {})) if (v) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${path} : HTTP ${res.status}`);
  return res.json();
}

/** Programmes enchaînés sur la même chaîne avec le même titre : un seul bloc "3 épisodes". */
function mergeEpisodes(list) {
  const out = [];
  for (const f of list) {
    const prev = out.findLast((p) => p.channelId === f.channelId);
    // On regroupe au plus 3 h d'affilée : au-delà, c'est une boucle de rediffusions, pas un bloc à regarder
    const merged = prev?.stop ? (Date.parse(f.stop ?? f.start) - Date.parse(prev.start)) / 60000 : Infinity;
    if (prev && prev.kind === f.kind && prev.title === f.title && prev.stop && merged <= 180 && Math.abs(Date.parse(f.start) - Date.parse(prev.stop)) < 10 * 60000) {
      prev.stop = f.stop ?? prev.stop;
      prev.durationMin = Math.round((Date.parse(prev.stop) - Date.parse(prev.start)) / 60000);
      prev.episodes = (prev.episodes ?? 1) + 1;
      continue;
    }
    out.push(f);
  }
  return out;
}

const OMDB_KEY = process.env.OMDB_API_KEY;
const IMG = (path, size) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined);

/** Notes IMDb, Rotten Tomatoes et Metacritic via OMDb (optionnel, clé gratuite). */
async function omdbRatings(imdbId) {
  if (!OMDB_KEY || !imdbId) return [];
  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`);
    const d = await res.json();
    return (d.Ratings ?? [])
      .map((r) => {
        if (r.Source === 'Internet Movie Database') return { source: 'IMDb', score: parseFloat(r.Value), display: r.Value.split('/')[0] };
        if (r.Source === 'Rotten Tomatoes') return { source: 'Rotten Tomatoes', score: parseInt(r.Value, 10) / 10, display: r.Value };
        if (r.Source === 'Metacritic') return { source: 'Metacritic', score: parseInt(r.Value, 10) / 10, display: r.Value.split('/')[0] };
        return null;
      })
      .filter((r) => r && Number.isFinite(r.score));
  } catch {
    return [];
  }
}

/** Champs communs film / série à partir d'une fiche TMDB détaillée. */
function fromTmdb(film, d, { isTv }) {
  const cast = (d.credits?.cast ?? []).slice(0, 12).map((c) => ({ name: c.name, role: c.character || undefined, photo: IMG(c.profile_path, 'w185') }));
  const crewJobs = { Director: 'Réalisation', Screenplay: 'Scénario', Writer: 'Scénario', 'Original Music Composer': 'Musique', Producer: 'Production' };
  const crew = (d.credits?.crew ?? []).filter((c) => crewJobs[c.job]).slice(0, 8).map((c) => ({ job: crewJobs[c.job], name: c.name }));
  const createdBy = isTv ? (d.created_by ?? []).map((c) => c.name) : [];
  const directors = createdBy.length ? createdBy : crew.filter((c) => c.job === 'Réalisation').map((c) => c.name);
  const trailer = (d.videos?.results ?? []).find((v) => v.site === 'YouTube' && /Trailer|Teaser/.test(v.type));
  const tmdbRating = d.vote_count > 50 ? [{ source: 'TMDB', score: Math.round(d.vote_average * 10) / 10, display: (Math.round(d.vote_average * 10) / 10).toFixed(1) }] : [];
  // Signalétique française si le flux ne l'a pas donnée
  let csa = film.csa;
  if (!csa) {
    const fr = isTv
      ? d.content_ratings?.results?.find((r) => r.iso_3166_1 === 'FR')?.rating
      : d.release_dates?.results?.find((r) => r.iso_3166_1 === 'FR')?.release_dates?.find((x) => x.certification)?.certification;
    const m = fr?.match(/(10|12|16|18)/);
    if (m) csa = `-${m[1]}`;
  }
  return {
    ...film,
    tmdbId: d.id,
    csa,
    originalTitle: (d.original_title || d.original_name) !== film.title ? d.original_title || d.original_name : undefined,
    tagline: d.tagline || undefined,
    year: film.year ?? (d.release_date || d.first_air_date)?.slice(0, 4),
    country: film.country ?? d.production_countries?.map((c) => c.name).join(', ') ?? undefined,
    genres: [...new Set([...film.genres, ...genres(d.genres?.map((g) => g.name) ?? [])])],
    directors: film.directors.length ? film.directors : directors,
    cast: film.cast.length ? film.cast : cast.map((c) => c.name).slice(0, 6),
    castDetails: cast.length ? cast : film.castDetails,
    crew: crew.length ? crew : film.crew,
    synopsis: film.synopsis && film.synopsis.length > (d.overview?.length ?? 0) ? film.synopsis : d.overview || film.synopsis,
    poster: film.poster ?? IMG(d.poster_path, 'w500'),
    backdrop: IMG(d.backdrop_path, 'w780'),
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    rating: tmdbRating[0]?.score,
    ratings: [...(film.ratings ?? []), ...tmdbRating],
    imdbId: d.imdb_id ?? d.external_ids?.imdb_id,
  };
}

async function enrich(film) {
  if (film.part === 'jour') return film; // on limite les appels à la soirée
  const isTv = film.kind === 'serie';
  if (film.kind !== 'film' && !isTv) return film; // docs, émissions, sport : on garde les infos XMLTV
  try {
    const search = isTv
      ? await tmdb('/search/tv', { query: film.title })
      : await tmdb('/search/movie', { query: film.title, year: film.year, region: 'FR' });
    const hit = search.results?.[0];
    if (!hit) return film;
    const d = isTv
      ? await tmdb(`/tv/${hit.id}`, { append_to_response: 'credits,videos,content_ratings,external_ids' })
      : await tmdb(`/movie/${hit.id}`, { append_to_response: 'credits,videos,release_dates' });
    const out = fromTmdb(film, d, { isTv });
    const extra = await omdbRatings(out.imdbId);
    if (extra.length) out.ratings = [...extra, ...out.ratings.filter((r) => !extra.some((e) => e.source === r.source))];
    return out;
  } catch (e) {
    console.warn(`TMDB : ${film.title} : ${e.message}`);
    return film;
  }
}

/** Champs propres à une diffusion (à garder quand on réutilise l'enrichissement d'un titre). */
const pick = (f) => ({ id: f.id, channel: f.channel, channelId: f.channelId, bouquet: f.bouquet, start: f.start, stop: f.stop, durationMin: f.durationMin, part: f.part, subTitle: f.subTitle, season: f.season, episode: f.episode, flags: f.flags });

// ---------- Main ----------

const win = tonightWindow();
const channels = new Map();
const logos = new Map();
const films = new Map();
const seenChannel = new Map();

for (const src of SOURCES) {
  try {
    console.log(`Lecture ${src.url}`);
    parseSource(await fetchXml(src.url), src.source, win, channels, films, seenChannel);
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
  // Une seule recherche par titre (un même film peut passer plusieurs fois)
  const cache = new Map();
  const out = [];
  for (const f of list) {
    const key = `${f.kind}|${f.title}|${f.year ?? ''}`;
    if (!cache.has(key)) cache.set(key, await enrich(f));
    const e = cache.get(key);
    out.push(e === f ? f : { ...e, ...pick(f) });
  }
  list = out;
  console.log(`TMDB : ${cache.size} titres enrichis`);
}

// ---------- Visuels : téléchargés et redimensionnés, servis par l'app elle-même ----------

async function downloadImage(sharp, url, file, width) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toFile(file);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Logo clair (blanc sur transparent) : on l'affiche sur fond sombre. */
async function isLightLogo(sharp, file) {
  try {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 3] < 128) continue;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n++;
    }
    return n > 0 && sum / n > 200;
  } catch {
    return false;
  }
}

async function downloadLogos(channelList) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return channelList;
  }
  const dir = resolve(OUT_DIR, 'logos');
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const queue = [...channelList];
  const worker = async () => {
    while (queue.length) {
      const c = queue.shift();
      if (!c.logo) continue;
      const name = `${createHash('sha1').update(c.logo).digest('hex').slice(0, 16)}.webp`;
      const file = resolve(dir, name);
      c.logo = (await downloadImage(sharp, c.logo, file, 120)) ? `logos/${name}` : undefined;
      if (c.logo) c.logoDark = await isLightLogo(sharp, file);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`${channelList.filter((c) => c.logo).length} logos téléchargés`);
  return channelList;
}

async function downloadPosters(list) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('sharp absent : visuels laissés en lien direct');
    return list;
  }
  if (existsSync(POSTERS_DIR)) rmSync(POSTERS_DIR, { recursive: true });
  mkdirSync(POSTERS_DIR, { recursive: true });
  const cache = new Map();
  let ok = 0;
  const queue = [...list];
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift();
      if (!f.poster || !/^https?:/.test(f.poster)) continue;
      const name = `${createHash('sha1').update(f.poster).digest('hex').slice(0, 16)}.webp`;
      if (!cache.has(name)) {
        cache.set(
          name,
          downloadImage(sharp, f.poster, resolve(POSTERS_DIR, name), 400).then((r) => {
            if (r) ok++;
            return r;
          }),
        );
      }
      f.poster = (await cache.get(name)) ? `posters/${name}` : undefined;
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`${ok} visuels téléchargés`);
  return list;
}

list = await downloadPosters(list);

// On ne liste que les chaînes qui ont au moins un programme aujourd'hui
const withProgrammes = new Set(list.map((f) => f.channelId));
const channelList = await downloadLogos(
  [...seenChannel.entries()]
    .filter(([id, c]) => c.bouquet && withProgrammes.has(id))
    .map(([id, c]) => ({ id, name: decode(channels.get(id) ?? id), bouquet: c.bouquet, logo: logos.get(id) })),
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ date: win.day, generatedAt: new Date().toISOString(), source: 'xmltv', channels: channelList, films: list }));
console.log(`Écrit : ${OUT}`);
