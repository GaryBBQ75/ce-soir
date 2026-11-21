export type Bouquet = 'tnt' | 'canal' | 'cinema';

export const BOUQUETS: { id: Bouquet; label: string; hint: string }[] = [
  { id: 'tnt', label: 'TNT', hint: 'TF1, France 2, M6, Arte, W9…' },
  { id: 'canal', label: 'Canal+', hint: 'Canal+, Canal+ Cinéma(s), Grand Écran…' },
  { id: 'cinema', label: 'Ciné+ / OCS', hint: 'Ciné+ Frisson, Famiz, Classic…' },
];

export type Kind = 'film' | 'serie' | 'doc' | 'divertissement' | 'sport';

export const KINDS: { id: Kind; label: string; plural: string }[] = [
  { id: 'film', label: 'Film', plural: 'Films' },
  { id: 'serie', label: 'Série', plural: 'Séries' },
  { id: 'doc', label: 'Doc', plural: 'Docs & magazines' },
  { id: 'divertissement', label: 'Divertissement', plural: 'Divertissement' },
  { id: 'sport', label: 'Sport', plural: 'Sport' },
];

export const kindLabel = (k: Kind) => KINDS.find((x) => x.id === k)?.label ?? k;

/** Un programme de la soirée (film, série, doc, émission, sport). */
export interface Film {
  id: string;
  kind: Kind;
  title: string;
  /** Titre d'épisode, thème d'émission… */
  subTitle?: string;
  /** Nombre d'épisodes enchaînés (séries) */
  episodes?: number;
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
export type Taggable = Pick<Film, 'genres' | 'directors' | 'cast' | 'year'> & { kind?: Kind };

export type Signal = 'like' | 'pass' | 'open' | 'remind' | 'watched';
