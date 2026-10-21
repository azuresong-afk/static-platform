/**
 * Движение в поле тяготения (Мещерский §28, 30, 50, 51).
 *
 * Небесное тело: гравитационный параметр μ = gR² (μ = fM), первая и вторая космические скорости v₁ = √(μ/r),
 * v₂ = √2·v₁, период круговой орбиты 2πr/v₁, стационарная орбита r³ = μT²/(4π²), работа на выход на орбиту.
 * Орбита в поле F = mμ/r²: интеграл площадей c = r·v·cos θ (θ — угол скорости с местным горизонтом), интеграл
 * энергии h = v² − 2μ/r, параметр p = c²/μ, эксцентриситет e = √(1 + c²h/μ²), истинная аномалия начальной точки
 * (e cos ν = p/r − 1, e sin ν = p·v_r/c), полуоси, период T = 2π√(a³/μ), апсиды и скорости в них. Траектория
 * r = p/(1 + e cos(φ − ε)). Импульс скорости в начальной точке — новая орбита; обратная задача — импульс для заданного
 * апоцентра, перицентра или скорости на бесконечности. Центральная сила произвольного вида a_r(r) — численно.
 * Прямолинейное движение по линии центров: притяжение или отталкивание ∝ 1/x², второй центр, постоянное ускорение;
 * интеграл энергии v² = v₀² + 2(U(x₀) − U(x)), время — численным интегрированием.
 */
import { evalExpr, parseExpr, type Expr } from '../../../shared/expr';

export type Unit = 'km' | 'm' | 'cm';
/** Метров в единице длины. */
export const LM: Record<Unit, number> = { km: 1000, m: 1, cm: 0.01 };
const rad = (a: number) => (a * Math.PI) / 180;
const deg = (a: number) => (a * 180) / Math.PI;
const TWO_PI = 2 * Math.PI;

/* ---------- небесное тело ---------- */

/** Земля и отношения масс и радиусов (Мещерский 50.2). */
export const EARTH = { R: 6370, g: 9.81 };
export const BODIES = {
  earth: { name: 'Земля', mass: 1, radius: 1 },
  moon: { name: 'Луна', mass: 0.0123, radius: 0.273 },
  venus: { name: 'Венера', mass: 0.814, radius: 0.958 },
  mars: { name: 'Марс', mass: 0.107, radius: 0.535 },
  jupiter: { name: 'Юпитер', mass: 317, radius: 10.95 },
} as const;
export type BodyKey = keyof typeof BODIES;
export interface PlanetProblem {
  body: BodyKey | 'ratio' | 'custom';
  /** Своё тело: g (м/с²) и R (км); или отношения массы и радиуса к земным. */
  g: number;
  R: number;
  mRatio: number;
  rRatio: number;
  /** Высота круговой орбиты, км; период вращения тела, с (0 — не считать); вес аппарата для работы (0 — не считать). */
  H: number;
  Trot: number;
  G: number;
}
export interface PlanetResult {
  ok: boolean;
  errors: string[];
  name: string;
  mu: number;
  g: number;
  R: number;
  v1: number;
  T1: number;
  v2: number;
  /** На высоте H: круговая скорость, период, параболическая скорость. */
  vc: number;
  Tc: number;
  vp: number;
  /** Стационарная орбита: радиус и высота. */
  rs: number | null;
  Hs: number | null;
  /** Работа на выход на круговую орбиту высоты H и на параболическую скорость (вес × км). */
  A1: number;
  A2: number;
}

export function solvePlanet(pr: PlanetProblem): PlanetResult {
  const errors: string[] = [];
  let g: number, R: number, name: string;
  if (pr.body === 'custom') {
    g = pr.g;
    R = pr.R;
    name = 'небесное тело';
  } else {
    const b = pr.body === 'ratio' ? { name: 'небесное тело', mass: pr.mRatio, radius: pr.rRatio } : BODIES[pr.body];
    if (!(b.mass > 0) || !(b.radius > 0)) errors.push('Отношения массы и радиуса к земным — положительные числа.');
    R = EARTH.R * b.radius;
    g = (EARTH.g * b.mass) / b.radius ** 2;
    name = b.name;
  }
  if (!(g > 0)) errors.push('Ускорение силы тяжести g — положительное число.');
  if (!(R > 0)) errors.push('Радиус тела R — положительное число.');
  if (!(pr.H >= 0)) errors.push('Высота орбиты H — неотрицательное число.');
  if (!(pr.Trot >= 0)) errors.push('Период вращения — неотрицательное число (0 — не считать стационарную орбиту).');
  if (!(pr.G >= 0)) errors.push('Вес аппарата — неотрицательное число (0 — не считать работу).');
  const base: PlanetResult = { ok: false, errors, name, mu: 0, g: 0, R: 0, v1: 0, T1: 0, v2: 0, vc: 0, Tc: 0, vp: 0, rs: null, Hs: null, A1: 0, A2: 0 };
  if (errors.length) return base;
  const mu = (g * R * R) / 1000; // км³/с²: g в м/с² = 10⁻³ км/с²
  const v1 = Math.sqrt(mu / R);
  const r = R + pr.H;
  const vc = Math.sqrt(mu / r);
  const rs = pr.Trot > 0 ? Math.cbrt((mu * pr.Trot ** 2) / (4 * Math.PI ** 2)) : null;
  return {
    ...base,
    ok: true,
    errors: [],
    mu,
    g,
    R,
    v1,
    T1: (TWO_PI * R) / v1,
    v2: Math.SQRT2 * v1,
    vc,
    Tc: (TWO_PI * r) / vc,
    vp: Math.SQRT2 * vc,
    rs,
    Hs: rs != null ? rs - R : null,
    A1: (pr.G * R * (R + 2 * pr.H)) / (2 * (R + pr.H)),
    A2: pr.G * R,
  };
}

