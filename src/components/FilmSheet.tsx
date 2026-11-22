import { KINDS, type Channel, type Film, type Signal, type Tonight } from '../types';
import { channelReceived, showKey, type Profile } from '../profile';
import { Sheet } from './Sheet';
import { Progress } from './Progress';
import { ChannelLogo } from './ChannelLogo';
import { CsaBadge, Flags, Ratings } from './Badges';
import { assetUrl, colorsFor, dayLabel, durationLabel, hhmm, isOn, nextAirings } from '../utils';
import { liveLink } from '../links';

interface Props {
  film: Film;
  tonight: Tonight;
  channel?: Channel;
  now: number;
  profile: Profile;
  onSignal: (s: Signal) => void;
  onHide: () => void;
  onClose: () => void;
  onToggleReminder: () => void;
  onAgenda: () => void;
  onFollow: (follow: boolean, notify: boolean) => void;
  onOpen: (f: Film) => void;
  onOpenChannel: (channelId: string) => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function FilmSheet(p: Props) {
  const { film, tonight, channel, now, profile } = p;
  const channelsById = new Map(tonight.channels.map((c) => [c.id, c]));
  const key = showKey(film.title);
  const follow = profile.followed[key];
  const reminded = !!profile.reminders[film.id];
  const live = liveLink(film.channel);
  const onAir = isOn(film, now);
  const started = Date.parse(film.start) <= now;
  // Prochaines diffusions sur mes chaînes (aujourd'hui et les jours suivants)
  const airings = nextAirings(key, showKey, tonight, now, film.id)
    .filter((a) => {
      const c = channelsById.get(a.channelId);
      return c && channelReceived(profile, c.id, c.bouquet);
    })
    .slice(0, 4);
  const until = tonight.laterUntil
    ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(tonight.laterUntil))
    : null;
  const isFilm = film.kind === 'film';
  const hero = film.backdrop ?? film.poster;
  const { bg } = colorsFor(film.title);
  const kindLabel = KINDS.find((k) => k.id === film.kind)?.label ?? 'Programme';

  // Casting : détaillé si dispo, sinon les noms simples
  const cast = film.castDetails ?? film.cast.map((name) => ({ name, role: undefined as string | undefined, photo: undefined as string | undefined }));
  const crew = [
    ...film.directors.map((name) => ({ job: film.kind === 'serie' ? 'Création' : 'Réalisation', name })),
    ...(film.crew ?? []).filter((c) => !film.directors.includes(c.name)),
  ];
  const meta = [
    kindLabel,
    film.genres.filter((g) => g !== 'Documentaire').slice(0, 3).join(', '),
    film.year,
    film.country,
    durationLabel(film),
  ].filter(Boolean);
  const episode =
    film.season || film.episode
      ? `${film.season ? `Saison ${film.season}` : ''}${film.season && film.episode ? ' · ' : ''}${film.episode ? `Épisode ${film.episode}` : ''}`
      : null;

