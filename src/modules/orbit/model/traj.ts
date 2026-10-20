/**
 * Кеплерово движение, формулы (Мещерский §50–51): эксцентрическая аномалия и уравнение Кеплера, время полёта между
 * точками эллиптической орбиты, средние значения радиуса, скорость через аномалию; граница падения на планету;
 * обратные задачи по элементам; формула Бине (центральная сила по траектории); трасса спутника на вращающейся Земле.
 *
 * Эллипс (e < 1): r = a(1 − e cos E) = p/(1 + e cos ν), tg(ν/2) = √((1+e)/(1−e))·tg(E/2), уравнение Кеплера
 * M = E − e sin E = n·t, n = √(μ/a³); v² = μ(2/r − 1/a) = (μ/a)(1 + e cos E)/(1 − e cos E).
 */
import { diff, evalExpr, parseExpr, simplify, type Expr } from '../../../shared/expr';
import { LM, elementsOf, muOf, type Elements, type Unit } from './orbit';

const rad = (a: number) => (a * Math.PI) / 180;
const deg = (a: number) => (a * 180) / Math.PI;
const TWO_PI = 2 * Math.PI;
/** Угол в [0, 2π). */
const wrap2 = (x: number) => ((x % TWO_PI) + TWO_PI) % TWO_PI;

export type TrajKind = 'point' | 'time' | 'mean' | 'fall' | 'inverse' | 'binet' | 'track' | 'two' | 'flywheel';
export type TrajFly = 'stop' | 'motor' | 'turn';
export type TrajAnom = 'nu' | 'E' | 'M' | 't';
export type TrajInv = 'axes' | 'ecc' | 'sma' | 'mass';

export interface TrajProblem {
  kind: TrajKind;
  unit: Unit;
  muMode: 'mu' | 'planet';
  /** μ в единицах длины³/с². */
  mu: number;
  /** Ускорение силы тяжести на поверхности, м/с². */
  g: number;
  /** Радиус тела, в единицах длины. */
  R: number;
  /** Большая полуось и эксцентриситет. */
  a: number;
  e: number;
  /** Как задана точка: истинная аномалия ν, эксцентрическая E, средняя M (°) или время от перицентра t (с). */
  anom: TrajAnom;
  x1: number;
  x2: number;
  /** Граница падения: расстояние r₀ от центра, угол θ₀ к местному горизонту (°), скорость v₀ (0 — не задана). */
  r0: number;
  th0: number;
  v0: number;
  /** Обратные задачи. */
  inv: TrajInv;
  p: number;
  c: number;
  T: number;
  Hd: number;
  gam: number;
  a1: number;
  T1: number;
  a2: number;
  T2: number;
  /** Формула Бине: r(φ) (в формуле φ обозначено буквой t, радианы), постоянная площадей c, точка φ₁ (°). */
  rphi: string;
  cb: number;
  phi1: number;
  /** Трасса: высота орбиты H, наклонение α (°), период вращения тела Trot, с; число витков. */
  H: number;
  alpha: number;
  Trot: number;
  turns: number;
  /** Задача двух тел (51.1, 51.2, 51.5): массы, кг, гравитационная постоянная f, м³/(кг·с²); относительная орбита — a, e. */
  m1: number;
  m2: number;
  fG: number;
  /** Вращение аппарата маховиком (51.9–51.12): моменты инерции маховика J и аппарата с маховиком J₀, кг·м²; Ω₀, рад/с; M₀, Н·м; κ, Н·м·с; постоянная времени Tc, с; u₀, рад/с²; угол поворота ψ, °. */
  fw: TrajFly;
  Jf: number;
  J0: number;
  Om0: number;
  M0: number;
  kap: number;
  Tc: number;
  u0: number;
  psi: number;
}

/** Точка эллипса. */
export interface TrajPoint {
  E: number;
  nu: number;
  M: number;
  /** Время от перицентра, с. */
  t: number;
  r: number;
  v: number;
  vr: number;
  vt: number;
  /** Угол скорости с местным горизонтом, °. */
  gamma: number;
  /** Положение и скорость в системе с осью x в перицентре. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Число итераций уравнения Кеплера (0, если E задана или найдена по ν). */
  iters: number;
}

