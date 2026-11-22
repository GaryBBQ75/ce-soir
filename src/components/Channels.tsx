import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Channel, Film, Kind } from '../types';
import { KindFilter, matchesFilter } from './KindFilter';
import { channelOn, isFollowed, score, showKey, type Profile } from '../profile';
import { hhmm, isOn, stopOf } from '../utils';
import { ChannelLogo } from './ChannelLogo';
import { Poster } from './Poster';
import { CsaBadge } from './Badges';
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
  onOpenChannel: (channelId: string) => void;
  onChange: (p: Profile) => void;
  view: View;
  query: string;
}

export type View = 'list' | 'grid';
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
export function Channels({ profile, channels, films, at, now, onOpen, onOpenChannel, onChange, view, query }: Props) {
  const [sort, setSort] = useState<Sort>('mine');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [genre, setGenre] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  // La grille occupe tout l'espace restant de l'écran : seule la grille défile
  const gridWrap = useRef<HTMLDivElement>(null);
  const [gridH, setGridH] = useState(480);
  useLayoutEffect(() => {
    if (view !== 'grid') return;
    const fit = () => {
      const top = gridWrap.current?.getBoundingClientRect().top ?? 300;
      setGridH(Math.max(260, window.innerHeight - top - 84));
    };
    window.scrollTo(0, 0);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [view]);

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
        current = list.find((f) => matchesFilter(f, kind, genre) && stopOf(f) > at && Date.parse(f.start) < at + 3 * 3600_000);
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

  const move = (id: string, dir: -1 | 1) => {
    const order = ordered.map((c) => c.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    onChange({ ...profile, channelOrder: order });
  };

  // Vignette : visuel du programme, avec le logo de la chaîne en petit dans le coin
  // Toucher le logo ouvre la journée de la chaîne ; toucher l'image ouvre le programme
  const thumb = (c: Channel, f?: Film) => (
    <span className="channel__thumb">
      <span className="channel__thumb-img" onClick={() => f && onOpen(f)} aria-hidden="true">
        {f ? <Poster title={f.title} poster={f.poster} className="channel__poster" /> : <span className="channel__poster" />}
      </span>
      <button className="channel__clogo" onClick={() => onOpenChannel(c.id)} aria-label={`Programme de la journée sur ${c.name}`}>
        <ChannelLogo channel={c} fallback={c.name} size="xs" />
      </button>
    </span>
  );

  return (
    <div className="stack">
      {q.length > 0 && q.length < 2 && <p className="muted small">Tape au moins 2 lettres.</p>}
      {q.length >= 2 ? (
        <ul className="channels">
          {results.length === 0 && <li className="muted small">Rien trouvé aujourd'hui sur tes chaînes.</li>}
          {results.map((f) => {
            const c = channels.find((x) => x.id === f.channelId)!;
            return (
              <li key={f.id} className="channel">
                {thumb(c, f)}
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
          <KindFilter
            films={films.filter((f) => stopOf(f) > at && Date.parse(f.start) < at + 3 * 3600_000 && ordered.some((c) => c.id === f.channelId))}
            kind={kind}
            genre={genre}
            onKind={setKind}
            onGenre={setGenre}
          />

          {view === 'grid' ? (
            <div ref={gridWrap}>
              <Grid profile={profile} channels={ordered} films={films} at={at} now={now} kind={kind} genre={genre} height={gridH} onOpen={onOpen} onOpenChannel={onOpenChannel} />
            </div>
          ) : (
            <>
              <div className="list-tools">
                <span className="list-tools__sort" role="group" aria-label="Tri">
                  <button aria-pressed={sort === 'mine'} className={sort === 'mine' ? 'is-on' : ''} onClick={() => setSort('mine')}>Mon ordre</button>
                  <button aria-pressed={sort === 'pourtoi'} className={sort === 'pourtoi' ? 'is-on' : ''} onClick={() => { setSort('pourtoi'); setReorder(false); }}>Pour toi</button>
                </span>
                {sort === 'mine' && (
                  <button className="list-tools__link" onClick={() => setReorder((v) => !v)}>
                    {reorder ? 'Terminer' : 'Réorganiser'}
                  </button>
                )}
              </div>
              <ul className="channels">
                {rows.length === 0 && <li className="muted small">Aucune chaîne ne diffuse ce type de programme dans les 3 prochaines heures.</li>}
                {rows.map(({ c, current, next }) => {
                  const fav = !!profile.favorites[c.id];
                  return (
                    <li key={c.id} className="channel">
                      {reorder && (
                        <span className="channel__move">
                          <button aria-label={`Monter ${c.name}`} onClick={() => move(c.id, -1)}>↑</button>
                          <button aria-label={`Descendre ${c.name}`} onClick={() => move(c.id, 1)}>↓</button>
                        </span>
                      )}
                      {thumb(c, current)}
                      {current ? (
                        <button className="channel__body" onClick={() => onOpen(current)}>
                          <span className="channel__name">
                            {fav && <span className="channel__favmark" aria-label="Favorite">★</span>}
                            {c.name} · {hhmm(current.start)}–{hhmm(new Date(stopOf(current)).toISOString())}
                            {current.csa && <CsaBadge csa={current.csa} size="sm" />}
                          </span>
                          <span className="channel__title">
                            {isFollowed(profile, current) && <span className="badge">Suivi</span>}
                            {current.title}
                          </span>
                          <Progress film={current} now={now} />
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
