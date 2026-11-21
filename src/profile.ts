import { KINDS, type Bouquet, type Film, type Signal, type Taggable } from './types';

/**
 * Profil de goûts, stocké en local.
 * Chaque film est décrit par des "traits" (genre, réalisateur, acteurs, décennie).
 * Chaque réaction de l'utilisateur augmente ou baisse le poids de ces traits.
 * Un film est noté en additionnant les poids de ses traits.
 */
export interface Profile {
  version: 1;
  /** Bouquets reçus. Par défaut : la TNT du pays. */
  bouquets: Bouquet[];
  /** Chaînes retirées, même si leur bouquet est actif */
  excluded: Record<string, true>;
  /** Chaînes ajoutées une par une, hors bouquet actif */
  added: Record<string, true>;
  hintDismissed: boolean;
  /** Chaînes favorites, en tête de la grille */
  favorites: Record<string, true>;
  weights: Record<string, number>;
  hidden: Record<string, true>;
  reminders: Record<string, true>;
  signals: number;
  /** Émissions suivies (récurrentes), par titre normalisé */
  followed: Record<string, { title: string; notify: boolean }>;
  /** Ordre personnalisé des chaînes (ids) ; vide = ordre des numéros */
  channelOrder: string[];
  /** Prévenir combien de minutes avant le début */
  notifyBefore: number;
  /** Notifications système autorisées et voulues */
  notifyEnabled: boolean;
}

/** Clé stable d'une émission récurrente : titre sans accents ni ponctuation. */
export const showKey = (title: string) =>
  title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const isFollowed = (p: Profile, f: Pick<Film, 'title'>) => !!p.followed[showKey(f.title)];

const KEY = 'ce-soir.profile.v1';

export const emptyProfile = (): Profile => ({
  version: 1,
  bouquets: ['tnt'],
  excluded: {},
  added: {},
  hintDismissed: false,
  favorites: {},
  weights: {},
  hidden: {},
  reminders: {},
  signals: 0,
  followed: {},
  channelOrder: [],
  notifyBefore: 10,
  notifyEnabled: false,
});

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProfile();
    const p = JSON.parse(raw) as Profile;
    return p.version === 1 ? { ...emptyProfile(), ...p } : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible : le profil vit en mémoire */
  }
}

// Importance relative de chaque type de trait
const FACTOR = { k: 0.8, g: 1, r: 0.8, a: 0.5, d: 0.4 } as const;
type Prefix = keyof typeof FACTOR;

// Force de chaque réaction
const DELTA: Record<Signal, number> = {
  like: 1,
  pass: -1,
  open: 0.25,
  remind: 0.6,
  watched: 0.8,
};

function decade(year?: string) {
  const y = parseInt(year ?? '', 10);
  return Number.isFinite(y) ? `${Math.floor(y / 10) * 10}` : null;
}

export function traits(f: Taggable): string[] {
  const t: string[] = [];
  if (f.kind) t.push(`k:${f.kind}`);
  f.genres.forEach((g) => t.push(`g:${g}`));
  f.directors.slice(0, 2).forEach((r) => t.push(`r:${r}`));
  f.cast.slice(0, 3).forEach((a) => t.push(`a:${a}`));
  const d = decade(f.year);
  if (d) t.push(`d:${d}`);
  return t;
}

const factorOf = (trait: string) => FACTOR[trait.slice(0, 1) as Prefix] ?? 0.3;

export function applySignal(p: Profile, f: Taggable, s: Signal): Profile {
  const weights = { ...p.weights };
  for (const t of traits(f)) {
    const w = (weights[t] ?? 0) + DELTA[s] * factorOf(t);
    weights[t] = Math.max(-5, Math.min(5, Math.round(w * 100) / 100));
  }
  return { ...p, weights, signals: p.signals + 1 };
}

export function score(p: Profile, f: Film): number {
  let s = 0;
  for (const t of traits(f)) s += (p.weights[t] ?? 0) * factorOf(t);
  if (f.rating) s += (f.rating - 6.5) * 0.4; // un bon film remonte un peu, même hors profil
  if (isFollowed(p, f)) s += 4; // une émission suivie passe devant
  return s;
}

