import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Panneau plein écran qui monte du bas.
 * Pour fermer : la croix ronde en haut à droite, glisser vers le bas,
 * le bouton retour du téléphone (géré dans App) ou la touche Échap.
 */
export function Sheet({ label, onClose, children }: Props) {
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    body.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glisser vers le bas : seulement quand le contenu est tout en haut
  const onTouchStart = (e: React.TouchEvent) => {
    if ((body.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    setDy(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dy > 90) close();
    else setDy(0);
  };

  return (
    <div className={`sheet-backdrop ${closing ? 'is-closing' : ''}`}>
      <div
        className={`sheet ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="sheet__grip" aria-hidden="true" />
        <button className="sheet__x" onClick={close} aria-label="Fermer">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="sheet__body" ref={body} tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
