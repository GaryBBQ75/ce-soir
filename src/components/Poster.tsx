import { assetUrl, colorsFor } from '../utils';

interface Props {
  title: string;
  poster?: string;
  className?: string;
  big?: boolean;
}

/** Affiche TMDB si dispo, sinon un bloc de couleur avec le titre. */
export function Poster({ title, poster, className = '', big }: Props) {
  if (poster) {
    // Visuel téléchargé par le script (chemin relatif) ou lien direct
    return <img className={`poster ${className}`} src={assetUrl(poster)} alt="" loading="lazy" />;
  }
  const { bg, ink } = colorsFor(title);
  return (
    <div className={`poster poster--type ${big ? 'poster--big' : ''} ${className}`} style={{ background: bg, color: ink }} aria-hidden="true">
      <span>{title}</span>
    </div>
  );
}
