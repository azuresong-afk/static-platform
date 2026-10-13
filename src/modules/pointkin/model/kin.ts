/**
 * Кинематика точки (Мещерский §10–12): способы задания движения.
 *
 * Координатный: x(t), y(t), z(t) → v = (ẋ, ẏ, ż), a = (ẍ, ÿ, z̈); a_τ = v·a/v, a_n = |v × a|/v, ρ = v²/a_n.
 * Естественный: закон движения по траектории s(t) и радиус кривизны ρ → v = ṡ, a_τ = s̈, a_n = v²/ρ.
 * Полярный: r(t), φ(t) → v_r = ṙ, v_φ = rφ′, a_r = r̈ − rφ′², a_φ = rφ″ + 2ṙφ′; ρ = v³/|v_r a_φ − v_φ a_r|.
 * Цилиндрический: r(t), φ(t), z(t) — полярные составляющие и v_z = ż, a_z = z̈.
 * Сферический (Мещерский 10.22, 11.17, 12.35): r(t), долгота φ(t), широта θ(t) — угол с плоскостью xy;
 *   x = r cos θ cos φ, y = r cos θ sin φ, z = r sin θ;
 *   v_r = ṙ, v_φ = r φ̇ cos θ, v_θ = r θ̇;
 *   a_r = r̈ − rθ̇² − rφ̇² cos²θ, a_φ = (rφ̈ + 2ṙφ̇) cos θ − 2rφ̇θ̇ sin θ, a_θ = rθ̈ + 2ṙθ̇ + rφ̇² sin θ cos θ.
 * Производные — символьные (src/shared/expr.ts).
 */
import { diff, evalExpr, parseExpr, type Expr } from '../../../shared/expr';
import type { LinUni } from './uniform';

export type KinMode = 'coord' | 'natural' | 'polar' | 'cyl' | 'sph' | 'uni';
export interface KinProblem {
  mode: KinMode;
  x: string;
  y: string;
  z: string;
  s: string;
  /** Радиус кривизны траектории в естественном способе (0 — прямая). */
  rho: number;
  r: string;
  phi: string;
  /** Широта θ(t) — сферические координаты (в файлах до этого способа — нет). */
  th?: string;
  /** Равнопеременное движение: из v₀, v, a, t, s известны три. */
  uni?: LinUni;
  t: number;
  /** Отрезок времени для траектории на чертеже. */
  t1: number;
  t2: number;
}

export interface KinResult {
  ok: boolean;
  errors: string[];
  /** Формулы и их производные (по способу задания). */
  f: { name: string; e: Expr; d1: Expr; d2: Expr }[];
  /** Положение (x, y, z), скорость и ускорение в декартовых проекциях (для полярного — пересчёт). */
  pos: [number, number, number];
  vel: [number, number, number];
  acc: [number, number, number];
  v: number;
  a: number;
  at: number;
  an: number;
  rho: number | null;
  /** Полярные составляющие. */
  polar: { r: number; phi: number; vr: number; vphi: number; ar: number; aphi: number } | null;
  /** Цилиндрические (r, φ, z) или сферические (r, φ, θ) координаты и проекции v, a на оси системы. */
  curv: { q: [number, number, number]; v: [number, number, number]; a: [number, number, number] } | null;
  /** Углы скорости и ускорения с осями, градусы. */
  vAngles: [number, number, number] | null;
  aAngles: [number, number, number] | null;
}

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
const ZERO: Expr = { k: 'num', v: 0 };

