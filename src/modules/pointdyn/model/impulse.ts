/**
 * Теоремы об изменении количества движения и момента количества движения точки (Мещерский 28.1–28.7, 28.9,
 * 28.11–28.14).
 *
 * Теорема об импульсе: m·v₁ − m·v₀ = S = ∫F dt; для постоянных сил S = F·t. Теорема моментов для центральной силы:
 * момент количества движения сохраняется, r²φ̇ = const (закон площадей). Вопросы:
 *  - line   — прямолинейное движение под постоянной силой тяги F и сопротивлением R = mg(f cos α + sin α) (α > 0 —
 *             подъём): m(v₁ − v₀) = (F − R)t; найти t, v₁, F (и среднее давление F/A), f или массу; время по пути
 *             (s = v₀t + at²/2);
 *  - vec    — импульс равнодействующей между двумя скоростями (векторно): S = m(v₁ − v₀), средняя сила S/Δt;
 *  - circle — равномерное движение по окружности: за поворот на ψ |S| = 2mv sin(ψ/2), средняя сила S/Δt;
 *  - area   — точка на нити, втягиваемой в трубку (отверстие): r²ω = const ⇒ n₂ = n₁(r₁/r₂)²;
 *  - hole   — шарик на нити, втягиваемой в отверстие с постоянной скоростью a: r = R − at, φ = u₀t/(R − at),
 *             натяжение T = mu₀²R²/(R − at)³;
 *  - sync   — два математических маятника: одновременно в исходное состояние через T = nT₁ = kT₂, если
 *             √(l₁/l₂) = k/n — несократимая дробь.
 */

export type ImpulseAsk = 'line' | 'vec' | 'circle' | 'area' | 'hole' | 'sync';
export type LineFind = 't' | 'v1' | 'F' | 'f' | 'm' | 'tpath';
export interface ImpulseProblem {
  byWeight: boolean;
  m: number;
  g: number;
  ask: ImpulseAsk;
  find: LineFind;
  v0: number;
  v1: number;
  t: number;
  F: number;
  f: number;
  /** Уклон, ° («+» — подъём). */
  alpha: number;
  s: number;
  /** Площадь сечения (для среднего давления F/A); 0 — не считать. */
  A: number;
  /** vec: направления скоростей, °. */
  a0: number;
  a1: number;
  dt: number;
  /** circle: скорость, период, угол поворота (°). */
  v: number;
  T: number;
  psi: number;
  /** area: радиусы и число оборотов. */
  r1: number;
  n1: number;
  r2: number;
  /** hole: начальное расстояние, поперечная скорость, скорость втягивания. */
  R: number;
  u0: number;
  a: number;
  l1: number;
  l2: number;
}

export interface ImpLine {
  t: number;
  v1: number;
  F: number;
  f: number;
  mass: number;
  /** Сила сопротивления (трение и составляющая тяжести вдоль пути). */
  Rs: number;
  S: number;
  s: number;
  acc: number;
  p: number | null;
}
export interface ImpulseResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  line?: ImpLine;
  vec?: { S: [number, number]; Sabs: number; ang: number; Fm: [number, number] | null };
  circle?: { S: number; dt: number; F: number };
  area?: { n2: number; v1: number; v2: number };
  hole?: { r: number; phi: number; T: number; vphi: number; tEnd: number };
  sync?: { k: number; n: number; T1: number; T2: number; T: number; ratio: number } | { k: 0; n: 0; T1: number; T2: number; T: number; ratio: number };
}

const D = Math.PI / 180;

/** Несократимая дробь k/n ≈ x (цепная дробь, знаменатель до maxDen); null — с точностью tol не получилось. */
export function rational(x: number, maxDen = 1000, tol = 1e-9): [number, number] | null {
  let h0 = 1,
    h1 = 0,
    k0 = 0,
    k1 = 1,
    y = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(y);
    const h2 = a * h0 + h1,
      k2 = a * k0 + k1;
    if (k2 > maxDen) break;
    if (Math.abs(h2 / k2 - x) <= tol * Math.max(1, x)) return [h2, k2];
    h1 = h0;
    h0 = h2;
    k1 = k0;
    k0 = k2;
    if (y - a < 1e-15) break;
    y = 1 / (y - a);
  }
  return null;
}

