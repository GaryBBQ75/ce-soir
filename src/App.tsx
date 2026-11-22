import { useEffect, useMemo, useRef, useState } from 'react';
import { KINDS, kindLabel, type Film, type Kind, type Signal, type Tonight } from './types';
import { applySignal, isFollowed, loadProfile, rank, saveProfile, showKey, type Profile } from './profile';
import { checkReminders, downloadIcs, type Alert } from './notify';
import { FilmSheet } from './components/FilmSheet';
import { Settings } from './components/Settings';
import { Poster } from './components/Poster';
import { Progress } from './components/Progress';
import { Channels } from './components/Channels';
import { ChannelLogo } from './components/ChannelLogo';
import { KindFilter, matchesFilter } from './components/KindFilter';
import { ChannelSheet } from './components/ChannelSheet';
import { CsaBadge, RatingPill } from './components/Badges';
import { assetUrl, durationLabel, hhmm, isOn, loadTonight, refTime, stopOf, todayLabel, type When } from './utils';

type Tab = 'pourtoi' | 'chaines';

const WHEN: { id: When; label: string }[] = [
  { id: 'now', label: 'Maintenant' },
  { id: 'prime', label: '1re partie' },
  { id: 'seconde', label: '2e partie' },
];

/** Un programme assez long et assez "regardable" pour être suggéré */
const suggestable = (f: Film) => f.kind !== 'autre' && (f.durationMin ?? 60) >= 20;
/** Types proposés par défaut (l'info seulement si on la demande) */
const defaultKind = (f: Film) => KINDS.find((k) => k.id === f.kind)?.suggest ?? false;

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [tonight, setTonight] = useState<Tonight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pourtoi');
  const [when, setWhen] = useState<When>('now');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [genre, setGenre] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [chView, setChView] = useState<'list' | 'grid'>('list');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  // Graine fixe pour la session : le film "découverte" ne change pas à chaque clic
  const [seed] = useState(() => Math.floor(Math.random() * 1000));

  useEffect(() => {
    loadTonight().then(setTonight).catch((e) => setError(String(e.message ?? e)));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Bouton retour du téléphone : ferme la fiche ouverte au lieu de quitter l'app
  const sheetOpen = !!openId || !!channelId || settings;
  const pushed = useRef(false);
  useEffect(() => {
    if (!sheetOpen) return;
    try {
      history.pushState({ sheet: true }, '');
      pushed.current = true;
    } catch {
      return;
    }
    const onPop = () => {
      pushed.current = false;
      setOpenId(null);
      setChannelId(null);
      setSettings(false);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Fiche fermée par le bouton Fermer : on retire l'étape ajoutée à l'historique
      if (pushed.current) {
        pushed.current = false;
        try {
          history.back();
        } catch {
          /* ignore */
        }
      }
    };
  }, [sheetOpen]);

  const update = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };

  // Rappels dus : notification système + message dans l'app
  useEffect(() => {
    if (!tonight) return;
    const due = checkReminders(profile, tonight.films, now);
    if (due.length) setAlerts((a) => [...a, ...due]);
  }, [now, tonight, profile]);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const at = tonight ? refTime(when, tonight.date, now) : now;

  // Émissions suivies en cours (ou qui commencent dans 15 min) sur mes chaînes
  const followedLive = (tonight?.films ?? []).filter(
    (f) => isFollowed(profile, f) && stopOf(f) > now && Date.parse(f.start) - now < 15 * 60_000,
  );

  // Programmes du moment choisi (avant le filtre de catégorie, pour proposer les bonnes catégories)
  const inSlot = useMemo(() => {
    const all = (tonight?.films ?? []).filter(suggestable).filter((f) => stopOf(f) > now);
    return all.filter((f) => (when === 'now' ? isOn(f, now) || Date.parse(f.start) - now < 30 * 60_000 : f.part === when));
  }, [tonight, when, now]);

  const candidates = useMemo(
    () => inSlot.filter((f) => (kind === 'all' ? defaultKind(f) : matchesFilter(f, kind, genre))),
    [inSlot, kind, genre],
  );

  const ranked = useMemo(() => rank(profile, candidates, seed), [profile, candidates, seed]);
  const top = ranked.slice(0, 5);
  const rest = ranked.slice(5);
  const restKinds = KINDS.filter((k) => rest.some((r) => r.film.kind === k.id));

  const openFilm = tonight?.films.find((f) => f.id === openId) ?? null;
  const channelById = useMemo(() => new Map((tonight?.channels ?? []).map((c) => [c.id, c])), [tonight]);
  const favCount = Object.keys(profile.favorites).length;

  const signal = (f: Film, s: Signal) => {
    let p = { ...applySignal(profile, f, s), hintDismissed: true };
    if (s === 'remind') {
      const reminders = { ...p.reminders };
      if (reminders[f.id]) delete reminders[f.id];
      else reminders[f.id] = true;
      p = { ...p, reminders };
    }
    update(p);
  };
  const hide = (f: Film) => {
    update({ ...applySignal(profile, f, 'pass'), hidden: { ...profile.hidden, [f.id]: true }, hintDismissed: true });
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
  const toggleReminder = (f: Film) => {
    const reminders = { ...profile.reminders };
    const on = !reminders[f.id];
    if (on) reminders[f.id] = true;
    else delete reminders[f.id];
    update({ ...(on ? applySignal(profile, f, 'remind') : profile), reminders });
    flash(on ? `Rappel ${profile.notifyBefore} min avant ${f.title}` : 'Rappel retiré');
  };
  const follow = (f: Film, on: boolean, notify: boolean) => {
    const followed = { ...profile.followed };
    const key = showKey(f.title);
    if (on) followed[key] = { title: f.title, notify };
    else delete followed[key];
    update({ ...(on && !profile.followed[key] ? applySignal(profile, f, 'like') : profile), followed });
    if (on !== !!profile.followed[key]) flash(on ? `Tu suis ${f.title}` : `Tu ne suis plus ${f.title}`);
  };

  return (
    <main className="screen">
      {tab === 'pourtoi' && top[0] && (top[0].film.backdrop || top[0].film.poster) && (
        <div className="ambient" aria-hidden="true">
          <img src={assetUrl((top[0].film.backdrop || top[0].film.poster)!)} alt="" />
        </div>
      )}
      <header className={`header ${tab === 'chaines' ? 'header--compact' : ''}`}>
        {tab === 'pourtoi' ? (
          <div>
            <span className="muted small">{todayLabel()}</span>
            <h1 className="title title--xl">Ce soir</h1>
          </div>
        ) : searching ? (
          <label className="search search--inline">
            <span className="sr-only">Rechercher un programme</span>
            <input autoFocus type="search" placeholder="Titre, acteur, équipe…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="search__close" aria-label="Fermer la recherche" onClick={() => { setSearching(false); setQuery(''); }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </label>
        ) : (
          <h1 className="header__date">{todayLabel()}</h1>
        )}
        <div className="header__actions">
        {tab === 'chaines' && !searching && (
          <>
            <button className="icon-btn" aria-label="Rechercher un programme" onClick={() => setSearching(true)}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </button>
            <button
              className="icon-btn"
              aria-label={chView === 'list' ? 'Passer en grille horaire' : 'Passer en liste'}
              onClick={() => setChView(chView === 'list' ? 'grid' : 'list')}
            >
              {chView === 'list' ? (
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>
              ) : (
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h12M9 12h12M9 18h12" /><rect x="3" y="4.5" width="3" height="3" rx="0.5" /><rect x="3" y="10.5" width="3" height="3" rx="0.5" /><rect x="3" y="16.5" width="3" height="3" rx="0.5" /></svg>
              )}
            </button>
          </>
        )}
        {!(tab === 'chaines' && searching) && <>
        <button
          className={`icon-btn ${profile.scope === 'favorites' ? 'is-on' : ''}`}
          aria-pressed={profile.scope === 'favorites'}
          aria-label={profile.scope === 'favorites' ? 'Afficher toutes mes chaînes' : 'Afficher seulement mes chaînes favorites'}
          onClick={() => {
            if (profile.scope === 'favorites') return update({ ...profile, scope: 'all' });
            if (favCount === 0) {
              setTab('chaines');
              flash('Touche l\'étoile d\'une chaîne pour l\'ajouter à tes favorites');
              return;
            }
            update({ ...profile, scope: 'favorites' });
            flash(`Seulement tes ${favCount} chaînes favorites`);
          }}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill={profile.scope === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
          </svg>
        </button>
        <button className="icon-btn" aria-label="Mes chaînes et réglages" onClick={() => setSettings(true)}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        </button>
        </>}
        </div>
      </header>
      {profile.scope === 'favorites' && (
        <button className="scope-note" onClick={() => update({ ...profile, scope: 'all' })}>
          ★ Mes {favCount} chaînes favorites · <u>tout afficher</u>
        </button>
      )}

      {!(tab === 'chaines' && searching) && <div className="segmented" role="group" aria-label="Moment">
        {WHEN.map((w) => (
          <button key={w.id} aria-pressed={when === w.id} className={when === w.id ? 'is-on' : ''} onClick={() => setWhen(w.id)}>
            {w.id === 'now' && <span className="live-dot" aria-hidden="true" />}
            {w.label}
          </button>
        ))}
      </div>}

      {followedLive.length > 0 && (
        <div className="live-banner" role="status">
          {followedLive.slice(0, 3).map((f) => (
            <button key={f.id} onClick={() => open(f)}>
              <span className="live-dot" aria-hidden="true" />
              <span className="live-banner__text">
                <strong>{f.title}</strong> {isOn(f, now) ? 'en cours' : `à ${hhmm(f.start)}`} sur {f.channel}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="notice">Impossible de charger le programme : {error}</p>}
      {!tonight && !error && <p className="muted">Chargement du programme…</p>}

      {tab === 'pourtoi' && tonight && (
        <>
          <KindFilter films={inSlot} kind={kind} genre={genre} onKind={setKind} onGenre={setGenre} />

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
                      <span className="card__media">
                        <Poster title={film.title} poster={film.poster} big className="card__poster" />
                        <span className="card__corner">
                          <RatingPill film={film} />
                          <CsaBadge csa={film.csa} size="sm" />
                        </span>
                        <span className="card__badge">
                          <ChannelLogo channel={channelById.get(film.channelId)} fallback={film.channel} size="xs" />
                          {isOn(film, now) && <span className="live-dot" aria-hidden="true" />}
                          {hhmm(film.start)}
                        </span>
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
                          <span className="mini__media">
                            <Poster title={film.title} poster={film.poster} className="mini__poster" />
                            <ChannelLogo channel={channelById.get(film.channelId)} fallback={film.channel} size="xs" className="mini__clogo" />
                          </span>
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
        <Channels profile={profile} channels={tonight.channels} films={tonight.films} at={at} now={now} onOpen={open} onOpenChannel={setChannelId} onChange={update} view={chView} query={searching ? query : ''} />
      )}

      {tonight?.source === 'sample' && <p className="muted small center">Soirée d'exemple, pas le vrai programme.</p>}
      {tonight?.source === 'xmltv' && (
        <p className="muted small center">Programme mis à jour à {hhmm(tonight.generatedAt)}</p>
      )}

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

      {channelId && channelById.get(channelId) && (
        <ChannelSheet
          channel={channelById.get(channelId)!}
          films={tonight?.films ?? []}
          now={now}
          profile={profile}
          onOpen={open}
          onToggleFavorite={toggleFavorite}
          onClose={() => setChannelId(null)}
        />
      )}

      {openFilm && (
        <FilmSheet
          film={openFilm}
          films={tonight?.films ?? []}
          now={now}
          profile={profile}
          onSignal={(s) => {
            signal(openFilm, s);
            flash(s === 'like' ? 'Noté : tu aimes' : s === 'watched' ? 'Noté : déjà vu' : 'Noté');
          }}
          onHide={() => hide(openFilm)}
          onClose={() => setOpenId(null)}
          onToggleReminder={() => toggleReminder(openFilm)}
          onAgenda={() => flash(downloadIcs(openFilm, profile.notifyBefore) ? 'Fichier agenda téléchargé' : 'Téléchargement impossible ici')}
          onFollow={(on, notify) => follow(openFilm, on, notify)}
          onOpen={open}
          channel={channelById.get(openFilm.channelId)}
          onOpenChannel={(id) => {
            setOpenId(null);
            setChannelId(id);
          }}
        />
      )}

      {alerts.length > 0 && (
        <div className="alerts" role="alert">
          {alerts.map((a) => (
            <div key={a.id} className="alert">
              <button className="alert__main" onClick={() => open(a.film)}>
                <span className="live-dot" aria-hidden="true" />
                {a.text}
              </button>
              <button className="alert__close" aria-label="Fermer" onClick={() => setAlerts((l) => l.filter((x) => x.id !== a.id))}>×</button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      {settings && tonight && (
        <Settings profile={profile} channels={tonight.channels ?? []} onChange={update} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
