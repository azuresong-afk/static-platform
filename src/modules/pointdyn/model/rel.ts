/**
 * Относительное движение точки в прямой трубке (канале) подвижного тела (Мещерский 33.9–33.14; Яблонский Д.4).
 *
 * Трубка лежит в плоскости чертежа; ось x идёт вдоль трубки от точки O, θ — угол оси x с горизонталью (вправо),
 * против часовой стрелки. Переносное движение тела:
 *  - vert — равномерное вращение вокруг вертикальной оси (ω > 0 — против часовой стрелки при взгляде сверху);
 *    O — на расстоянии r от оси по горизонтали (вправо «+»), плоскость трубки может быть смещена от оси на d
 *    (за чертёж «+»). Расстояние точки от оси в плоскости чертежа X = r + x cos θ.
 *  - horz — равномерное вращение вокруг горизонтальной оси, перпендикулярной чертежу (ω > 0 — против часовой);
 *    x — от основания перпендикуляра из оси на трубку, h — длина перпендикуляра (по нормали к x, повёрнутой на +90°);
 *    угол трубки меняется: θ(t) = θ₀ + ωt.
 *  - trans — поступательное движение: точка тела движется по законам y₁(t) (вправо) и z₁(t) (вверх).
 *
 * Уравнение относительного движения m·a_r = ΣF + Φ_e + Φ_c в проекции на трубку:
 *   vert:  m ẍ = mω²X cos θ − mg sin θ + F;
 *   horz:  m ẍ = mω²x − mg sin θ(t) + F;
 *   trans: m ẍ = −m(ÿ₁ cos θ + z̈₁ sin θ) − mg sin θ + F,
 * F — пружина −c(x − l₀) от точки O, сила-формула F(t, x, v) и трение −f|N|·sign ẋ.
 * Реакция стенки (две составляющие, перпендикулярные трубке): N₁ — в плоскости чертежа (по нормали n = x повёрнутая
 * на +90°), N₂ — перпендикулярно чертежу:
 *   vert:  N₁ = m(g cos θ + ω²X sin θ),       N₂ = m(2ωẋ cos θ − ω²d);
 *   horz:  N₁ = m(g cos θ(t) + 2ωẋ − ω²h),    N₂ = 0;
 *   trans: N₁ = m(g cos θ + z̈₁ cos θ − ÿ₁ sin θ), N₂ = 0.
 * Давление точки на стенку равно реакции и направлено противоположно.
 */
import { diff, evalExpr, parseExpr, simplify, usesVar, type Expr } from '../../../shared/expr';
import { solveEq, type EqResult, type RotEq } from '../../rotation/model/rotation';

export type RelFrame = 'vert' | 'horz' | 'trans';
export interface RelProblem {
  byWeight: boolean;
  m: number;
  g: number;
  frame: RelFrame;
  /** Угловая скорость тела, рад/с. */
  omega: number;
  /** vert: расстояние от оси до точки O по горизонтали; смещение плоскости трубки от оси. */
  r: number;
  d: number;
  /** horz: расстояние от оси до трубки. */
  h: number;
  /** Угол оси x с горизонталью, ° (horz — в начальный момент). */
  theta: number;
  /** trans: законы движения точки тела, м — формулы от t. */
  y1: string;
  z1: string;
  /** Пружина от точки O: −c(x − l₀). */
  c: number;
  l0: number;
  /** Коэффициент трения скольжения о стенку. */
  f: number;
  /** Дополнительная сила вдоль трубки — формула от t, x, v. */
  form?: string;
  x0: number;
  v0: number;
  /** Что ищем: состояние в момент t₁ или когда x = x₁ (например, вылет из трубки). */
  ask: 't' | 'x';
  t1: number;
  x1: number;
}

