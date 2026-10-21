/**
 * Составные задачи кинематики точки (Мещерский 10.13, 12.3, 12.4, 12.6, 12.11) и пересчёт координат (10.19, 10.21–10.23).
 *
 * Режим «comp» (поле p.kind): drops — две капли, pow — путь пропорционален степени времени, pile — копровая баба,
 * arcs — нормальное ускорение на дугах разных радиусов, when — моменты, когда величина принимает заданные значения.
 * Режим «conv» — декартовы уравнения движения → полярные, цилиндрические или сферические координаты; книжные формулы
 * (p.rb, p.pb, p.zb) сверяются с пересчётом.
 */
import { evalExpr, parseExpr, type Expr } from '../../../shared/expr';
import type { KinProblem } from './kin';
import { pnum, pstr } from './ext';

export type CompKind = 'drops' | 'pow' | 'pile' | 'arcs' | 'when';
export const COMP_KINDS: [CompKind, string][] = [
  ['drops', 'две капли: расстояние между ними'],
  ['pow', 'путь пропорционален степени времени'],
  ['pile', 'копровая баба: падение и подъём'],
  ['arcs', 'нормальное ускорение на дугах разных радиусов'],
  ['when', 'моменты, когда величина принимает заданные значения'],
];
/** Поля вида (p.k) и их значения по умолчанию — первые строки готовых задач. */
export const COMP_FIELDS: Record<CompKind, [string, string, string][]> = {
  drops: [
    ['tau', 'интервал между отрывами капель τ, с', '0,1'],
    ['g', 'ускорение свободного падения g', '981'],
  ],
  pow: [
    ['n', 'показатель степени n в s = c·tⁿ', '3'],
    ['S', 'путь S за время t₁', '90'],
    ['t1', 'время t₁', '1'],
  ],
  pile: [
    ['h', 'высота падения h', '2,5'],
    ['k', 'во сколько раз подъём дольше падения', '3'],
    ['g', 'g', '9,81'],
  ],
  arcs: [
    ['v', 'скорость v (км/ч, если отмечено, иначе в единицах длины/с)', '36'],
    ['kmh', 'скорость в км/ч: 1 — да, 0 — нет', '1'],
    ['rho1', 'радиус дуги 1, ρ₁', '300'],
    ['al1', 'центральный угол дуги 1, °', '60'],
    ['rho2', 'радиус дуги 2, ρ₂', '400'],
    ['al2', 'центральный угол дуги 2, °', '60'],
    ['rho3', 'радиус дуги 3 (пусто — нет)', ''],
    ['al3', 'центральный угол дуги 3, °', ''],
  ],
  when: [
    ['f', 'функция f(t) (координата, расстояние…)', '1 − cos(t)'],
    ['c', 'значения через «;» — найти t, при которых f(t) равна каждому', '0; 1; 2'],
  ],
};
export const compDefaults = (kind: CompKind): Record<string, string> => ({ kind, ...Object.fromEntries(COMP_FIELDS[kind].map(([k, , d]) => [k, d])) });

export interface CompResult {
  ok: boolean;
  errors: string[];
  kind: CompKind;
  /** Именованные результаты (для ответа книги и текста решения). */
  out: Record<string, number>;
  /** Кривые для чертежа: подпись, единицы по оси y, точки (t, y). */
  curves: { name: string; unit: string; pts: [number, number][] }[];
  /** Дуги (arcs): s, t начала и конца, aₙ. */
  arcs: { rho: number; alpha: number; s: number; t0: number; t1: number; an: number }[];
  /** Корни (when): значение и моменты. */
  roots: { c: number; ts: number[] }[];
  f: Expr | null;
}

const blank = (kind: CompKind, errors: string[]): CompResult => ({ ok: false, errors, kind, out: {}, curves: [], arcs: [], roots: [], f: null });

export function compKind(pr: KinProblem): CompKind {
  const k = pstr(pr, 'kind', 'drops') as CompKind;
  return COMP_KINDS.some((x) => x[0] === k) ? k : 'drops';
}