/* ---------- орбита ---------- */

export interface OrbitProblem {
  unit: Unit;
  force: 'newton' | 'formula';
  /** μ задан или μ = gR² (g в м/с², R в единицах длины); R — радиус тела (0 — тело не учитывается). */
  muMode: 'mu' | 'planet';
  mu: number;
  g: number;
  R: number;
  /** Масса точки — для силы притяжения в апсидах. */
  m: number;
  def: 'state' | 'elements';
  /** Начальное состояние: расстояние от центра, скорость, угол с местным горизонтом, полярный угол, °. */
  r0: number;
  v0: number;
  th0: number;
  ph0: number;
  /** Орбита по элементам: форма и что задаёт масштаб (μ, период или скорость в перицентре). */
  shape: 'apsides' | 'ae' | 'ab' | 'pe';
  e1: number;
  e2: number;
  scale: 'mu' | 'T' | 'vp';
  T: number;
  vp: number;
  man: 'none' | 'impulse' | 'target';
  /** Импульс скорости: вдоль скорости и по радиусу (от центра). */
  dvt: number;
  dvr: number;
  tgtKind: 'tang' | 'rad';
  tgt: 'apo' | 'peri' | 'vinf';
  tgtVal: number;
  /** Скорость на расстоянии r₁ (0 — не считать). */
  r1: number;
  /** Сила-формула: радиальное ускорение a_r(r) (> 0 — от центра) и время интегрирования. */
  ar: string;
  t1: number;
}
export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | 'line';
export interface Elements {
  r: number;
  v: number;
  th: number;
  ph: number;
  c: number;
  h: number;
  p: number;
  e: number;
  /** Направление на перицентр (полярный угол фокальной оси), истинная аномалия начальной точки, °. */
  eps: number;
  nu: number;
  type: ConicType;
  a: number | null;
  b: number | null;
  T: number | null;
  rp: number;
  ra: number | null;
  vpe: number;
  va: number | null;
  vinf: number | null;
  /** Круговая и параболическая скорости на начальном расстоянии. */
  vc: number;
  vpar: number;
  /** Траектория пересекает поверхность тела радиуса R: истинная аномалия точки падения, °. */
  hit: number | null;
}
export interface OrbitSample {
  t: number;
  r: number;
  phi: number;
}
export interface OrbitResult {
  ok: boolean;
  errors: string[];
  notes: string[];
  mu: number;
  orb: Elements | null;
  /** Орбита после импульса и найденный импульс (обратная задача). */
  after: Elements | null;
  dv: { t: number; r: number } | null;
  v1: number | null;
  /** Силы притяжения в перицентре и апоцентре (m·μ/r²). */
  Fp: number | null;
  Fa: number | null;
  /** Сила-формула: конец интегрирования, крайние расстояния, интеграл площадей в начале и в конце, энергия. */
  path: OrbitSample[];
  end: { t: number; r: number; phi: number; v: number; vr: number } | null;
  rmin: number | null;
  rmax: number | null;
  c0: number | null;
  c1: number | null;
  E0: number | null;
  E1: number | null;
  stopped: 'center' | 'away' | null;
  arExpr: Expr | null;
}

export function muOf(pr: { muMode: 'mu' | 'planet'; mu: number; g: number; R: number; unit: Unit }): number {
  return pr.muMode === 'mu' ? pr.mu : (pr.g * pr.R * pr.R) / LM[pr.unit];
}

