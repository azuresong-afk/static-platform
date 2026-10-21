/**
 * Удар двух тел в плоскости (Мещерский §44; Яблонский Д.13).
 *
 * Оси: x вправо, y вверх; углы — от оси x против часовой стрелки, ω > 0 — против часовой. Тело — свободное
 * (поступательное и вращательное движение; «точка» — без вращения), на неподвижной оси O или неподвижная преграда.
 * Контакт в точке P, нормаль n направлена от тела 1 к телу 2; ударный импульс S действует на тело 2, −S — на тело 1.
 * Теоремы об изменении количества движения и кинетического момента при ударе:
 *   свободное тело — m(u_C − v_C) = S, J_C(ω′ − ω) = (P − C) × S;  тело на оси — J_O(ω′ − ω) = (P − O) × S.
 * Скорость точки P после удара линейна по S: u_P = v_P + W·S, W = E/m + (k×r)(k×r)ᵀ/J_C или (k×r)(k×r)ᵀ/J_O.
 * Условия удара: гладкий контакт — S ∥ n и (u₂ − u₁)·n = −k(v₂ − v₁)·n; абсолютно шероховатый — ещё (u₂ − u₁)·t = 0.
 * Если тело 1 после удара остаётся в теле 2 (неупругий удар, k = 0), скорости точки P совпадают полностью.
 * Ударный импульс оси: S_O = m(u_C − v_C) − S. Потеря энергии — теорема Карно.
 */
import { fmt } from '../../../shared/format';

export type BodyKind = 'free' | 'axis' | 'wall';
export type Inertia = 'point' | 'JC' | 'rhoC' | 'JO' | 'rhoO' | 'rod' | 'disk' | 'ring' | 'rect' | 'sphere';
export type Before = 'given' | 'fall' | 'thread' | 'swing';
export type After = 'none' | 'rise' | 'thread' | 'slide' | 'pivot' | 'swing' | 'spring' | 'pile';
export interface ImpBody {
  kind: BodyKind;
  name: string;
  /** Масса (или вес). */
  m: number;
  inertia: Inertia;
  /** J_C или J_O; радиус инерции; длина стержня; радиус; стороны пластины; угол оси стержня или стороны a, °. */
  J: number;
  rho: number;
  L: number;
  R: number;
  a: number;
  b: number;
  th: number;
  /** Центр масс и ось вращения. */
  cx: number;
  cy: number;
  ox: number;
  oy: number;
  before: Before;
  vx: number;
  vy: number;
  omega: number;
  /** Высота падения; длина нити; угол отклонения нити или поворота тела перед ударом, °. */
  h: number;
  l: number;
  ang: number;
  after: After;
  /** Коэффициент трения скольжения; жёсткость пружины; углубление сваи за удар. */
  f: number;
  c: number;
  delta: number;
}
export interface ImpProblem {
  byWeight: boolean;
  g: number;
  b1: ImpBody;
  b2: ImpBody;
  px: number;
  py: number;
  /** Направление нормали n от тела 1 к телу 2, °. */
  nAng: number;
  contact: 'smooth' | 'rough';
  k: number;
  /** Тело 1 после удара остаётся в теле 2 (снаряд в маятнике, шар в призме). */
  stick: boolean;
  /** Что ищем: состояние после удара; скорость тела 1 по движению после удара; коэффициент восстановления. */
  ask: 'after' | 'v1' | 'k';
  /** Для «v1»: угол отклонения тела после удара или опрокидывание; для «k»: высота отскока или угол отражения. */
  target: 'angle' | 'tip' | 'height' | 'refl';
  tVal: number;
}

