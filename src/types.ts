export type Bouquet = 'tnt' | 'canal' | 'cinema';

export const BOUQUETS: { id: Bouquet; label: string; hint: string }[] = [
  { id: 'tnt', label: 'TNT', hint: 'TF1, France 2, M6, Arte, W9…' },
  { id: 'canal', label: 'Canal+', hint: 'Canal+, Canal+ Cinéma(s), Grand Écran…' },
  { id: 'cinema', label: 'Ciné+ / OCS', hint: 'Ciné+ Frisson, Famiz, Classic…' },
];

export interface Film {
  id: string;
  title: string;
  year?: string;
  channel: string;
  channelId: string;
  bouquet: Bouquet;
  /** ISO 8601 */
  start: string;
  stop?: string;
  durationMin?: number;
  genres: string[];
  directors: string[];
  cast: string[];
  synopsis?: string;
  poster?: string;
  /** Note TMDB sur 10, si dispo */
  rating?: number;
  part: 'prime' | 'seconde';
}

export interface Channel {
  id: string;
  name: string;
  bouquet: Bouquet;
}

export interface Tonight {
  date: string;
  generatedAt: string;
  source: 'xmltv' | 'sample';
  /** Toutes les chaînes connues, même sans film ce soir (pour les réglages) */
  channels: Channel[];
  films: Film[];
}

/** Ce que l'algo sait d'un film. */
export type Taggable = Pick<Film, 'genres' | 'directors' | 'cast' | 'year'>;

export type Signal = 'like' | 'pass' | 'open' | 'remind' | 'watched';
