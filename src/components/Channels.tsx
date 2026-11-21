import type { Channel, Film } from '../types';
import { channelOn, type Profile } from '../profile';
import { assetUrl, hhmm, isOn, stopOf } from '../utils';
import { Progress } from './Progress';

interface Props {
  profile: Profile;
  channels: Channel[];
  films: Film[];
  /** Heure de référence : maintenant, ou le début de la 1re / 2e partie */
  at: number;
  now: number;
  onOpen: (f: Film) => void;
  onToggleFavorite: (channelId: string) => void;
}

/** Toutes mes chaînes d'un coup : ce qui passe à l'heure choisie, et ce qui suit. */
export function Channels({ profile, channels, films, at, now, onOpen, onToggleFavorite }: Props) {
  const mine = channels.filter((c) => channelOn(profile, c.id, c.bouquet));
  const ordered = [...mine.filter((c) => profile.favorites[c.id]), ...mine.filter((c) => !profile.favorites[c.id])];

  const byChannel = new Map<string, Film[]>();
  for (const f of films) {
    const list = byChannel.get(f.channelId) ?? [];
    list.push(f);
    byChannel.set(f.channelId, list);
  }
  for (const list of byChannel.values()) list.sort((a, b) => a.start.localeCompare(b.start));

  return (
    <ul className="channels">
      {ordered.map((c) => {
        const list = byChannel.get(c.id) ?? [];
        const current = list.find((f) => isOn(f, at)) ?? list.find((f) => Date.parse(f.start) > at);
        const next = current ? list.find((f) => Date.parse(f.start) >= stopOf(current) - 60_000 && f.id !== current.id) : undefined;
        const fav = !!profile.favorites[c.id];
        return (
          <li key={c.id} className="channel">
            <button
              className={`channel__fav ${fav ? 'is-on' : ''}`}
              aria-label={fav ? `Retirer ${c.name} des favoris` : `Ajouter ${c.name} aux favoris`}
              aria-pressed={fav}
              onClick={() => onToggleFavorite(c.id)}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
              </svg>
            </button>
            <span className="channel__logo" aria-hidden="true">
              {c.logo ? <img src={assetUrl(c.logo)} alt="" loading="lazy" /> : <span>{c.name.slice(0, 3)}</span>}
            </span>
            {current ? (
              <button className="channel__body" onClick={() => onOpen(current)}>
                <span className="channel__name">{c.name}</span>
                <span className="channel__title">{current.title}</span>
                <Progress film={current} now={now} times />
                {next && (
                  <span className="channel__next">
                    Puis {hhmm(next.start)} · {next.title}
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
  );
}
