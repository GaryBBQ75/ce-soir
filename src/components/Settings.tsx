import { BOUQUETS, type Bouquet, type Channel } from '../types';
import { channelReceived as channelOn, topTraits, type Profile } from '../profile';
import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { askPermission, notificationsSupported } from '../notify';
import { availableProviders, type Account, type Provider } from '../account';

interface Props {
  profile: Profile;
  channels: Channel[];
  onChange: (p: Profile) => void;
  onClose: () => void;
  account: Account | null;
  onSignIn: (p: Provider) => void;
  onSignOut: () => void;
}

export function Settings({ profile, channels, onChange, onClose, account, onSignIn, onSignOut }: Props) {
  const [resetArmed, setResetArmed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tastes = topTraits(profile, 8);
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    availableProviders().then(setProviders);
  }, []);

  const toggleBouquet = (b: Bouquet) => {
    const on = profile.bouquets.includes(b);
    onChange({ ...profile, bouquets: on ? profile.bouquets.filter((x) => x !== b) : [...profile.bouquets, b] });
  };

  const toggleChannel = (c: Channel) => {
    const on = channelOn(profile, c.id, c.bouquet);
    const excluded = { ...profile.excluded };
    const added = { ...profile.added };
    if (on) {
      delete added[c.id];
      if (profile.bouquets.includes(c.bouquet)) excluded[c.id] = true;
    } else {
      delete excluded[c.id];
      if (!profile.bouquets.includes(c.bouquet)) added[c.id] = true;
    }
    onChange({ ...profile, excluded, added });
  };

  return (
    <Sheet label="Réglages" onClose={onClose}>
        <h2 className="sheet__heading">Réglages</h2>

        {(account || providers.length > 0) && (
        <section className="account">
          {account ? (
            <>
              <div className="account__who">
                {account.avatar ? <img src={account.avatar} alt="" className="account__avatar" /> : <span className="account__avatar">{account.name[0]?.toUpperCase()}</span>}
                <span>
                  <strong>{account.name}</strong>
                  <span className="muted small"> · goûts synchronisés</span>
                </span>
              </div>
              <button className="link" onClick={onSignOut}>Se déconnecter</button>
            </>
          ) : (
            <>
              <p className="small">
                <strong>Garde tes goûts sur tous tes appareils.</strong>
                <span className="muted"> Tes favorites, suivis et alertes te suivent d'un téléphone à l'autre.</span>
              </p>
              {providers.includes('google') && (
              <button className="btn btn--wide btn--google" onClick={() => onSignIn('google')}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Continuer avec Google
              </button>
              )}
            </>
          )}
        </section>
        )}
        <h3 className="eyebrow">Mes chaînes</h3>
        <p className="muted small">Active un bouquet ou un thème entier, ou choisis tes chaînes une par une.</p>

        {BOUQUETS.map((b) => {
          const list = channels.filter((c) => c.bouquet === b.id);
          const bouquetOn = profile.bouquets.includes(b.id);
          const count = list.filter((c) => channelOn(profile, c.id, c.bouquet)).length;
          if (list.length === 0) return null;
          const open = bouquetOn || count > 0 || expanded[b.id];
          return (
            <section key={b.id} className="group">
              <label className="switch-row">
                <span className="stack-xs">
                  <strong>{b.label}</strong>
                  <span className="muted small">{count > 0 ? `${count} / ${list.length} chaînes` : b.hint}</span>
                </span>
                <input type="checkbox" className="switch" checked={bouquetOn} onChange={() => toggleBouquet(b.id)} />
              </label>
              {!open && (
                <button className="link" onClick={() => setExpanded({ ...expanded, [b.id]: true })}>
                  Choisir des chaînes une par une ({list.length})
                </button>
              )}
              {open && (
              <div className="chips">
                {list.map((c) => {
                  const on = channelOn(profile, c.id, c.bouquet);
                  return (
                    <button key={c.id} className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggleChannel(c)}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
              )}
            </section>
          );
        })}

        <section className="group">
          <strong>Rappels</strong>
          <label className="switch-row">
            <span className="stack-xs">
              <span>Notifications sur cet appareil</span>
              <span className="muted small">
                {notificationsSupported() ? 'Quand l\'app est ouverte ou en arrière-plan' : 'Non disponible dans ce navigateur'}
              </span>
            </span>
            <input
              type="checkbox"
              className="switch"
              disabled={!notificationsSupported()}
              checked={profile.notifyEnabled}
              onChange={async () => {
                if (profile.notifyEnabled) return onChange({ ...profile, notifyEnabled: false });
                const ok = await askPermission();
                onChange({ ...profile, notifyEnabled: ok });
                if (!ok) setDenied(true);
              }}
            />
          </label>
          {denied && <p className="muted small">Notifications refusées par le navigateur. Tu verras quand même les rappels dans l'app.</p>}
          <div className="stack-xs">
            <span className="small">Prévenir</span>
            <div className="chips">
              {[5, 10, 15, 30].map((m) => (
                <button key={m} className={`chip chip--plain ${profile.notifyBefore === m ? 'is-on' : ''}`} aria-pressed={profile.notifyBefore === m} onClick={() => onChange({ ...profile, notifyBefore: m })}>
                  {m} min avant
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="group">
          <strong>Émissions suivies</strong>
          {Object.keys(profile.followed).length === 0 ? (
            <p className="muted small">Ouvre une émission et touche « Suivre cette émission » : tu la verras en haut de l'app dès qu'elle passe.</p>
          ) : (
            <ul className="followed">
              {Object.entries(profile.followed).map(([key, f]) => (
                <li key={key}>
                  <span>{f.title}</span>
                  <label className="small">
                    <input
                      type="checkbox"
                      checked={f.notify}
                      onChange={() => onChange({ ...profile, followed: { ...profile.followed, [key]: { ...f, notify: !f.notify } } })}
                    />{' '}
                    Prévenir
                  </label>
                  <button
                    className="link"
                    onClick={() => {
                      const followed = { ...profile.followed };
                      delete followed[key];
                      onChange({ ...profile, followed });
                    }}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="group">
          <strong>Ce que l'app a compris de toi</strong>
          {tastes.length === 0 ? (
            <p className="muted small">Rien encore. Réagis aux films avec « J'aime » ou « Pas pour moi ».</p>
          ) : (
            <div className="tags">
              {tastes.map((t) => (
                <span key={t.kind + t.label} className={`tag ${t.weight > 0 ? 'tag--plus' : 'tag--minus'}`}>
                  {t.weight > 0 ? '+' : '−'} {t.label}
                </span>
              ))}
            </div>
          )}
          <button
            className="link"
            onClick={() => {
              if (!resetArmed) return setResetArmed(true);
              onChange({ ...profile, weights: {}, hidden: {}, signals: 0 });
              setResetArmed(false);
            }}
          >
            {resetArmed ? 'Confirmer : effacer mes goûts ?' : 'Effacer mes goûts'}
          </button>
        </section>
        <p className="muted small center">
          Programmes : xmltvfr.fr · Films et séries : TMDB (cette app n'est ni approuvée ni certifiée par TMDB)
        </p>
    </Sheet>
  );
}
