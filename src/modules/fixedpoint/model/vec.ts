/** Векторы в пространстве: тройки чисел. Ось x — вправо, y — вверх в плоскости чертежа, z — на наблюдателя. */
export type V3 = [number, number, number];

export const V0: V3 = [0, 0, 0];
export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vmul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const vsum = (...xs: V3[]): V3 => xs.reduce((s, x) => vadd(s, x), V0);
/** Угол между векторами, градусы (0…180); NaN, если один из них нулевой. */
export function angleDeg(a: V3, b: V3): number {
  const na = norm(a),
    nb = norm(b);
  if (na < 1e-300 || nb < 1e-300) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (na * nb)))) * 180) / Math.PI;
}
/** Округление шума: |x| < tol·масштаб → 0. */
export const clean = (v: V3, scale = 1): V3 => v.map((x) => (Math.abs(x) < 1e-11 * Math.max(1, scale) ? 0 : x)) as V3;
