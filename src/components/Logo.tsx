import { useEffect, useState } from 'preact/hooks';

/**
 * ROMA ↔ AMOR (F38): al tocarlo, las letras giran una a una y la palabra se lee al revés.
 * `autoFlip` lo hace girar solo al montar (primera apertura del 30 de octubre).
 */
export function Logo({ hero = false, autoFlip = false }: { hero?: boolean; autoFlip?: boolean }) {
  const [amor, setAmor] = useState(false);
  const [flip, setFlip] = useState(false);
  const word = amor ? 'AMOR' : 'ROMA';

  const toggle = () => {
    if (flip) return;
    setFlip(true);
    window.setTimeout(() => { setAmor((a) => !a); setFlip(false); }, 240 + 3 * 40);
  };

  useEffect(() => {
    if (!autoFlip) return;
    const id = window.setTimeout(toggle, 600);
    return () => window.clearTimeout(id);
  }, [autoFlip]);

  return (
    <button type="button" class={`logo${hero ? ' logo-hero' : ''}${flip ? ' flip' : ''}`} onClick={toggle}
      aria-label={`${word}. Toca para leerlo al revés`}>
      {word.split('').map((l, i) => <span key={i} style={{ transitionDelay: `${i * 40}ms` }}>{l}</span>)}
    </button>
  );
}