export function solveImpulse(p: ImpulseProblem): ImpulseResult {
  const errors: string[] = [];
  const nums = [p.m, p.g, p.v0, p.v1, p.t, p.F, p.f, p.alpha, p.s, p.A, p.a0, p.a1, p.dt, p.v, p.T, p.psi, p.r1, p.n1, p.r2, p.R, p.u0, p.a, p.l1, p.l2];
  if (!nums.every(Number.isFinite)) errors.push('Все данные — числа.');
  if (!(p.g > 0)) errors.push('g — положительное число.');
  if (!(p.m > 0) && !(p.ask === 'line' && p.find === 'm')) errors.push(p.byWeight ? 'Вес P — положительное число.' : 'Масса m — положительное число.');
  const mass = p.byWeight ? p.m / p.g : p.m;
  const P = mass * p.g;
  const base: ImpulseResult = { ok: false, errors, mass, P };
  if (errors.length) return base;
  const bad = (e: string): ImpulseResult => ({ ...base, errors: [e] });
  const g = p.g;

  if (p.ask === 'line') {
    const ca = Math.cos(p.alpha * D),
      sa = Math.sin(p.alpha * D);
    const res = g * (p.f * ca + sa); // сопротивление на единицу массы
    let m = mass,
      t = p.t,
      v1 = p.v1,
      F = p.F,
      f = p.f;
    if (p.find === 't') {
      const a = (F - m * res) / m;
      if (a === 0 || !((v1 - p.v0) / a > 0)) return bad('С такими силами скорость не меняется от v₀ до v₁.');
      t = (v1 - p.v0) / a;
    } else if (p.find === 'v1') {
      if (!(t > 0)) return bad('Время t — положительное число.');
      v1 = p.v0 + ((F - m * res) * t) / m;
    } else if (p.find === 'F') {
      if (!(t > 0)) return bad('Время t — положительное число.');
      F = (m * (v1 - p.v0)) / t + m * res;
    } else if (p.find === 'f') {
      if (!(t > 0)) return bad('Время t — положительное число.');
      f = (F - (m * (v1 - p.v0)) / t - m * g * sa) / (m * g * ca);
    } else if (p.find === 'm') {
      if (!(t > 0)) return bad('Время t — положительное число.');
      const den = v1 - p.v0 + g * t * (p.f * ca + sa);
      if (!(den > 0 && F > 0)) return bad('Массу по этим данным найти нельзя: сила тяги не разгоняет тело.');
      m = (F * t) / den;
    } else {
      if (!(p.s > 0)) return bad('Путь s — положительное число.');
      const a = (F - m * res) / m;
      const disc = p.v0 * p.v0 + 2 * a * p.s;
      if (a === 0) {
        if (!(p.v0 > 0)) return bad('Тело не движется.');
        t = p.s / p.v0;
      } else {
        if (disc < 0) return bad('Тело останавливается, не пройдя путь s.');
        t = (-p.v0 + Math.sqrt(disc)) / a;
      }
      if (!(t > 0)) return bad('Тело не проходит путь s.');
      v1 = p.v0 + a * t;
    }
    const Rs = m * g * (f * ca + sa);
    const acc = t > 0 ? (v1 - p.v0) / t : 0;
    return {
      ...base,
      mass: m,
      P: m * g,
      ok: true,
      line: { t, v1, F, f, mass: m, Rs, S: (F - Rs) * t, s: ((p.v0 + v1) * t) / 2, acc, p: p.A > 0 ? F / p.A : null },
    };
  }

  if (p.ask === 'vec') {
    const u0: [number, number] = [p.v0 * Math.cos(p.a0 * D), p.v0 * Math.sin(p.a0 * D)],
      u1: [number, number] = [p.v1 * Math.cos(p.a1 * D), p.v1 * Math.sin(p.a1 * D)];
    const S: [number, number] = [mass * (u1[0] - u0[0]), mass * (u1[1] - u0[1])];
    return { ...base, ok: true, vec: { S, Sabs: Math.hypot(S[0], S[1]), ang: Math.atan2(S[1], S[0]) / D, Fm: p.dt > 0 ? [S[0] / p.dt, S[1] / p.dt] : null } };
  }

  if (p.ask === 'circle') {
    if (!(p.v > 0 && p.T > 0)) return bad('Скорость v и период T — положительные числа.');
    if (!(p.psi > 0 && p.psi <= 360)) return bad('Угол поворота ψ — от 0 до 360°.');
    const S = 2 * mass * p.v * Math.sin((p.psi * D) / 2);
    const dt = (p.T * p.psi) / 360;
    return { ...base, ok: true, circle: { S, dt, F: S / dt } };
  }

  if (p.ask === 'area') {
    if (!(p.r1 > 0 && p.r2 > 0)) return bad('Радиусы r₁ и r₂ — положительные числа.');
    const n2 = p.n1 * (p.r1 / p.r2) ** 2;
    return { ...base, ok: true, area: { n2, v1: (2 * Math.PI * p.r1 * p.n1) / 60, v2: (2 * Math.PI * p.r2 * n2) / 60 } };
  }

  if (p.ask === 'hole') {
    if (!(p.R > 0 && p.a > 0)) return bad('Начальное расстояние R и скорость втягивания a — положительные числа.');
    const tEnd = p.R / p.a;
    if (!(p.t >= 0 && p.t < tEnd)) return bad(`Время t — от 0 до R/a = ${tEnd} с (шарик доходит до отверстия).`);
    const r = p.R - p.a * p.t;
    return { ...base, ok: true, hole: { r, phi: (p.u0 * p.t) / r, T: (mass * p.u0 ** 2 * p.R ** 2) / r ** 3, vphi: (p.u0 * p.R) / r, tEnd } };
  }

  if (!(p.l1 > 0 && p.l2 > 0)) return bad('Длины маятников — положительные числа.');
  const T1 = 2 * Math.PI * Math.sqrt(p.l1 / g),
    T2 = 2 * Math.PI * Math.sqrt(p.l2 / g);
  const ratio = Math.sqrt(p.l1 / p.l2);
  const q = rational(ratio);
  if (!q) return { ...base, ok: true, sync: { k: 0, n: 0, T1, T2, T: Infinity, ratio } };
  return { ...base, ok: true, sync: { k: q[0], n: q[1], T1, T2, T: q[1] * T1, ratio } };
}
