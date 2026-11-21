import { KINDS, type Film, type Kind } from '../types';

interface Props {
  /** Programmes visibles (pour savoir quels types et sous-genres proposer) */
  films: Film[];
  kind: Kind | 'all';
  genre: string | null;
  onKind: (k: Kind | 'all') => void;
  onGenre: (g: string | null) => void;
}

// Genres trop vagues pour servir de filtre
const IGNORED = new Set(['Documentaire']);

/** 1re ligne : les catégories. 2e ligne (si une catégorie est choisie) : ses sous-genres. */
export function KindFilter({ films, kind, genre, onKind, onGenre }: Props) {
  const kinds = KINDS.filter((k) => films.some((f) => f.kind === k.id));

  const counts = new Map<string, number>();
  if (kind !== 'all') {
    for (const f of films) {
      if (f.kind !== kind) continue;
      for (const g of f.genres) if (!IGNORED.has(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  const genres = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g);

  return (
    <div className="kind-filter">
      <div className="filters" role="group" aria-label="Catégorie">
        {[{ id: 'all' as const, plural: 'Tout' }, ...kinds].map((k) => (
          <button
            key={k.id}
            aria-pressed={kind === k.id}
            className={`chip ${kind === k.id ? 'is-on' : ''}`}
            onClick={() => {
              onKind(k.id);
              onGenre(null);
            }}
          >
            {k.plural}
          </button>
        ))}
      </div>
      {genres.length > 1 && (
        <div className="filters filters--sub" role="group" aria-label="Sous-genre">
          <button aria-pressed={genre === null} className={`chip chip--sub ${genre === null ? 'is-on' : ''}`} onClick={() => onGenre(null)}>
            Tous
          </button>
          {genres.map((g) => (
            <button key={g} aria-pressed={genre === g} className={`chip chip--sub ${genre === g ? 'is-on' : ''}`} onClick={() => onGenre(genre === g ? null : g)}>
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Le programme correspond-il au filtre ? */
export const matchesFilter = (f: Film, kind: Kind | 'all', genre: string | null) =>
  (kind === 'all' || f.kind === kind) && (!genre || f.genres.includes(genre));
