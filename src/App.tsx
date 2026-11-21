import { useEffect, useMemo, useState } from 'react';
import { BOUQUETS, type Film, type Signal, type Tonight } from './types';
import { applySignal, emptyProfile, loadProfile, rank, saveProfile, topTraits, type Profile } from './profile';
import { Onboarding } from './components/Onboarding';
import { FilmSheet } from './components/FilmSheet';
import { Poster } from './components/Poster';
import { durationLabel, endOf, hhmm, loadTonight, todayLabel } from './utils';

type Part = 'all' | 'prime' | 'seconde';

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [tonight, setTonight] = useState<Tonight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [part, setPart] = useState<Part>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editBouquets, setEditBouquets] = useState(false);
  const [showTastes, setShowTastes] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
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
    () => (tonight?.films ?? []).filter((f) => part === 'all' || f.part === part),
    [tonight, part],
  );
  const ranked = useMemo(() => rank(profile, films, seed), [profile, films, seed]);
  const top = ranked.slice(0, 5);
  const byBouquet = BOUQUETS.filter((b) => profile.bouquets.includes(b.id)).map((b) => ({
    ...b,
    films: ranked.filter((r) => r.film.bouquet === b.id),
  }));

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

  if (!profile.onboarded) return <Onboarding profile={profile} onDone={update} />;
  if (editBouquets)
    return (
      <Onboarding
        profile={profile}
        bouquetsOnly
        onDone={(p) => {
          update(p);
          setEditBouquets(false);
        }}
      />
    );

  return (
    <main className="screen">
      <header className="header">
        <div>
          <span className="muted small">{todayLabel()}</span>
          <h1 className="title title--xl">Ce soir</h1>
        </div>
        <div className="segmented" role="group" aria-label="Partie de soirée">
          {(['all', 'prime', 'seconde'] as Part[]).map((p) => (
            <button key={p} aria-pressed={part === p} className={part === p ? 'is-on' : ''} onClick={() => setPart(p)}>
              {p === 'all' ? 'Tout' : p === 'prime' ? '21h' : '23h'}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="notice">Impossible de charger le programme : {error}</p>}
      {!tonight && !error && <p className="muted">Chargement du programme…</p>}

      {tonight && top.length === 0 && (
        <p className="notice">Aucun film ce soir sur tes bouquets. Essaie d'en ajouter dans « Mes chaînes ».</p>
      )}

      {top.length > 0 && (
        <section className="stack">
          <h2 className="eyebrow eyebrow--accent">Pour toi ce soir</h2>
          <div className="carousel">
            {top.map(({ film, reason, discovery }, idx) => (
              <article key={film.id} className={`card ${idx === 0 ? 'card--first' : ''}`}>
                <button className="card__main" onClick={() => open(film)}>
                  <Poster title={film.title} poster={film.poster} big className="card__poster" />
                  <span className="card__badge">{film.channel} · {hhmm(film.start)}</span>
                  <span className="card__body">
                    <span className={`card__reason ${discovery ? 'is-discovery' : ''}`}>{reason}</span>
                    <strong className="card__title">{film.title}</strong>
                    <span className="muted small">
                      {[film.genres[0], durationLabel(film), endOf(film) && `fin ${endOf(film)}`].filter(Boolean).join(' · ')}
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

      {byBouquet.map((b) =>
        b.films.length === 0 ? null : (
          <section key={b.id} className="stack">
            <h2 className="eyebrow">
              {b.label} <span className="muted">· {b.films.length} film{b.films.length > 1 ? 's' : ''}</span>
            </h2>
            <div className="rail">
              {b.films.map(({ film }) => (
                <button key={film.id} className="mini" onClick={() => open(film)}>
                  <Poster title={film.title} poster={film.poster} className="mini__poster" />
                  <span className="mini__title">{film.title}</span>
                  <span className="muted small">{film.channel} · {hhmm(film.start)}</span>
                </button>
              ))}
            </div>
          </section>
        ),
      )}

      {showTastes && (
        <section className="stack panel">
          <h2 className="eyebrow">Ce que l'app a compris de toi</h2>
          {topTraits(profile).length === 0 ? (
            <p className="muted small">Pas encore assez de réactions.</p>
          ) : (
            <div className="tags">
              {topTraits(profile).map((t) => (
                <span key={t.kind + t.label} className={`tag ${t.weight > 0 ? 'tag--plus' : 'tag--minus'}`}>
                  {t.weight > 0 ? '+' : '−'} {t.label}
                </span>
              ))}
            </div>
          )}
          <p className="muted small">{profile.signals} réactions enregistrées.</p>
        </section>
      )}

      <footer className="footer">
        <button className="link" onClick={() => setEditBouquets(true)}>Mes chaînes</button>
        <button className="link" onClick={() => setShowTastes((v) => !v)}>Mes goûts</button>
        <button
          className="link"
          onClick={() => {
            if (resetArmed) {
              update(emptyProfile());
              setResetArmed(false);
            } else setResetArmed(true);
          }}
        >
          {resetArmed ? 'Confirmer : tout effacer ?' : 'Repartir de zéro'}
        </button>
        {tonight?.source === 'sample' && <p className="muted small">Soirée d'exemple, pas le vrai programme.</p>}
      </footer>

      {openFilm && (
        <FilmSheet
          film={openFilm}
          reminded={!!profile.reminders[openFilm.id]}
          onSignal={(s) => signal(openFilm, s)}
          onHide={() => hide(openFilm)}
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  );
}
