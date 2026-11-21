import { useState } from 'react';
import { BOUQUETS, type Bouquet } from '../types';
import { SEEDS } from '../seeds';
import { Poster } from './Poster';
import { applySignal, type Profile } from '../profile';

interface Props {
  profile: Profile;
  onDone: (p: Profile) => void;
  /** true : on ne refait que le choix des bouquets */
  bouquetsOnly?: boolean;
}

export function Onboarding({ profile, onDone, bouquetsOnly }: Props) {
  const [step, setStep] = useState<'bouquets' | 'swipe'>('bouquets');
  const [p, setP] = useState(profile);
  const [i, setI] = useState(0);

  const toggle = (b: Bouquet) => {
    const has = p.bouquets.includes(b);
    const bouquets = has ? p.bouquets.filter((x) => x !== b) : [...p.bouquets, b];
    setP({ ...p, bouquets });
  };

  if (step === 'bouquets') {
    return (
      <main className="screen onboarding">
        <h1 className="title">Qu'est-ce que tu reçois ?</h1>
        <p className="muted">On ne te proposera que des films que tu peux vraiment regarder.</p>
        <div className="stack">
          {BOUQUETS.map((b) => (
            <label key={b.id} className={`choice ${p.bouquets.includes(b.id) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={p.bouquets.includes(b.id)} onChange={() => toggle(b.id)} />
              <span className="choice__text">
                <strong>{b.label}</strong>
                <span className="muted small">{b.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <button
          className="btn btn--primary btn--wide"
          disabled={p.bouquets.length === 0}
          onClick={() => (bouquetsOnly ? onDone(p) : setStep('swipe'))}
        >
          {bouquetsOnly ? 'Enregistrer' : 'Continuer'}
        </button>
      </main>
    );
  }

  const seed = SEEDS[i];
  const react = (s: 'like' | 'pass' | null) => {
    const next = s ? applySignal(p, seed, s) : p;
    if (i + 1 >= SEEDS.length) onDone({ ...next, onboarded: true });
    else {
      setP(next);
      setI(i + 1);
    }
  };

  return (
    <main className="screen onboarding">
      <div className="progress" aria-label={`Film ${i + 1} sur ${SEEDS.length}`}>
        <div className="progress__bar" style={{ width: `${((i + 1) / SEEDS.length) * 100}%` }} />
      </div>
      <h1 className="title">Tu aimes ?</h1>
      <p className="muted">Quelques films connus pour comprendre tes goûts.</p>
      <div className="seed">
        <Poster title={seed.title} big className="seed__poster" />
        <div className="seed__meta">
          <strong>{seed.title}</strong>
          <span className="muted small">
            {seed.year} · {seed.genres.join(', ')}
          </span>
        </div>
      </div>
      <div className="row">
        <button className="btn btn--ghost" onClick={() => react('pass')}>Pas pour moi</button>
        <button className="btn btn--ghost" onClick={() => react(null)}>Pas vu</button>
        <button className="btn btn--primary" onClick={() => react('like')}>J'aime</button>
      </div>
      <button className="link" onClick={() => onDone({ ...p, onboarded: true })}>Passer</button>
    </main>
  );
}