/** Решение уравнения в замкнутом виде (без трения и силы-формулы): x = x* + C₁·u(kt) + C₂·w(kt) + x_p(t). */
export interface RelClosed {
  /** K в ẍ + Kx = B (+ возмущение); вид однородной части. */
  K: number;
  B: number;
  kind: 'osc' | 'exp' | 'lin';
  k: number;
  xs: number;
  C1: number;
  C2: number;
  /** horz: амплитуда частного решения при −g sin(θ₀ + ωt): x_p = A sin(θ₀ + ωt). */
  A: number;
}
export interface RelState {
  t: number;
  x: number;
  v: number;
  a: number;
  N1: number;
  N2: number;
  N: number;
  /** Составляющие: переносная сила инерции и кориолисова (проекции на x, n, b). */
  Fe: [number, number, number];
  Fc: [number, number, number];
}
export interface RelResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  eq: EqResult | null;
  /** Законы движения тела и их вторые производные (trans). */
  ay: Expr | null;
  az: Expr | null;
  closed: RelClosed | null;
  start: RelState | null;
  end: RelState | null;
  /** Цель x₁ не достигнута (застряла трением или уходит в другую сторону). */
  note: 'ok' | 'never' | 'stuck';
  curve: { t: number; x: number; v: number; N: number }[];
}

const rad = (a: number) => (a * Math.PI) / 180;

export function relModel(pr: RelProblem, ay: Expr | null, az: Expr | null, fe: Expr | null) {
  const mass = pr.byWeight ? pr.m / pr.g : pr.m;
  const w = pr.omega;
  const th = (t: number) => rad(pr.theta) + (pr.frame === 'horz' ? w * t : 0);
  /** Ускорение тела (trans). */
  const acc = (t: number): [number, number] => [ay ? evalExpr(ay, t) : 0, az ? evalExpr(az, t) : 0];
  /** Проекции переносной силы инерции и кориолисовой на x, n (в плоскости), b (из плоскости). */
  const inertia = (t: number, x: number, v: number): { Fe: [number, number, number]; Fc: [number, number, number] } => {
    const a = th(t),
      c = Math.cos(a),
      s = Math.sin(a);
    if (pr.frame === 'vert') {
      const X = pr.r + x * c;
      return { Fe: [mass * w * w * X * c, -mass * w * w * X * s, mass * w * w * pr.d], Fc: [0, 0, -2 * mass * w * v * c] };
    }
    if (pr.frame === 'horz') return { Fe: [mass * w * w * x, mass * w * w * pr.h, 0], Fc: [0, -2 * mass * w * v, 0] };
    const [yy, zz] = acc(t);
    return { Fe: [-mass * (yy * c + zz * s), -mass * (-yy * s + zz * c), 0], Fc: [0, 0, 0] };
  };
  /** Сила тяжести: проекции на x и n. */
  const grav = (t: number): [number, number] => [-mass * pr.g * Math.sin(th(t)), -mass * pr.g * Math.cos(th(t))];
  /** Сила вдоль трубки без трения. */
  const along = (t: number, x: number, v: number) => inertia(t, x, v).Fe[0] + grav(t)[0] - pr.c * (x - pr.l0) + (fe ? evalExpr(fe, t, { x, v }) : 0);
  /** Реакция: составляющие уравновешивают поперечные силы. */
  const react = (t: number, x: number, v: number) => {
    const { Fe, Fc } = inertia(t, x, v);
    const N1 = -(Fe[1] + Fc[1] + grav(t)[1]),
      N2 = -(Fe[2] + Fc[2]);
    return { N1, N2, N: Math.hypot(N1, N2) };
  };
  return { mass, P: mass * pr.g, th, acc, inertia, grav, along, react };
}