/** Элементы конического сечения по состоянию (r, v, угол с горизонтом θ, полярный угол φ). */
export function elementsOf(mu: number, r: number, v: number, th: number, ph: number, R = 0): Elements {
  const vt = v * Math.cos(rad(th)),
    vr = v * Math.sin(rad(th));
  const c = r * vt;
  const h = v * v - (2 * mu) / r;
  const p = (c * c) / mu;
  const e = Math.sqrt(Math.max(0, 1 + (c * c * h) / (mu * mu)));
  const ec = p / r - 1,
    es = Math.abs(c) > 1e-300 ? (p * vr) / c : 0;
  let nu = e > 1e-12 ? deg(Math.atan2(es, ec)) : 0;
  if (Math.abs(c) < 1e-300) nu = 0;
  const vc = Math.sqrt(mu / r),
    vpar = Math.SQRT2 * vc;
  const tol = 1e-10;
  let type: ConicType = e < tol ? 'circle' : Math.abs(e - 1) < tol ? 'parabola' : e < 1 ? 'ellipse' : 'hyperbola';
  if (Math.abs(c) < 1e-12 * r * Math.max(v, vc)) type = 'line';
  const rp = p / (1 + e);
  const el: Elements = {
    r,
    v,
    th,
    ph,
    c,
    h,
    p,
    e,
    eps: ph - nu,
    nu,
    type,
    a: null,
    b: null,
    T: null,
    rp,
    ra: null,
    vpe: Math.abs(c) / rp,
    va: null,
    vinf: null,
    vc,
    vpar,
    hit: null,
  };
  if (e < 1 - tol || type === 'circle') {
    const a = p / (1 - e * e);
    el.a = a;
    el.b = a * Math.sqrt(1 - e * e);
    el.T = TWO_PI * Math.sqrt(a ** 3 / mu);
    el.ra = p / (1 - e);
    el.va = Math.abs(c) / el.ra;
  } else if (e > 1 + tol) {
    el.a = p / (e * e - 1);
    el.b = el.a * Math.sqrt(e * e - 1);
    el.vinf = Math.sqrt(h);
  } else el.vinf = 0;
  // Падение: перицентр ниже поверхности, а точка на замкнутой орбите или приближается к телу.
  if (R > 0 && rp < R && r >= R && (el.ra != null || vr < 0)) el.hit = deg(Math.acos(Math.max(-1, Math.min(1, (p / R - 1) / (e || 1e-300)))));
  return el;
}

/** Радиальное ускорение по формуле a_r(r): численное интегрирование в плоскости (Рунге — Кутта с контролем шага). */
function integrateFormula(e: Expr, r0: number, v0: number, th: number, ph: number, t1: number) {
  const acc = (x: number, y: number) => {
    const r = Math.hypot(x, y);
    const a = evalExpr(e, 0, { r });
    return [(a * x) / r, (a * y) / r];
  };
  type Y = [number, number, number, number];
  const f = (y: Y): Y => {
    const [ax, ay] = acc(y[0], y[1]);
    return [y[2], y[3], ax, ay];
  };
  const stepRK = (y: Y, h: number): Y => {
    const k1 = f(y);
    const k2 = f(y.map((c, i) => c + (h / 2) * k1[i]) as Y);
    const k3 = f(y.map((c, i) => c + (h / 2) * k2[i]) as Y);
    const k4 = f(y.map((c, i) => c + h * k3[i]) as Y);
    return y.map((c, i) => c + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as Y;
  };
  const u: [number, number] = [Math.cos(rad(ph)), Math.sin(rad(ph))];
  const vr = v0 * Math.sin(rad(th)),
    vt = v0 * Math.cos(rad(th));
  let y: Y = [r0 * u[0], r0 * u[1], vr * u[0] - vt * u[1], vr * u[1] + vt * u[0]];
  let t = 0,
    h = Math.min(t1 / 200, (1e-3 * r0) / Math.max(1e-12, v0 || 1));
  const path: OrbitSample[] = [{ t: 0, r: r0, phi: ph }];
  let phiPrev = rad(ph);
  let phiAcc = rad(ph);
  let stopped: 'center' | 'away' | null = null;
  /** Расстояния в апсидах (v_r = 0) — уточнены делением шага пополам. */
  const aps: number[] = [];
  const vrOf = (q: Y) => q[0] * q[2] + q[1] * q[3];
  const floor = 1e-14 * Math.max(1, t1);
  let n = 0;
  while (t < t1 && n++ < 400000) {
    if (t + h > t1) h = t1 - t;
    const full = stepRK(y, h);
    const half = stepRK(stepRK(y, h / 2), h / 2);
    const sc = Math.hypot(half[0], half[1]) + 1e-12 * r0,
      sv = Math.hypot(half[2], half[3]) + 1e-12;
    const err = Math.max(Math.hypot(half[0] - full[0], half[1] - full[1]) / sc, Math.hypot(half[2] - full[2], half[3] - full[3]) / sv);
    if (err > 1e-11 && h > floor) {
      h /= 2;
      continue;
    }
    // Шаг упёрся в предел точности у особенности силы в центре.
    if (err > 1e-11 && Math.hypot(y[0], y[1]) < 0.01 * r0) {
      stopped = 'center';
      break;
    }
    if (Math.sign(vrOf(y)) * Math.sign(vrOf(half)) < 0) {
      let lo = 0,
        hi = h;
      const s0 = Math.sign(vrOf(y));
      for (let q = 0; q < 60; q++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(vrOf(stepRK(y, mid))) === s0) lo = mid;
        else hi = mid;
      }
      const ya = stepRK(y, (lo + hi) / 2);
      aps.push(Math.hypot(ya[0], ya[1]));
    }
    y = half;
    t += h;
    const r = Math.hypot(y[0], y[1]);
    const phi = Math.atan2(y[1], y[0]);
    let d = phi - phiPrev;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    phiAcc += d;
    phiPrev = phi;
    path.push({ t, r, phi: deg(phiAcc) });
    if (!Number.isFinite(r) || r < 1e-6 * r0) {
      stopped = 'center';
      break;
    }
    if (r > 1e6 * r0) {
      stopped = 'away';
      break;
    }
    if (err < 1e-13) h *= 1.5;
    h = Math.min(h, t1 / 200);
  }
  const r = Math.hypot(y[0], y[1]);
  const v = Math.hypot(y[2], y[3]);
  const vrEnd = (y[0] * y[2] + y[1] * y[3]) / r;
  const cEnd = y[0] * y[3] - y[1] * y[2];
  return { path, end: { t, r, phi: deg(phiAcc), v, vr: vrEnd }, cEnd, stopped, aps };
}

