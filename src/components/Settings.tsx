import { BOUQUETS, type Bouquet, type Channel } from '../types';
import { channelOn, emptyProfile, topTraits, type Profile } from '../profile';
import { useState } from 'react';

interface Props {
  profile: Profile;
  channels: Channel[];
  onChange: (p: Profile) => void;
  onClose: () => void;
}

export function Settings({ profile, channels, onChange, onClose }: Props) {
  const [resetArmed, setResetArmed] = useState(false);
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
              onChange({ ...emptyProfile(), bouquets: profile.bouquets, excluded: profile.excluded, added: profile.added, hintDismissed: true });
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