export type V = [number, number];
export interface BodyState {
  m: number;
  JC: number;
  JO: number;
  /** Скорости до и после удара. */
  v: V;
  w: number;
  u: V;
  w1: number;
  /** Скорость точки P до и после. */
  vP: V;
  uP: V;
  /** Импульс, приложенный к телу в точке P, и ударный импульс оси (тело на оси). */
  S: V;
  SO: V | null;
  T0: number;
  T1: number;
  Tlost: number;
  /** Центр удара (тело на оси): расстояние J_O/(m·OC). */
  perc: number | null;
}
export interface SwingRes {
  /** Вращение вокруг точки Q после удара: J_Q, масса, Q → C. */
  J: number;
  M: number;
  d: V;
  w: number;
  E: number;
  Etop: number;
  over: boolean;
  phi: number;
}
export interface AfterRes {
  kind: After;
  /** Высота подъёма центра масс; полный путь при повторных отскоках; угол нити; путь скольжения; сжатие пружины; сопротивление грунта. */
  rise?: number;
  bounce?: { first: number; total: number };
  thread?: { alpha: number; full: boolean; slack: boolean };
  slide?: number;
  swing?: SwingRes;
  spring?: number;
  pile?: { T: number; R: number };
  /** Масса и скорость движущегося после удара тела (вместе с застрявшим телом 1). */
  M?: number;
  v?: number;
  note?: string;
}
export interface ImpResult {
  ok: boolean;
  errors: string[];
  notes: string[];
  n: V;
  t: V;
  P: V;
  b1: BodyState;
  b2: BodyState;
  /** Импульс на тело 2: нормальная и касательная составляющие. */
  S: V;
  Sn: number;
  St: number;
  /** Относительная скорость точки P до и после удара. */
  rel0: V;
  rel1: V;
  k: number;
  T0: number;
  T1: number;
  dT: number;
  Tlost: number;
  after1: AfterRes | null;
  after2: AfterRes | null;
  /** Обратные задачи: найденная скорость тела 1; найденный коэффициент восстановления. */
  v1: number | null;
  kFound: number | null;
  /** Скорости до удара по этапу «до удара»: пояснение. */
  pre1: string | null;
  pre2: string | null;
}

const rad = (a: number) => (a * Math.PI) / 180;
const deg = (a: number) => (a * 180) / Math.PI;
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const crs = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const kx = (r: V): V => [-r[1], r[0]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s];
const len = (a: V) => Math.hypot(a[0], a[1]);

/** Масса тела. */
export const massOf = (pr: ImpProblem, b: ImpBody) => (pr.byWeight ? b.m / pr.g : b.m);

/** Момент инерции относительно центра масс и формула. */
export function inertiaOf(pr: ImpProblem, b: ImpBody): { JC: number; JO: number; err: string | null } {
  const m = massOf(pr, b);
  const d2 = b.kind === 'axis' ? (b.cx - b.ox) ** 2 + (b.cy - b.oy) ** 2 : 0;
  let JC = 0;
  switch (b.inertia) {
    case 'point':
      JC = 0;
      break;
    case 'JC':
      JC = b.J;
      break;
    case 'rhoC':
      JC = m * b.rho ** 2;
      break;
    case 'rod':
      JC = (m * b.L ** 2) / 12;
      break;
    case 'disk':
      JC = (m * b.R ** 2) / 2;
      break;
    case 'ring':
      JC = m * b.R ** 2;
      break;
    case 'rect':
      JC = (m * (b.a ** 2 + b.b ** 2)) / 12;
      break;
    case 'sphere':
      JC = (2 * m * b.R ** 2) / 5;
      break;
    case 'JO':
    case 'rhoO': {
      if (b.kind !== 'axis') return { JC: 0, JO: 0, err: 'момент инерции относительно оси O задаётся только у тела на оси' };
      const JO = b.inertia === 'JO' ? b.J : m * b.rho ** 2;
      if (JO < m * d2 - 1e-12 * Math.max(1, JO))
        return { JC: 0, JO, err: `J_O = ${JO.toPrecision(4)} меньше m·OC² = ${(m * d2).toPrecision(4)} — проверьте данные` };
      return { JC: Math.max(0, JO - m * d2), JO, err: null };
    }
  }
  if (!(JC >= 0)) return { JC, JO: JC + m * d2, err: 'момент инерции должен быть неотрицательным' };
  return { JC, JO: JC + m * d2, err: null };
}

