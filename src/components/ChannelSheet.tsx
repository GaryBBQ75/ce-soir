import { useEffect, useRef } from 'react';
import type { Channel, Film } from '../types';
import { isFollowed, type Profile } from '../profile';
import { Sheet } from './Sheet';
import { ChannelLogo } from './ChannelLogo';
import { Poster } from './Poster';
import { Progress } from './Progress';
import { CsaBadge } from './Badges';
import { hhmm, isOn, stopOf } from '../utils';
import { liveLink } from '../links';

interface Props {
  channel: Channel;
  films: Film[];
  now: number;
  profile: Profile;
  onOpen: (f: Film) => void;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
}

/** La journée d'une chaîne, du matin à la nuit, centrée sur ce qui passe maintenant. */
export function ChannelSheet({ channel, films, now, profile, onOpen, onToggleFavorite, onClose }: Props) {
  const list = films.filter((f) => f.channelId === channel.id).sort((a, b) => a.start.localeCompare(b.start));
  const current = list.find((f) => isOn(f, now)) ?? list.find((f) => Date.parse(f.start) > now) ?? list[list.length - 1];
  const currentRef = useRef<HTMLLIElement>(null);
  const live = liveLink(channel.name);
  const fav = !!profile.favorites[channel.id];

  // On ouvre la journée sur ce qui passe maintenant (après l'animation d'ouverture)
  useEffect(() => {
    const t = setTimeout(() => currentRef.current?.scrollIntoView({ block: 'center' }), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <Sheet label={`Programme de ${channel.name}`} onClose={onClose}>
      <div className="channel-head">
        <ChannelLogo channel={channel} fallback={channel.name} size="md" />
        <div className="stack-xs" style={{ flex: 1 }}>
          <strong>{channel.name}</strong>
          <span className="muted small">{list.length} programmes aujourd'hui</span>
        </div>
        <button className={`btn btn--sm ${fav ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={fav} onClick={() => onToggleFavorite(channel.id)}>
          {fav ? '★ Dans mes favorites' : '☆ Ajouter aux favorites'}
        </button>
      </div>
      {live && (
        <a className="btn btn--live btn--wide" href={live.url} target="_blank" rel="noreferrer">
          <span className="live-dot" aria-hidden="true" />
          Regarder {channel.name} en direct
        </a>
      )}
      <ul className="day">
        {list.map((f) => {
          const past = stopOf(f) <= now;
          return (
            <li key={f.id} ref={f === current ? currentRef : undefined} className={`day__item ${past ? 'is-past' : ''} ${f === current ? 'is-current' : ''}`}>
              <span className="day__time">{hhmm(f.start)}</span>
              <button className="day__body" onClick={() => onOpen(f)}>
                {f.kind !== 'autre' && <Poster title={f.title} poster={f.poster} className="day__poster" />}
                <span className="day__text">
                  <span className="day__title">
                    {isFollowed(profile, f) && <span className="badge">Suivi</span>}
                    {f.title}
                  </span>
                  {f.subTitle && <span className="muted small day__sub">{f.subTitle}</span>}
                  {!past && Date.parse(f.start) - now < 3 * 3600_000 && <Progress film={f} now={now} />}
                </span>
                <CsaBadge csa={f.csa} size="sm" />
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
