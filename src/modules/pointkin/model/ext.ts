/**
 * Законы движения точки по времени (Мещерский §10, 12, 21): путь и закон движения по траектории, интегрирование
 * ускорения, параметры гармонического колебания, бросок под углом к горизонту.
 *
 * Все поля — формулы (π, запятая, дроби); параметры режимов лежат в KinProblem.p.
 */
import { diff, evalExpr, parseExpr, printExpr, usesVar, type Expr } from '../../../shared/expr';
import { fmtPi, integrateFrom } from '../../../shared/integ';
import type { KinProblem } from './kin';

export const pstr = (pr: KinProblem, k: string, def = ''): string => pr.p?.[k] ?? def;

/** Число из поля параметров (формула без t: «π/2», «9,81»). */
export function pnum(pr: KinProblem, k: string, label: string, errors: string[], def?: number): number {
  const raw = (pr.p?.[k] ?? '').trim();
  if (!raw) {
    if (def !== undefined) return def;
    errors.push(`${label}: пусто.`);
    return NaN;
  }
  const e = parseExpr(raw);
  if (!e.ok) {
    errors.push(`${label}: ${e.error}.`);
    return NaN;
  }
  if (usesVar(e.e, 't')) {
    errors.push(`${label}: здесь нужно число, без t.`);
    return NaN;
  }
  const v = evalExpr(e.e, 0);
  if (!Number.isFinite(v)) errors.push(`${label}: не число.`);
  return v;
}

function law(src: string, label: string, errors: string[]): { e: Expr; d1: Expr; d2: Expr } {
  const p = parseExpr(src);
  if (!p.ok) {
    errors.push(`${label}: ${p.error}.`);
    return { e: { k: 'num', v: 0 }, d1: { k: 'num', v: 0 }, d2: { k: 'num', v: 0 } };
  }
  const d1 = diff(p.e);
  return { e: p.e, d1, d2: diff(d1) };
}

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
/** Формула со «встроенным» π (2π, π/2…). */
export const printPi = (e: Expr) => printExpr(e, 0, fmtPi);

/* ======================= путь и закон движения по траектории ======================= */

export interface PathRow {
  t: number;
  /** Расстояние s от начального положения по траектории (со знаком — у закона s(t), арифметическое — у координатного). */
  s: number;
  pos: [number, number, number] | null;
}
export interface PathResult {
  ok: boolean;
  errors: string[];
  src: 'xyz' | 's';
  /** Формулы закона и производных (s(t), ṡ или x, y, z). */
  f: { name: string; e: Expr; d1: Expr }[];
  t1: number;
  t2: number;
  rows: PathRow[];
  /** Координата s в конце промежутка и путь σ (у координатного способа оба — длина дуги). */
  s1: number;
  s2: number;
  path: number;
  /** Моменты остановки со сменой направления (ṡ меняет знак): t, s. */
  turns: { t: number; s: number }[];
  /** Закон движения по траектории в замкнутом виде («5t³», «3t»), если он найден (отсчёт от t = 0 или t₁). */
  closed: string | null;
  /** Скорость постоянна (модуль). */
  vConst: number | null;
}