/** Подъём центра масс при вращении вокруг Q под действием тяжести: угол наибольшего поворота или переход через верх. */
export function swingOf(J: number, M: number, d: V, w: number, g: number): SwingRes {
  const E = (J * w * w) / 2;
  const r = len(d);
  const Etop = M * g * (r - d[1]);
  const res: SwingRes = { J, M, d, w, E, Etop, over: false, phi: 0 };
  if (Math.abs(w) < 1e-15 || r < 1e-15) return res;
  const s = Math.sign(w);
  const psi = Math.atan2(d[1], d[0]);
  const gain = (th: number) => M * g * r * (Math.sin(psi + s * th) - Math.sin(psi));
  // Переход через верхнее положение: энергии хватает подняться до высоты |QC| над Q.
  if (E > Etop * (1 + 1e-12)) {
    res.over = true;
    return res;
  }
  const N = 1440;
  for (let i = 1; i <= N; i++) {
    const th = (2 * Math.PI * i) / N;
    if (gain(th) >= E) {
      let lo = (2 * Math.PI * (i - 1)) / N,
        hi = th;
      for (let q = 0; q < 60; q++) {
        const mid = (lo + hi) / 2;
        if (gain(mid) >= E) hi = mid;
        else lo = mid;
      }
      res.phi = s * deg((lo + hi) / 2);
      return res;
    }
  }
  res.over = true;
  return res;
}

/** Скорости до удара по этапу «до удара». */
function preVel(pr: ImpProblem, b: ImpBody, m: number, JO: number, errs: string[], who: string): { v: V; w: number; pre: string | null } {
  if (b.kind === 'wall') return { v: [0, 0], w: 0, pre: null };
  const g = pr.g;
  if (b.kind === 'axis') {
    if (b.before === 'swing') {
      const d: V = [b.cx - b.ox, b.cy - b.oy];
      const r = len(d),
        psi = Math.atan2(d[1], d[0]);
      // Тело отпущено без скорости, будучи повёрнутым на φ₀ от положения удара.
      const drop = m * g * r * (Math.sin(psi + rad(b.ang)) - Math.sin(psi));
      if (!(drop > 0)) {
        errs.push(`${who}: из положения, повёрнутого на ${fmt(b.ang, 4)}°, тело под действием тяжести не придёт в положение удара.`);
        return { v: [0, 0], w: 0, pre: null };
      }
      const w = -Math.sign(b.ang) * Math.sqrt((2 * drop) / JO);
      return {
        v: mul(kx(d), w),
        w,
        pre: `падает без начальной скорости, будучи повёрнутым на ${fmt(b.ang, 4)}°: J_Oω²/2 = mgΔy_C, Δy_C = ${fmt(drop / (m * g), 4)} м`,
      };
    }
    const d: V = [b.cx - b.ox, b.cy - b.oy];
    return { v: mul(kx(d), b.omega), w: b.omega, pre: null };
  }
  if (b.before === 'fall') {
    if (!(b.h >= 0)) errs.push(`${who}: высота падения — неотрицательное число.`);
    return { v: [0, -Math.sqrt(2 * g * Math.max(0, b.h))], w: 0, pre: `падает без начальной скорости с высоты h = ${fmt(b.h, 4)} м: v = √(2gh)` };
  }
  if (b.before === 'thread') {
    if (!(b.l > 0)) errs.push(`${who}: длина нити — положительное число.`);
    const v = Math.sqrt(2 * g * Math.max(0, b.l) * (1 - Math.cos(rad(b.ang))));
    return {
      v: [Math.sign(b.ang) * v, 0],
      w: 0,
      pre: `на нити длиной l = ${fmt(b.l, 4)} м, отклонён на ${fmt(b.ang, 4)}° и отпущен: в нижней точке v = √(2gl(1 − cos α₀)) = 2√(gl)·sin(α₀/2)`,
    };
  }
  return { v: [b.vx, b.vy], w: b.omega, pre: null };
}

