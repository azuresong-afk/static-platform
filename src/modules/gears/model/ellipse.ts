/**
 * Эллиптические (некруглые) зубчатые колёса (Мещерский 14.6–14.8).
 *
 * Колесо 1 — эллипс с полуосями a ≥ b (c = √(a² − b²)), вращается с постоянной ω₁ вокруг фокуса или центра.
 * φ — угол между линией центров O₁O₂ и большой осью колеса 1. Точка касания лежит на линии центров, колёса
 * катятся без скольжения: ω₂/ω₁ = r₁/r₂, r₁ + r₂ = A (A — расстояние между осями).
 *   ось в фокусе:  r₁ = (a² − c²)/(a − c cos φ), по умолчанию A = 2a; тогда ω₂ = ω₁(a² − c²)/(a² − 2ac cos φ + c²) (14.7);
 *   ось в центре:  r₁ = ab/√(b² cos² φ + a² sin² φ), по умолчанию A = a + b (овальные колёса 14.8).
 * Колесо 2 — сопряжённый профиль (при A = 2a и оси в фокусе — такой же эллипс), вращается в обратную сторону.
 * ε₂ = dω₂/dt = ω₁·dω₂/dφ (ω₁ = const).
 */
export interface EllProblem {
  a: number;
  b: number;
  pivot: 'focus' | 'center';
  /** Расстояние между осями (0 — по умолчанию: 2a или a + b). */
  A: number;
  /** Угловая скорость колеса 1 и её единицы. */
  w1: number;
  unit: 'rad' | 'rpm';
  /** Положение колеса 1, градусы. */
  phi: number;
}

export interface EllResult {
  ok: boolean;
  errors: string[];
  c: number;
  A: number;
  w1: number;
  /** При заданном φ: радиусы до точки касания, отношение, ω₂ (по модулю, вращение обратное) и ε₂. */
  r1: number;
  r2: number;
  ratio: number;
  w2: number;
  eps2: number;
  /** Наименьшая и наибольшая ω₂ и положения колеса 1, где они достигаются (°). */
  min: { w: number; phi: number; r1: number };
  max: { w: number; phi: number; r1: number };
}

export function ellR(pr: EllProblem, phi: number): number {
  const { a, b } = pr;
  if (pr.pivot === 'focus') {
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    return (a * a - c * c) / (a - c * Math.cos(phi));
  }
  return (a * b) / Math.sqrt(b * b * Math.cos(phi) ** 2 + a * a * Math.sin(phi) ** 2);
}

export const ellA = (pr: EllProblem) => (pr.A > 0 ? pr.A : pr.pivot === 'focus' ? 2 * pr.a : pr.a + pr.b);

export function solveEllipse(pr: EllProblem): EllResult {
  const errors: string[] = [];
  if (!(pr.a > 0) || !(pr.b > 0)) errors.push('Полуоси — положительные числа.');
  else if (pr.b > pr.a) errors.push('Большая полуось a должна быть не меньше малой b.');
  if (!(pr.w1 > 0)) errors.push('Угловая скорость колеса 1 — положительное число.');
  if (!Number.isFinite(pr.phi)) errors.push('Угол φ — число.');
  const c = pr.a > pr.b ? Math.sqrt(pr.a * pr.a - pr.b * pr.b) : 0;
  const A = ellA(pr);
  const rMax = pr.pivot === 'focus' ? pr.a + c : pr.a,
    rMin = pr.pivot === 'focus' ? pr.a - c : pr.b;
  if (!errors.length && !(A > rMax)) errors.push(`Расстояние между осями должно быть больше наибольшего радиуса колеса 1 (${+rMax.toFixed(6)}).`);
  const z = { w: 0, phi: 0, r1: 0 };
  if (errors.length) return { ok: false, errors, c, A, w1: 0, r1: 0, r2: 0, ratio: 0, w2: 0, eps2: 0, min: z, max: z };
  const w1 = pr.unit === 'rpm' ? (pr.w1 * Math.PI) / 30 : pr.w1;
  const g = (f: number) => {
    const r = ellR(pr, f);
    return r / (A - r);
  };
  const f = (pr.phi * Math.PI) / 180;
  const r1 = ellR(pr, f),
    h = 1e-5;
  const ratio = r1 / (A - r1);
  const dg = (g(f + h) - g(f - h)) / (2 * h);
  return {
    ok: true,
    errors: [],
    c,
    A,
    w1,
    r1,
    r2: A - r1,
    ratio,
    w2: w1 * ratio,
    eps2: Math.abs(dg) < 1e-12 ? 0 : w1 * w1 * dg,
    // r₁/(A − r₁) возрастает с r₁ — крайние значения при крайних радиусах.
    max: { w: (w1 * rMax) / (A - rMax), phi: 0, r1: rMax },
    min: { w: (w1 * rMin) / (A - rMin), phi: pr.pivot === 'focus' ? 180 : 90, r1: rMin },
  };
}

/** Профиль колеса 2 в его собственных осях: точки касания (A − r₁, π + ψ₂), ψ₂ = ∫ω₂/ω₁ dφ. */
export function conjugate(pr: EllProblem, A: number, n = 720): { pts: [number, number][]; psi: (phi: number) => number } {
  const psiTab: number[] = [0];
  const g = (f: number) => {
    const r = ellR(pr, f);
    return r / (A - r);
  };
  const step = (2 * Math.PI) / n;
  for (let i = 1; i <= n; i++) {
    const f0 = (i - 1) * step;
    psiTab.push(psiTab[i - 1] + (step / 6) * (g(f0) + 4 * g(f0 + step / 2) + g(f0 + step)));
  }
  const total = psiTab[n];
  const psi = (phi: number) => {
    const turns = Math.floor(phi / (2 * Math.PI));
    const rem = phi - turns * 2 * Math.PI;
    const i = Math.min(n - 1, Math.floor(rem / step));
    const fr = (rem - i * step) / step;
    return turns * total + psiTab[i] + fr * (psiTab[i + 1] - psiTab[i]);
  };
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const r2 = A - ellR(pr, i * step),
      th = Math.PI + psiTab[i];
    pts.push([r2 * Math.cos(th), r2 * Math.sin(th)]);
  }
  return { pts, psi };
}
