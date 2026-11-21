import { useEffect, useMemo, useState } from 'react';
import { KINDS, kindLabel, type Film, type Kind, type Signal, type Tonight } from './types';
import { applySignal, loadProfile, rank, saveProfile, type Profile } from './profile';
import { FilmSheet } from './components/FilmSheet';
import { Settings } from './components/Settings';
import { Poster } from './components/Poster';
import { durationLabel, endOf, hhmm, loadTonight, todayLabel } from './utils';

type Part = 'all' | 'prime' | 'seconde';

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [tonight, setTonight] = useState<Tonight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [part, setPart] = useState<Part>('all');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  // Graine fixe pour la session : le film "découverte" ne change pas à chaque clic
  const [seed] = useState(() => Math.floor(Math.random() * 1000));

  useEffect(() => {
    loadTonight().then(setTonight).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const update = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };

  const films = useMemo(
    () => (tonight?.films ?? []).filter((f) => (part === 'all' || f.part === part) && (kind === 'all' || f.kind === kind)),
    [tonight, part, kind],
  );
  const ranked = useMemo(() => rank(profile, films, seed), [profile, films, seed]);
  const top = ranked.slice(0, 5);
  const rest = ranked.slice(5);
  const restKinds = KINDS.filter((k) => rest.some((r) => r.film.kind === k.id));
  const kindsTonight = KINDS.filter((k) => tonight?.films.some((f) => f.kind === k.id));

  const openFilm = tonight?.films.find((f) => f.id === openId) ?? null;

  const signal = (f: Film, s: Signal) => {
    let p = applySignal(profile, f, s);
    if (s === 'remind') {
      const reminders = { ...p.reminders };
      if (reminders[f.id]) delete reminders[f.id];
      else reminders[f.id] = true;
      p = { ...p, reminders };
    }
    update(p);
  };
  const hide = (f: Film) => {
    update({ ...applySignal(profile, f, 'pass'), hidden: { ...profile.hidden, [f.id]: true } });
    setOpenId(null);
  };
  const open = (f: Film) => {
    update(applySignal(profile, f, 'open'));
    setOpenId(f.id);
  };

  return (
    <main className="screen">
      <header className="header">
        <div>
          <span className="muted small">{todayLabel()}</span>
          <h1 className="title title--xl">Ce soir</h1>
        </div>
        <button className="icon-btn" aria-label="Mes chaînes et réglages" onClick={() => setSettings(true)}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        </button>
      </header>

      <div className="segmented" role="group" aria-label="Partie de soirée">
        {(['all', 'prime', 'seconde'] as Part[]).map((p) => (
          <button key={p} aria-pressed={part === p} className={part === p ? 'is-on' : ''} onClick={() => setPart(p)}>
            {p === 'all' ? 'Toute la soirée' : p === 'prime' ? 'Vers 21h' : 'Vers 23h'}
          </button>
        ))}
      </div>

      <div className="filters" role="group" aria-label="Type de programme">
        {[{ id: 'all' as const, plural: 'Tout' }, ...kindsTonight].map((k) => (
          <button key={k.id} aria-pressed={kind === k.id} className={`chip ${kind === k.id ? 'is-on' : ''}`} onClick={() => setKind(k.id)}>
            {k.plural}
          </button>
        ))}
      </div>

      {error && <p className="notice">Impossible de charger le programme : {error}</p>}
      {!tonight && !error && <p className="muted">Chargement du programme…</p>}

      {tonight && ranked.length === 0 && (
        <div className="notice">
          <p>Rien de ce type sur tes chaînes à ce moment-là.</p>
          <button className="link" onClick={() => setSettings(true)}>Ajouter des chaînes</button>
        </div>
      )}

      {!profile.hintDismissed && ranked.length > 0 && (
        <div className="hint">
          <p>Réagis avec « J'aime » ou « Pas pour moi » : l'app affine ses choix pour toi.</p>
          <button className="link" onClick={() => update({ ...profile, hintDismissed: true })}>Compris</button>
        </div>
      )}

      {top.length > 0 && (
        <section className="stack">
          <h2 className="eyebrow eyebrow--accent">À voir ce soir</h2>
          <div className="carousel">
            {top.map(({ film, reason, discovery }) => (
              <article key={film.id} className="card">
                <button className="card__main" onClick={() => open(film)}>
                  <Poster title={film.title} poster={film.poster} big className="card__poster" />
                  <span className="card__badge">{film.channel} · {hhmm(film.start)}</span>
                  <span className="card__body">
                    <span className={`card__reason ${discovery ? 'is-discovery' : ''}`}>{reason}</span>
                    <strong className="card__title">{film.title}</strong>
                    <span className="muted small card__meta">
                      {[kindLabel(film.kind), film.genres[0], durationLabel(film), endOf(film) && `fin ${endOf(film)}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
                <div className="card__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => hide(film)}>Pas pour moi</button>
                  <button className="btn btn--primary btn--sm" onClick={() => signal(film, 'like')}>J'aime</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="stack">
          <h2 className="eyebrow">Le reste de la soirée · {rest.length}</h2>
          {restKinds.map((k) => {
            const list = rest.filter((r) => r.film.kind === k.id);
            return (
              <div key={k.id} className="stack-sm">
                {restKinds.length > 1 && <span className="muted small">{k.plural} · {list.length}</span>}
                <div className="rail">
                  {list.map(({ film }) => (
                    <button key={film.id} className="mini" onClick={() => open(film)}>
                      <Poster title={film.title} poster={film.poster} className="mini__poster" />
                      <span className="mini__title">{film.title}</span>
                      <span className="muted small">{film.channel} · {hhmm(film.start)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tonight?.source === 'sample' && <p className="muted small center">Soirée d'exemple, pas le vrai programme.</p>}

      {openFilm && (
        <FilmSheet
          film={openFilm}
          reminded={!!profile.reminders[openFilm.id]}
          onSignal={(s) => signal(openFilm, s)}
          onHide={() => hide(openFilm)}
          onClose={() => setOpenId(null)}
        />
      )}

      {settings && tonight && (
        <Settings profile={profile} channels={tonight.channels ?? []} onChange={update} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
