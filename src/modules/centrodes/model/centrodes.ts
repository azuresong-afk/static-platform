/**
 * Неподвижная и подвижная центроиды плоского движения (Мещерский §17).
 *
 * Центроиды — геометрические места мгновенного центра скоростей P: в неподвижной плоскости (неподвижная центроида) и в плоскости,
 * жёстко связанной с телом (подвижная центроида). При движении подвижная центроида катится по неподвижной без скольжения,
 * точка касания — P.
 *
 * Источник движения — одно из двух:
 *  • механизм (раздел «Плоский механизм»): положение задано параметром φ (°), мгновенный центр звена даёт решение скоростей
 *    (`kinematics`) в каждом положении; подвижные оси связаны со звеном: начало — точка o, ось ξ — по направлению o→to,
 *    повёрнутому на rot (°), η — ось ξ, повёрнутая на +90°;
 *  • заданное движение тела: координаты начала подвижных осей x(φ), y(φ) и угол ξ-оси к оси x θ(φ) (формулы от t = φ, градусы).
 *    Тогда P = O + (−y′, x′)/θ′ (штрих — производная по φ, θ′ — в рад на единицу φ), а координаты P в подвижных осях
 *    ξ = (P − O)·ξ̂, η = (P − O)·η̂.
 */
import { diff, evalExpr, parseExpr, type Expr } from '../../../shared/expr';
import { kinematics, type MechProblem, type V2 } from '../../mechanism/model/mech';

export type { V2 };

export interface Frame {
  /** Начало подвижных осей — точка звена. */
  o: string;
  /** Точка, задающая направление оси ξ (от o к to). */
  to: string;
  /** Поворот направления o→to для оси ξ, °. */
  rot: number;
}

export interface MechPart {
  problem: MechProblem;
  /** Диапазон φ, °, на котором работает эта часть (при выходе за него положение строится заново с другой ветвью). */
  from: number;
  to: number;
}

export interface MechSource {
  kind: 'mech';
  parts: MechPart[];
  /** Звено, чьи центроиды ищем. */
  body: string;
  frame: Frame;
}

/** Фигура в подвижных осях для чертежа. */
export type Shape = { k: 'poly'; pts: V2[] } | { k: 'circle'; c: V2; r: number };

export interface MotionSource {
  kind: 'motion';
  /** Угол оси ξ к направлению θ, °: ξ̂ = (cos(θ + frameRot), sin(θ + frameRot)). */
  frameRot: number;
  /** Формулы от t = φ (°): начало подвижных осей и угол оси ξ (°). */
  x: string;
  y: string;
  theta: string;
  from: number;
  to: number;
  shapes: Shape[];
}

export type Source = MechSource | MotionSource;

export interface Pose {
  ok: boolean;
  errors: string[];
  /** Мгновенный центр скоростей в неподвижных осях; null — тело движется поступательно. */
  ic: V2 | null;
  /** Он же в подвижных осях. */
  local: V2 | null;
  origin: V2;
  xi: V2;
  eta: V2;
  /** Чертёж тела в неподвижных осях: ломаные и окружности. */
  lines: V2[][];
  circles: { c: V2; r: number }[];
  /** Неподвижные точки (опоры, оси). */
  fixedPts: { name: string; p: V2 }[];
  omega: number;
}

export interface Centrodes {
  ok: boolean;
  errors: string[];
  /** Ломаные неподвижной центроиды (разрывы — там, где центр уходит в бесконечность). */
  fixed: V2[][];
  /** Подвижная центроида в подвижных осях. */
  moving: V2[][];
  /** Значения φ по ломаным (для сверки с уравнениями). */
  phis: number[][];
}

const rad = (a: number) => (a * Math.PI) / 180;
const rot = (v: V2, a: number): V2 => [v[0] * Math.cos(rad(a)) - v[1] * Math.sin(rad(a)), v[0] * Math.sin(rad(a)) + v[1] * Math.cos(rad(a))];
const norm = (v: V2): V2 => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

export const sourceRange = (s: Source): [number, number] =>
  s.kind === 'mech' ? [Math.min(...s.parts.map((p) => p.from)), Math.max(...s.parts.map((p) => p.to))] : [s.from, s.to];

