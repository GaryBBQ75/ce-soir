import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Titre affiché dans la barre fixe en haut (facultatif) */
  title?: string;
}

/**
 * Panneau du bas, facile à refermer :
 * - bouton « Fermer » toujours visible en haut
 * - glisser vers le bas
 * - toucher le fond assombri
 * - touche Échap
 */
export function Sheet({ label, onClose, children, title }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    // Bloque le défilement de la page derrière
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glisser vers le bas : seulement si le contenu est tout en haut
  const onTouchStart = (e: React.TouchEvent) => {
    if ((body.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const d = e.touches[0].clientY - startY.current;
    setDy(Math.max(0, d));
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dy > 90) close();
    else setDy(0);
  };

  return (
    <div className={`sheet-backdrop ${closing ? 'is-closing' : ''}`} onClick={close}>
      <div
        ref={panel}
        className={`sheet ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet__top">
          <div className="sheet__handle" aria-hidden="true" />
          <div className="sheet__bar">
            <span className="sheet__bar-title">{title}</span>
            <button className="sheet__close" onClick={close} aria-label="Fermer">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              Fermer
            </button>
          </div>
        </div>
        <div className="sheet__body" ref={body}>
          {children}
        </div>
      </div>
    </div>
  );
}