export function solveKin(pr: KinProblem): KinResult {
  const errors: string[] = [];
  const names =
    pr.mode === 'coord'
      ? (['x', 'y', 'z'] as const)
      : pr.mode === 'natural'
        ? (['s'] as const)
        : pr.mode === 'cyl'
          ? (['r', 'phi', 'z'] as const)
          : pr.mode === 'sph'
            ? (['r', 'phi', 'th'] as const)
            : (['r', 'phi'] as const);
  const label = (n: string) => (n === 'phi' ? 'φ' : n === 'th' ? 'θ' : n);
  const f = names.map((n) => {
    const p = parseExpr(pr[n] ?? '');
    if (!p.ok) errors.push(`${label(n)}(t): ${p.error}.`);
    const e = p.ok ? p.e : ZERO;
    const d1 = diff(e);
    return { name: label(n), e, d1, d2: diff(d1) };
  });
  if (pr.mode === 'natural' && !(pr.rho >= 0)) errors.push('Радиус кривизны — неотрицательное число (0 — прямолинейное движение).');
  const z3: [number, number, number] = [0, 0, 0];
  const empty: KinResult = { ok: false, errors, f, pos: z3, vel: z3, acc: z3, v: 0, a: 0, at: 0, an: 0, rho: null, polar: null, curv: null, vAngles: null, aAngles: null };
  if (errors.length) return empty;
  const t = pr.t;
  const val = (i: number, k: 'e' | 'd1' | 'd2') => evalExpr(f[i][k], t);
  let pos = z3,
    vel = z3,
    acc = z3,
    polar: KinResult['polar'] = null,
    curv: KinResult['curv'] = null;
  let v: number, at: number, an: number, rho: number | null;
  if (pr.mode === 'natural') {
    const sd = val(0, 'd1'),
      sdd = val(0, 'd2');
    v = Math.abs(sd);
    at = sdd * (Math.sign(sd) || 1);
    an = pr.rho > 0 ? (sd * sd) / pr.rho : 0;
    rho = pr.rho > 0 ? pr.rho : null;
    pos = [val(0, 'e'), 0, 0];
    vel = [sd, 0, 0];
    acc = [sdd, an, 0];
  } else if (pr.mode === 'polar') {
    const r = val(0, 'e'),
      rd = val(0, 'd1'),
      rdd = val(0, 'd2'),
      ph = val(1, 'e'),
      phd = val(1, 'd1'),
      phdd = val(1, 'd2');
    const vr = rd,
      vphi = r * phd,
      ar = rdd - r * phd * phd,
      aphi = r * phdd + 2 * rd * phd;
    polar = { r, phi: ph, vr: clean(vr), vphi: clean(vphi), ar: clean(ar), aphi: clean(aphi) };
    const c = Math.cos(ph),
      s = Math.sin(ph);
    pos = [r * c, r * s, 0];
    vel = [vr * c - vphi * s, vr * s + vphi * c, 0];
    acc = [ar * c - aphi * s, ar * s + aphi * c, 0];
    v = Math.hypot(vr, vphi);
    at = v > 1e-12 ? (vr * ar + vphi * aphi) / v : 0;
    const cr = Math.abs(vr * aphi - vphi * ar);
    an = v > 1e-12 ? cr / v : Math.hypot(ar, aphi);
    rho = cr > 1e-12 ? v ** 3 / cr : null;
  } else {
    if (pr.mode === 'cyl' || pr.mode === 'sph') {
      const [q, qd, qdd] = (['e', 'd1', 'd2'] as const).map((k) => [0, 1, 2].map((i) => val(i, k))) as [number[], number[], number[]];
      const [r, ph, w] = q,
        [rd, phd, wd] = qd,
        [rdd, phdd, wdd] = qdd;
      const cp = Math.cos(ph),
        sp = Math.sin(ph);
      // Орты системы в декартовых осях: e_r, e_φ и третий (e_z или e_θ).
      let er: number[], ep: number[], e3: number[], cv: [number, number, number], ca: [number, number, number];
      if (pr.mode === 'cyl') {
        er = [cp, sp, 0];
        ep = [-sp, cp, 0];
        e3 = [0, 0, 1];
        cv = [rd, r * phd, wd];
        ca = [rdd - r * phd * phd, r * phdd + 2 * rd * phd, wdd];
        pos = [r * cp, r * sp, w];
      } else {
        const ct = Math.cos(w),
          st = Math.sin(w);
        er = [ct * cp, ct * sp, st];
        ep = [-sp, cp, 0];
        e3 = [-st * cp, -st * sp, ct];
        cv = [rd, r * phd * ct, r * wd];
        ca = [rdd - r * wd * wd - r * phd * phd * ct * ct, (r * phdd + 2 * rd * phd) * ct - 2 * r * phd * wd * st, r * wdd + 2 * rd * wd + r * phd * phd * st * ct];
        pos = [r * ct * cp, r * ct * sp, r * st];
      }
      const toXYZ = (c: number[]) => [0, 1, 2].map((k) => c[0] * er[k] + c[1] * ep[k] + c[2] * e3[k]) as [number, number, number];
      vel = toXYZ(cv);
      acc = toXYZ(ca);
      curv = { q: [r, ph, w], v: cv.map(clean) as [number, number, number], a: ca.map(clean) as [number, number, number] };
    } else {
      pos = [0, 1, 2].map((i) => val(i, 'e')) as [number, number, number];
      vel = [0, 1, 2].map((i) => val(i, 'd1')) as [number, number, number];
      acc = [0, 1, 2].map((i) => val(i, 'd2')) as [number, number, number];
    }
    v = Math.hypot(...vel);
    at = v > 1e-12 ? (vel[0] * acc[0] + vel[1] * acc[1] + vel[2] * acc[2]) / v : 0;
    const cr = Math.hypot(vel[1] * acc[2] - vel[2] * acc[1], vel[2] * acc[0] - vel[0] * acc[2], vel[0] * acc[1] - vel[1] * acc[0]);
    an = v > 1e-12 ? cr / v : 0;
    rho = cr > 1e-12 * Math.max(1, v ** 3) ? v ** 3 / cr : null;
  }
  const a = Math.hypot(at, an);
  if (![...pos, ...vel, ...acc, v, a].every(Number.isFinite)) return { ...empty, errors: [`В момент t = ${t} формулы не определены.`] };
  const angles = (w: [number, number, number], m: number): [number, number, number] | null => (pr.mode === 'natural' || m < 1e-12 ? null : (w.map((c) => (Math.acos(Math.max(-1, Math.min(1, c / m))) * 180) / Math.PI) as [number, number, number]));
  const amag = Math.hypot(...acc);
  return {
    ok: true,
    errors: [],
    f,
    pos: pos.map(clean) as [number, number, number],
    vel: vel.map(clean) as [number, number, number],
    acc: acc.map(clean) as [number, number, number],
    v: clean(v),
    a: clean(a),
    at: clean(at),
    an: clean(an),
    rho,
    polar,
    curv,
    vAngles: angles(vel, v),
    aAngles: angles(acc, amag),
  };
}