/** Метод Симпсона для функции g на [a; b]. */
function simpson(g: (t: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = g(a) + g(b);
  for (let i = 1; i < n; i++) s += g(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

export function solvePath(pr: KinProblem): PathResult {
  const errors: string[] = [];
  const src: 'xyz' | 's' = pstr(pr, 'src', 'xyz') === 's' ? 's' : 'xyz';
  const t1 = pr.t1,
    t2 = pr.t2;
  const names = src === 's' ? ['s'] : ['x', 'y', 'z'].filter((_, i) => i < 2 || pr.z.trim());
  const f = names.map((n) => {
    const L = law(src === 's' ? pr.s : pr[n as 'x' | 'y' | 'z'], `${n}(t)`, errors);
    return { name: n, e: L.e, d1: L.d1 };
  });
  const nPos = Math.round(pnum(pr, 'n', 'число положений', errors, 6));
  const empty: PathResult = { ok: false, errors, src, f, t1, t2, rows: [], s1: 0, s2: 0, path: 0, turns: [], closed: null, vConst: null };
  if (!(t2 > t1)) errors.push('Промежуток времени: t₂ должно быть больше t₁.');
  if (!(nPos >= 2 && nPos <= 40)) errors.push('Число положений — от 2 до 40.');
  if (errors.length) return empty;
  const speed = (t: number) => (src === 's' ? Math.abs(evalExpr(f[0].d1, t)) : Math.hypot(...f.map((q) => evalExpr(q.d1, t))));
  const at = (t: number): [number, number, number] | null =>
    src === 's' ? null : ([0, 1, 2].map((i) => (f[i] ? evalExpr(f[i].e, t) : 0)) as [number, number, number]);
  const turns: { t: number; s: number }[] = [];
  let path = 0;
  let sOf: (t: number) => number;
  if (src === 's') {
    const s = (t: number) => evalExpr(f[0].e, t),
      sd = (t: number) => evalExpr(f[0].d1, t);
    sOf = s;
    // Корни ṡ со сменой знака: сетка + деление пополам (нули у краёв и касания без смены знака — не остановки).
    const M = 4000;
    const grid = Array.from({ length: M + 1 }, (_, i) => t1 + ((t2 - t1) * i) / M);
    const sdv = grid.map(sd);
    const eps = 1e-9 * Math.max(1e-300, ...sdv.map(Math.abs));
    const brk: number[] = [t1];
    let last = -1;
    for (let i = 0; i <= M; i++) {
      if (Math.abs(sdv[i]) <= eps) continue;
      if (last >= 0 && sdv[last] * sdv[i] < 0) {
        let a = grid[last],
          b = grid[i];
        for (let k = 0; k < 100; k++) {
          const m = (a + b) / 2;
          if (sd(a) * sd(m) <= 0) b = m;
          else a = m;
        }
        const tr = (a + b) / 2;
        brk.push(tr);
        turns.push({ t: tr, s: s(tr) });
      }
      last = i;
    }
    brk.push(t2);
    for (let i = 1; i < brk.length; i++) path += Math.abs(s(brk[i]) - s(brk[i - 1]));
  } else {
    path = simpson(speed, t1, t2);
    sOf = (t) => (t === t1 ? 0 : simpson(speed, t1, t, 600));
  }
  const rows: PathRow[] = Array.from({ length: nPos }, (_, i) => {
    const t = t1 + ((t2 - t1) * i) / (nPos - 1);
    return { t, s: clean(src === 's' ? sOf(t) : i === nPos - 1 ? path : sOf(t)), pos: at(t) };
  });
  // Модуль скорости постоянен? Тогда s = v·(t − t₁); степенной закон v = c·tⁿ (отсчёт с t = 0).
  const probe = Array.from({ length: 9 }, (_, i) => t1 + ((t2 - t1) * (i + 1)) / 10);
  const vs = probe.map(speed);
  const v0 = vs[0];
  let vConst: number | null = null,
    closed: string | null = null;
  const num = (x: number) => fmtPi(x);
  if (src === 'xyz') {
    if (v0 > 1e-12 && vs.every((x) => Math.abs(x - v0) <= 1e-9 * v0)) {
      vConst = v0;
      closed = t1 === 0 ? `s = ${num(v0)}t` : `s = ${num(v0)}(t − ${num(t1)})`;
    } else if (t1 === 0 && probe.every((t) => t > 0)) {
      const n = Math.log(vs[8] / vs[0]) / Math.log(probe[8] / probe[0]);
      const c = vs[0] / probe[0] ** n;
      if (
        Number.isFinite(n) &&
        Math.abs(n - Math.round(n * 2) / 2) < 1e-6 &&
        n > -0.5 &&
        vs.every((x, i) => Math.abs(x - c * probe[i] ** n) <= 1e-8 * Math.abs(x))
      ) {
        const m = Math.round(n * 2) / 2 + 1;
        const k = c / m;
        closed = `s = ${num(k)}${m === 1 ? 't' : `t${m === 2 ? '²' : m === 3 ? '³' : `^${num(m)}`}`}`;
      }
    }
  } else {
    const dd = (t: number) => Math.abs(evalExpr(f[0].d1, t));
    vConst = dd(probe[0]) > 1e-12 && probe.every((t) => Math.abs(dd(t) - dd(probe[0])) < 1e-9 * dd(probe[0])) ? dd(probe[0]) : null;
  }
  const s1 = src === 's' ? evalExpr(f[0].e, t1) : 0,
    s2 = src === 's' ? evalExpr(f[0].e, t2) : path;
  return { ok: true, errors: [], src, f, t1, t2, rows, s1: clean(s1), s2: clean(s2), path: clean(path), turns, closed, vConst };
}

/* ======================= интегрирование ускорения ======================= */

export interface IntegResult {
  ok: boolean;
  errors: string[];
  /** a или v как задано, t₀, начальные условия. */
  given: 'a' | 'v';
  t0: number;
  x0: number;
  v0: number;
  /** Формулы a, v, x (null — первообразную в замкнутом виде найти не удалось, значения — численно). */
  a: Expr | null;
  v: Expr | null;
  x: Expr | null;
  /** Значения в момент t и на сетке для графиков. */
  at: { t: number; a: number; v: number; x: number };
  curve: { t: number; a: number; v: number; x: number }[];
  /** Решено численным интегрированием (Симпсон), а не формулой. */
  numeric: boolean;
}

export function solveInteg(pr: KinProblem): IntegResult {
  const errors: string[] = [];
  const given = pstr(pr, 'src', 'a') === 'v' ? 'v' : 'a';
  const L = law(pstr(pr, 'f'), given === 'a' ? 'a(t)' : 'v(t)', errors);
  const t0 = pnum(pr, 't0', 'начальный момент t₀', errors, 0);
  const x0 = pnum(pr, 'x0', 'начальное положение x₀', errors, 0);
  const v0 = pnum(pr, 'v0', 'начальная скорость v₀', errors, 0);
  const tq = pr.t;
  const tEnd = Math.max(tq, t0 + 1e-9);
  const empty: IntegResult = { ok: false, errors, given, t0, x0, v0, a: null, v: null, x: null, at: { t: tq, a: 0, v: 0, x: 0 }, curve: [], numeric: false };
  if (errors.length) return empty;
  let aE: Expr | null = null,
    vE: Expr | null = null,
    xE: Expr | null = null;
  let aF: (t: number) => number, vF: (t: number) => number, xF: (t: number) => number;
  if (given === 'a') {
    aE = L.e;
    vE = integrateFrom(L.e, t0, v0);
    xE = vE ? integrateFrom(vE, t0, x0) : null;
    aF = (t) => evalExpr(L.e, t);
    vF = vE ? (t) => evalExpr(vE!, t) : (t) => v0 + simpson(aF, t0, t, 400);
    xF = xE ? (t) => evalExpr(xE!, t) : (t) => x0 + v0 * (t - t0) + simpson((u) => vF(u), t0, t, 400);
  } else {
    vE = L.e;
    aE = L.d1;
    xE = integrateFrom(L.e, t0, x0);
    aF = (t) => evalExpr(L.d1, t);
    vF = (t) => evalExpr(L.e, t);
    xF = xE ? (t) => evalExpr(xE!, t) : (t) => x0 + simpson(vF, t0, t, 400);
  }
  const numeric = !xE || !vE;
  const lo = Math.min(t0, tq),
    hi = Math.max(t0, tq, lo + 1);
  const curve = Array.from({ length: 201 }, (_, i) => {
    const t = lo + ((hi - lo) * i) / 200;
    return { t, a: aF(t), v: vF(t), x: xF(t) };
  });
  const at = { t: tq, a: aF(tq), v: vF(tq), x: xF(tq) };
  if (![at.a, at.v, at.x].every(Number.isFinite)) return { ...empty, errors: [`В момент t = ${tq} формулы не определены.`] };
  void tEnd;
  return { ok: true, errors: [], given, t0, x0, v0, a: aE, v: vE, x: xE, at, curve, numeric };
}

/* ======================= гармоническое колебание ======================= */

export interface HarmResult {
  ok: boolean;
  errors: string[];
  /** Формула закона (если задана формулой). */
  law: Expr | null;
  /** x = a₀ + a·sin(kt + ε): центр, амплитуда, круговая частота, период, частота, начальная фаза (−π; π]. */
  a0: number;
  a: number;
  k: number;
  T: number;
  f: number;
  eps: number;
  /** Положение и скорость при t = 0; наибольшие скорость и ускорение. */
  x0: number;
  v0: number;
  vMax: number;
  aMax: number;
  /** Режим: закон задан формулой или найден по периоду, фазе и начальному положению. */
  mode: 'law' | 'par';
  curve: { t: number; x: number }[];
}

/** Угол, приведённый к (−π; π]. */
export const wrapPhase = (a: number) => wrapPi(a);
const wrapPi = (a: number) => {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return Math.abs(r - Math.PI) < 1e-9 ? Math.PI : Math.abs(r + Math.PI) < 1e-9 ? Math.PI : r;
};

export function solveHarm(pr: KinProblem): HarmResult {
  const errors: string[] = [];
  const mode: 'law' | 'par' = pstr(pr, 'src', 'law') === 'par' ? 'par' : 'law';
  const blank: HarmResult = { ok: false, errors, law: null, a0: 0, a: 0, k: 0, T: 0, f: 0, eps: 0, x0: 0, v0: 0, vMax: 0, aMax: 0, mode, curve: [] };
  let a0: number,
    a: number,
    k: number,
    eps: number,
    lawE: Expr | null = null;
  if (mode === 'par') {
    // Заданы: период T (или k), начальная фаза ε, начальное положение x₀ и центр a₀ → амплитуда.
    const T = pnum(pr, 'T', 'период T', errors);
    eps = pnum(pr, 'eps', 'начальная фаза ε', errors);
    const x0 = pnum(pr, 'x0', 'начальное положение x₀', errors);
    a0 = pnum(pr, 'a0', 'центр колебаний a₀', errors, 0);
    if (errors.length) return blank;
    if (!(T > 0)) return { ...blank, errors: ['Период T должен быть положительным.'] };
    k = (2 * Math.PI) / T;
    if (Math.abs(Math.sin(eps)) < 1e-9)
      return { ...blank, errors: ['При sin ε = 0 начальное положение x₀ = a₀ не определяет амплитуду: задайте формулу закона.'] };
    a = (x0 - a0) / Math.sin(eps);
    if (!(a > 0)) {
      // Амплитуда положительна: сдвигаем фазу на π.
      a = -a;
      eps += Math.PI;
    }
    eps = wrapPi(eps);
  } else {
    const L = law(pr.x, 'x(t)', errors);
    if (errors.length) return blank;
    lawE = L.e;
    // x'' = −k²(x − a₀) ⇒ x''' = −k²x'. Берём несколько моментов, где x' заметно отлична от нуля.
    const d3 = diff(L.d2),
      d4 = diff(d3);
    const ts = [0.1234, 0.5271, 0.9318, 1.4143, 2.0721, 3.1111];
    let k2 = NaN;
    let best = 0;
    for (const t of ts) {
      const d1 = evalExpr(L.d1, t),
        v3 = evalExpr(d3, t);
      if (Math.abs(d1) > best) {
        best = Math.abs(d1);
        k2 = -v3 / d1;
      }
    }
    void d4;
    if (!(best > 1e-9)) {
      // Постоянная: колебаний нет.
      return { ...blank, errors: ['Это не колебание: x(t) не меняется (или не гармонична).'] };
    }
    if (!(k2 > 1e-12) || !Number.isFinite(k2))
      return { ...blank, errors: ['Закон не гармонический: нужна сумма постоянной и синусоид одной частоты (x = a₀ + a·sin(kt + ε)).'] };
    k = Math.sqrt(k2);
    const tt = ts[0];
    a0 = evalExpr(L.e, tt) + evalExpr(L.d2, tt) / k2;
    const sS = evalExpr(L.e, tt) - a0,
      cS = evalExpr(L.d1, tt) / k;
    a = Math.hypot(sS, cS);
    // sin(kt + ε) = sS/a, cos(kt + ε) = cS/a ⇒ kt + ε = atan2(sS, cS).
    eps = wrapPi(Math.atan2(sS, cS) - k * tt);
    // Проверка в других точках.
    const scale = Math.max(1, Math.abs(a0), a);
    for (const t of [0, 0.37, 1.91, 4.4, 7.3]) {
      const got = a0 + a * Math.sin(k * t + eps),
        want = evalExpr(L.e, t);
      if (!(Math.abs(got - want) <= 1e-7 * scale))
        return { ...blank, errors: ['Закон не гармонический: нужна сумма постоянной и синусоид одной частоты (x = a₀ + a·sin(kt + ε)).'] };
    }
    if (!(a > 1e-12)) return { ...blank, errors: ['Амплитуда равна нулю — колебаний нет.'] };
  }
  const T = (2 * Math.PI) / k;
  const x = (t: number) => a0 + a * Math.sin(k * t + eps);
  const tMax = Math.max(pr.t2 > pr.t1 ? pr.t2 : 2 * T, 1e-6);
  const t0 = pr.t2 > pr.t1 ? pr.t1 : 0;
  const curve = Array.from({ length: 401 }, (_, i) => ({ t: t0 + ((tMax - t0) * i) / 400, x: x(t0 + ((tMax - t0) * i) / 400) }));
  return {
    ok: true,
    errors: [],
    law: lawE,
    a0: clean(a0),
    a,
    k,
    T,
    f: 1 / T,
    eps: clean(eps),
    x0: clean(x(0)),
    v0: clean(a * k * Math.cos(eps)),
    vMax: a * k,
    aMax: a * k * k,
    mode,
    curve,
  };
}

/* ======================= бросок под углом к горизонту ======================= */

export interface ShotResult {
  ok: boolean;
  errors: string[];
  v0: number;
  alpha: number;
  g: number;
  h0: number;
  /** Время подъёма до вершины, время полёта до земли (y = 0), дальность, наибольшая высота над землёй. */
  tTop: number;
  T: number;
  L: number;
  H: number;
  /** Скорость и угол к горизонту в момент падения. */
  vEnd: number;
  alphaEnd: number;
  /** Наибольшая дальность и угол, при котором она достигается; высота и время полёта в этом случае. */
  best: { alpha: number; L: number; H: number; T: number };
  /** Цель (x, y): углы бросания (tg α), при которых снаряд в неё попадает. */
  target: { x: number; y: number; reachable: boolean; tgs: number[] } | null;
  curve: [number, number][];
  /** Парабола безопасности y(x) (кривая) — для чертежа. */
  safe: [number, number][];
}

export function solveShot(pr: KinProblem): ShotResult {
  const errors: string[] = [];
  const v0 = pnum(pr, 'v0', 'начальная скорость v₀', errors);
  const alpha = pnum(pr, 'al', 'угол бросания α, °', errors);
  const g = pnum(pr, 'g', 'ускорение свободного падения g', errors, 9.81);
  const h0 = pnum(pr, 'h0', 'начальная высота h₀', errors, 0);
  const hasT = (pr.p?.xt ?? '').trim() !== '' || (pr.p?.yt ?? '').trim() !== '';
  const xt = hasT ? pnum(pr, 'xt', 'цель: x', errors) : 0,
    yt = hasT ? pnum(pr, 'yt', 'цель: y', errors) : 0;
  const blank: ShotResult = {
    ok: false,
    errors,
    v0,
    alpha,
    g,
    h0,
    tTop: 0,
    T: 0,
    L: 0,
    H: 0,
    vEnd: 0,
    alphaEnd: 0,
    best: { alpha: 0, L: 0, H: 0, T: 0 },
    target: null,
    curve: [],
    safe: [],
  };
  if (errors.length) return blank;
  if (!(v0 > 0)) return { ...blank, errors: ['Начальная скорость v₀ должна быть положительной.'] };
  if (!(g > 0)) return { ...blank, errors: ['g должно быть положительным.'] };
  if (!(h0 >= 0)) return { ...blank, errors: ['Начальная высота h₀ — неотрицательная.'] };
  if (!(Math.abs(alpha) < 90)) return { ...blank, errors: ['Угол бросания α — между −90° и 90°.'] };
  const al = (alpha * Math.PI) / 180;
  const vx = v0 * Math.cos(al),
    vy = v0 * Math.sin(al);
  const yAt = (t: number) => h0 + vy * t - (g * t * t) / 2;
  const tTop = Math.max(0, vy / g);
  const H = h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0);
  const T = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  const L = vx * T;
  const vEnd = Math.hypot(vx, vy - g * T);
  const alphaEnd = (Math.atan2(vy - g * T, vx) * 180) / Math.PI;
  // Наибольшая дальность: tg α* = v₀/√(v₀² + 2gh₀).
  const aStar = Math.atan(v0 / Math.sqrt(v0 * v0 + 2 * g * h0));
  const vxS = v0 * Math.cos(aStar),
    vyS = v0 * Math.sin(aStar);
  const TS = (vyS + Math.sqrt(vyS * vyS + 2 * g * h0)) / g;
  const best = { alpha: (aStar * 180) / Math.PI, L: vxS * TS, H: h0 + (vyS * vyS) / (2 * g), T: TS };
  let target: ShotResult['target'] = null;
  if (hasT) {
    // y − h₀ = x tg α − g x²(1 + tg²α)/(2v₀²) ⇒ (g x²/2v₀²) u² − x u + (y − h₀ + g x²/2v₀²) = 0, u = tg α.
    const dy = yt - h0;
    if (Math.abs(xt) < 1e-12) target = { x: xt, y: yt, reachable: false, tgs: [] };
    else {
      const A = (g * xt * xt) / (2 * v0 * v0),
        B = -xt,
        C = dy + A;
      const D = B * B - 4 * A * C;
      const tgs = D < 0 ? [] : D === 0 ? [-B / (2 * A)] : [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)];
      target = { x: xt, y: yt, reachable: D >= 0, tgs: tgs.map(clean) };
    }
  }
  const xEnd = Math.max(L, best.L, Math.abs(xt)) * 1.02 || 1;
  const curve: [number, number][] = [];
  const nT = 240;
  for (let i = 0; i <= nT; i++) {
    const t = (T * i) / nT;
    curve.push([vx * t, Math.max(0, yAt(t))]);
  }
  const safe: [number, number][] = [];
  const xs = Math.min(xEnd, ((v0 * Math.sqrt(v0 * v0 + 2 * g * h0)) / g) * 1.02);
  for (let i = 0; i <= 120; i++) {
    const x = (xs * i) / 120;
    const y = h0 + (v0 * v0) / (2 * g) - (g * x * x) / (2 * v0 * v0);
    if (y >= 0) safe.push([x, y]);
  }
  return { ok: true, errors: [], v0, alpha, g, h0, tTop, T, L: clean(L), H, vEnd, alphaEnd, best, target, curve, safe };
}
