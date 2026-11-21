import type { Channel } from '../types';
import { assetUrl } from '../utils';

interface Props {
  channel?: Channel;
  /** Nom à afficher si la chaîne n'a pas de logo */
  fallback: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/** Petit logo de chaîne dans une pastille (claire, ou sombre pour les logos blancs). */
export function ChannelLogo({ channel, fallback, size = 'sm', className = '' }: Props) {
  return (
    <span className={`clogo clogo--${size} ${channel?.logoDark ? 'is-dark' : ''} ${className}`} title={channel?.name ?? fallback}>
      {channel?.logo ? <img src={assetUrl(channel.logo)} alt={channel.name} loading="lazy" /> : <span>{fallback.slice(0, 4)}</span>}
    </span>
  );
}