/** Отрезок времени для траектории: [t₁; t₂] или, если он не задан, [min(0, t); max(t, 1)]. */
export function trajInterval(pr: KinProblem): [number, number] {
  return pr.t2 > pr.t1 ? [pr.t1, pr.t2] : [Math.min(0, pr.t), Math.max(pr.t, 1)];
}

/** Декартовы координаты точки в момент t по формулам способа задания (естественный — не определены). */
export function cartesian(pr: KinProblem, r: KinResult, t: number): [number, number, number] {
  const e = (i: number) => (r.f[i] ? evalExpr(r.f[i].e, t) : 0);
  if (pr.mode === 'polar' || pr.mode === 'cyl') {
    const rr = e(0),
      ph = e(1);
    return [rr * Math.cos(ph), rr * Math.sin(ph), pr.mode === 'cyl' ? e(2) : 0];
  }
  if (pr.mode === 'sph') {
    const rr = e(0),
      ph = e(1),
      th = e(2);
    return [rr * Math.cos(th) * Math.cos(ph), rr * Math.cos(th) * Math.sin(ph), rr * Math.sin(th)];
  }
  return [e(0), e(1), pr.z.trim() ? e(2) : 0];
}

/** Точки траектории на отрезке (в плоскости xy; для естественного способа — не строится). */
export function trajectory(pr: KinProblem, r: KinResult, n = 600): [number, number][] {
  if (!r.ok || pr.mode === 'natural' || pr.mode === 'uni') return [];
  const [ta, tb] = trajInterval(pr);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = ta + ((tb - ta) * i) / n;
    const [x, y] = cartesian(pr, r, t);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y]);
  }
  return out;
}
