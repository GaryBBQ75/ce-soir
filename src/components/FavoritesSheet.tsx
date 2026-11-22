import type { Channel } from '../types';
import { channelReceived, type Profile } from '../profile';
import { Sheet } from './Sheet';
import { ChannelLogo } from './ChannelLogo';

interface Props {
  profile: Profile;
  channels: Channel[];
  onChange: (p: Profile) => void;
  onClose: () => void;
}

/** Choisir ses chaînes favorites d'un coup d'œil, et n'afficher qu'elles si on veut. */
export function FavoritesSheet({ profile, channels, onChange, onClose }: Props) {
  const mine = channels.filter((c) => channelReceived(profile, c.id, c.bouquet));
  const count = mine.filter((c) => profile.favorites[c.id]).length;
  const onlyFav = profile.scope === 'favorites' && count > 0;

  const toggle = (id: string) => {
    const favorites = { ...profile.favorites };
    if (favorites[id]) delete favorites[id];
    else favorites[id] = true;
    const left = Object.keys(favorites).length;
    onChange({ ...profile, favorites, scope: left === 0 ? 'all' : profile.scope });
  };

  return (
    <Sheet label="Mes chaînes favorites" onClose={onClose}>
      <div className="stack">
        <div>
          <h2 className="sheet__heading">Mes chaînes favorites</h2>
          <p className="muted small">
            Touche les chaînes que tu regardes le plus. Elles passent en tête de liste, et tu peux choisir de ne voir qu'elles.
          </p>
        </div>

        <label className={`switch-row fav-only ${count === 0 ? 'is-disabled' : ''}`}>
          <span>
            <strong>N'afficher que mes favorites</strong>
            <span className="muted small"> · {count === 0 ? 'choisis-en au moins une' : `${count} chaîne${count > 1 ? 's' : ''}`}</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            disabled={count === 0}
            checked={onlyFav}
            onChange={() => onChange({ ...profile, scope: onlyFav ? 'all' : 'favorites' })}
          />
        </label>

        <ul className="fav-grid">
          {mine.map((c) => {
            const on = !!profile.favorites[c.id];
            return (
              <li key={c.id}>
                <button className={`fav-tile ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
                  <ChannelLogo channel={c} fallback={c.name} size="sm" />
                  <span className="fav-tile__name">{c.name}</span>
                  <span className="fav-tile__star" aria-hidden="true">{on ? '★' : '☆'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
