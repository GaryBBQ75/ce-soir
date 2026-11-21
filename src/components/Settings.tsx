import { BOUQUETS, type Bouquet, type Channel } from '../types';
import { channelOn, topTraits, type Profile } from '../profile';
import { useState } from 'react';
import { askPermission, notificationsSupported } from '../notify';

interface Props {
  profile: Profile;
  channels: Channel[];
  onChange: (p: Profile) => void;
  onClose: () => void;
}

export function Settings({ profile, channels, onChange, onClose }: Props) {
  const [resetArmed, setResetArmed] = useState(false);
  const [denied, setDenied] = useState(false);
  const tastes = topTraits(profile, 8);

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
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" role="dialog" aria-label="Réglages" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__bar">
          <h2 className="sheet__title">Mes chaînes</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>OK</button>
        </div>
        <p className="muted small">Active un bouquet entier, puis retire ou ajoute des chaînes une par une.</p>

        {BOUQUETS.map((b) => {
          const list = channels.filter((c) => c.bouquet === b.id);
          const bouquetOn = profile.bouquets.includes(b.id);
          const count = list.filter((c) => channelOn(profile, c.id, c.bouquet)).length;
          return (
            <section key={b.id} className="group">
              <label className="switch-row">
                <span className="stack-xs">
                  <strong>{b.label}</strong>
                  <span className="muted small">{count} / {list.length} chaînes</span>
                </span>
                <input type="checkbox" className="switch" checked={bouquetOn} onChange={() => toggleBouquet(b.id)} />
              </label>
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
      </div>
    </div>
  );
}