export interface TrajResult {
  ok: boolean;
  errors: string[];
  notes: string[];
  mu: number;
  /** Эллипс. */
  a: number;
  e: number;
  b: number;
  p: number;
  T: number;
  n: number;
  rp: number;
  ra: number;
  vp: number;
  va: number;
  pts: TrajPoint[];
  /** Время пролёта между двумя точками: вперёд по движению и остаток периода. */
  dt: number | null;
  dtRest: number | null;
  /** Средние: по времени, по углу, по эксцентрической аномалии. */
  mean: { t: number; phi: number; E: number; inv: number } | null;
  /** Точки с особыми свойствами (50.32, 50.34). */
  special: { vgeo: number; gammaMax: number; Eg: number; nug: number } | null;
  fall: FallResult | null;
  inverse: InverseResult | null;
  binet: BinetResult | null;
  track: TrackResult | null;
  two: TwoResult | null;
  fly: FlyResult | null;
}

export interface TwoResult {
  /** μ = f(m₁ + m₂) относительного движения; параметры движения каждой точки относительно центра масс. */
  mu: number;
  mu1: number;
  mu2: number;
  T: number;
  a1: number;
  a2: number;
  /** T движения точки 1 относительно центра масс по её μ₁ (должно совпасть с T). */
  T1: number;
  /** Период при μ = f·m₁ (без учёта движения центра): T_f и отношение T/T_f = √(m₁/(m₁ + m₂)). */
  Tc: number;
  ratio: number;
}
export interface FlyResult {
  kind: TrajFly;
  /** Угловая скорость маховика относительно аппарата в конце торможения, рад/с; работа двигателя, Дж. */
  omF: number;
  A: number;
  K: number;
  E0: number;
  /** motor */
  alpha?: number;
  Mmin?: number;
  ok?: boolean;
  T?: number;
  psi?: number;
  omMax?: number;
  /** turn */
  tau?: number;
  t1?: number;
  t2?: number;
  tTotal?: number;
  omPeak?: number;
}

export interface FallResult {
  r0: number;
  R: number;
  /** Угол конуса от направления на центр: sin δ = R/r₀, ° и граничный угол θ к горизонту, °. */
  delta: number;
  thCone: number;
  vc: number;
  vpar: number;
  /** Направление скорости внутри конуса (падение при любой скорости). */
  inside: boolean;
  /** Граничная скорость 50.25: при v₀ ≥ vcrit траектория не пересекает поверхность (направление вне конуса). */
  vcrit: number | null;
  /** Результат проверки заданной скорости. */
  el: Elements | null;
  hits: boolean | null;
}
export interface InverseResult {
  /** axes */
  a?: number;
  b?: number;
  T?: number;
  mu?: number;
  /** ecc */
  e?: number;
  aNeed?: number;
  /** sma */
  rpNeed?: number;
  raNeed?: number;
  /** mass */
  ratio?: number;
  lines: string[];
}
export interface BinetResult {
  /** Значения по φ (°): r, u = 1/r, ускорение a_r = −c²u²(u″ + u), скорость, a_r·r². */
  rows: { phi: number; r: number; ar: number; v: number; k: number }[];
  at: { phi: number; r: number; u: number; du: number; ddu: number; ar: number; ap: number; v: number; vr: number; vt: number; n: number | null };
  /** a_r·r² одно и то же вдоль траектории — сила обратно пропорциональна квадрату расстояния. */
  inverseSquare: boolean;
  /** Показатель n в a_r ∝ rⁿ, если закон степенной по всей траектории. */
  power: number | null;
  mu: number | null;
  /** Выражение для r(φ) в виде текста (формула с φ). */
  expr: Expr;
  uExpr: Expr;
}
export interface TrackResult {
  r: number;
  n: number;
  T: number;
  Om: number;
  k: number;
  /** Угол пересечения трассы с экватором, °, и тот же по формуле книги со знаком «+» (верна для орбиты против вращения; при α > 90° — через α′ = 180° − α). */
  beta: number;
  betaBook: number | null;
  /** Сдвиг трассы за виток к западу, °. */
  shift: number;
  /** Широта и долгота подспутниковой точки по виткам. */
  pts: { t: number; lat: number; lon: number }[];
  lat: number;
  geo: boolean;
  vTrack: number;
}

