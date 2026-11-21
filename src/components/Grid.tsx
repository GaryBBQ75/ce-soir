import { useEffect, useRef } from 'react';
import type { Channel, Film, Kind } from '../types';
import { isFollowed, type Profile } from '../profile';
import { assetUrl, hhmm, stopOf } from '../utils';
import { ChannelLogo } from './ChannelLogo';

interface Props {
  profile: Profile;
  channels: Channel[];
  films: Film[];
  at: number;
  now: number;
  kind: Kind | 'all';
  /** Hauteur fixe : seule la grille défile, pas la page */
  height: number;
  onOpen: (f: Film) => void;
}

const PX_PER_MIN = 4.5;
const HOURS = 7;
const ROW = 76;

/** Grille horaire (test) : chaînes en lignes, la soirée défile de gauche à droite. */
export function Grid({ profile, channels, films, at, now, kind, height, onOpen }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  // Début de la grille : la demi-heure pleine 1 h avant l'heure choisie
  const t0 = Math.floor((at - 60 * 60_000) / (30 * 60_000)) * 30 * 60_000;
  const t1 = t0 + HOURS * 3600_000;
  const x = (t: number) => ((t - t0) / 60_000) * PX_PER_MIN;
  const width = x(t1);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(at) - 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const visible = (f: Film) => stopOf(f) > t0 && Date.parse(f.start) < t1;
  // Avec un filtre (ex. Films) : seulement les chaînes qui en diffusent
  const rows = channels.filter((c) => kind === 'all' || films.some((f) => f.channelId === c.id && f.kind === kind && visible(f)));

  const ticks: number[] = [];
  for (let t = t0; t <= t1; t += 30 * 60_000) ticks.push(t);

  return (
    <div className="grid" ref={scroller} style={{ height }}>
      <div className="grid__inner" style={{ width: width + 64 }}>
        <div className="grid__head">
          <span className="grid__corner" />
          <div className="grid__ticks" style={{ width }}>
            {ticks.map((t) => (
              <span key={t} className="grid__tick" style={{ left: x(t) }}>{hhmm(new Date(t).toISOString())}</span>
            ))}
          </div>
        </div>
        {rows.length === 0 && <p className="muted small grid__empty">Aucune chaîne ne diffuse ce type de programme sur cette période.</p>}
        {rows.map((c) => (
          <div key={c.id} className="grid__row" style={{ height: ROW }}>
            <span className="grid__logo">
              <ChannelLogo channel={c} fallback={c.name} size="md" />
            </span>
            <div className="grid__track" style={{ width }}>
              {films
                .filter((f) => f.channelId === c.id && visible(f))
                .map((f) => {
                  const left = Math.max(0, x(Date.parse(f.start)));
                  const w = Math.max(18, x(Math.min(stopOf(f), t1)) - left - 3);
                  const dim = kind !== 'all' && f.kind !== kind;
                  const followed = isFollowed(profile, f);
                  const live = Date.parse(f.start) <= now && now < stopOf(f);
                  // Le visuel prend la hauteur de la case, au format 16/9, et se fond dans le fond de la case
                  const imgW = Math.min(Math.round((ROW - 8) * 1.6), Math.round(w * 0.55));
                  const showImg = !!f.poster && w >= 110;
                  return (
                    <button
                      key={f.id}
                      className={`grid__block ${f.kind === 'autre' ? 'is-plain' : ''} ${dim ? 'is-dim' : ''} ${followed ? 'is-followed' : ''} ${live ? 'is-live' : ''}`}
                      style={{ left, width: w }}
                      onClick={() => onOpen(f)}
                      title={`${hhmm(f.start)} ${f.title}`}
                    >
                      {showImg && (
                        <span className="grid__img" style={{ width: imgW }}>
                          <img src={assetUrl(f.poster!)} alt="" loading="lazy" />
                        </span>
                      )}
                      <span className="grid__text" style={showImg ? { paddingLeft: imgW - 18 } : undefined}>
                        <span className="grid__title">{f.title}</span>
                        <span className="grid__time">
                          {live && <span className="live-dot" aria-hidden="true" />}
                          {hhmm(f.start)}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        {now >= t0 && now <= t1 && <span className="grid__now" style={{ left: 64 + x(now) }} aria-hidden="true" />}
      </div>
    </div>
  );
}
