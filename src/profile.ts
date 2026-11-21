import type { Bouquet, Film, Signal, Taggable } from './types';

/**
 * Profil de goûts, stocké en local.
 * Chaque film est décrit par des "traits" (genre, réalisateur, acteurs, décennie).
 * Chaque réaction de l'utilisateur augmente ou baisse le poids de ces traits.
 * Un film est noté en additionnant les poids de ses traits.
 */
export interface Profile {
  version: 1;
  onboarded: boolean;
  bouquets: Bouquet[];
  weights: Record<string, number>;
  hidden: Record<string, true>;
  reminders: Record<string, true>;
  signals: number;
}

const KEY = 'ce-soir.profile.v1';

export const emptyProfile = (): Profile => ({
  version: 1,
  onboarded: false,
  bouquets: ['tnt'],
  weights: {},
  hidden: {},
  reminders: {},
  signals: 0,
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
const FACTOR = { g: 1, r: 0.8, a: 0.5, d: 0.4 } as const;
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
  g: (v) => `Parce que tu aimes : ${v}`,
  r: (v) => `Un film de ${v}`,
  a: (v) => `Avec ${v}`,
  d: (v) => `Tu aimes les années ${v.slice(2)}`,
};

function reasonFor(p: Profile, f: Film): string {
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
 * - filtre sur les bouquets reçus et les films masqués
 * - trie par score
 * - glisse 1 film "découverte" dans le top (environ 1 sur 5), pour éviter la bulle
 */
export function rank(p: Profile, films: Film[], seed = 0): Ranked[] {
  const pool = films.filter((f) => p.bouquets.includes(f.bouquet) && !p.hidden[f.id]);
  const ranked: Ranked[] = pool
    .map((film) => ({ film, score: score(p, film), reason: reasonFor(p, film), discovery: false }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 5) {
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
    .map(([t, w]) => ({ label: t.slice(2), kind: t.slice(0, 1) as Prefix, weight: w }));
}