/** Решение 2×2 (псевдообратная для вырожденной симметричной W). */
function solve2(W: [V, V], r: V): { x: V; resid: number } {
  const det = W[0][0] * W[1][1] - W[0][1] * W[1][0];
  const sc = Math.abs(W[0][0]) + Math.abs(W[1][1]) + Math.abs(W[0][1]) + 1e-300;
  if (Math.abs(det) > 1e-12 * sc * sc) {
    const x: V = [(W[1][1] * r[0] - W[0][1] * r[1]) / det, (-W[1][0] * r[0] + W[0][0] * r[1]) / det];
    return { x, resid: 0 };
  }
  // Ранг 1: W = λ·e·eᵀ.
  const lam = W[0][0] + W[1][1];
  if (lam < 1e-300) return { x: [0, 0], resid: len(r) };
  const e: V = W[0][0] >= W[1][1] ? [W[0][0], W[1][0]] : [W[0][1], W[1][1]];
  const el = len(e);
  const u: V = [e[0] / el, e[1] / el];
  const x = mul(u, dot(u, r) / lam);
  return { x, resid: len(sub(r, mul(u, dot(u, r)))) };
}

interface Core {
  errors: string[];
  notes: string[];
  res: ImpResult | null;
}

function core(pr: ImpProblem, override?: { v1scale?: number; k?: number }): Core {
  const errors: string[] = [];
  const notes: string[] = [];
  const g = pr.g;
  if (!(g > 0)) errors.push('Ускорение свободного падения g — положительное число.');
  const k = override?.k ?? pr.k;
  if (!(k >= 0 && k <= 1)) errors.push('Коэффициент восстановления k — от 0 до 1.');
  if (pr.b1.kind === 'wall' && pr.b2.kind === 'wall') errors.push('Хотя бы одно тело должно быть подвижным.');
  if (pr.contact === 'rough' && !pr.stick && k > 0)
    errors.push(
      'Удар без проскальзывания (абсолютно шероховатый контакт) рассматривается как неупругий: задайте k = 0. При k > 0 условие Ньютона вместе с отсутствием проскальзывания может давать прирост кинетической энергии.',
    );
  if (pr.stick && pr.k !== 0 && pr.ask !== 'k') errors.push('Тело 1 может остаться в теле 2 только при неупругом ударе (k = 0).');
  if (pr.stick && (pr.b1.kind !== 'free' || pr.b2.kind === 'wall')) errors.push('Застревает подвижное свободное тело 1 в подвижном теле 2.');
  const bodies = [pr.b1, pr.b2].map((b, i) => {
    const who = `Тело ${i + 1}`;
    if (b.kind === 'wall') return { b, m: 0, JC: 0, JO: 0, v: [0, 0] as V, w: 0, pre: null as string | null };
    const m = massOf(pr, b);
    if (!(m > 0)) errors.push(`${who}: масса (вес) — положительное число.`);
    const { JC, JO, err } = inertiaOf(pr, b);
    if (err) errors.push(`${who}: ${err}.`);
    if (b.kind === 'axis' && !(JO > 0)) errors.push(`${who}: момент инерции относительно оси J_O должен быть положительным.`);
    const pv = preVel(pr, b, m, JO, errors, who);
    let v = pv.v;
    const w = pv.w;
    if (i === 0 && override?.v1scale != null) {
      const L = len(v);
      if (!(L > 0)) errors.push('Тело 1: задайте направление скорости до удара (v_x, v_y не равны нулю одновременно).');
      v = L > 0 ? mul(v, override.v1scale / L) : v;
    }
    return { b, m, JC, JO, v, w, pre: pv.pre };
  });
  if (errors.length) return { errors, notes, res: null };
  const P: V = [pr.px, pr.py];
  const n: V = [Math.cos(rad(pr.nAng)), Math.sin(rad(pr.nAng))];
  const t: V = kx(n);
  const geo = bodies.map(({ b, m, JC, JO, v, w }) => {
    if (b.kind === 'wall') return { W: [[0, 0] as V, [0, 0] as V] as [V, V], vP: [0, 0] as V, r: [0, 0] as V };
    if (b.kind === 'axis') {
      const r = sub(P, [b.ox, b.oy]);
      const q = kx(r);
      return { W: [mul(q, q[0] / JO), mul(q, q[1] / JO)] as [V, V], vP: mul(q, w), r };
    }
    // Точка (без вращения): импульс приложен в центре масс.
    const r = b.inertia === 'point' || JC === 0 ? ([0, 0] as V) : sub(P, [b.cx, b.cy]);
    const q = kx(r);
    const W: [V, V] = [
      [1 / m + (JC > 0 ? (q[0] * q[0]) / JC : 0), JC > 0 ? (q[0] * q[1]) / JC : 0],
      [JC > 0 ? (q[1] * q[0]) / JC : 0, 1 / m + (JC > 0 ? (q[1] * q[1]) / JC : 0)],
    ];
    return { W, vP: add(v, mul(q, w)), r };
  });
  const W: [V, V] = [add(geo[0].W[0], geo[1].W[0]), add(geo[0].W[1], geo[1].W[1])];
  const rel0 = sub(geo[1].vP, geo[0].vP);
  const vn = dot(rel0, n);
  const scaleV = 1 + len(geo[0].vP) + len(geo[1].vP);
  if (!(vn < -1e-12 * scaleV))
    return { errors: ['Точки контакта не сближаются по нормали n (v₂ₙ − v₁ₙ ≥ 0) — удара нет. Проверьте направление нормали и скорости.'], notes, res: null };
  const Wv = (S: V): V => [W[0][0] * S[0] + W[0][1] * S[1], W[1][0] * S[0] + W[1][1] * S[1]];
  let S: V;
  const rough = pr.contact === 'rough' || pr.stick;
  if (!rough) {
    const nWn = dot(n, Wv(n));
    if (!(nWn > 0)) return { errors: ['Удар не меняет скоростей: оба тела не могут двигаться вдоль нормали в точке P.'], notes, res: null };
    S = mul(n, (-(1 + k) * vn) / nWn);
  } else {
    const kk = pr.stick ? 0 : k;
    const target = mul(n, -kk * vn);
    const sol = solve2(W, sub(target, rel0));
    S = sol.x;
    if (sol.resid > 1e-9 * scaleV)
      notes.push(
        'Условия удара без проскальзывания нельзя выполнить точно (точка P может двигаться только по одной прямой) — импульс найден по наименьшим квадратам.',
      );
  }
  const states = bodies.map((bd, i): BodyState => {
    const { b, m, JC, JO, v, w } = bd;
    const Sb = i === 0 ? mul(S, -1) : S;
    if (b.kind === 'wall')
      return { m: 0, JC: 0, JO: 0, v: [0, 0], w: 0, u: [0, 0], w1: 0, vP: [0, 0], uP: [0, 0], S: Sb, SO: null, T0: 0, T1: 0, Tlost: 0, perc: null };
    if (b.kind === 'axis') {
      const r = geo[i].r,
        d: V = [b.cx - b.ox, b.cy - b.oy];
      const w1 = w + crs(r, Sb) / JO;
      const u = mul(kx(d), w1);
      const SO = sub(mul(sub(u, v), m), Sb);
      const dl = len(d);
      return {
        m,
        JC,
        JO,
        v,
        w,
        u,
        w1,
        vP: geo[i].vP,
        uP: mul(kx(r), w1),
        S: Sb,
        SO,
        T0: (JO * w * w) / 2,
        T1: (JO * w1 * w1) / 2,
        Tlost: (JO * (w - w1) ** 2) / 2,
        perc: dl > 1e-12 ? JO / (m * dl) : null,
      };
    }
    const r = geo[i].r;
    const u = add(v, mul(Sb, 1 / m));
    const w1 = JC > 0 ? w + crs(r, Sb) / JC : w;
    return {
      m,
      JC,
      JO: 0,
      v,
      w,
      u,
      w1,
      vP: geo[i].vP,
      uP: add(u, mul(kx(r), w1)),
      S: Sb,
      SO: null,
      T0: (m * dot(v, v)) / 2 + (JC * w * w) / 2,
      T1: (m * dot(u, u)) / 2 + (JC * w1 * w1) / 2,
      Tlost: (m * dot(sub(v, u), sub(v, u))) / 2 + (JC * (w - w1) ** 2) / 2,
      perc: null,
    };
  });
  const [s1, s2] = states;
  const rel1 = sub(s2.uP, s1.uP);
  const T0 = s1.T0 + s2.T0,
    T1 = s1.T1 + s2.T1;
  const res: ImpResult = {
    ok: true,
    errors: [],
    notes,
    n,
    t,
    P,
    b1: s1,
    b2: s2,
    S,
    Sn: dot(S, n),
    St: dot(S, t),
    rel0,
    rel1,
    k: pr.stick ? 0 : k,
    T0,
    T1,
    dT: T0 - T1,
    Tlost: s1.Tlost + s2.Tlost,
    after1: null,
    after2: null,
    v1: null,
    kFound: null,
    pre1: bodies[0].pre,
    pre2: bodies[1].pre,
  };
  if (res.Sn < -1e-9 * (1 + len(S))) notes.push('Нормальная составляющая импульса отрицательна: тела «притягиваются» — проверьте направление нормали.');
  res.after1 = pr.stick ? null : afterOf(pr, 0, res);
  res.after2 = afterOf(pr, 1, res);
  return { errors, notes, res };
}

