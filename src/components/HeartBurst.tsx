/** Lluvia corta de corazones (se ve unos 2 s y se apaga sola). Con «reducir movimiento» no se anima. */
export function HeartBurst() {
  const hearts = [8, 22, 36, 50, 64, 78, 90];
  return (
    <div class="heartburst" aria-hidden="true">
      {hearts.map((x, i) => <span key={x} style={{ left: `${x}%`, animationDelay: `${i * 110}ms`, fontSize: `${1.1 + (i % 3) * 0.45}rem` }}>♥</span>)}
    </div>
  );
}
