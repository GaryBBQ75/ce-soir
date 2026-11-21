export type Bouquet = 'tnt' | 'canal' | 'cinema' | 'sport' | 'decouverte' | 'series' | 'jeunesse' | 'musique' | 'info' | 'lifestyle' | 'box';

/**
 * Bouquets et thèmes. TNT, Canal+ et Ciné+ OCS sont de vrais bouquets ;
 * les autres regroupent par thème les chaînes des box (Free, SFR, Orange, Bouygues…).
 */
export const BOUQUETS: { id: Bouquet; label: string; hint: string }[] = [
  { id: 'tnt', label: 'TNT gratuite', hint: 'TF1, France 2, M6, Arte, W9, TMC, RMC Découverte…' },
  { id: 'canal', label: 'Canal+', hint: 'Canal+, Cinéma(s), Séries, Docs, Foot, Box Office…' },
  { id: 'cinema', label: 'Cinéma', hint: 'Ciné+, OCS, TCM, Action, Ciné Western…' },
  { id: 'sport', label: 'Sport', hint: 'beIN Sports, RMC Sport, Eurosport, DAZN, Equidia…' },
  { id: 'decouverte', label: 'Découverte', hint: 'Discovery, National Geographic, Planète+, Histoire, Ushuaïa, RMC Mystère…' },
  { id: 'series', label: 'Séries & divertissement', hint: 'Paris Première, Téva, RTL9, 13e Rue, Syfy, Warner TV, Comédie+…' },
  { id: 'jeunesse', label: 'Jeunesse', hint: 'Disney, Nickelodeon, Cartoon Network, Boomerang, Canal J, Tiji…' },
  { id: 'musique', label: 'Musique', hint: 'MTV, MCM, Mezzo, Melody, Trace…' },
  { id: 'info', label: 'Info', hint: 'France 24, BFM Business, Euronews, i24news…' },
  { id: 'lifestyle', label: 'Maison & loisirs', hint: 'Marmiton, Maison & Travaux, Top Santé, gaming…' },
  { id: 'box', label: 'Autres chaînes', hint: 'Le reste des chaînes françaises' },
];

/** 'autre' : journal, météo, jeunesse… visibles dans la grille des chaînes, jamais suggérés */
export type Kind = 'film' | 'serie' | 'doc' | 'divertissement' | 'spectacle' | 'sport' | 'jeunesse' | 'info' | 'autre';

export const KINDS: { id: Kind; label: string; plural: string; /** proposé dans les suggestions par défaut */ suggest: boolean }[] = [
  { id: 'film', label: 'Film', plural: 'Films', suggest: true },
  { id: 'serie', label: 'Série', plural: 'Séries', suggest: true },
  { id: 'doc', label: 'Doc', plural: 'Docs & magazines', suggest: true },
  { id: 'divertissement', label: 'Divertissement', plural: 'Divertissement', suggest: true },
  { id: 'spectacle', label: 'Spectacle', plural: 'Spectacles & musique', suggest: true },
  { id: 'sport', label: 'Sport', plural: 'Sport', suggest: true },
  { id: 'jeunesse', label: 'Jeunesse', plural: 'Jeunesse', suggest: true },
  { id: 'info', label: 'Info', plural: 'Info & débats', suggest: false },
];

export const kindLabel = (k: Kind) => KINDS.find((x) => x.id === k)?.label ?? 'Programme';

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
  part: Part;
}

export type Part = 'jour' | 'prime' | 'seconde';

export interface Channel {
  id: string;
  name: string;
  bouquet: Bouquet;
  logo?: string;
  /** Logo clair : à afficher sur fond sombre */
  logoDark?: boolean;
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