/* ---------- анома́лии и уравнение Кеплера ---------- */

/** Эксцентрическая аномалия по средней: E − e sin E = M. Возвращает E ∈ (−π, π] и число итераций. */
export function keplerE(M: number, e: number): { E: number; iters: number } {
  let m = M % TWO_PI;
  if (m > Math.PI) m -= TWO_PI;
  if (m <= -Math.PI) m += TWO_PI;
  if (e === 0) return { E: m, iters: 0 };
  let E = e < 0.8 ? m : m >= 0 ? Math.PI : -Math.PI;
  let i = 0;
  for (; i < 100; i++) {
    const f = E - e * Math.sin(E) - m;
    const d = 1 - e * Math.cos(E);
    const dE = f / d;
    E -= dE;
    if (Math.abs(dE) < 1e-15) {
      i++;
      break;
    }
  }
  return { E, iters: i };
}
export const nuOfE = (E: number, e: number) => 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
export const eOfNu = (nu: number, e: number) => 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));

/** Все величины в точке эллипса по эксцентрической аномалии. */
export function pointOfE(mu: number, a: number, e: number, E: number, iters = 0): TrajPoint {
  const p = a * (1 - e * e);
  const nu = nuOfE(E, e);
  const r = a * (1 - e * Math.cos(E));
  const M = E - e * Math.sin(E);
  const n = Math.sqrt(mu / (a * a * a));
  const k = Math.sqrt(mu / p);
  const vr = k * e * Math.sin(nu),
    vt = k * (1 + e * Math.cos(nu));
  return {
    E,
    nu,
    M,
    t: M / n,
    r,
    v: Math.hypot(vr, vt),
    vr,
    vt,
    gamma: deg(Math.atan2(vr, vt)),
    x: r * Math.cos(nu),
    y: r * Math.sin(nu),
    vx: -k * Math.sin(nu),
    vy: k * (e + Math.cos(nu)),
    iters,
  };
}
/** Точка по заданной аномалии: ν, E, M в радианах, t в секундах. */
export function pointOf(mu: number, a: number, e: number, kind: TrajAnom, x: number): TrajPoint {
  const n = Math.sqrt(mu / (a * a * a));
  if (kind === 'E') return pointOfE(mu, a, e, x);
  if (kind === 'nu') return pointOfE(mu, a, e, eOfNu(x, e));
  const M = kind === 't' ? n * x : x;
  const k = keplerE(M, e);
  return pointOfE(mu, a, e, k.E, k.iters);
}

/* ---------- формула Бине ---------- */

/**
 * Центральная сила по траектории r(φ): a_r = −c²u²(u″ + u), u = 1/r; скорость v² = c²(u² + u′²); a_φ = 0.
 * Производные по φ — символьно (формула r(φ), φ в радианах обозначена буквой t).
 */
