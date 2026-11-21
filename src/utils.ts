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
