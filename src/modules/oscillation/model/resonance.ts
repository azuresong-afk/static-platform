/**
 * Резонансная кривая: амплитуда вынужденных колебаний как функция частоты возмущения (Мещерский 32.88–32.99, 53.37).
 *
 * Два вида возмущения. Сила постоянной амплитуды H (сила, перемещение точки крепления, H = c·a):
 *   B(z) = (H/c)/√((1 − z²)² + 4ζ²z²), z = p/k, ζ = n/k.
 * Сила, пропорциональная p² (неуравновешенный ротор, движение основания в относительных координатах), H = H₀p²:
 *   B(z) = (H₀/m)·z²/√((1 − z²)² + 4ζ²z²); у ротора H₀/m = m₀e/m, у основания — a (при κ = m).
 * В обоих случаях наибольшая высота кривой 1/(2ζ√(1 − ζ²)), при ζ < 1/√2.
 * Сдвиг фазы ε = atan2(2ζz, 1 − z²). «Половинная ширина» (53.37) — разность двух частот, на которых амплитуда равна
 * половине амплитуды при резонансе z = 1: Δ = √(1 − 2b² + 2b√(3 + b²)) − √(1 − 2b² − 2b√(3 + b²)), b = ζ; при малом b
 * Δ ≈ 2√3·b (для кривой с постоянной силой).
 */
import type { OscResult } from './osc';

export interface ResPoint {
  z: number;
  /** Безразмерная амплитуда B/B_ref и сдвиг фазы ε, рад. */
  eta: number;
  eps: number;
}

export interface Resonance {
  /** true — сила пропорциональна p² (ротор, основание), иначе — постоянная амплитуда. */
  rotor: boolean;
  zeta: number;
  /** Опорная амплитуда B_ref: H/c (постоянная сила) или H/(p²m) (ротор: m₀e/m). */
  Bref: number;
  curve: ResPoint[];
  /** Семейство для сравнения при ζ = 0,05; 0,1; 0,25; 0,5; 1. */
  family: { zeta: number; curve: ResPoint[] }[];
  /** Положение максимума z* и его высота. */
  zStar: number | null;
  etaMax: number | null;
  /** Половинная ширина по амплитуде при резонансе z = 1 (только для постоянной силы и ζ > 0). */
  half: { z1: number; z2: number; width: number; approx: number; etaRes: number } | null;
  z: number;
  etaNow: number | null;
}

/** Безразмерная амплитуда. */
export function etaOf(z: number, zeta: number, rotor: boolean): number {
  const d = Math.hypot(1 - z * z, 2 * zeta * z);
  return (rotor ? z * z : 1) / d;
}

function sample(zeta: number, rotor: boolean, zMax: number, N = 400): ResPoint[] {
  const out: ResPoint[] = [];
  for (let i = 0; i <= N; i++) {
    const z = (zMax * i) / N;
    out.push({ z, eta: etaOf(z, zeta, rotor), eps: Math.atan2(2 * zeta * z, 1 - z * z) });
  }
  return out;
}

export function halfWidth(zeta: number): { z1: number; z2: number; width: number; approx: number; etaRes: number } | null {
  if (!(zeta > 0)) return null;
  const b = zeta;
  const root = 2 * b * Math.sqrt(3 + b * b);
  const lo = 1 - 2 * b * b - root,
    hi = 1 - 2 * b * b + root;
  // При большом затухании нижняя частота — нуль (кривая не опускается до половины слева).
  const z1 = lo > 0 ? Math.sqrt(lo) : 0;
  return { z1, z2: Math.sqrt(hi), width: Math.sqrt(hi) - z1, approx: 2 * Math.sqrt(3) * b, etaRes: 1 / (2 * b) };
}

/** Резонансная кривая для решённой задачи с одной гармоникой; null — если возмущение не гармоническое или n = 0 без смысла. */
export function resonanceOf(r: OscResult, mode: 'H' | 'rotor' | 'base' | 'support' | 'two'): Resonance | null {
  const f = r.forced;
  if (!f || mode === 'two') return null;
  const rotor = mode === 'rotor' || mode === 'support';
  const zeta = r.n / r.k;
  const zMax = Math.max(2.5, f.z * 1.15);
  const Bref = rotor ? f.H / (f.p * f.p * r.m) : f.H / r.c;
  const zStar = rotor
    ? zeta < Math.SQRT1_2
      ? 1 / Math.sqrt(1 - 2 * zeta * zeta)
      : null
    : zeta > 0 && zeta < Math.SQRT1_2
      ? Math.sqrt(1 - 2 * zeta * zeta)
      : null;
  const etaMax = zStar != null && zeta > 0 ? (rotor ? 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta)) : 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta))) : null;
  return {
    rotor,
    zeta,
    Bref,
    curve: sample(zeta, rotor, zMax),
    family: [0.05, 0.1, 0.25, 0.5, 1].map((zt) => ({ zeta: zt, curve: sample(zt, rotor, zMax, 200) })),
    zStar,
    etaMax,
    half: rotor ? null : halfWidth(zeta),
    z: f.z,
    etaNow: f.B != null ? etaOf(f.z, zeta, rotor) : null,
  };
}
