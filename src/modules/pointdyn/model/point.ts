/**
 * Динамика точки: прямолинейное движение (Мещерский §27; Антонов п. 9.1, 9.3) — вторая основная задача.
 *
 * Точка движется по прямой, наклонённой к горизонту под углом α (0 — горизонталь, 90° — вертикаль).
 * Ось x направлена вдоль прямой вверх или вниз. Силы вдоль x:
 *   проекция силы тяжести ∓P sin α; трение скольжения −f·P·cos α·sign v (N = P cos α);
 *   F₀ + a·t + F₁ sin pt; упругая −c·x; сопротивление −k₁v и −k₂v|v|.
 * Уравнение m·dv/dt = ΣF_x — то же по форме, что уравнение вращения J·dω/dt = ΣM, поэтому решается тем же
 * интегратором (Рунге — Кутта с контролем шага, точная остановка сухим трением).
 */
import { G, solveEq, type EqResult, type RotEq } from '../../rotation/model/rotation';

export interface PointProblem {
  byWeight: boolean;
  /** Масса (или вес). */
  m: number;
  /** Наклон прямой к горизонту, градусы. */
  alpha: number;
  /** Ось x — вверх по наклону (иначе вниз). */
  up: boolean;
  f: number;
  F0: number;
  /** Сила a·t. */
  at: number;
  /** Сила F₁ sin pt. */
  F1: number;
  p: number;
  c: number;
  kv: number;
  kq: number;
  x0: number;
  v0: number;
  /** Что ищем: состояние в момент t, когда v = v1, когда x = x1. */
  ask: 't' | 'v' | 'x';
  t: number;
  v1: number;
  x1: number;
}

export interface PointResult {
  ok: boolean;
  errors: string[];
  mass: number;
  /** Вес P = mg. */
  P: number;
  /** Проекция силы тяжести на x и сила трения (модуль). */
  Gx: number;
  Ffr: number;
  eq: EqResult;
  /** Предельная скорость (если силы зависят только от v и она существует). */
  vLim: number | null;
}

const rad = (a: number) => (a * Math.PI) / 180;
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

export function toRotEq(pr: PointProblem): { eq: RotEq; mass: number; P: number; Gx: number; Ffr: number } {
  const mass = pr.byWeight ? pr.m / G : pr.m;
  const P = pr.byWeight ? pr.m : pr.m * G;
  const Gx = clean((pr.up ? -1 : 1) * P * Math.sin(rad(pr.alpha)));
  const Ffr = clean(pr.f * P * Math.cos(rad(pr.alpha)));
  const eq: RotEq = {
    body: { kind: 'J', m: 0, R: 0, J: mass },
    loads: [],
    M0: pr.F0 + Gx,
    at: pr.at,
    m0: pr.F1,
    p: pr.p,
    c: pr.c,
    Pa: 0,
    kv: pr.kv,
    kq: pr.kq,
    Mf: Ffr,
    phi0: pr.x0,
    omega0: pr.v0,
    ask: pr.ask === 'v' ? 'omega' : pr.ask === 'x' ? 'phi' : 't',
    t: pr.t,
    omega1: pr.v1,
    phi1: pr.x1,
  };
  return { eq, mass, P, Gx, Ffr };
}

/** Предельная скорость: F(v) = 0 при силах, зависящих только от v, и наличии сопротивления. */
export function limitSpeed(pr: PointProblem, C: number, Ffr: number): number | null {
  if (pr.at !== 0 || (pr.F1 !== 0 && pr.p !== 0) || pr.c !== 0 || (pr.kv === 0 && pr.kq === 0)) return null;
  // Направление установившегося движения — по знаку постоянной силы (с трением против движения).
  const dir = Math.sign(C) || 0;
  if (dir === 0 || Math.abs(C) <= Ffr) return null;
  const F = (v: number) => C - Ffr * dir - pr.kv * v - pr.kq * v * Math.abs(v);
  let lo = 0,
    hi = dir;
  while (Math.sign(F(hi)) === Math.sign(F(lo)) && Math.abs(hi) < 1e9) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(F(mid)) === Math.sign(F(lo))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function solvePoint(pr: PointProblem): PointResult {
  const errors: string[] = [];
  if (!(pr.m > 0)) errors.push('Масса (вес) точки — положительное число.');
  if (pr.f < 0 || pr.kv < 0 || pr.kq < 0) errors.push('Коэффициенты трения и сопротивления не могут быть отрицательными.');
  const { eq, mass, P, Gx, Ffr } = toRotEq(pr);
  const r = solveEq(eq, false);
  const all = [...errors, ...r.errors.map((e) => e.replace('Момент инерции', 'Масса').replace('момент инерции', 'масса'))];
  return { ok: !all.length && r.ok, errors: all, mass, P, Gx, Ffr, eq: r, vLim: limitSpeed(pr, pr.F0 + Gx, Ffr) };
}
