/**
 * Тело с неподвижной точкой O: сложение вращений вокруг пересекающихся осей (Мещерский §19, 25; Яблонский К.6).
 *
 * Переносное вращение — вокруг неподвижной оси Oz (ωₑ, εₑ); относительное — вокруг оси тела Oζ, лежащей в данный момент
 * в плоскости Oyz под углом α к Oz (ωᵣ, εᵣ; знак — по правилу правого винта вдоль орта оси). Абсолютная угловая
 * скорость ω = ωₑ·k + ωᵣ·e, где e — орт оси тела; так как ось тела поворачивается вместе с переносным вращением,
 * угловое ускорение ε = εₑ·k + εᵣ·e + ωₑk × ωᵣe (при постоянных ωₑ, ωᵣ — только последний член).
 *
 * Качение без скольжения (конус по плоскости или по конусу, бегун, коническое колесо по опорной шестерне): точки тела
 * на линии касания неподвижны, значит, ω направлена по линии касания OP (в плоскости Oyz под углом γ к Oz):
 * (ωₑk + ωᵣe) × u = 0 ⇒ ωᵣ = ωₑ·sin γ / sin(α − γ), и при переменной ωₑ — εᵣ = εₑ·sin γ / sin(α − γ).
 * Масштаб можно задать не ωₑ, а периодом переносного вращения или скоростью одной из точек (при качении все
 * величины пропорциональны ωₑ).
 *
 * Скорость точки v = ω × r, ускорение a = ε × r + ω × (ω × r) (вращательное и осестремительное); расстояние до
 * мгновенной оси h = |ω × r|/|ω|. При постоянных ωₑ, ωᵣ аксоиды — круговые конусы: неподвижный — вокруг Oz
 * с полууглом ∠(ω, k), подвижный — вокруг оси тела с полууглом ∠(ω, e); годограф ω — окружность радиуса |ω| sin ∠(ω, k).
 */
import { cross, dot, norm, type V3 } from '../../converging/model/forces';

export type WUnit = 'rad' | 'rpm';
export const RPM = Math.PI / 30;
export interface SPoint {
  name: string;
  x: number;
  y: number;
  z: number;
}
export interface ComposeProblem {
  unit: WUnit;
  /** Как задано переносное вращение: угловой скоростью, периодом оборота или скоростью точки (только при качении). */
  scale: 'we' | 'period' | 'point';
  we: number;
  T: number;
  /** Номер точки и её скорость (для scale = 'point'). */
  pi: number;
  vp: number;
  ee: number;
  /** Угол оси тела с осью Oz, градусы (в плоскости Oyz, к +y). */
  alpha: number;
  rel: 'given' | 'roll';
  wr: number;
  er: number;
  /** Угол линии касания (мгновенной оси) с осью Oz, градусы. */
  gamma: number;
  points: SPoint[];
}
export interface PointKin {
  name: string;
  r: V3;
  v: V3;
  /** Вращательное ε × r и осестремительное ω × (ω × r) ускорения. */
  aE: V3;
  aW: V3;
  a: V3;
  /** Расстояние до мгновенной оси. */
  h: number;
}
export interface ComposeResult {
  ok: true;
  k: V3;
  e: V3;
  u: V3 | null;
  we: number;
  ee: number;
  wr: number;
  er: number;
  /** ωᵣ/ωₑ при качении. */
  ratio: number | null;
  w: V3;
  eps: V3;
  /** Члены ε: εₑk, εᵣe, ωₑ × ωᵣ. */
  epsParts: [V3, V3, V3];
  /** Полууглы аксоидов, рад: ∠(ω, k), ∠(ω, e). */
  axFixed: number;
  axMoving: number;
  points: PointKin[];
}
export type ComposeOut = ComposeResult | { ok: false; error: string };

const rad = (d: number) => (d * Math.PI) / 180;
export const add3 = (...vs: V3[]): V3 => vs.reduce<V3>((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
export const mul3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
/** Угол между векторами, рад (0 при нулевом векторе). */
export function angle(a: V3, b: V3): number {
  const n = norm(a) * norm(b);
  return n > 0 ? Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n))) : 0;
}
/** Скорость и ускорение точки тела при угловой скорости ω и угловом ускорении ε (неподвижная точка — начало). */
export function pointKin(name: string, r: V3, w: V3, eps: V3): PointKin {
  const rn = norm(r),
    wn = norm(w);
  // Ошибки округления (точка на мгновенной оси) — в нуль относительно масштаба |ω|·|r| и (|ε| + ω²)·|r|.
  const clean = (v: V3, sc: number): V3 => v.map((x) => (Math.abs(x) <= 1e-12 * sc ? 0 : x)) as V3;
  const v = clean(cross(w, r), wn * rn);
  const sa = (norm(eps) + wn * wn) * rn;
  const aE = clean(cross(eps, r), sa),
    aW = clean(cross(w, v), sa);
  return { name, r, v, aE, aW, a: clean(add3(aE, aW), sa), h: wn > 0 ? norm(v) / wn : NaN };
}

export function solveCompose(pr: ComposeProblem): ComposeOut {
  const f = pr.unit === 'rpm' ? RPM : 1;
  const k: V3 = [0, 0, 1];
  const e: V3 = [0, Math.sin(rad(pr.alpha)), Math.cos(rad(pr.alpha))];
  const roll = pr.rel === 'roll';
  const u: V3 | null = roll ? [0, Math.sin(rad(pr.gamma)), Math.cos(rad(pr.gamma))] : null;
  let ratio: number | null = null;
  if (roll) {
    const s = Math.sin(rad(pr.alpha - pr.gamma));
    if (Math.abs(s) < 1e-9) return { ok: false, error: 'Ось тела совпадает с линией касания — качение невозможно: задайте другие углы α и γ.' };
    ratio = Math.sin(rad(pr.gamma)) / s;
  }
  if (pr.scale === 'point' && !roll) return { ok: false, error: 'Скорость точки задаёт масштаб только при качении (когда ωᵣ пропорциональна ωₑ).' };
  if (pr.scale === 'period' && !(pr.T > 0)) return { ok: false, error: 'Период переносного вращения — положительный.' };
  let we = pr.scale === 'period' ? (2 * Math.PI) / pr.T : pr.we * f;
  if (pr.scale === 'point') {
    const p = pr.points[pr.pi];
    if (!p) return { ok: false, error: 'Точка, по скорости которой задан масштаб, не найдена.' };
    // При ωₑ = 1 скорость точки v₁; масштаб — vp/v₁.
    const w1 = add3(k, mul3(e, ratio!));
    const v1 = norm(cross(w1, [p.x, p.y, p.z]));
    if (!(v1 > 0)) return { ok: false, error: `Точка ${p.name} лежит на мгновенной оси — её скорость равна нулю и масштаб не задаёт.` };
    we = pr.vp / v1;
  }
  const wr = roll ? ratio! * we : pr.wr * f;
  const ee = pr.ee,
    er = roll ? ratio! * pr.ee : pr.er;
  const w = add3(mul3(k, we), mul3(e, wr));
  const parts: [V3, V3, V3] = [mul3(k, ee), mul3(e, er), cross(mul3(k, we), mul3(e, wr))];
  const eps = add3(...parts);
  return {
    ok: true,
    k,
    e,
    u,
    we,
    ee,
    wr,
    er,
    ratio,
    w,
    eps,
    epsParts: parts,
    axFixed: angle(w, k),
    axMoving: angle(w, e),
    points: pr.points.map((p) => pointKin(p.name, [p.x, p.y, p.z], w, eps)),
  };
}