/** Потенциал на единицу массы U(r) − U(r₀) = −∫ a_r dr (Симпсон). */
function potDiff(e: Expr, r0: number, r: number): number {
  const N = 2000;
  const hh = (r - r0) / N;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    s += w * evalExpr(e, 0, { r: r0 + i * hh });
  }
  return -(s * hh) / 3;
}

export function solveOrbit(pr: OrbitProblem): OrbitResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const base: OrbitResult = {
    ok: false,
    errors,
    notes,
    mu: 0,
    orb: null,
    after: null,
    dv: null,
    v1: null,
    Fp: null,
    Fa: null,
    path: [],
    end: null,
    rmin: null,
    rmax: null,
    c0: null,
    c1: null,
    E0: null,
    E1: null,
    stopped: null,
    arExpr: null,
  };
  if (pr.force === 'formula') {
    const ep = parseExpr(pr.ar, { vars: ['r'] });
    if (!ep.ok) errors.push(`Ускорение a_r(r): ${ep.error}.`);
    if (!(pr.r0 > 0)) errors.push('Начальное расстояние r₀ — положительное число.');
    if (!(pr.t1 > 0)) errors.push('Время t₁ — положительное число.');
    if (errors.length || !ep.ok) return base;
    const I = integrateFormula(ep.e, pr.r0, pr.v0, pr.th0, pr.ph0, pr.t1);
    const rs = [...I.path.map((s) => s.r), ...I.aps];
    const c0 = pr.r0 * pr.v0 * Math.cos(rad(pr.th0));
    const E0 = (pr.v0 * pr.v0) / 2;
    const E1 = (I.end.v * I.end.v) / 2 + potDiff(ep.e, pr.r0, I.end.r);
    if (I.stopped === 'center') notes.push('Точка падает в силовой центр (r → 0) — интегрирование остановлено.');
    if (I.stopped === 'away') notes.push('Точка уходит на бесконечность — интегрирование остановлено.');
    return {
      ...base,
      ok: true,
      errors: [],
      path: I.path,
      end: I.end,
      rmin: Math.min(...rs),
      rmax: Math.max(...rs),
      c0,
      c1: I.cEnd,
      E0,
      E1,
      stopped: I.stopped,
      arExpr: ep.e,
    };
  }
  let mu = muOf(pr);
  if (pr.def === 'state' || pr.scale === 'mu') {
    if (pr.muMode === 'planet' && !(pr.g > 0 && pr.R > 0)) errors.push('Для μ = gR² нужны g > 0 и R > 0.');
    else if (!(mu > 0)) errors.push('Гравитационный параметр μ — положительное число.');
  }
  if (!(pr.R >= 0)) errors.push('Радиус тела R — неотрицательное число.');
  let r0 = pr.r0,
    v0 = pr.v0,
    th0 = pr.th0,
    ph0 = pr.ph0;
  if (pr.def === 'state') {
    if (!(r0 > 0)) errors.push('Начальное расстояние r₀ — положительное число.');
    if (!(v0 >= 0)) errors.push('Скорость v₀ — неотрицательное число.');
  } else {
    // Форма орбиты → перицентр и эксцентриситет.
    let rp = 0,
      e = 0;
    const [x1, x2] = [pr.e1, pr.e2];
    if (pr.shape === 'apsides') {
      if (!(x1 > 0 && x2 >= x1)) errors.push('Апсиды: 0 < r_п ≤ r_а.');
      rp = x1;
      e = (x2 - x1) / (x2 + x1);
    } else if (pr.shape === 'ae') {
      if (!(x1 > 0 && x2 >= 0 && x2 < 1)) errors.push('Эллипс: a > 0, 0 ≤ e < 1.');
      rp = x1 * (1 - x2);
      e = x2;
    } else if (pr.shape === 'ab') {
      if (!(x1 > 0 && x2 > 0 && x2 <= x1)) errors.push('Полуоси: 0 < b ≤ a.');
      e = Math.sqrt(Math.max(0, 1 - (x2 / x1) ** 2));
      rp = x1 * (1 - e);
    } else {
      if (!(x1 > 0 && x2 >= 0)) errors.push('Параметр p > 0, эксцентриситет e ≥ 0.');
      e = x2;
      rp = x1 / (1 + e);
    }
    if (pr.scale === 'T') {
      if (!(pr.T > 0) || e >= 1) errors.push('Период задаётся только для эллиптической орбиты (T > 0).');
      const a = rp / (1 - e);
      mu = (4 * Math.PI ** 2 * a ** 3) / pr.T ** 2;
    } else if (pr.scale === 'vp') {
      if (!(pr.vp > 0)) errors.push('Скорость в перицентре — положительное число.');
      mu = (pr.vp ** 2 * rp) / (1 + e);
    }
    r0 = rp;
    v0 = Math.sqrt((mu * (1 + e)) / rp);
    th0 = 0;
    ph0 = 0;
  }
  if (pr.man === 'target' && !(pr.tgtVal > 0)) errors.push('Целевое значение (апоцентр, перицентр или v∞) — положительное число.');
  if (errors.length) return base;
  const orb = elementsOf(mu, r0, v0, th0, ph0, pr.R);
  if (pr.R > 0 && r0 < pr.R) notes.push('Начальная точка лежит внутри тела радиуса R.');
  const res: OrbitResult = { ...base, ok: true, errors: [], mu, orb };
  if (orb.type !== 'line') {
    res.Fp = (pr.m * mu) / orb.rp ** 2;
    res.Fa = orb.ra != null ? (pr.m * mu) / orb.ra ** 2 : null;
  }
  // Импульс в начальной точке.
  const applied = (dt: number, dr: number): Elements => {
    const vr = v0 * Math.sin(rad(th0)),
      vt = v0 * Math.cos(rad(th0));
    // Единичный вектор скорости в осях (радиальная, трансверсальная).
    const vl = Math.hypot(vr, vt);
    const dir: [number, number] = vl > 0 ? [vr / vl, vt / vl] : [0, 1];
    const nvr = vr + dt * dir[0] + dr,
      nvt = vt + dt * dir[1];
    const nv = Math.hypot(nvr, nvt);
    return elementsOf(mu, r0, nv, deg(Math.atan2(nvr, nvt)), ph0, pr.R);
  };
  if (pr.man === 'impulse') {
    res.after = applied(pr.dvt, pr.dvr);
    res.dv = { t: pr.dvt, r: pr.dvr };
  }
  if (pr.man === 'target') {
    const val = (d: number) => {
      const el = pr.tgtKind === 'tang' ? applied(d, 0) : applied(0, d);
      if (pr.tgt === 'peri') return el.rp;
      if (pr.tgt === 'apo') return el.ra ?? Infinity;
      return el.vinf ?? -1;
    };
    const f = (d: number) => {
      const x = val(d);
      return Number.isFinite(x) ? x - pr.tgtVal : 1e300;
    };
    // Корень, ближайший к нулю: просмотр по обе стороны и деление пополам.
    const span = 4 * Math.max(v0, orb.vc);
    const N = 4000;
    let best: number | null = null;
    for (const s of [1, -1]) {
      let prev = f(0);
      for (let i = 1; i <= N; i++) {
        const d = (s * span * i) / N;
        const cur = f(d);
        if (Math.sign(cur) !== Math.sign(prev) && Number.isFinite(cur) && Number.isFinite(prev)) {
          let lo = (s * span * (i - 1)) / N,
            hi = d;
          for (let q = 0; q < 200; q++) {
            const mid = (lo + hi) / 2;
            if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid;
            else hi = mid;
          }
          const root = (lo + hi) / 2;
          if (Math.abs(f(root)) < 1e-6 * Math.max(1, pr.tgtVal) && (best == null || Math.abs(root) < Math.abs(best))) best = root;
          break;
        }
        prev = cur;
      }
    }
    if (best == null) return { ...base, errors: ['Импульсом этого вида заданное значение не достигается.'] };
    res.dv = pr.tgtKind === 'tang' ? { t: best, r: 0 } : { t: 0, r: best };
    res.after = pr.tgtKind === 'tang' ? applied(best, 0) : applied(0, best);
  }
  if (pr.r1 > 0) res.v1 = speedAt(mu, (res.after ?? orb).h, pr.r1);
  return res;
}

