import { useMemo, useState } from 'react';
import { KINDS, type Channel, type Film, type Kind } from '../types';
import { channelOn, isFollowed, score, showKey, type Profile } from '../profile';
import { assetUrl, hhmm, isOn, stopOf } from '../utils';
import { Progress } from './Progress';
import { Grid } from './Grid';

interface Props {
  profile: Profile;
  channels: Channel[];
  films: Film[];
  /** Heure de référence : maintenant, ou le début de la 1re / 2e partie */
  at: number;
  now: number;
  onOpen: (f: Film) => void;
  onChange: (p: Profile) => void;
}

type View = 'list' | 'grid';
type Sort = 'mine' | 'pourtoi';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mes chaînes dans mon ordre : favoris d'abord, puis l'ordre perso (ou celui des numéros). */
export function orderedChannels(p: Profile, channels: Channel[]) {
  const mine = channels.filter((c) => channelOn(p, c.id, c.bouquet));
  const idx = new Map(p.channelOrder.map((id, i) => [id, i]));
  const base = mine.map((c, i) => ({ c, i: idx.get(c.id) ?? 10_000 + i })).sort((a, b) => a.i - b.i).map((x) => x.c);
  return [...base.filter((c) => p.favorites[c.id]), ...base.filter((c) => !p.favorites[c.id])];
}