/** Положение застрявшего тела 1: точечное — в точке удара, иначе — его центр масс. */
export const stuckAt = (pr: ImpProblem, r: ImpResult): V => (pr.b1.inertia === 'point' ? r.P : [pr.b1.cx, pr.b1.cy]);

/** Движение после удара. */
function afterOf(pr: ImpProblem, i: 0 | 1, r: ImpResult): AfterRes | null {
  const b = i === 0 ? pr.b1 : pr.b2;
  const st = i === 0 ? r.b1 : r.b2;
  if (b.kind === 'wall' || b.after === 'none') return null;
  const g = pr.g;
  const other = i === 0 ? pr.b2 : pr.b1;
  // Тело 2 вместе с застрявшим телом 1.
  const merged = i === 1 && pr.stick;
  const m1 = r.b1.m;
  const M = merged ? st.m + m1 : st.m;
  const vv: V = merged ? mul(add(mul(st.u, st.m), mul(r.b1.u, m1)), 1 / M) : st.u;
  const out: AfterRes = { kind: b.after, M, v: len(vv) };
  switch (b.after) {
    case 'rise': {
      out.rise = Math.max(0, vv[1]) ** 2 / (2 * g);
      if (other.kind === 'wall' && b.before === 'fall' && Math.abs(r.n[0]) < 1e-9 && Math.abs(vv[0]) < 1e-12 && r.k < 1)
        out.bounce = { first: r.k * r.k * b.h, total: (b.h * (1 + r.k * r.k)) / (1 - r.k * r.k) };
      return out;
    }
    case 'thread': {
      const v2 = dot(vv, vv);
      const lim = 2 * g * b.l;
      out.thread = { alpha: v2 <= lim ? deg(Math.acos(1 - v2 / lim)) : 90, full: v2 >= 5 * g * b.l, slack: v2 > lim && v2 < 5 * g * b.l };
      return out;
    }
    case 'slide':
      out.slide = b.f > 0 ? dot(vv, vv) / (2 * b.f * g) : Infinity;
      return out;
    case 'pivot':
    case 'swing': {
      // Вращение вокруг оси O (тело на оси) или вокруг точки удара P (свободное тело упирается в преграду).
      if (b.kind === 'axis' && b.after === 'swing') {
        let J = st.JO,
          C: V = mul([b.cx, b.cy], st.m);
        if (merged) {
          // Застрявшее точечное тело находится в точке удара P.
          const C1 = stuckAt(pr, r);
          J += r.b1.JC + m1 * ((C1[0] - b.ox) ** 2 + (C1[1] - b.oy) ** 2);
          C = add(C, mul(C1, m1));
        }
        C = mul(C, 1 / M);
        out.swing = swingOf(J, M, sub(C, [b.ox, b.oy]), st.w1, g);
        return out;
      }
      if (b.kind === 'free' && b.after === 'pivot') {
        if (len(st.uP) > 1e-9 * (1 + len(st.u) + Math.abs(st.w1))) {
          out.note = 'после удара точка P не остановилась — поворот вокруг неё не определён (нужен неупругий удар без проскальзывания о неподвижную преграду)';
          return out;
        }
        const d = sub([b.cx, b.cy], r.P);
        out.swing = swingOf(st.JC + st.m * dot(d, d), st.m, d, st.w1, g);
        return out;
      }
      out.note = 'поворот после удара задаётся телу на оси или свободному телу, упёршемуся в преграду';
      return out;
    }
    case 'spring': {
      // Тело 2 стоит на пружине (статически сжатой его весом); после удара вниз со скоростью v.
      const v = Math.max(0, -vv[1]);
      const extra = (M - st.m) * g;
      out.spring = b.c > 0 ? (extra + Math.sqrt(extra * extra + b.c * M * v * v)) / b.c : NaN;
      return out;
    }
    case 'pile': {
      const v = Math.max(0, -vv[1]);
      const T = (M * v * v) / 2;
      out.pile = { T, R: b.delta > 0 ? M * g + T / b.delta : NaN };
      return out;
    }
  }
  return null;
}

