import { useEffect, useRef } from 'react';
import type { Channel, Film, Kind } from '../types';
import { isFollowed, type Profile } from '../profile';
import { assetUrl, colorsFor, hhmm, stopOf } from '../utils';

interface Props {
  profile: Profile;
  channels: Channel[];
  films: Film[];
  at: number;
  now: number;
  kind: Kind | 'all';
  onOpen: (f: Film) => void;
}

const PX_PER_MIN = 4;
const HOURS = 7;

/** Grille horaire (test) : chaînes en lignes, la soirée défile de gauche à droite. */
export function Grid({ profile, channels, films, at, now, kind, onOpen }: Props) {
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

  const ticks: number[] = [];
  for (let t = t0; t <= t1; t += 30 * 60_000) ticks.push(t);

  return (
    <div className="grid" ref={scroller}>
      <div className="grid__inner" style={{ width: width + 64 }}>
        <div className="grid__head">
          <span className="grid__corner" />
          <div className="grid__ticks" style={{ width }}>
            {ticks.map((t) => (
              <span key={t} className="grid__tick" style={{ left: x(t) }}>{hhmm(new Date(t).toISOString())}</span>
            ))}
          </div>
        </div>
        {channels.map((c) => (
          <div key={c.id} className="grid__row">
            <span className={`grid__logo ${c.logoDark ? 'is-dark' : ''}`} title={c.name}>
              {c.logo ? <img src={assetUrl(c.logo)} alt={c.name} loading="lazy" /> : <span>{c.name.slice(0, 4)}</span>}
            </span>
            <div className="grid__track" style={{ width }}>
              {films
                .filter((f) => f.channelId === c.id && stopOf(f) > t0 && Date.parse(f.start) < t1)
                .map((f) => {
                  const left = Math.max(0, x(Date.parse(f.start)));
                  const w = Math.max(18, x(Math.min(stopOf(f), t1)) - left - 2);
                  const dim = kind !== 'all' && f.kind !== kind;
                  const followed = isFollowed(profile, f);
                  const live = Date.parse(f.start) <= now && now < stopOf(f);
                  // Visuel du programme en fond ; sinon un aplat de couleur (sauf journaux, météo…)
                  const bg = f.poster
                    ? { backgroundImage: `url("${assetUrl(f.poster)}")` }
                    : f.kind !== 'autre'
                      ? { backgroundColor: colorsFor(f.title).bg }
                      : undefined;
                  return (
                    <button
                      key={f.id}
                      className={`grid__block ${f.poster ? 'has-poster' : ''} ${f.kind === 'autre' ? 'is-plain' : ''} ${dim ? 'is-dim' : ''} ${followed ? 'is-followed' : ''} ${live ? 'is-live' : ''}`}
                      style={{ left, width: w, ...bg }}
                      onClick={() => onOpen(f)}
                      title={`${hhmm(f.start)} ${f.title}`}
                    >
                      <span className="grid__text">
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
