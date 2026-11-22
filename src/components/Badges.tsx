import type { Film } from '../types';

/** Signalétique jeunesse (-10, -12, -16, -18), en pastille ronde. */
export function CsaBadge({ csa, size = 'md' }: { csa?: string; size?: 'sm' | 'md' }) {
  if (!csa) return null;
  return (
    <span className={`csa csa--${size} csa--${csa.replace('-', 'm')}`} title={`Déconseillé aux moins de ${csa.replace('-', '')} ans`} aria-label={`Déconseillé aux moins de ${csa.replace('-', '')} ans`}>
      {csa}
    </span>
  );
}

const SHORT: Record<string, string> = { 'Rotten Tomatoes': 'RT', Metacritic: 'MC' };

/** Noms lisibles des sources de notes du flux XMLTV */
const SOURCE: Record<string, string> = {
  allocine: 'AlloCiné',
  teleloisirs: 'Télé-Loisirs',
  telerama: 'Télérama',
  tele7jours: 'Télé 7 Jours',
  telestar: 'Télé Star',
  programmetv: 'Programme TV',
  imdb: 'IMDb',
};
export const sourceLabel = (s: string) => SOURCE[s.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? s;

/** Meilleure note dispo, pour les cartes (une seule, courte). */
export function bestRating(f: Film) {
  const r = f.ratings ?? (f.rating ? [{ source: 'TMDB', score: f.rating, display: f.rating.toFixed(1) }] : []);
  return r.find((x) => x.source === 'IMDb') ?? r[0];
}

export function RatingPill({ film }: { film: Film }) {
  const r = bestRating(film);
  if (!r) return null;
  return (
    <span className="rating-pill" title={r.source}>
      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      </svg>
      {r.display}
      <span className="rating-pill__src">{SHORT[r.source] ?? sourceLabel(r.source)}</span>
    </span>
  );
}

/** Toutes les notes, en tuiles : source + note + jauge. */
export function Ratings({ film }: { film: Film }) {
  const list = film.ratings ?? (film.rating ? [{ source: 'TMDB', score: film.rating, display: film.rating.toFixed(1) }] : []);
  if (!list.length) return null;
  return (
    <div className="ratings">
      {list.map((r) => (
        <div key={r.source} className="rating">
          <span className="rating__value">{r.display}</span>
          <span className="rating__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(10, r.score)) * 10}%` }} />
          </span>
          <span className="rating__src">{sourceLabel(r.source)}</span>
        </div>
      ))}
    </div>
  );
}

/** Petites infos techniques : inédit, rediffusion, HD, sous-titres… */
export function Flags({ film }: { film: Film }) {
  const f = film.flags;
  if (!f) return null;
  const items = [
    f.premiere && 'Inédit',
    f.rerun && 'Rediffusion',
    f.hd && 'HD',
    f.vost && 'VOST',
    f.subtitles && 'Sous-titres',
    f.audioDescription && 'Audiodescription',
  ].filter(Boolean) as string[];
  if (!items.length) return null;
  return (
    <div className="flags">
      {items.map((i) => (
        <span key={i} className={`flag ${i === 'Inédit' ? 'flag--new' : ''}`}>{i}</span>
      ))}
    </div>
  );
}