export function solveRel(pr: RelProblem): RelResult {
  const errors: string[] = [];
  if (!(pr.m > 0)) errors.push('Масса (вес) точки — положительное число.');
  if (!(pr.g > 0)) errors.push('Ускорение свободного падения g — положительное число.');
  if (pr.c < 0 || pr.f < 0) errors.push('Жёсткость пружины и коэффициент трения не могут быть отрицательными.');
  if (pr.ask === 't' && !(pr.t1 > 0)) errors.push('Время t₁ — положительное число.');
  let ay: Expr | null = null,
    az: Expr | null = null,
    fe: Expr | null = null;
  if (pr.frame === 'trans')
    for (const [k, name] of [
      ['y1', 'y₁(t)'],
      ['z1', 'z₁(t)'],
    ] as const) {
      const src = pr[k].trim();
      if (!src) continue;
      const p = parseExpr(src);
      if (!p.ok) errors.push(`Закон ${name}: ${p.error}`);
      else if (k === 'y1') ay = simplify(diff(diff(p.e)));
      else az = simplify(diff(diff(p.e)));
    }
  if (pr.form?.trim()) {
    const p = parseExpr(pr.form, { vars: ['x', 'v'] });
    if (!p.ok) errors.push(`Сила F(t, x, v): ${p.error}`);
    else fe = p.e;
  }
  const empty: RelResult = { ok: false, errors, mass: 0, P: 0, eq: null, ay, az, closed: null, start: null, end: null, note: 'ok', curve: [] };
  if (errors.length) return empty;
  const md = relModel(pr, ay, az, fe);
  const timeDep = pr.frame !== 'vert' || (!!fe && usesVar(fe, 't'));
  const eq: RotEq = {
    body: { kind: 'J', m: 0, R: 0, J: md.mass },
    loads: [],
    M0: 0,
    at: 0,
    m0: 0,
    p: 0,
    c: 0,
    Pa: 0,
    kv: 0,
    kq: 0,
    Mf: 0,
    phi0: pr.x0,
    omega0: pr.v0,
    ask: pr.ask === 'x' ? 'phi' : 't',
    t: pr.t1,
    omega1: 0,
    phi1: pr.x1,
    tMax:
      20 *
      Math.max(
        pr.omega ? (2 * Math.PI) / Math.abs(pr.omega) : 0,
        pr.c > 0 ? 2 * Math.PI * Math.sqrt(md.mass / pr.c) : 0,
        Math.sqrt((2 * (Math.abs(pr.x0) + Math.abs(pr.x1) + 1)) / pr.g),
        1,
      ),
    extra: {
      f: md.along,
      t: timeDep,
      phi: true,
      w: (pr.frame === 'vert' && pr.f > 0) || (pr.frame === 'horz' && pr.f > 0) || (!!fe && usesVar(fe, 'v')),
      ...(pr.f > 0 ? { fric: (t: number, x: number, v: number) => pr.f * md.react(t, x, v).N } : {}),
    },
  };
  const closed = closedForm(pr, md.mass, fe);
  // Колебания около x* без трения: x₁ вне размаха недостижима — без долгого счёта (кривая — за два периода).
  let unreachable = false;
  if (pr.ask === 'x' && closed?.kind === 'osc' && closed.A === 0) {
    const amp = Math.hypot(closed.C1, closed.C2);
    if (Math.abs(pr.x1 - closed.xs) > amp * (1 + 1e-12) + 1e-15) unreachable = true;
  }
  const r = unreachable ? solveEq({ ...eq, ask: 't', t: (4 * Math.PI) / closed!.k }, false) : solveEq(eq, false);
  if (!r.ok) return { ...empty, errors: r.errors, eq: r, mass: md.mass, P: md.P };
  const state = (t: number, x: number, v: number): RelState => {
    const { N1, N2, N } = md.react(t, x, v);
    const { Fe, Fc } = md.inertia(t, x, v);
    const fr = pr.f > 0 ? (Math.abs(v) > 1e-12 ? -pr.f * N * Math.sign(v) : 0) : 0;
    let a = (md.along(t, x, v) + fr) / md.mass;
    // Покой при трении: ускорение — по условию сцепления.
    if (pr.f > 0 && Math.abs(v) <= 1e-12) {
      const F = md.along(t, x, 0);
      a = Math.abs(F) <= pr.f * N ? 0 : (F - pr.f * N * Math.sign(F)) / md.mass;
    }
    const z = (u: number) => (Math.abs(u) < 1e-13 ? 0 : u);
    return { t, x, v, a: z(a), N1: z(N1), N2: z(N2), N, Fe, Fc };
  };
  const curve = r.curve.map((p) => ({ t: p.t, x: p.phi, v: p.w, N: md.react(p.t, p.phi, p.w).N }));
  const end = state(r.t, r.phi, r.w);
  let note: RelResult['note'] = unreachable ? 'never' : r.note === 'ok' ? 'ok' : r.note === 'stuck' ? 'stuck' : 'never';
  // Трение удерживает точку в покое (и силы от времени не зависят).
  if (note === 'never' && pr.f > 0 && !timeDep && Math.abs(end.v) < 1e-12 && Math.abs(md.along(end.t, end.x, 0)) <= pr.f * end.N) note = 'stuck';
  return {
    ok: true,
    errors: [],
    mass: md.mass,
    P: md.P,
    eq: r,
    ay,
    az,
    closed,
    start: state(0, pr.x0, pr.v0),
    end,
    note,
    curve,
  };
}

