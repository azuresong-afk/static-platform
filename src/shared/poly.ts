/** Многочлены по возрастанию степеней: [c0, c1, c2, …] ↔ c0 + c1·z + c2·z² + … */
export type Poly = number[];

export const polyAdd = (a: Poly, b: Poly): Poly => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
export const polyScale = (a: Poly, k: number): Poly => a.map((c) => c * k);
export const polyEval = (a: Poly, z: number): number => a.reduceRight((acc, c) => acc * z + c, 0);
export const polyDeriv = (a: Poly): Poly => a.slice(1).map((c, i) => c * (i + 1));
/** Степень без учёта пренебрежимо малых старших коэффициентов (относительно масштаба). */
export function polyDegree(a: Poly, scale = 1): number {
  const tol = 1e-9 * Math.max(1, scale);
  for (let i = a.length - 1; i > 0; i--) if (Math.abs(a[i]) > tol) return i;
  return 0;
}

/** Корни многочлена степени ≤ 2 на отрезке [lo, hi] (внутренние, без концов). */
export function rootsInside(a: Poly, lo: number, hi: number, scale = 1): number[] {
  const d = polyDegree(a, scale);
  const eps = 1e-9 * Math.max(1, hi - lo);
  const inside = (z: number) => z > lo + eps && z < hi - eps;
  if (d === 0) return [];
  if (d === 1) {
    const z = -a[0] / a[1];
    return inside(z) ? [z] : [];
  }
  if (d === 2) {
    const [c, b, A] = a;
    const D = b * b - 4 * A * c;
    if (D < 0) return [];
    const s = Math.sqrt(D);
    // Устойчивая формула корней.
    const q = -0.5 * (b + (b >= 0 ? s : -s));
    const rs = [q / A, q !== 0 ? c / q : -b / (2 * A)];
    return [...new Set(rs.map((z) => +z.toPrecision(15)))].filter(inside).sort((x, y) => x - y);
  }
  throw new Error('rootsInside: степень больше 2');
}

/** Замена переменной: q(s) = p(L − s) (отсчёт от другого конца отрезка длиной L). */
export function polyReflect(p: Poly, L: number): Poly {
  // (L − s)^k = Σ C(k, j)·L^(k−j)·(−s)^j
  const out: Poly = new Array(p.length).fill(0);
  p.forEach((c, k) => {
    let binom = 1;
    for (let j = 0; j <= k; j++) {
      out[j] += c * binom * L ** (k - j) * (j % 2 ? -1 : 1);
      binom = (binom * (k - j)) / (j + 1);
    }
  });
  return out;
}