/** Подстановка φ (°) в числовые поля механизма (в том числе в углы прямых построения «пересечение»). */
const NUMERIC = new Set(['x', 'y', 'L', 'ang', 'L1', 'L2', 't', 'r', 'r1', 'r2', 'w', 'e', 'v', 'a', 'a1', 'a2', 'vang', 'aang', 'F', 'M', 'm', 'J']);
function substPhi<T>(o: T, s: string): T {
  if (Array.isArray(o)) return o.map((x) => substPhi(x, s)) as T;
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'string' && NUMERIC.has(k) ? v.replace(/φ|phi/g, s) : substPhi(v, s);
    return out as T;
  }
  return o;
}

const bad = (msg: string[]): Pose => ({
  ok: false,
  errors: msg,
  ic: null,
  local: null,
  origin: [0, 0],
  xi: [1, 0],
  eta: [0, 1],
  lines: [],
  circles: [],
  fixedPts: [],
  omega: 0,
});

interface MotionExprs {
  x: Expr;
  y: Expr;
  th: Expr;
  dx: Expr;
  dy: Expr;
  dth: Expr;
}
const cache = new Map<string, MotionExprs | string>();
function motionExprs(s: MotionSource): MotionExprs | string {
  const key = [s.x, s.y, s.theta].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const parse = (src: string, what: string): Expr | string => {
    const p = parseExpr(src);
    return p.ok ? p.e : `${what}: ${p.error}`;
  };
  const x = parse(s.x, 'x(φ)'),
    y = parse(s.y, 'y(φ)'),
    th = parse(s.theta, 'θ(φ)');
  const err = [x, y, th].find((v) => typeof v === 'string');
  const out = err ? (err as string) : { x: x as Expr, y: y as Expr, th: th as Expr, dx: diff(x as Expr), dy: diff(y as Expr), dth: diff(th as Expr) };
  cache.set(key, out);
  return out;
}

/** Положение тела и мгновенный центр при значении параметра φ. */
export function poseAt(src: Source, phi: number): Pose {
  if (src.kind === 'motion') {
    const m = motionExprs(src);
    if (typeof m === 'string') return bad([m]);
    const O: V2 = [evalExpr(m.x, phi), evalExpr(m.y, phi)];
    const th = evalExpr(m.th, phi);
    const w = rad(evalExpr(m.dth, phi));
    const vx = evalExpr(m.dx, phi),
      vy = evalExpr(m.dy, phi);
    if (![O[0], O[1], th, w, vx, vy].every(Number.isFinite)) return bad(['В этом положении формулы не определены.']);
    const xi: V2 = [Math.cos(rad(th + src.frameRot)), Math.sin(rad(th + src.frameRot))],
      eta: V2 = [-xi[1], xi[0]];
    const ic: V2 | null = Math.abs(w) > 1e-12 ? [O[0] - vy / w, O[1] + vx / w] : null;
    const toFixed = (p: V2): V2 => [O[0] + p[0] * xi[0] + p[1] * eta[0], O[1] + p[0] * xi[1] + p[1] * eta[1]];
    const lines = src.shapes.filter((s): s is Extract<Shape, { k: 'poly' }> => s.k === 'poly').map((s) => s.pts.map(toFixed));
    const circles = src.shapes.filter((s): s is Extract<Shape, { k: 'circle' }> => s.k === 'circle').map((s) => ({ c: toFixed(s.c), r: s.r }));
    const local: V2 | null = ic ? [(ic[0] - O[0]) * xi[0] + (ic[1] - O[1]) * xi[1], (ic[0] - O[0]) * eta[0] + (ic[1] - O[1]) * eta[1]] : null;
    return { ok: true, errors: [], ic, local, origin: O, xi, eta, lines, circles, fixedPts: [], omega: w };
  }
  // Между частями (ветвями механизма) берём ближайшую и зажимаем φ в её диапазон.
  const dist = (p: MechPart) => (phi < p.from ? p.from - phi : phi > p.to ? phi - p.to : 0);
  const part = src.parts.reduce((best, p) => (dist(p) < dist(best) ? p : best), src.parts[0]);
  phi = Math.min(part.to, Math.max(part.from, phi));
  const pr = substPhi({ ...part.problem, acc: false }, `(${phi})`);
  const res = kinematics(pr);
  if (!res.ok) return bad(res.errors.length ? res.errors : ['Положение не строится.']);
  const b = res.bodies.find((x) => x.name === src.body);
  if (!b) return bad([`Нет звена ${src.body}.`]);
  const O = res.pos[src.frame.o],
    T = res.pos[src.frame.to];
  if (!O || !T) return bad(['Для подвижных осей нужны точки звена.']);
  const xi = norm(rot([T[0] - O[0], T[1] - O[1]], src.frame.rot)),
    eta: V2 = [-xi[1], xi[0]];
  const ic = b.icr;
  const local: V2 | null = ic ? [(ic[0] - O[0]) * xi[0] + (ic[1] - O[1]) * xi[1], (ic[0] - O[0]) * eta[0] + (ic[1] - O[1]) * eta[1]] : null;
  const lines = pr.bodies.map((bd) => bd.pts.map((n) => res.pos[n]).filter(Boolean) as V2[]).filter((l) => l.length >= 2);
  const inBody = new Set(pr.bodies.flatMap((bd) => bd.pts));
  const fixedPts = res.points
    .filter((p) => p.aux || (pr.cons.some((c) => c.k === 'fixed' && c.p === p.name) && inBody.has(p.name)))
    .map((p) => ({ name: p.name, p: p.pos }));
  return { ok: true, errors: [], ic, local, origin: O, xi, eta, lines, circles: [], fixedPts, omega: b.omega };
}

