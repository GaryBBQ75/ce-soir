import { kindLabel, type Film, type Signal } from '../types';
import { showKey, type Profile } from '../profile';
import { Poster } from './Poster';
import { Progress } from './Progress';
import { durationLabel, hhmm, isOn } from '../utils';
import { liveLink } from '../links';

interface Props {
  film: Film;
  films: Film[];
  now: number;
  profile: Profile;
  onSignal: (s: Signal) => void;
  onHide: () => void;
  onClose: () => void;
  onToggleReminder: () => void;
  onAgenda: () => void;
  onFollow: (follow: boolean, notify: boolean) => void;
  onOpen: (f: Film) => void;
}

export function FilmSheet({ film, films, now, profile, onSignal, onHide, onClose, onToggleReminder, onAgenda, onFollow, onOpen }: Props) {
  const key = showKey(film.title);
  const follow = profile.followed[key];
  const reminded = !!profile.reminders[film.id];
  const live = liveLink(film.channel);
  const onAir = isOn(film, now);
  const started = Date.parse(film.start) <= now;
  // Les autres diffusions du même programme aujourd'hui
  const others = films.filter((f) => f.id !== film.id && showKey(f.title) === key && Date.parse(f.start) > now).slice(0, 4);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={film.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__head">
          <Poster title={film.title} poster={film.poster} className="sheet__poster" />
          <div className="stack-sm">
            <h2 className="sheet__title">{film.title}</h2>
            {film.subTitle && <span className="muted">{film.subTitle}</span>}
            <div className="tags">
              <span className="tag tag--accent">{film.channel} · {hhmm(film.start)}</span>
              <span className="tag">{kindLabel(film.kind)}{film.episodes && film.episodes > 1 ? ` · ${film.episodes} épisodes` : ''}</span>
              {durationLabel(film) && <span className="tag">{durationLabel(film)}</span>}
              {film.year && <span className="tag">{film.year}</span>}
              {film.rating ? <span className="tag">{film.rating.toFixed(1)}/10</span> : null}
            </div>
          </div>
        </div>

        <Progress film={film} now={now} times />

        {live && (
          <a className="btn btn--live btn--wide" href={live.url} target="_blank" rel="noreferrer">
            {onAir && <span className="live-dot" aria-hidden="true" />}
            {onAir ? `Regarder en direct sur ${live.label}` : `Ouvrir ${live.label}`}
          </a>
        )}

        {film.genres.length > 0 && <p className="muted small">{film.genres.join(' · ')}</p>}
        {film.synopsis && <p className="sheet__synopsis">{film.synopsis}</p>}
        {(film.directors.length > 0 || film.cast.length > 0) && (
          <p className="muted small">
            {film.directors.length > 0 && <>De {film.directors.join(', ')}</>}
            {film.directors.length > 0 && film.cast.length > 0 && ', '}
            {film.cast.length > 0 && <>avec {film.cast.slice(0, 4).join(', ')}</>}
          </p>
        )}

        {!started && (
          <div className="row">
            <button className={`btn ${reminded ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={reminded} onClick={onToggleReminder}>
              {reminded ? `Rappel ${profile.notifyBefore} min avant` : 'Me rappeler'}
            </button>
            <button className="btn btn--ghost" onClick={onAgenda}>Ajouter à l'agenda</button>
          </div>
        )}

        {film.kind !== 'film' && (
          <div className="follow">
            <button className={`btn btn--wide ${follow ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={!!follow} onClick={() => onFollow(!follow, follow?.notify ?? true)}>
              {follow ? 'Émission suivie' : 'Suivre cette émission'}
            </button>
            {follow && (
              <label className="switch-row">
                <span className="small">Me prévenir à chaque diffusion</span>
                <input type="checkbox" className="switch" checked={follow.notify} onChange={() => onFollow(true, !follow.notify)} />
              </label>
            )}
          </div>
        )}

        {others.length > 0 && (
          <div className="stack-sm">
            <span className="eyebrow">Autres diffusions aujourd'hui</span>
            {others.map((o) => (
              <button key={o.id} className="other" onClick={() => onOpen(o)}>
                <strong>{hhmm(o.start)}</strong> {o.channel}
                {o.subTitle && <span className="muted"> · {o.subTitle}</span>}
              </button>
            ))}
          </div>
        )}

        {film.kind !== 'autre' && (
          <div className="row">
            <button className="btn btn--ghost btn--sm" onClick={() => onSignal('like')}>J'aime</button>
            <button className="btn btn--ghost btn--sm" onClick={() => onSignal('watched')}>Déjà vu</button>
            <button className="btn btn--ghost btn--sm" onClick={onHide}>Pas pour moi</button>
          </div>
        )}
      </div>
    </div>
  );
}
