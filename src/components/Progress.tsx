import type { Film } from '../types';
import { hhmm, minutesLabel, progressOf, stopOf } from '../utils';

interface Props {
  film: Film;
  now: number;
  /** Affiche aussi les heures de début et de fin */
  times?: boolean;
}

/** Ligne de temps : avancement si c'est en cours, sinon dans combien de temps ça commence. */
export function Progress({ film, now, times }: Props) {
  const p = progressOf(film, now);
  const start = Date.parse(film.start);
  const stop = stopOf(film);

  let label: string;
  if (p === null) {
    const min = Math.round((start - now) / 60_000);
    label = min <= 90 ? `Dans ${minutesLabel(Math.max(1, min))}` : `À ${hhmm(film.start)}`;
  } else if (p >= 1) {
    label = 'Terminé';
  } else {
    label = `Reste ${minutesLabel(Math.max(1, Math.round((stop - now) / 60_000)))}`;
  }

  return (
    <span className="progress-line">
      {times && <span className="progress-line__time">{hhmm(film.start)}</span>}
      <span
        className="progress-line__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((p ?? 0) * 100)}
      >
        <span className={`progress-line__fill ${p !== null && p < 1 ? 'is-live' : ''}`} style={{ width: `${(p ?? 0) * 100}%` }} />
      </span>
      {times && <span className="progress-line__time">{hhmm(new Date(stop).toISOString())}</span>}
      <span className={`progress-line__label ${p !== null && p < 1 ? 'is-live' : ''}`}>{label}</span>
    </span>
  );
}
