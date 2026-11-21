import { kindLabel, type Film, type Signal } from '../types';
import { Poster } from './Poster';
import { durationLabel, endOf, hhmm } from '../utils';

interface Props {
  film: Film;
  reminded: boolean;
  onSignal: (s: Signal) => void;
  onHide: () => void;
  onClose: () => void;
}

export function FilmSheet({ film, reminded, onSignal, onHide, onClose }: Props) {
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
              {durationLabel(film) && <span className="tag">{durationLabel(film)} · fin {endOf(film)}</span>}
              {film.year && <span className="tag">{film.year}</span>}
              {film.rating ? <span className="tag">{film.rating.toFixed(1)}/10</span> : null}
            </div>
          </div>
        </div>
        {film.genres.length > 0 && <p className="muted small">{film.genres.join(' · ')}</p>}
        {film.synopsis && <p className="sheet__synopsis">{film.synopsis}</p>}
        {(film.directors.length > 0 || film.cast.length > 0) && (
          <p className="muted small">
            {film.directors.length > 0 && <>De {film.directors.join(', ')}</>}
            {film.directors.length > 0 && film.cast.length > 0 && ', '}
            {film.cast.length > 0 && <>avec {film.cast.slice(0, 4).join(', ')}</>}
          </p>
        )}
        <button className="btn btn--primary btn--wide" onClick={() => onSignal('remind')}>
          {reminded ? 'Rappel activé' : 'Me rappeler avant le début'}
        </button>
        <div className="row">
          <button className="btn btn--ghost" onClick={() => onSignal('like')}>J'aime</button>
          <button className="btn btn--ghost" onClick={() => onSignal('watched')}>Déjà vu</button>
          <button className="btn btn--ghost" onClick={onHide}>Pas pour moi</button>
        </div>
      </div>
    </div>
  );
}