/** Корни f(t) = c на [a; b]: смена знака (деление пополам) и касание нуля (минимум |f − c|). */
export function findRoots(f: (t: number) => number, c: number, a: number, b: number, n = 6000): number[] {
  const out: number[] = [];
  const h = (b - a) / n;
  const g = (t: number) => f(t) - c;
  let scale = 1e-12;
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const y = g(a + i * h);
    ys.push(y);
    if (Number.isFinite(y)) scale = Math.max(scale, Math.abs(y + c));
  }
  const push = (t: number) => {
    if (!out.some((x) => Math.abs(x - t) < 1e-7 * Math.max(1, Math.abs(t)))) out.push(t);
  };
  for (let i = 0; i < n; i++) {
    const y0 = ys[i],
      y1 = ys[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) push(a + i * h);
    else if (y0 * y1 < 0) {
      let lo = a + i * h,
        hi = lo + h,
        flo = y0;
      for (let k = 0; k < 80; k++) {
        const m = (lo + hi) / 2,
          fm = g(m);
        if (fm * flo <= 0) hi = m;
        else ((lo = m), (flo = fm));
      }
      push((lo + hi) / 2);
    }
  }
  if (ys[n] === 0) push(b);
  // Касание: локальный минимум |g| почти нулевой.
  for (let i = 1; i < n; i++) {
    const m = Math.abs(ys[i]);
    if (m <= Math.abs(ys[i - 1]) && m <= Math.abs(ys[i + 1]) && m < 1e-4 * scale && ys[i - 1] * ys[i + 1] >= 0) {
      let lo = a + (i - 1) * h,
        hi = a + (i + 1) * h;
      for (let k = 0; k < 100; k++) {
        const m1 = lo + (hi - lo) / 3,
          m2 = hi - (hi - lo) / 3;
        if (Math.abs(g(m1)) < Math.abs(g(m2))) hi = m2;
        else lo = m1;
      }
      const t = (lo + hi) / 2;
      if (Math.abs(g(t)) < 1e-9 * scale) push(t);
    }
  }
  return out.sort((x, y) => x - y);
}