/** Скорость на расстоянии r₁ по интегралу энергии. */
export function speedAt(mu: number, h: number, r1: number): number | null {
  const v2 = h + (2 * mu) / r1;
  return v2 >= 0 ? Math.sqrt(v2) : null;
}

/* ---------- прямолинейное движение ---------- */

export interface RadialProblem {
  unit: Unit;
  /** Центр 1 в начале оси x: μ₁ задан или μ₁ = gR²; притяжение или отталкивание (μ₁ = q₁q₂/m). */
  muMode: 'mu' | 'planet';
  mu1: number;
  g: number;
  R: number;
  repel: boolean;
  /** Второй притягивающий центр на расстоянии d: отношение μ₂/μ₁ (отношение масс). */
  two: boolean;
  k2: number;
  d: number;
  /** Постоянное добавочное ускорение вдоль оси x (+ — от центра 1): тяга, торможение. */
  acc: number;
  /** Начало: из бесконечности со скоростью v∞ (к центру 1) или с расстояния x₀ со скоростью v₀ (+ — от центра 1). */
  fromInf: boolean;
  vinf: number;
  x0: number;
  v0: number;
  /** Что найти: точку остановки, скорость и время в x₁, начальную скорость для x₁, начальное расстояние для остановки в x₁. */
  ask: 'top' | 'at' | 'v0' | 'x0';
  /** Расстояние x₁ (для «начальной скорости» при двух центрах 0 — точка равного притяжения). */
  x1: number;
}
export interface RadialResult {
  ok: boolean;
  errors: string[];
  notes: string[];
  mu1: number;
  mu2: number;
  /** Точка равного притяжения (два центра). */
  xeq: number | null;
  /** Точка остановки (v = 0) и время до неё; уход на бесконечность и v∞. */
  xtop: number | null;
  ttop: number | null;
  escape: boolean;
  vinfOut: number | null;
  /** Скорость и время на расстоянии x₁. */
  v1: number | null;
  t1: number | null;
  /** Найденные начальная скорость и начальное расстояние. */
  v0need: number | null;
  x0need: number | null;
  /** Целевая точка (x₁ или точка равного притяжения). */
  target: number | null;
  /** Удельная механическая энергия E = v²/2 + U(x). */
  E: number | null;
  curve: { t: number; x: number; v: number }[];
}