export function solveBinet(src: string, c: number, phi1Deg: number): BinetResult | string {
  const pr = parseExpr(src.replace(/φ|phi/gi, 't'));
  if (!pr.ok) return `формула r(φ): ${pr.error}`;
  const r = pr.e;
  // u = 1/r; производные — по формуле дроби: u′ = −r′/r², u″ = (2r′² − r·r″)/r³.
  const r1 = simplify(diff(r)),
    r2 = simplify(diff(r1));
  const R = (x: number) => evalExpr(r, x),
    R1 = (x: number) => evalExpr(r1, x),
    R2 = (x: number) => evalExpr(r2, x);
  const at = (phi: number) => {
    const rr = R(phi),
      d1 = R1(phi),
      d2 = R2(phi);
    const u = 1 / rr,
      du = -d1 / (rr * rr),
      ddu = (2 * d1 * d1 - rr * d2) / (rr * rr * rr);
    const ar = -c * c * u * u * (ddu + u);
    const v = Math.abs(c) * Math.sqrt(u * u + du * du);
    const vt = c * u,
      vr = -c * du; // dr/dt = −c·u′ (r = 1/u, dφ/dt = c u²)
    return { phi: deg(phi), r: rr, u, du, ddu, ar, ap: 0, v, vr, vt, k: ar * rr * rr };
  };
  const p1 = at(rad(phi1Deg));
  if (!(p1.r > 0) || !Number.isFinite(p1.ar)) return 'в точке φ₁ радиус не определён или не положителен';
  // Таблица по четвертям оборота вокруг φ₁ и проверка закона.
  const rows: { phi: number; r: number; ar: number; v: number; k: number }[] = [];
  const base = rad(phi1Deg);
  for (let i = 0; i < 12; i++) {
    const q = at(base + (i * Math.PI) / 6 - Math.PI / 3);
    if (q.r > 0 && Number.isFinite(q.ar) && Math.abs(q.r) < 1e300) rows.push({ phi: q.phi, r: q.r, ar: q.ar, v: q.v, k: q.k });
  }
  let inverseSquare = rows.length >= 3;
  for (const q of rows) if (Math.abs(q.k - p1.k) > 1e-7 * Math.max(Math.abs(p1.k), 1e-300)) inverseSquare = false;
  // Степенной закон a_r = K·rⁿ: показатель по двум разным r (логарифмическая производная), проверка по остальным.
  let power: number | null = null;
  const distinct = rows.filter((q) => Math.abs(q.r - p1.r) > 1e-6 * p1.r && q.ar * p1.ar > 0);
  if (distinct.length) {
    const q = distinct[0];
    const nn = Math.log(q.ar / p1.ar) / Math.log(q.r / p1.r);
    const K = p1.ar / p1.r ** nn;
    if (rows.every((w) => Math.abs(w.ar - K * w.r ** nn) <= 1e-6 * Math.abs(w.ar))) power = nn;
  } else if (rows.length && rows.every((q) => Math.abs(q.r - p1.r) <= 1e-9 * p1.r)) power = null;
  const uExpr: Expr = { k: 'div', a: { k: 'num', v: 1 }, b: r };
  return {
    rows,
    at: { phi: p1.phi, r: p1.r, u: p1.u, du: p1.du, ddu: p1.ddu, ar: p1.ar, ap: 0, v: p1.v, vr: p1.vr, vt: p1.vt, n: power },
    inverseSquare,
    power,
    mu: inverseSquare ? -p1.k : null,
    expr: r,
    uExpr,
  };
}

/* ---------- решение ---------- */

const NAN_TRAJ = (errors: string[], mu = NaN): TrajResult => ({
  ok: false,
  errors,
  notes: [],
  mu,
  a: NaN,
  e: NaN,
  b: NaN,
  p: NaN,
  T: NaN,
  n: NaN,
  rp: NaN,
  ra: NaN,
  vp: NaN,
  va: NaN,
  pts: [],
  dt: null,
  dtRest: null,
  mean: null,
  special: null,
  fall: null,
  inverse: null,
  binet: null,
  track: null,
  two: null,
  fly: null,
});

