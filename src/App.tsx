import { useEffect, useMemo, useState } from 'react';
import { KINDS, kindLabel, type Film, type Kind, type Signal, type Tonight } from './types';
import { applySignal, loadProfile, rank, saveProfile, type Profile } from './profile';
import { FilmSheet } from './components/FilmSheet';
import { Settings } from './components/Settings';
import { Poster } from './components/Poster';
import { Progress } from './components/Progress';
import { Channels } from './components/Channels';
import { durationLabel, hhmm, isOn, loadTonight, refTime, stopOf, todayLabel, type When } from './utils';

type Tab = 'pourtoi' | 'chaines';

const WHEN: { id: When; label: string }[] = [
  { id: 'now', label: 'Maintenant' },
  { id: 'prime', label: '1re partie' },
  { id: 'seconde', label: '2e partie' },
];

/** Un programme assez long et assez "regardable" pour être suggéré */
const suggestable = (f: Film) => f.kind !== 'autre' && (f.durationMin ?? 60) >= 20;

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [tonight, setTonight] = useState<Tonight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pourtoi');
  const [when, setWhen] = useState<When>('now');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Graine fixe pour la session : le film "découverte" ne change pas à chaque clic
  const [seed] = useState(() => Math.floor(Math.random() * 1000));

  useEffect(() => {
    loadTonight().then(setTonight).catch((e) => setError(String(e.message ?? e)));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const update = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };

  const at = tonight ? refTime(when, tonight.date, now) : now;

  const candidates = useMemo(() => {
    const all = (tonight?.films ?? []).filter(suggestable).filter((f) => stopOf(f) > now);
    const inSlot = all.filter((f) =>
      when === 'now' ? isOn(f, now) || Date.parse(f.start) - now < 30 * 60_000 : f.part === when,
    );
    return inSlot.filter((f) => kind === 'all' || f.kind === kind);
  }, [tonight, when, kind, now]);

  const ranked = useMemo(() => rank(profile, candidates, seed), [profile, candidates, seed]);
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
    if (f.kind !== 'autre') update(applySignal(profile, f, 'open'));
    setOpenId(f.id);
  };
  const toggleFavorite = (id: string) => {
    const favorites = { ...profile.favorites };
    if (favorites[id]) delete favorites[id];
    else favorites[id] = true;
    update({ ...profile, favorites });
  };

  return (
    <main className="screen">
      <header className="header">
        <div>
          <span className="muted small">{todayLabel()}</span>
          <h1 className="title title--xl">{tab === 'pourtoi' ? 'Ce soir' : 'Chaînes'}</h1>
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

      <div className="segmented" role="group" aria-label="Moment">
        {WHEN.map((w) => (
          <button key={w.id} aria-pressed={when === w.id} className={when === w.id ? 'is-on' : ''} onClick={() => setWhen(w.id)}>
            {w.id === 'now' && <span className="live-dot" aria-hidden="true" />}
            {w.label}
          </button>
        ))}
      </div>

      {error && <p className="notice">Impossible de charger le programme : {error}</p>}
      {!tonight && !error && <p className="muted">Chargement du programme…</p>}

      {tab === 'pourtoi' && tonight && (
        <>
          <div className="filters" role="group" aria-label="Type de programme">
            {[{ id: 'all' as const, plural: 'Tout' }, ...kindsTonight].map((k) => (
              <button key={k.id} aria-pressed={kind === k.id} className={`chip ${kind === k.id ? 'is-on' : ''}`} onClick={() => setKind(k.id)}>
                {k.plural}
              </button>
            ))}
          </div>

          {ranked.length === 0 && (
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
              <h2 className="eyebrow eyebrow--accent">{when === 'now' ? 'À voir maintenant' : 'À voir ce soir'}</h2>
              <div className="carousel">
                {top.map(({ film, reason, discovery }) => (
                  <article key={film.id} className="card">
                    <button className="card__main" onClick={() => open(film)}>
                      <Poster title={film.title} poster={film.poster} big className="card__poster" />
                      <span className="card__badge">
                        {isOn(film, now) && <span className="live-dot" aria-hidden="true" />}
                        {film.channel} · {hhmm(film.start)}
                      </span>
                      <span className="card__body">
                        <span className={`card__reason ${discovery ? 'is-discovery' : ''}`}>{reason}</span>
                        <strong className="card__title">{film.title}</strong>
                        <span className="muted small card__meta">
                          {[kindLabel(film.kind), film.genres[0], durationLabel(film)].filter(Boolean).join(' · ')}
                        </span>
                        <Progress film={film} now={now} />
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
              <h2 className="eyebrow">Aussi à ce moment · {rest.length}</h2>
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
                          <Progress film={film} now={now} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {tab === 'chaines' && tonight && (
        <Channels
          profile={profile}
          channels={tonight.channels}
          films={tonight.films}
          at={at}
          now={now}
          onOpen={open}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {tonight?.source === 'sample' && <p className="muted small center">Soirée d'exemple, pas le vrai programme.</p>}

      <nav className="tabbar" aria-label="Navigation">
        <button aria-current={tab === 'pourtoi' ? 'page' : undefined} className={tab === 'pourtoi' ? 'is-on' : ''} onClick={() => setTab('pourtoi')}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
          </svg>
          Pour toi
        </button>
        <button aria-current={tab === 'chaines' ? 'page' : undefined} className={tab === 'chaines' ? 'is-on' : ''} onClick={() => setTab('chaines')}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M8 2l4 4 4-4" />
          </svg>
          Chaînes
        </button>
      </nav>

      {openFilm && (
        <FilmSheet
          film={openFilm}
          now={now}
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