/** Потенциал U(x) и ускорение a(x) = −U′(x) на единицу массы для прямолинейного движения. */
export function radialField(pr: RadialProblem, mu1: number, mu2: number) {
  const s1 = pr.repel ? -1 : 1;
  return {
    U: (x: number) => (-s1 * mu1) / x - (pr.two ? mu2 / (pr.d - x) : 0) - pr.acc * x,
    a: (x: number) => (-s1 * mu1) / (x * x) + (pr.two ? mu2 / (pr.d - x) ** 2 : 0) + pr.acc,
  };
}

/** Корень f на отрезке (по просмотру из `from` к `to` и делению пополам); `geo` — шаги в геометрической прогрессии. */
function firstRoot(f: (x: number) => number, from: number, to: number, geo = false): number | null {
  const N = 20000;
  let px = from,
    pf = f(from);
  for (let i = 1; i <= N; i++) {
    const x = geo ? from * Math.pow(to / from, i / N) : from + ((to - from) * i) / N;
    const fx = f(x);
    if (!(fx > 0) !== !(pf > 0)) {
      let lo = px,
        hi = x;
      for (let q = 0; q < 200; q++) {
        const mid = (lo + hi) / 2;
        if (!(f(mid) > 0) === !(pf > 0)) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    px = x;
    pf = fx;
  }
  return null;
}

export function solveRadial(pr: RadialProblem): RadialResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const base: RadialResult = {
    ok: false,
    errors,
    notes,
    mu1: 0,
    mu2: 0,
    xeq: null,
    xtop: null,
    ttop: null,
    escape: false,
    vinfOut: null,
    v1: null,
    t1: null,
    v0need: null,
    x0need: null,
    target: null,
    E: null,
    curve: [],
  };
  const mu1 = muOf({ muMode: pr.muMode, mu: pr.mu1, g: pr.g, R: pr.R, unit: pr.unit });
  if (pr.muMode === 'planet' && !(pr.g > 0 && pr.R > 0)) errors.push('Для μ = gR² нужны g > 0 и R > 0.');
  else if (!(mu1 > 0)) errors.push('μ₁ (или q₁q₂/m при отталкивании) — положительное число.');
  if (pr.two && !(pr.k2 > 0 && pr.d > 0)) errors.push('Второй центр: μ₂/μ₁ > 0 и расстояние d > 0.');
  if (pr.fromInf && (pr.two || pr.acc !== 0 || pr.repel))
    errors.push('Начало «из бесконечности» — только для одного притягивающего центра без добавочного ускорения.');
  if (pr.fromInf && pr.ask !== 'at') errors.push('Из бесконечности находится скорость на расстоянии x₁.');
  if (pr.fromInf && !(pr.vinf >= 0)) errors.push('Скорость на бесконечности — неотрицательное число.');
  if (!pr.fromInf && pr.ask !== 'x0') {
    if (!(pr.x0 > 0)) errors.push('Начальное расстояние x₀ — положительное число.');
    else if (pr.two && !(pr.x0 < pr.d)) errors.push('Начальная точка должна быть между центрами (x₀ < d).');
  }
  if (pr.ask === 'at' && !(pr.x1 >= 0)) errors.push('Расстояние x₁ — неотрицательное число.');
  if (pr.ask === 'x0') {
    if (!(pr.x1 > 0)) errors.push('Точка остановки x₁ — положительное число.');
    else if (pr.two && !(pr.x1 < pr.d)) errors.push('Точка остановки должна быть между центрами (x₁ < d).');
    if (pr.v0 === 0) errors.push('Скорость v₀ в момент включения не должна быть нулевой.');
  }
  if (errors.length) return base;
  const mu2 = pr.two ? pr.k2 * mu1 : 0;
  const { U, a } = radialField(pr, mu1, mu2);
  const res: RadialResult = { ...base, ok: true, errors: [], mu1, mu2 };
  if (pr.two) res.xeq = pr.d / (1 + Math.sqrt(pr.k2));
  const far = pr.two ? pr.d : Infinity;
  if (pr.ask === 'v0') {
    const tgt = pr.two && !(pr.x1 > 0) ? res.xeq! : pr.x1;
    if (!(tgt > 0) || (pr.two && !(tgt < pr.d))) return { ...base, errors: ['Укажите x₁ — расстояние, которого нужно достигнуть.'] };
    res.target = tgt;
    // Наибольший потенциальный барьер между x₀ и целью.
    const N = 4000;
    let maxU = -Infinity;
    for (let i = 0; i <= N; i++) maxU = Math.max(maxU, U(pr.x0 + ((tgt - pr.x0) * i) / N));
    const need = 2 * (maxU - U(pr.x0));
    if (maxU > U(tgt) + 1e-9 * Math.abs(U(tgt)))
      notes.push('Между начальной точкой и целью есть более высокий потенциальный барьер — скорость найдена по нему.');
    if (!(need > 0)) notes.push('Точка x₁ достигается и без начальной скорости.');
    res.v0need = Math.sqrt(Math.max(0, need));
    res.E = res.v0need ** 2 / 2 + U(pr.x0);
    return res;
  }
  let x0 = pr.x0;
  const v0 = pr.v0;
  if (pr.ask === 'x0') {
    // E = U(x₁): v₀²/2 + U(x₀) = U(x₁), x₀ — по другую сторону от x₁, откуда точка приходит.
    const F = (x: number) => (v0 * v0) / 2 + U(x) - U(pr.x1);
    const x =
      v0 < 0
        ? firstRoot(F, pr.x1, Number.isFinite(far) ? pr.x1 + (far - pr.x1) * (1 - 1e-12) : pr.x1 * 1e9, !Number.isFinite(far))
        : firstRoot(F, pr.x1, pr.x1 * 1e-12);
    if (x == null) return { ...base, errors: ['Такого начального расстояния нет: скорости v₀ не хватает или её слишком много при любом x₀.'] };
    // Между x₀ и x₁ скорость не должна обращаться в нуль.
    const N = 4000;
    for (let i = 1; i < N; i++) {
      const xi = pr.x1 + ((x - pr.x1) * i) / N;
      if (U(xi) >= U(pr.x1))
        return { ...base, errors: ['Остановиться точно в x₁ нельзя: точка остановится раньше и повернёт назад (сила вблизи x₁ не тормозит её).'] };
    }
    x0 = x;
    res.x0need = x;
  }
  const E = pr.fromInf ? (pr.vinf * pr.vinf) / 2 : (v0 * v0) / 2 + U(x0);
  res.E = E;
  const v2at = (x: number) => 2 * (E - U(x));
  // Направление движения: по скорости, при v₀ = 0 — по силе.
  const dir = pr.fromInf ? -1 : Math.sign(v0) || Math.sign(a(x0)) || 1;
  if (!pr.fromInf) {
    const xt =
      dir < 0
        ? firstRoot(v2at, x0, x0 * 1e-12)
        : Number.isFinite(far)
          ? firstRoot(v2at, x0, x0 + (far - x0) * (1 - 1e-12))
          : firstRoot(v2at, x0, x0 * 1e9, true);
    if (xt != null && Math.abs(xt - x0) > 1e-12 * x0) res.xtop = pr.ask === 'x0' ? pr.x1 : xt;
    else if (dir > 0 && !pr.two && pr.acc === 0) {
      res.escape = true;
      res.vinfOut = Math.sqrt(Math.max(0, 2 * E));
    } else if (pr.ask !== 'at' && dir < 0) notes.push('Точка не останавливается и приходит в центр 1.');
    else if (pr.ask !== 'at' && pr.two) notes.push('Точка не останавливается и приходит во второй центр.');
  }
  let target: number | null = pr.ask === 'at' ? pr.x1 : res.xtop;
  if (pr.ask === 'at') {
    const reach =
      pr.fromInf || (dir < 0 ? pr.x1 < x0 && (res.xtop == null || pr.x1 >= res.xtop) : pr.x1 > x0 && pr.x1 < far && (res.xtop == null || pr.x1 <= res.xtop));
    if (!reach) {
      notes.push('Точка x₁ не достигается при этом движении.');
      return res;
    }
    res.v1 = pr.x1 > 0 ? Math.sqrt(Math.max(0, v2at(pr.x1))) : Infinity;
  }
  // Время — интегрированием x'' = a(x) (Рунге — Кутта с контролем шага) до события.
  if (!pr.fromInf && target != null && Number.isFinite(target)) {
    const isTop = pr.ask !== 'at';
    target = Math.max(target, 1e-9 * x0);
    let t = 0,
      x = x0,
      v = v0;
    let h = 1e-4 * Math.sqrt(x0 ** 3 / mu1);
    const curve = [{ t, x, v }];
    const f = (xx: number, vv: number): [number, number] => [vv, a(xx)];
    const st = (xx: number, vv: number, hh: number): [number, number] => {
      const k1 = f(xx, vv);
      const k2 = f(xx + (hh / 2) * k1[0], vv + (hh / 2) * k1[1]);
      const k3 = f(xx + (hh / 2) * k2[0], vv + (hh / 2) * k2[1]);
      const k4 = f(xx + hh * k3[0], vv + hh * k3[1]);
      return [xx + (hh / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), vv + (hh / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    };
    const tg = target;
    const ev = (xx: number, vv: number) => (isTop ? dir * vv : dir * (tg - xx));
    const vs = Math.abs(v0) + Math.sqrt(mu1 / x0);
    let n = 0;
    while (n++ < 400000) {
      const full = st(x, v, h);
      const half = st(...st(x, v, h / 2), h / 2);
      const err = Math.max(Math.abs(half[0] - full[0]) / (Math.abs(half[0]) + 1e-12 * x0), Math.abs(half[1] - full[1]) / (Math.abs(half[1]) + 1e-9 * vs));
      if (err > 1e-11 && h > 1e-15 * Math.sqrt(x0 ** 3 / mu1)) {
        h /= 2;
        continue;
      }
      if (!half.every(Number.isFinite) || half[0] <= 0 || half[0] >= far) break;
      if (ev(half[0], half[1]) <= 0 && !(isTop && v === 0 && t === 0)) {
        let lo = 0,
          hi = h;
        for (let q = 0; q < 100; q++) {
          const mid = (lo + hi) / 2;
          const ym = st(x, v, mid);
          if (ev(ym[0], ym[1]) > 0) lo = mid;
          else hi = mid;
        }
        t += hi;
        [x, v] = st(x, v, hi);
        curve.push({ t, x, v });
        if (isTop) res.ttop = t;
        else res.t1 = t;
        break;
      }
      [x, v] = half;
      t += h;
      curve.push({ t, x, v });
      if (err < 1e-13) h *= 1.5;
    }
    res.curve = curve;
  }
  return res;
}