export function solveTraj(pr: TrajProblem): TrajResult {
  const errors: string[] = [];
  const mu = muOf(pr);
  const finite = (...xs: number[]) => xs.every(Number.isFinite);
  if (pr.kind !== 'binet' && pr.kind !== 'two' && pr.kind !== 'flywheel' && !(pr.kind === 'inverse' && (pr.inv === 'axes' || pr.inv === 'mass')) && !(mu > 0))
    errors.push(pr.muMode === 'planet' ? 'нужны g > 0 и R > 0' : 'гравитационный параметр μ должен быть положительным');
  const res = NAN_TRAJ(errors, mu);
  const fin = (): TrajResult => ({ ...res, ok: res.errors.length === 0 });
  const k = pr.kind;

  if (k === 'point' || k === 'time' || k === 'mean') {
    if (!(pr.a > 0)) res.errors.push('большая полуось a должна быть положительной');
    if (!(pr.e >= 0 && pr.e < 1)) res.errors.push('эксцентриситет эллипса: 0 ≤ e < 1');
    if (res.errors.length) return fin();
    const { a, e } = pr;
    res.a = a;
    res.e = e;
    res.b = a * Math.sqrt(1 - e * e);
    res.p = a * (1 - e * e);
    res.n = Math.sqrt(mu / (a * a * a));
    res.T = TWO_PI / res.n;
    res.rp = a * (1 - e);
    res.ra = a * (1 + e);
    res.vp = Math.sqrt((mu / a) * ((1 + e) / (1 - e)));
    res.va = Math.sqrt((mu / a) * ((1 - e) / (1 + e)));
    if (pr.R > 0 && res.rp < pr.R) res.notes.push('перицентр ниже поверхности тела: орбита пересекает его');
    const conv = (x: number) => (pr.anom === 't' ? x : rad(x));
    if (k === 'point') {
      res.pts = [pointOf(mu, a, e, pr.anom, conv(pr.x1))];
      const eg = Math.PI / 2;
      const pg = pointOfE(mu, a, e, eg);
      res.special = { vgeo: Math.sqrt(res.vp * res.va), gammaMax: deg(Math.asin(e)), Eg: 90, nug: deg(pg.nu) };
    } else if (k === 'time') {
      if (pr.anom === 't') {
        res.errors.push('для времени пролёта точки задаются аномалиями ν, E или M');
        return fin();
      }
      const p1 = pointOf(mu, a, e, pr.anom, rad(pr.x1)),
        p2 = pointOf(mu, a, e, pr.anom, rad(pr.x2));
      res.pts = [p1, p2];
      const dM = wrap2(p2.M - p1.M);
      res.dt = dM / res.n;
      res.dtRest = res.T - res.dt;
    } else {
      res.mean = { t: a * (1 + (e * e) / 2), phi: res.b, E: a, inv: 1 / a };
      res.pts = [pointOfE(mu, a, e, 0), pointOfE(mu, a, e, Math.PI)];
    }
    return fin();
  }

  if (k === 'fall') {
    const { r0, R } = pr;
    if (!(R > 0)) res.errors.push('радиус тела R должен быть положительным');
    if (!(r0 > R)) res.errors.push('расстояние r₀ должно быть больше радиуса тела');
    if (!finite(pr.th0, pr.v0) || pr.v0 < 0) res.errors.push('скорость v₀ — неотрицательное число (0 — не задана)');
    if (res.errors.length) return fin();
    const thCone = deg(Math.acos(R / r0));
    const cth = Math.cos(rad(pr.th0));
    const inside = pr.th0 < 0 && r0 * cth <= R;
    const vc = Math.sqrt(mu / r0);
    let vcrit: number | null = null;
    if (!inside && r0 * cth > R) {
      // Перицентр r_п = R: c = r₀v₀cos θ₀, v₀² − 2μ/r₀ = c²/R² − 2μ/R.
      vcrit = Math.sqrt((2 * mu * R * (r0 - R)) / (r0 * ((r0 * cth) ** 2 - R * R)));
    }
    let el: Elements | null = null;
    let hits: boolean | null = null;
    if (pr.v0 > 0) {
      el = elementsOf(mu, r0, pr.v0, pr.th0, 0, R);
      hits = el.hit != null;
    }
    res.fall = { r0, R, delta: deg(Math.asin(R / r0)), thCone, vc, vpar: Math.SQRT2 * vc, inside, vcrit, el, hits };
    return fin();
  }

  if (k === 'inverse') {
    const lines: string[] = [];
    const out: InverseResult = { lines };
    if (pr.inv === 'axes') {
      if (!(pr.p > 0) || !(pr.e >= 0 && pr.e < 1) || !(pr.c > 0)) res.errors.push('нужны p > 0, 0 ≤ e < 1, c > 0');
      if (res.errors.length) return fin();
      out.a = pr.p / (1 - pr.e * pr.e);
      out.b = pr.p / Math.sqrt(1 - pr.e * pr.e);
      out.T = (TWO_PI * out.a * out.b) / pr.c;
      out.mu = (pr.c * pr.c) / pr.p;
    } else if (pr.inv === 'ecc') {
      if (!(pr.T > 0) || !(pr.Hd >= 0)) res.errors.push('нужны T > 0 и H ≥ 0');
      if (res.errors.length) return fin();
      out.aNeed = Math.cbrt((mu * pr.T * pr.T) / (4 * Math.PI * Math.PI));
      out.e = pr.Hd / (2 * out.aNeed);
      if (out.e >= 1) res.errors.push('H ≥ 2a: такой орбиты нет (e ≥ 1)');
    } else if (pr.inv === 'sma') {
      if (!(pr.R > 0) || !(pr.e >= 0 && pr.e < 1) || !(pr.gam >= 0 && pr.gam < 1)) res.errors.push('нужны R > 0, 0 ≤ e < 1, 0 ≤ γ < 1');
      if (res.errors.length) return fin();
      const den = 1 - pr.e - pr.gam * (1 + pr.e);
      if (!(den > 0)) res.errors.push('при таких e и γ перигей выше апогея или орбита уходит под поверхность: γ(1 + e) должно быть меньше 1 − e');
      else {
        out.aNeed = (pr.R * (1 - pr.gam)) / den;
        out.rpNeed = out.aNeed * (1 - pr.e);
        out.raNeed = out.aNeed * (1 + pr.e);
      }
    } else {
      if (!(pr.a1 > 0 && pr.a2 > 0 && pr.T1 > 0 && pr.T2 > 0)) res.errors.push('нужны положительные a₁, T₁, a₂, T₂');
      if (res.errors.length) return fin();
      out.ratio = (pr.a1 / pr.a2) ** 3 * (pr.T2 / pr.T1) ** 2;
    }
    res.inverse = out;
    return fin();
  }

  if (k === 'binet') {
    if (!(pr.cb !== 0) || !Number.isFinite(pr.cb)) res.errors.push('постоянная площадей c не должна быть нулевой');
    if (!Number.isFinite(pr.phi1)) res.errors.push('угол φ₁ — число');
    if (res.errors.length) return fin();
    const b = solveBinet(pr.rphi, pr.cb, pr.phi1);
    if (typeof b === 'string') res.errors.push(b);
    else res.binet = b;
    return fin();
  }

  if (k === 'two') {
    if (!(pr.m1 > 0 && pr.m2 > 0)) res.errors.push('массы m₁ и m₂ должны быть положительными');
    if (!(pr.fG > 0)) res.errors.push('гравитационная постоянная f должна быть положительной');
    if (!(pr.a > 0)) res.errors.push('большая полуось a относительной орбиты должна быть положительной');
    if (!(pr.e >= 0 && pr.e < 1)) res.errors.push('эксцентриситет эллипса: 0 ≤ e < 1');
    if (res.errors.length) return fin();
    const l3 = LM[pr.unit] ** 3,
      Mt = pr.m1 + pr.m2;
    const muRel = (pr.fG * Mt) / l3;
    const mu1 = (pr.fG * pr.m2 ** 3) / (Mt * Mt) / l3,
      mu2 = (pr.fG * pr.m1 ** 3) / (Mt * Mt) / l3;
    const a1 = (pr.a * pr.m2) / Mt,
      a2 = (pr.a * pr.m1) / Mt;
    const T = TWO_PI * Math.sqrt(pr.a ** 3 / muRel);
    const Tc = TWO_PI * Math.sqrt(pr.a ** 3 / ((pr.fG * pr.m1) / l3));
    res.mu = muRel;
    res.a = pr.a;
    res.e = pr.e;
    res.T = T;
    res.two = { mu: muRel, mu1, mu2, T, a1, a2, T1: TWO_PI * Math.sqrt(a1 ** 3 / mu1), Tc, ratio: T / Tc };
    return fin();
  }

  if (k === 'flywheel') {
    const { Jf, J0, Om0 } = pr;
    if (!(Jf > 0) || !(J0 > Jf)) res.errors.push('нужны J > 0 и J₀ > J (J₀ — момент инерции аппарата вместе с маховиком)');
    if (!(Om0 > 0 || pr.fw === 'turn')) res.errors.push('начальная угловая скорость Ω₀ должна быть положительной');
    if (pr.fw === 'motor' && !(pr.M0 > 0 && pr.kap > 0)) res.errors.push('нужны M₀ > 0 и κ > 0');
    if (pr.fw === 'turn' && !(pr.Tc > 0 && pr.u0 > 0 && pr.psi > 0)) res.errors.push('нужны T > 0, u₀ > 0 и угол поворота ψ > 0');
    if (res.errors.length) return fin();
    const K = J0 * Om0;
    const omF = K / Jf;
    const fly: FlyResult = { kind: pr.fw, omF, K, E0: 0.5 * J0 * Om0 * Om0, A: (0.5 * J0 * (J0 - Jf) * Om0 * Om0) / Jf };
    if (pr.fw === 'motor') {
      const al = (pr.kap * J0) / (Jf * (J0 - Jf));
      const Mmin = al * (J0 - Jf) * Om0;
      fly.alpha = al;
      fly.Mmin = Mmin;
      fly.omMax = pr.M0 / pr.kap;
      fly.ok = pr.M0 > Mmin;
      if (fly.ok) {
        const lg = Math.log(pr.M0 / (pr.M0 - Mmin));
        fly.T = lg / al;
        fly.psi = Om0 / al - ((pr.M0 - Mmin) / (al * al * (J0 - Jf))) * lg;
      } else res.notes.push('M₀ ≤ α(J₀ − J)Ω₀: момент двигателя недостаточен — аппарат не остановится за конечное время');
    } else if (pr.fw === 'turn') {
      const phi = rad(pr.psi);
      const tau = (phi * J0) / (Jf * pr.Tc * pr.u0);
      const w = Math.log(1 + Math.sqrt(1 - Math.exp(-tau / pr.Tc)));
      const t1 = tau + pr.Tc * w;
      fly.tau = tau;
      fly.t1 = t1;
      fly.t2 = pr.Tc * w;
      fly.tTotal = t1 + pr.Tc * w;
      fly.omPeak = pr.Tc * pr.u0 * (1 - Math.exp(-t1 / pr.Tc));
      fly.omF = 0;
    }
    res.fly = fly;
    return fin();
  }

  // track
  {
    const { R } = pr;
    if (!(pr.H >= 0) || !(R > 0)) res.errors.push('нужны R > 0 и H ≥ 0');
    if (!(pr.alpha >= 0 && pr.alpha <= 180)) res.errors.push('наклонение α — от 0° до 180°');
    if (!(pr.Trot > 0)) res.errors.push('период вращения тела Trot должен быть положительным');
    if (!(pr.turns >= 1 && pr.turns <= 200)) res.errors.push('число витков — от 1 до 200');
    if (res.errors.length) return fin();
    const r = R + pr.H;
    const n = Math.sqrt(mu / (r * r * r)),
      Om = TWO_PI / pr.Trot;
    const al = rad(pr.alpha),
      kk = Om / n;
    const sa = Math.sin(al),
      ca = Math.cos(al);
    const geo = Math.abs(sa) < 1e-12 && Math.abs(ca - kk) < 1e-3;
    const beta = deg(Math.atan2(sa, ca - kk));
    // Формула книги — со знаком «+» перед Ω√(r³/μ); она верна для орбиты против вращения (α > 90°: берётся α′ = 180° − α).
    const betaBook = Math.abs(sa) < 1e-12 ? null : ca < 0 ? 180 - deg(Math.atan2(sa, -ca + kk)) : deg(Math.atan2(sa, ca + kk));
    const T = TWO_PI / n;
    const pts: TrackResult['pts'] = [];
    const total = pr.turns * T;
    const N = Math.min(4000, Math.max(120, Math.round(pr.turns * 180)));
    for (let i = 0; i <= N; i++) {
      const t = (total * i) / N;
      const u = n * t;
      const lat = deg(Math.asin(Math.max(-1, Math.min(1, sa * Math.sin(u)))));
      let lon = deg(Math.atan2(ca * Math.sin(u), Math.cos(u)) - Om * t);
      lon = ((((lon + 180) % 360) + 360) % 360) - 180;
      pts.push({ t, lat, lon });
    }
    res.track = {
      r,
      n,
      T,
      Om,
      k: kk,
      beta,
      betaBook,
      shift: deg(Om * T),
      pts,
      lat: Math.min(pr.alpha, 180 - pr.alpha),
      geo,
      vTrack: r * Math.hypot(n * ca - Om, n * sa),
    };
    if (kk > 1) res.notes.push('Ω > n: орбита выше синхронной — спутник движется по небу медленнее вращения тела, трасса идёт на запад');
    return fin();
  }
}