/** Замкнутое решение для vert и horz без трения и без силы-формулы (horz — кроме резонанса K = ω²). */
export function closedForm(pr: RelProblem, mass: number, fe: Expr | null): RelClosed | null {
  if (pr.f > 0 || fe || pr.frame === 'trans') return null;
  const w = pr.omega,
    th = rad(pr.theta);
  let K: number,
    B: number,
    A = 0;
  if (pr.frame === 'vert') {
    K = pr.c / mass - w * w * Math.cos(th) ** 2;
    B = w * w * pr.r * Math.cos(th) - pr.g * Math.sin(th) + (pr.c * pr.l0) / mass;
  } else {
    K = pr.c / mass - w * w;
    B = (pr.c * pr.l0) / mass;
    if (w === 0)
      B -= pr.g * Math.sin(th); // тело не вращается: постоянная сила −g sin θ₀
    else {
      // Частное решение для −g sin(θ₀ + ωt): A sin(θ₀ + ωt), (K − ω²)A = −g; при K = ω² — резонанс, только численно.
      const D = K - w * w;
      if (Math.abs(D) < 1e-9 * (Math.abs(K) + w * w)) return null;
      A = -pr.g / D;
    }
  }
  const scale = Math.abs(K) + w * w + pr.c / mass + 1e-300;
  const kind: RelClosed['kind'] = Math.abs(K) <= 1e-12 * scale ? 'lin' : K > 0 ? 'osc' : 'exp';
  const k = kind === 'lin' ? 0 : Math.sqrt(Math.abs(K));
  const xs = kind === 'lin' ? 0 : B / K;
  // Начальные условия за вычетом частного решения.
  const xp0 = A * Math.sin(th),
    vp0 = A * w * Math.cos(th);
  const C1 = kind === 'lin' ? pr.x0 - xp0 : pr.x0 - xs - xp0;
  const C2 = kind === 'lin' ? pr.v0 - vp0 : (pr.v0 - vp0) / k;
  return { K, B, kind, k, xs, C1, C2, A };
}

/** x(t) по замкнутому решению (для проверки и текста). */
export function closedX(c: RelClosed, pr: RelProblem, t: number): number {
  const th = rad(pr.theta);
  const p = c.A ? c.A * Math.sin(th + pr.omega * t) : 0;
  if (c.kind === 'lin') return c.C1 + c.C2 * t + (c.B * t * t) / 2 + p;
  if (c.kind === 'osc') return c.xs + c.C1 * Math.cos(c.k * t) + c.C2 * Math.sin(c.k * t) + p;
  return c.xs + c.C1 * Math.cosh(c.k * t) + c.C2 * Math.sinh(c.k * t) + p;
}