  return (
    <Sheet label={film.title} onClose={p.onClose}>
      {/* Visuel en grand, fondu dans le fond de la fiche */}
      <div className="hero" style={{ backgroundColor: bg }}>
        {hero && <img className="hero__img" src={assetUrl(hero)} alt="" />}
        <div className="hero__shade" />
        <div className="hero__content">
          <div className="hero__top">
            <button className="hero__channel" onClick={() => p.onOpenChannel(film.channelId)} aria-label={`Programme de ${film.channel}`}>
              <ChannelLogo channel={channel} fallback={film.channel} size="sm" />
              <span>
                {onAir && <span className="live-dot" aria-hidden="true" />}
                {hhmm(film.start)}
              </span>
            </button>
            <CsaBadge csa={film.csa} />
          </div>
          <h2 className="hero__title">{film.title}</h2>
          {film.originalTitle && <span className="hero__original">{film.originalTitle}</span>}
        </div>
      </div>

      <div className="sheet__section">
        <p className="meta-line">{meta.join(' · ')}</p>
        {(film.subTitle || episode) && (
          <p className="episode-line">
            {episode && <strong>{episode}</strong>}
            {episode && film.subTitle && ' · '}
            {film.subTitle}
          </p>
        )}
        <Flags film={film} />
        <Progress film={film} now={now} times />
      </div>

      {/* Actions principales */}
      <div className="actions">
        {live && (
          <a className="btn btn--live" href={live.url} target="_blank" rel="noreferrer">
            {onAir && <span className="live-dot" aria-hidden="true" />}
            {onAir ? 'Regarder en direct' : `Ouvrir ${live.label}`}
          </a>
        )}
        {film.trailer && (
          <a className="btn btn--ghost" href={film.trailer} target="_blank" rel="noreferrer">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Bande-annonce
          </a>
        )}
        {!started && (
          <button className={`btn ${reminded ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={reminded} onClick={p.onToggleReminder}>
            {reminded ? `Rappel ${profile.notifyBefore} min avant` : 'Me rappeler'}
          </button>
        )}
        {!started && (
          <button className="btn btn--ghost" onClick={p.onAgenda}>Agenda</button>
        )}
      </div>

      <Ratings film={film} />

      {film.tagline && <p className="tagline">« {film.tagline} »</p>}
      {film.synopsis && <p className="sheet__synopsis">{film.synopsis}</p>}

      {cast.length > 0 && (
        <div className="sheet__section">
          <h3 className="eyebrow">{film.kind === 'divertissement' || film.kind === 'doc' ? 'Avec' : 'Casting'}</h3>
          <div className="cast">
            {cast.slice(0, 12).map((c) => (
              <div key={c.name} className="person">
                <span className="person__photo" aria-hidden="true">
                  {c.photo ? <img src={c.photo} alt="" loading="lazy" /> : <span>{initials(c.name)}</span>}
                </span>
                <span className="person__name">{c.name}</span>
                {c.role && <span className="person__role">{c.role}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {crew.length > 0 && (
        <dl className="credits">
          {crew.slice(0, 8).map((c, i) => (
            <div key={c.job + c.name + i}>
              <dt>{c.job}</dt>
              <dd>{c.name}</dd>
            </div>
          ))}
        </dl>
      )}

      {film.kind !== 'autre' && (
        <div className="sheet__section follow">
          <h3 className="eyebrow">{isFilm ? 'Quand ça repasse' : 'Prochaines diffusions'}</h3>
          {airings.length > 0 ? (
            <div className="airings">
              {airings.map((a) => {
                const c = channelsById.get(a.channelId);
                const inner = (
                  <>
                    <ChannelLogo channel={c} fallback={c?.name ?? ''} size="xs" />
                    <span className="airing__when">
                      <strong>{dayLabel(a.start, now)}</strong> à {hhmm(a.start)}
                    </span>
                    <span className="muted airing__ch">{c?.name}</span>
                  </>
                );
                return a.film ? (
                  <button key={a.channelId + a.start} className="airing" onClick={() => p.onOpen(a.film!)}>{inner}</button>
                ) : (
                  <div key={a.channelId + a.start} className="airing">{inner}</div>
                );
              })}
            </div>
          ) : (
            <p className="muted small">
              {isFilm ? 'Pas d\'autre diffusion prévue' : 'Pas d\'autre diffusion prévue sur tes chaînes'}
              {until ? ` d'ici ${until}.` : '.'}
            </p>
          )}

          <button className={`btn btn--wide ${follow ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={!!follow} onClick={() => p.onFollow(!follow, follow?.notify ?? true)}>
            {isFilm ? (follow ? 'Alerte activée' : 'M\'alerter quand il repasse') : follow ? 'Émission suivie' : 'Suivre cette émission'}
          </button>
          <p className="muted small">
            {isFilm
              ? follow
                ? 'Tu le verras dans « Tes suivis » dès qu\'une nouvelle diffusion est annoncée, et une notification le jour même.'
                : 'Pratique si tu le rates ce soir : l\'app te prévient dès qu\'il est reprogrammé sur tes chaînes.'
              : follow
                ? 'Elle apparaît dans « Tes suivis » avec sa prochaine diffusion.'
                : 'Tu verras sa prochaine diffusion en haut de l\'app, et un bandeau quand elle commence.'}
          </p>
          {follow && (
            <label className="switch-row">
              <span className="small">{isFilm ? 'Notification le jour de la diffusion' : 'Me prévenir à chaque diffusion'}</span>
              <input type="checkbox" className="switch" checked={follow.notify} onChange={() => p.onFollow(true, !follow.notify)} />
            </label>
          )}
        </div>
      )}

      {film.kind !== 'autre' && (
        <div className="taste">
          <span className="muted small">Ton avis affine tes suggestions</span>
          <div className="row">
            <button className="btn btn--ghost btn--sm" onClick={() => p.onSignal('like')}>J'aime</button>
            <button className="btn btn--ghost btn--sm" onClick={() => p.onSignal('watched')}>Déjà vu</button>
            <button className="btn btn--ghost btn--sm" onClick={p.onHide}>Pas pour moi</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