/** Обе центроиды: φ из диапазона с шагом; точки, где центр уходит дальше clip·размер, разрывают линию. */
export function centrodes(src: Source, n = 361, clip = 8): Centrodes {
  const [a, b] = sourceRange(src);
  const fixed: V2[][] = [],
    moving: V2[][] = [],
    phis: number[][] = [];
  const errors = new Set<string>();
  let cur: { f: V2[]; m: V2[]; p: number[] } | null = null;
  const flush = () => {
    if (cur && cur.f.length > 1) (fixed.push(cur.f), moving.push(cur.m), phis.push(cur.p));
    cur = null;
  };
  // Масштаб — размер тела в каком-нибудь построенном положении.
  let size = 1e-9;
  for (let k = 1; k < 8 && size <= 1e-9; k++) {
    const mid = poseAt(src, a + ((b - a) * k) / 8);
    if (!mid.ok) continue;
    const pts = [
      ...mid.lines.flat(),
      ...mid.fixedPts.map((p) => p.p),
      mid.origin,
      ...mid.circles.flatMap((c): V2[] => [
        [c.c[0] + c.r, c.c[1]],
        [c.c[0] - c.r, c.c[1]],
        [c.c[0], c.c[1] + c.r],
        [c.c[0], c.c[1] - c.r],
      ]),
    ];
    size = Math.max(1e-9, ...pts.map((p) => Math.hypot(p[0] - mid.origin[0], p[1] - mid.origin[1])));
  }
  const parts = src.kind === 'mech' ? src.parts.map((p): [number, number] => [p.from, p.to]) : [[a, b] as [number, number]];
  const total = parts.reduce((s, [f, t]) => s + (t - f), 0) || 1;
  for (const [pf, pt] of parts) {
    const m = Math.max(2, Math.round((n * (pt - pf)) / total));
    for (let i = 0; i <= m; i++) {
      const phi = pf + ((pt - pf) * i) / m;
      const pose = poseAt(src, phi);
      if (!pose.ok) {
        pose.errors.forEach((e) => errors.add(e));
        flush();
        continue;
      }
      const far = pose.ic && Math.hypot(pose.ic[0] - pose.origin[0], pose.ic[1] - pose.origin[1]) > clip * size;
      if (!pose.ic || !pose.local || far) {
        flush();
        continue;
      }
      if (!cur) cur = { f: [], m: [], p: [] };
      cur.f.push(pose.ic);
      cur.m.push(pose.local);
      cur.p.push(phi);
    }
    flush();
  }
  return {
    ok: fixed.length > 0,
    errors: fixed.length ? [] : [...errors].slice(0, 3).concat(errors.size ? [] : ['Мгновенный центр скоростей нигде в диапазоне не определён.']),
    fixed,
    moving,
    phis,
  };
}

/** Наибольшие по модулю невязки уравнений книги вдоль построенных центроид. */
export function bookResiduals(
  check: { fixed: (v: Record<string, number>, x: number, y: number) => number; moving: (v: Record<string, number>, xi: number, eta: number) => number },
  v: Record<string, number>,
  c: Centrodes,
): { fixed: number; moving: number } {
  let f = 0,
    m = 0;
  for (const l of c.fixed) for (const [x, y] of l) f = Math.max(f, Math.abs(check.fixed(v, x, y)));
  for (const l of c.moving) for (const [x, y] of l) m = Math.max(m, Math.abs(check.moving(v, x, y)));
  return { fixed: f, moving: m };
}