/** Ce que l'algo connaît déjà de ce film : faible = territoire inconnu. */
function familiarity(p: Profile, f: Film) {
  return traits(f).reduce((acc, t) => acc + Math.abs(p.weights[t] ?? 0), 0);
}

export interface Ranked {
  film: Film;
  score: number;
  reason: string;
  discovery: boolean;
}

const LABEL: Record<Prefix, (v: string) => string> = {
  k: (v) => `Tu aimes : ${KINDS.find((k) => k.id === v)?.plural ?? v}`,
  g: (v) => `Parce que tu aimes : ${v}`,
  r: (v) => `Un film de ${v}`,
  a: (v) => `Avec ${v}`,
  d: (v) => `Tu aimes les années ${v.slice(2)}`,
};

function reasonFor(p: Profile, f: Film): string {
  if (isFollowed(p, f)) return 'Tu suis cette émission';
  let best: [string, number] | null = null;
  for (const t of traits(f)) {
    const c = (p.weights[t] ?? 0) * factorOf(t);
    if (c > 0.3 && (!best || c > best[1])) best = [t, c];
  }
  if (best) return LABEL[best[0].slice(0, 1) as Prefix](best[0].slice(2));
  if (f.rating && f.rating >= 7.5) return `Très bien noté (${f.rating.toFixed(1)})`;
  return 'À découvrir';
}

/**
 * Classe les films du soir.
 * - filtre sur les chaînes choisies et les films masqués
 * - trie par score
 * - glisse 1 film "découverte" dans le top (environ 1 sur 5), pour éviter la bulle
 */
export function channelOn(p: Profile, channelId: string, bouquet: Bouquet) {
  if (p.excluded[channelId]) return false;
  return p.bouquets.includes(bouquet) || !!p.added[channelId];
}

export function rank(p: Profile, films: Film[], seed = 0): Ranked[] {
  const pool = films.filter((f) => channelOn(p, f.channelId, f.bouquet) && !p.hidden[f.id]);
  const ranked: Ranked[] = pool
    .map((film) => ({ film, score: score(p, film), reason: reasonFor(p, film), discovery: false }))
    .sort((a, b) => b.score - a.score);

  diversify(ranked, 5, 3);

  // Le slot découverte n'a de sens qu'une fois que l'app a appris quelque chose
  if (ranked.length > 5 && p.signals >= 3) {
    const tail = ranked.slice(5);
    const leastKnown = [...tail].sort((a, b) => familiarity(p, a.film) - familiarity(p, b.film));
    const candidates = leastKnown.slice(0, 3);
    const pick = candidates[seed % candidates.length];
    const idx = ranked.indexOf(pick);
    ranked.splice(idx, 1);
    ranked.splice(3, 0, { ...pick, discovery: true, reason: 'Pour sortir de tes habitudes' });
  }
  return ranked;
}

/** Les goûts les plus marqués, pour l'écran "Mes goûts". */
export function topTraits(p: Profile, n = 6) {
  return Object.entries(p.weights)
    .filter(([, w]) => Math.abs(w) >= 0.5)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, n)
    .map(([t, w]) => {
      const kind = t.slice(0, 1) as Prefix;
      const v = t.slice(2);
      const label = kind === 'k' ? KINDS.find((k) => k.id === v)?.plural ?? v : kind === 'd' ? `Années ${v.slice(2)}` : v;
      return { label, kind, weight: w };
    });
}

/**
 * Pas plus de `max` programmes du même type dans le top `n`,
 * pour que la soirée propose aussi un doc, une émission ou du sport.
 */
function diversify(list: Ranked[], n: number, max: number) {
  for (let i = 0; i < Math.min(n, list.length); i++) {
    const kind = list[i].film.kind;
    const count = list.slice(0, i).filter((r) => r.film.kind === kind).length;
    if (count < max) continue;
    const j = list.findIndex((r, idx) => idx > i && list.slice(0, i).filter((x) => x.film.kind === r.film.kind).length < max);
    if (j === -1) return;
    const [item] = list.splice(j, 1);
    list.splice(i, 0, item);
  }
}
