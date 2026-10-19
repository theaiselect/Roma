import { useState } from 'preact/hooks';

/** ROMA ↔ AMOR: al tocarlo, las letras giran y la palabra se lee al revés. */
export function Logo() {
  const [amor, setAmor] = useState(false);
  const [flip, setFlip] = useState(false);
  const word = amor ? 'AMOR' : 'ROMA';

  const toggle = () => {
    setFlip(true);
    window.setTimeout(() => { setAmor((a) => !a); setFlip(false); }, 240);
  };

  return (
    <button type="button" class={`logo${flip ? ' flip' : ''}`} onClick={toggle} aria-label={`${word}. Toca para leerlo al revés`}>
      {word.split('').map((l, i) => <span key={i} style={{ transitionDelay: `${i * 40}ms` }}>{l}</span>)}
    </button>
  );
}
