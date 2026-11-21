import type { Film, Tonight } from './types';

const PALETTE: [string, string][] = [
  ['#E07A5F', '#1A0E0A'],
  ['#2E4057', '#F4F1EA'],
  ['#F2C14E', '#1A1405'],
  ['#C8553D', '#FFFFFF'],
  ['#1B998B', '#06201D'],
  ['#8E5572', '#FFFFFF'],
  ['#3D348B', '#FFFFFF'],
  ['#A3B18A', '#151A10'],
];

/** Couleur stable par titre, en attendant les affiches TMDB. */
export function colorsFor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  const [bg, ink] = PALETTE[h % PALETTE.length];
  return { bg, ink };
}

const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });

export const hhmm = (iso?: string) => (iso ? timeFmt.format(new Date(iso)).replace(':', 'h') : '');

export function endOf(f: Film) {
  if (f.stop) return hhmm(f.stop);
  if (f.durationMin) return hhmm(new Date(Date.parse(f.start) + f.durationMin * 60_000).toISOString());
  return '';
}

export function durationLabel(f: Film) {
  const d = f.durationMin ?? (f.stop ? Math.round((Date.parse(f.stop) - Date.parse(f.start)) / 60_000) : 0);
  if (!d) return '';
  const h = Math.floor(d / 60);
  const m = d % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

export function todayLabel() {
  const s = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function loadTonight(): Promise<Tonight> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/tonight.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`tonight.json introuvable (${res.status})`);
  const data = (await res.json()) as Tonight;
  // Compatibilité avec les anciens fichiers (films seulement, sans liste de chaînes)
  const films = data.films.map((f) => ({ ...f, kind: f.kind ?? 'film', genres: f.genres ?? [], directors: f.directors ?? [], cast: f.cast ?? [] }));
  const channels =
    data.channels ??
    [...new Map(films.map((f) => [f.channelId, { id: f.channelId, name: f.channel, bouquet: f.bouquet }])).values()];
  return { ...data, films, channels };
}

/** Chemin d'un visuel ou d'un logo : relatif (servi par l'app) ou lien direct. */
export const assetUrl = (path: string) => (/^https?:/.test(path) ? path : `${import.meta.env.BASE_URL}${path}`);

export type When = 'now' | 'prime' | 'seconde';

/** Heure de référence pour un moment de la soirée (en ms). */
export function refTime(when: When, tonightDate: string, now: number) {
  if (when === 'now') return now;
  // Décalage horaire de Paris à cette date
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${tonightDate}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value.replace('GMT', '') ?? '+1';
  const sign = off.startsWith('-') ? '-' : '+';
  const [h, m = '00'] = off.replace(/[+-]/, '').split(':');
  const tz = `${sign}${h.padStart(2, '0')}:${m}`;
  return Date.parse(`${tonightDate}T${when === 'prime' ? '21:10' : '22:50'}:00${tz}`);
}

export const stopOf = (f: Film) => (f.stop ? Date.parse(f.stop) : Date.parse(f.start) + (f.durationMin ?? 60) * 60_000);

export const isOn = (f: Film, t: number) => Date.parse(f.start) <= t && t < stopOf(f);

/** Avancement d'un programme à l'instant t : 0 à 1, ou null s'il n'a pas commencé. */
export function progressOf(f: Film, t: number) {
  const a = Date.parse(f.start);
  const b = stopOf(f);
  if (t < a) return null;
  return Math.min(1, (t - a) / (b - a));
}

export function minutesLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