export function solveComp(pr: KinProblem): CompResult {
  const kind = compKind(pr);
  const errors: string[] = [];
  const N = (k: string, label: string, def?: number) => pnum(pr, k, label, errors, def);
  const bad = () => blank(kind, errors);
  const res = blank(kind, []);
  res.ok = true;
  if (kind === 'drops') {
    const tau = N('tau', 'интервал τ'),
      g = N('g', 'g');
    const t = pr.t;
    if (errors.length) return bad();
    if (!(tau > 0) || !(g > 0)) return { ...bad(), errors: ['τ и g должны быть положительными.'] };
    if (!(t > tau)) return { ...bad(), errors: [`Вторая капля отрывается в момент τ = ${tau}: время t должно быть больше.`] };
    const s1 = (g * t * t) / 2,
      s2 = (g * (t - tau) ** 2) / 2;
    res.out = { s1, s2, d: s1 - s2, v1: g * t, v2: g * (t - tau), t, tau, g };
    const tm = Math.max(t * 1.5, tau * 3);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const tt = tau + ((tm - tau) * i) / 120;
      pts.push([tt, g * tau * (tt - tau / 2)]);
    }
    res.curves = [{ name: 'd', unit: 'ед. длины', pts }];
    return res;
  }
  if (kind === 'pow') {
    const n = N('n', 'показатель n'),
      S = N('S', 'путь S'),
      t1 = N('t1', 'время t₁');
    const t = pr.t;
    if (errors.length) return bad();
    if (!(n > 1) || !(t1 > 0) || !(S > 0)) return { ...bad(), errors: ['Нужны n > 1, S > 0, t₁ > 0.'] };
    const c = S / t1 ** n;
    const v = (x: number) => n * c * x ** (n - 1),
      a = (x: number) => n * (n - 1) * c * x ** (n - 2);
    res.out = { c, n, v0: 0, a0: 0, s: c * t ** n, v: v(t), a: a(t), t };
    const tm = Math.max(t * 2, t1);
    const mk = (fn: (x: number) => number): [number, number][] => Array.from({ length: 101 }, (_, i) => [(tm * i) / 100, fn((tm * i) / 100)]);
    res.curves = [
      { name: 's', unit: 'ед. длины', pts: mk((x) => c * x ** n) },
      { name: 'v', unit: 'ед./время', pts: mk(v) },
      { name: 'a', unit: 'ед./время²', pts: mk(a) },
    ];
    return res;
  }
  if (kind === 'pile') {
    const h = N('h', 'высота h'),
      k = N('k', 'отношение времён'),
      g = N('g', 'g');
    if (errors.length) return bad();
    if (!(h > 0) || !(k > 0) || !(g > 0)) return { ...bad(), errors: ['h, k и g должны быть положительными.'] };
    const tf = Math.sqrt((2 * h) / g),
      tu = k * tf,
      T = tf + tu;
    res.out = { tf, tu, T, perMin: 60 / T, vEnd: g * tf, h, k, g };
    return res;
  }
  if (kind === 'arcs') {
    const kmh = pstr(pr, 'kmh', '1').trim() !== '0';
    let v = N('v', 'скорость v');
    if (errors.length) return bad();
    if (kmh) v /= 3.6;
    if (!(v > 0)) return { ...bad(), errors: ['Скорость должна быть положительной.'] };
    let t = 0;
    const arcs: CompResult['arcs'] = [];
    for (const i of [1, 2, 3]) {
      if (!pstr(pr, `rho${i}`).trim() && !pstr(pr, `al${i}`).trim()) continue;
      const rho = N(`rho${i}`, `радиус дуги ${i}`),
        al = N(`al${i}`, `угол дуги ${i}`);
      if (errors.length) return bad();
      if (!(rho > 0) || !(al > 0)) return { ...bad(), errors: [`Дуга ${i}: радиус и угол должны быть положительными.`] };
      const s = (rho * al * Math.PI) / 180;
      arcs.push({ rho, alpha: al, s, t0: t, t1: t + s / v, an: (v * v) / rho });
      t += s / v;
    }
    if (!arcs.length) return { ...bad(), errors: ['Задайте хотя бы одну дугу.'] };
    res.arcs = arcs;
    res.out = { v, T: t, L: arcs.reduce((q, x) => q + x.s, 0), ...Object.fromEntries(arcs.map((x, i) => [`an${i + 1}`, x.an])) };
    const pts: [number, number][] = [[0, 0]];
    for (const x of arcs) pts.push([x.t0, x.an], [x.t1, x.an]);
    pts.push([t, 0]);
    res.curves = [{ name: 'aₙ', unit: 'ед. длины/с²', pts }];
    return res;
  }
  // when
  const fs = pstr(pr, 'f', '1 − cos(t)');
  const e = parseExpr(fs);
  if (!e.ok) return { ...bad(), errors: [`f(t): ${e.error}.`] };
  const targets: number[] = [];
  for (const part of pstr(pr, 'c').split(';')) {
    if (!part.trim()) continue;
    const q = parseExpr(part);
    const val = q.ok ? evalExpr(q.e, 0) : NaN;
    if (!Number.isFinite(val)) return { ...bad(), errors: [`Значение «${part.trim()}» — не число.`] };
    targets.push(val);
  }
  if (!targets.length) return { ...bad(), errors: ['Задайте значения f через «;».'] };
  const [a, b] = pr.t2 > pr.t1 ? [pr.t1, pr.t2] : [0, 10];
  const fn = (t: number) => evalExpr(e.e, t);
  res.f = e.e;
  res.roots = targets.map((c) => ({ c, ts: findRoots(fn, c, a, b) }));
  res.curves = [
    { name: 'f', unit: '', pts: Array.from({ length: 301 }, (_, i) => [a + ((b - a) * i) / 300, fn(a + ((b - a) * i) / 300)] as [number, number]) },
  ];
  res.out = { a, b };
  return res;
}

/* ====================== пересчёт координат ====================== */

export type ConvSys = 'polar' | 'cyl' | 'sph';
export interface ConvResult {
  ok: boolean;
  errors: string[];
  sys: ConvSys;
  /** Таблица: t, r, φ (непрерывный), третья координата (z или θ). */
  rows: { t: number; r: number; phi: number; q: number }[];
  at: { t: number; r: number; phi: number; q: number } | null;
  /** Графики r(t), φ(t), q(t) (101 точка). */
  series: { r: [number, number][]; phi: [number, number][]; q: [number, number][] };
  /** Сверка с формулами книги: наибольшее отклонение по каждой координате (null — формула не задана). */
  dev: { r: number | null; phi: number | null; q: number | null };
  /** Отклонение больше допуска. */
  mismatch: string[];
}

export const convSys = (pr: KinProblem): ConvSys => {
  const s = pstr(pr, 'sys', 'cyl');
  return s === 'polar' || s === 'sph' ? s : 'cyl';
};