/** Toutes mes chaînes d'un coup : liste (ce qui passe + ce qui suit) ou grille horaire. */
export function Channels({ profile, channels, films, at, now, onOpen, onChange }: Props) {
  const [view, setView] = useState<View>('list');
  const [sort, setSort] = useState<Sort>('mine');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [reorder, setReorder] = useState(false);

  const byChannel = useMemo(() => {
    const m = new Map<string, Film[]>();
    for (const f of films) {
      const list = m.get(f.channelId) ?? [];
      list.push(f);
      m.set(f.channelId, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return m;
  }, [films]);

  const ordered = orderedChannels(profile, channels);

  // Ce qu'on montre pour chaque chaîne : le programme à l'heure choisie (ou le prochain du type filtré)
  const rows = ordered
    .map((c) => {
      const list = byChannel.get(c.id) ?? [];
      let current = list.find((f) => isOn(f, at)) ?? list.find((f) => Date.parse(f.start) > at);
      if (kind !== 'all') {
        current = list.find((f) => f.kind === kind && stopOf(f) > at && Date.parse(f.start) < at + 3 * 3600_000);
      }
      const cur = current;
      const next = cur ? list.find((f) => Date.parse(f.start) >= stopOf(cur) - 60_000 && f.id !== cur.id) : undefined;
      return { c, current: cur, next };
    })
    .filter((r) => kind === 'all' || r.current);

  if (sort === 'pourtoi') {
    const s = (f?: Film) => (!f || f.kind === 'autre' ? -99 : score(profile, f));
    rows.sort((a, b) => s(b.current) - s(a.current));
  }

  const q = norm(query.trim());
  const results =
    q.length >= 2
      ? films
          .filter((f) => stopOf(f) > now && ordered.some((c) => c.id === f.channelId))
          .filter((f) => norm([f.title, f.subTitle, f.synopsis, ...f.cast, ...f.directors].filter(Boolean).join(' ')).includes(q))
          .sort((a, b) => a.start.localeCompare(b.start))
          .slice(0, 40)
      : [];

  const toggleFavorite = (id: string) => {
    const favorites = { ...profile.favorites };
    if (favorites[id]) delete favorites[id];
    else favorites[id] = true;
    onChange({ ...profile, favorites });
  };

  const move = (id: string, dir: -1 | 1) => {
    const order = ordered.map((c) => c.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    onChange({ ...profile, channelOrder: order });
  };

  const logo = (c: Channel) => (
    <span className={`channel__logo ${c.logoDark ? 'is-dark' : ''}`} aria-hidden="true">
      {c.logo ? <img src={assetUrl(c.logo)} alt="" loading="lazy" /> : <span>{c.name.slice(0, 3)}</span>}
    </span>
  );

  return (
    <div className="stack">
      <label className="search">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Rechercher</span>
        <input type="search" placeholder="Titre, acteur, équipe…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {q.length >= 2 ? (
        <ul className="channels">
          {results.length === 0 && <li className="muted small">Rien trouvé aujourd'hui sur tes chaînes.</li>}
          {results.map((f) => {
            const c = channels.find((x) => x.id === f.channelId)!;
            return (
              <li key={f.id} className="channel">
                {logo(c)}
                <button className="channel__body" onClick={() => onOpen(f)}>
                  <span className="channel__name">{c.name} · {hhmm(f.start)}</span>
                  <span className="channel__title">{f.title}</span>
                  {f.subTitle && <span className="channel__next">{f.subTitle}</span>}
                  <Progress film={f} now={now} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className="toolbar">
            <div className="segmented segmented--sm" role="group" aria-label="Affichage">
              <button aria-pressed={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>Liste</button>
              <button aria-pressed={view === 'grid'} className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')}>Grille (test)</button>
            </div>
            {view === 'list' && (
              <div className="segmented segmented--sm" role="group" aria-label="Tri">
                <button aria-pressed={sort === 'mine'} className={sort === 'mine' ? 'is-on' : ''} onClick={() => setSort('mine')}>Mon ordre</button>
                <button aria-pressed={sort === 'pourtoi'} className={sort === 'pourtoi' ? 'is-on' : ''} onClick={() => setSort('pourtoi')}>Pour toi</button>
              </div>
            )}
          </div>

          <div className="filters" role="group" aria-label="Type de programme">
            {[{ id: 'all' as const, plural: 'Tout' }, ...KINDS].map((k) => (
              <button key={k.id} aria-pressed={kind === k.id} className={`chip ${kind === k.id ? 'is-on' : ''}`} onClick={() => setKind(k.id)}>
                {k.plural}
              </button>
            ))}
          </div>

          {view === 'grid' ? (
            <Grid profile={profile} channels={ordered} films={films} at={at} now={now} kind={kind} onOpen={onOpen} />
          ) : (
            <>
              {sort === 'mine' && (
                <button className="link" onClick={() => setReorder((v) => !v)}>
                  {reorder ? 'Terminer' : 'Réorganiser mes chaînes'}
                </button>
              )}
              <ul className="channels">
                {rows.length === 0 && <li className="muted small">Aucune chaîne ne diffuse ce type de programme dans les 3 prochaines heures.</li>}
                {rows.map(({ c, current, next }) => {
                  const fav = !!profile.favorites[c.id];
                  return (
                    <li key={c.id} className="channel">
                      {reorder ? (
                        <span className="channel__move">
                          <button aria-label={`Monter ${c.name}`} onClick={() => move(c.id, -1)}>↑</button>
                          <button aria-label={`Descendre ${c.name}`} onClick={() => move(c.id, 1)}>↓</button>
                        </span>
                      ) : (
                        <button
                          className={`channel__fav ${fav ? 'is-on' : ''}`}
                          aria-label={fav ? `Retirer ${c.name} des favoris` : `Ajouter ${c.name} aux favoris`}
                          aria-pressed={fav}
                          onClick={() => toggleFavorite(c.id)}
                        >
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                            <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
                          </svg>
                        </button>
                      )}
                      {logo(c)}
                      {current ? (
                        <button className="channel__body" onClick={() => onOpen(current)}>
                          <span className="channel__name">{c.name}</span>
                          <span className="channel__title">
                            {isFollowed(profile, current) && <span className="badge">Suivi</span>}
                            {current.title}
                          </span>
                          <Progress film={current} now={now} times />
                          {next && (
                            <span className="channel__next">
                              Puis {hhmm(next.start)} · {next.title}
                              {profile.followed[showKey(next.title)] ? ' · suivi' : ''}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="channel__body">
                          <span className="channel__name">{c.name}</span>
                          <span className="muted small">Pas de programme connu</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