/** Скорость тела 1 по повороту тела после удара или коэффициент восстановления по отскоку. */
export function solveImpact(pr: ImpProblem): ImpResult {
  const zero: BodyState = {
    m: 0,
    JC: 0,
    JO: 0,
    v: [0, 0],
    w: 0,
    u: [0, 0],
    w1: 0,
    vP: [0, 0],
    uP: [0, 0],
    S: [0, 0],
    SO: null,
    T0: 0,
    T1: 0,
    Tlost: 0,
    perc: null,
  };
  const fail = (errors: string[]): ImpResult => ({
    ok: false,
    errors,
    notes: [],
    n: [1, 0],
    t: [0, 1],
    P: [pr.px, pr.py],
    b1: zero,
    b2: zero,
    S: [0, 0],
    Sn: 0,
    St: 0,
    rel0: [0, 0],
    rel1: [0, 0],
    k: pr.k,
    T0: 0,
    T1: 0,
    dT: 0,
    Tlost: 0,
    after1: null,
    after2: null,
    v1: null,
    kFound: null,
    pre1: null,
    pre2: null,
  });
  if (pr.ask === 'k') {
    if (pr.b2.kind !== 'wall' || pr.contact !== 'smooth' || pr.b1.kind !== 'free')
      return fail(['Коэффициент восстановления по отскоку: тело 1 свободное, тело 2 — неподвижная преграда, контакт гладкий.']);
    const base = core(pr, { k: 1 });
    if (!base.res) return fail(base.errors);
    const n = base.res.n;
    const v = base.res.b1.vP;
    const vn = dot(v, n),
      vt = dot(v, kx(n));
    let kf: number;
    if (pr.target === 'height') {
      if (pr.b1.before !== 'fall' || Math.abs(n[0]) > 1e-9)
        return fail(['Высота отскока: тело 1 падает с высоты h на горизонтальную плиту (нормаль по вертикали).']);
      if (!(pr.tVal >= 0)) return fail(['Высота отскока — неотрицательное число.']);
      kf = Math.sqrt((2 * pr.g * pr.tVal) / (vn * vn));
    } else {
      if (!(pr.tVal > 0 && pr.tVal < 90)) return fail(['Угол отражения (от нормали) — от 0 до 90°.']);
      if (Math.abs(vt) < 1e-12) return fail(['При ударе по нормали угол отражения равен нулю — задайте косой удар.']);
      kf = Math.abs(vt) / Math.tan(rad(pr.tVal)) / Math.abs(vn);
    }
    if (!(kf <= 1 + 1e-9)) return fail([`По этим данным k = ${kf.toPrecision(4)} > 1 — отскок невозможен.`]);
    const c = core(pr, { k: Math.min(1, kf) });
    if (!c.res) return fail(c.errors);
    c.res.kFound = kf;
    return c.res;
  }
  if (pr.ask === 'v1') {
    if (pr.b1.kind !== 'free' || pr.b1.before !== 'given')
      return fail(['Скорость тела 1 ищется для свободного тела со скоростью, заданной направлением (v_x, v_y).']);
    const tgt = pr.b2.kind === 'axis' && pr.b2.after === 'swing' ? 2 : pr.b1.after === 'pivot' ? 1 : 0;
    if (!tgt)
      return fail([
        'Укажите, какое тело поворачивается после удара: тело на оси — «поворот вокруг оси», свободное тело у преграды — «поворот вокруг точки удара».',
      ]);
    if (pr.target !== 'angle' && pr.target !== 'tip') return fail(['Цель: угол отклонения после удара или опрокидывание.']);
    const at = (s: number) => {
      const c = core(pr, { v1scale: s });
      return c.res ? ((tgt === 2 ? c.res.after2 : c.res.after1)?.swing ?? null) : null;
    };
    const c1 = core(pr, { v1scale: 1 });
    if (!c1.res) return fail(c1.errors);
    const sw1 = at(1),
      sw2 = at(2);
    if (!sw1 || !sw2) return fail(['Поворот после удара не определён — проверьте вид тела и контакт.']);
    // ω после удара линейна по модулю скорости тела 1: ω = a + b·s.
    const b = sw2.w - sw1.w,
      a = sw1.w - b;
    if (Math.abs(b) < 1e-15) return fail(['Скорость тела 1 не влияет на вращение — проверьте геометрию удара.']);
    const sgn = Math.sign(b);
    const d = sw1.d,
      r = len(d),
      psi = Math.atan2(d[1], d[0]);
    let E: number;
    if (pr.target === 'tip') E = sw1.M * pr.g * (r - d[1]);
    else {
      if (!(pr.tVal > 0 && pr.tVal < 360)) return fail(['Угол отклонения после удара — от 0 до 360°.']);
      E = sw1.M * pr.g * r * (Math.sin(psi + sgn * rad(pr.tVal)) - Math.sin(psi));
      if (!(E > 0)) return fail(['При повороте на этот угол центр масс не поднимается — угол не определяет скорость.']);
    }
    const wReq = sgn * Math.sqrt((2 * E) / sw1.J);
    const s = (wReq - a) / b;
    if (!(s > 0)) return fail(['Нужная скорость тела 1 получается неположительной — при заданном направлении цель недостижима.']);
    const c = core(pr, { v1scale: s * (1 + (pr.target === 'tip' ? 1e-9 : 0)) });
    if (!c.res) return fail(c.errors);
    c.res.v1 = s;
    return c.res;
  }
  const c = core(pr);
  return c.res ?? fail(c.errors);
}