export function solveConv(pr: KinProblem): ConvResult {
  const errors: string[] = [];
  const sys = convSys(pr);
  const empty: ConvResult = {
    ok: false,
    errors,
    sys,
    rows: [],
    at: null,
    series: { r: [], phi: [], q: [] },
    dev: { r: null, phi: null, q: null },
    mismatch: [],
  };
  const parse = (s: string, label: string, optional = false): Expr | null => {
    if (!s.trim()) {
      if (!optional) errors.push(`${label}: пусто.`);
      return null;
    }
    const e = parseExpr(s);
    if (!e.ok) {
      errors.push(`${label}: ${e.error}.`);
      return null;
    }
    return e.e;
  };
  const ex = parse(pr.x, 'x(t)');
  const ey = parse(pr.y, 'y(t)');
  const ez = parse(pr.z, 'z(t)', sys === 'polar');
  const bR = parse(pstr(pr, 'rb'), 'r(t) книги', true);
  const bP = parse(pstr(pr, 'pb'), 'φ(t) книги', true);
  const bQ = parse(pstr(pr, 'zb'), sys === 'sph' ? 'θ(t) книги' : 'z(t) книги', true);
  if (errors.length || !ex || !ey) return empty;
  const [a, b] = pr.t2 > pr.t1 ? [pr.t1, pr.t2] : [0, Math.max(pr.t, 1)];
  const at = (t: number) => {
    const x = evalExpr(ex, t),
      y = evalExpr(ey, t),
      z = ez ? evalExpr(ez, t) : 0;
    const rho = Math.hypot(x, y);
    const r = sys === 'sph' ? Math.hypot(rho, z) : rho;
    return { r, phi: Math.atan2(y, x), q: sys === 'sph' ? Math.atan2(z, rho) : z };
  };
  // Непрерывный угол φ: сквозная развёртка по равномерной сетке.
  const n = 400;
  const unw: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = at(a + ((b - a) * i) / n).phi;
    if (i === 0) unw.push(p);
    else {
      const prev = unw[i - 1];
      unw.push(p + 2 * Math.PI * Math.round((prev - p) / (2 * Math.PI)));
    }
  }
  const phiCont = (t: number) => {
    const u = ((t - a) / (b - a)) * n;
    const i = Math.max(0, Math.min(n - 1, Math.floor(u)));
    const p = at(t).phi;
    return p + 2 * Math.PI * Math.round((unw[i] - p) / (2 * Math.PI));
  };
  const rows = Array.from({ length: 9 }, (_, i) => {
    const t = a + ((b - a) * i) / 8;
    const c = at(t);
    return { t, r: c.r, phi: phiCont(t), q: c.q };
  });
  const series: ConvResult['series'] = { r: [], phi: [], q: [] };
  for (let i = 0; i <= 100; i++) {
    const t = a + ((b - a) * i) / 100;
    const c = at(t);
    series.r.push([t - a, c.r]);
    series.phi.push([t - a, phiCont(t)]);
    series.q.push([t - a, c.q]);
  }
  const cur = at(pr.t);
  const here = { t: pr.t, r: cur.r, phi: phiCont(Math.min(b, Math.max(a, pr.t))), q: cur.q };
  if (![here.r, here.phi, here.q, ...rows.flatMap((x) => [x.r, x.phi, x.q])].every(Number.isFinite))
    return { ...empty, errors: ['В части промежутка формулы не определены.'] };
  const dev: ConvResult['dev'] = { r: null, phi: null, q: null };
  const mismatch: string[] = [];
  const wrap = (d: number) => Math.abs(d - 2 * Math.PI * Math.round(d / (2 * Math.PI)));
  const check = (e: Expr | null, key: 'r' | 'phi' | 'q', label: string, angle: boolean) => {
    if (!e) return;
    let m = 0;
    for (let i = 0; i <= 200; i++) {
      const t = a + ((b - a) * i) / 200;
      const want = evalExpr(e, t);
      const got = at(t)[key];
      const d = angle ? wrap(got - want) : Math.abs(got - want);
      if (Number.isFinite(d)) m = Math.max(m, d);
      else m = Infinity;
    }
    dev[key] = m;
    if (!(m < 1e-8 * 1 + 1e-9 * Math.abs(here[key]))) mismatch.push(label);
  };
  check(bR, 'r', 'r', false);
  check(bP, 'phi', 'φ', true);
  check(bQ, 'q', sys === 'sph' ? 'θ' : 'z', sys === 'sph');
  return { ok: true, errors: [], sys, rows, at: here, series, dev, mismatch };
}
