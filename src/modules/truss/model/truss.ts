/**
 * Плоская ферма: узлы с координатами, прямые стержни (шарниры в узлах), опоры и сосредоточенные силы в узлах.
 * Решение — уравнения равновесия всех узлов (метод вырезания узлов в матричной форме); для текста решения —
 * нулевые стержни по признакам, порядок вырезания узлов и сечения Риттера.
 * Правило знаков: усилие в стержне положительно, если стержень растянут (сила на узел направлена от узла вдоль стержня).
 */
import { gauss } from '../../../shared/gauss';
import { rankOf } from '../../../shared/rank';
import { ptName } from '../../frames/model/constants';

export interface TrussNode {
  x: number;
  y: number;
}
/** Стержень между узлами a и b (номера узлов). */
export interface TrussBar {
  a: number;
  b: number;
}
export type SupportKind = 'pin' | 'roller';
/** Опора: шарнирно-неподвижная (X, Y) или каток (одна реакция под углом angle к оси x). */
export interface TrussSupport {
  node: number;
  kind: SupportKind;
  /** Для катка — направление реакции к оси x, град (90 — вверх). */
  angle: number;
}
/** Сила в узле: модуль F и угол к оси x, град (270 — вниз). */
export interface TrussLoad {
  node: number;
  F: number;
  angle: number;
}
export interface Truss {
  nodes: TrussNode[];
  bars: TrussBar[];
  supports: TrussSupport[];
  loads: TrussLoad[];
}

export const nodeName = (i: number): string => ptName(i);
const rad = (a: number) => (a * Math.PI) / 180;
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
export const unitOf = (a: number): [number, number] => [clean(Math.cos(rad(a))), clean(Math.sin(rad(a)))];

export interface Reaction {
  /** X_A, Y_A, R_B. */
  L: 'X' | 'Y' | 'R';
  S: string;
  key: string;
  node: number;
  ux: number;
  uy: number;
  /** Угол положительного направления к оси x, град. */
  angle: number;
}

export function reactionsOf(t: Truss): Reaction[] {
  const out: Reaction[] = [];
  for (const s of t.supports) {
    const S = nodeName(s.node);
    if (s.kind === 'pin') {
      out.push({ L: 'X', S, key: 'X_' + S, node: s.node, ux: 1, uy: 0, angle: 0 });
      out.push({ L: 'Y', S, key: 'Y_' + S, node: s.node, ux: 0, uy: 1, angle: 90 });
    } else {
      const [ux, uy] = unitOf(s.angle);
      out.push({ L: 'R', S, key: 'R_' + S, node: s.node, ux, uy, angle: s.angle });
    }
  }
  return out;
}

/** Единичный вектор стержня от узла from к другому концу. */
export function barDir(t: Truss, k: number, from: number): [number, number] {
  const q = t.bars[k],
    o = q.a === from ? q.b : q.a;
  const P = t.nodes[from],
    Q = t.nodes[o];
  const L = Math.hypot(Q.x - P.x, Q.y - P.y);
  return [clean((Q.x - P.x) / L), clean((Q.y - P.y) / L)];
}
export const barLen = (t: Truss, k: number) => {
  const P = t.nodes[t.bars[k].a],
    Q = t.nodes[t.bars[k].b];
  return Math.hypot(Q.x - P.x, Q.y - P.y);
};
/** Стержни, сходящиеся в узле. */
export const barsAt = (t: Truss, i: number) => t.bars.map((q, k) => (q.a === i || q.b === i ? k : -1)).filter((k) => k >= 0);

export type TrussStatus = 'ok' | 'indeterminate' | 'mechanism' | 'invalid';

export interface TrussResult {
  status: TrussStatus;
  /** Для invalid — что не так. */
  errors: string[];
  n: number;
  m: number;
  r: number;
  reactions: Reaction[];
  /** Усилия в стержнях (растяжение — «+»). */
  N: number[];
  /** Значения реакций в порядке reactions. */
  R: number[];
}

/** Проверка данных: стержни между разными существующими узлами, без повторов, все узлы связаны. */
export function validate(t: Truss): string[] {
  const e: string[] = [];
  const n = t.nodes.length;
  if (n < 2) e.push('В ферме должно быть хотя бы два узла.');
  const seen = new Set<string>();
  t.bars.forEach((q, k) => {
    if (!(q.a >= 0 && q.a < n && q.b >= 0 && q.b < n)) return e.push(`Стержень ${k + 1} ссылается на несуществующий узел.`);
    if (q.a === q.b) return e.push(`Стержень ${k + 1} начинается и кончается в одном узле.`);
    const id = [Math.min(q.a, q.b), Math.max(q.a, q.b)].join('-');
    if (seen.has(id)) return e.push(`Стержень ${k + 1} повторяет другой стержень между теми же узлами.`);
    seen.add(id);
    if (barLen(t, k) < 1e-9) e.push(`Стержень ${k + 1} нулевой длины: узлы ${nodeName(q.a)} и ${nodeName(q.b)} совпадают.`);
  });
  for (let i = 0; i < n; i++) if (!t.bars.some((q) => q.a === i || q.b === i)) e.push(`К узлу ${nodeName(i)} не подходит ни один стержень.`);
  for (const s of t.supports) if (!(s.node >= 0 && s.node < n)) e.push('Опора в несуществующем узле.');
  for (const l of t.loads) if (!(l.node >= 0 && l.node < n)) e.push('Сила в несуществующем узле.');
  if (!e.length && components(t, new Set()).length > 1) e.push('Стержни не связывают все узлы в одну ферму.');
  return e;
}

/** Связные группы узлов, если убрать стержни removed. */
export function components(t: Truss, removed: Set<number>): number[][] {
  const n = t.nodes.length,
    comp = new Array<number>(n).fill(-1),
    out: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const c = out.length,
      list = [s];
    comp[s] = c;
    for (let h = 0; h < list.length; h++)
      t.bars.forEach((q, k) => {
        if (removed.has(k)) return;
        const o = q.a === list[h] ? q.b : q.b === list[h] ? q.a : -1;
        if (o >= 0 && comp[o] < 0) {
          comp[o] = c;
          list.push(o);
        }
      });
    out.push(list.sort((a, b) => a - b));
  }
  return out;
}

/** Матрица уравнений равновесия узлов: строки ΣFx, ΣFy каждого узла; столбцы — стержни, затем реакции. */
export function jointMatrix(t: Truss, reactions: Reaction[]): { A: number[][]; b: number[] } {
  const n = t.nodes.length,
    m = t.bars.length;
  const A = Array.from({ length: 2 * n }, () => new Array<number>(m + reactions.length).fill(0));
  const b = new Array<number>(2 * n).fill(0);
  t.bars.forEach((q, k) => {
    for (const i of [q.a, q.b]) {
      const [ux, uy] = barDir(t, k, i);
      A[2 * i][k] += ux;
      A[2 * i + 1][k] += uy;
    }
  });
  reactions.forEach((r, j) => {
    A[2 * r.node][m + j] += r.ux;
    A[2 * r.node + 1][m + j] += r.uy;
  });
  for (const l of t.loads) {
    const [ux, uy] = unitOf(l.angle);
    b[2 * l.node] -= l.F * ux;
    b[2 * l.node + 1] -= l.F * uy;
  }
  return { A, b };
}

export function solveTruss(t: Truss): TrussResult {
  const reactions = reactionsOf(t);
  const n = t.nodes.length,
    m = t.bars.length,
    r = reactions.length;
  const base = { n, m, r, reactions, N: [] as number[], R: [] as number[] };
  const errors = validate(t);
  if (errors.length) return { ...base, status: 'invalid', errors };
  if (m + r > 2 * n) return { ...base, status: 'indeterminate', errors: [] };
  if (m + r < 2 * n) return { ...base, status: 'mechanism', errors: [] };
  const { A, b } = jointMatrix(t, reactions);
  if (rankOf(A) < 2 * n) return { ...base, status: 'mechanism', errors: [] };
  const x = gauss(A, b).map(clean);
  return { ...base, status: 'ok', errors: [], N: x.slice(0, m), R: x.slice(m) };
}

/* ---------- нулевые стержни ---------- */

export interface ZeroBar {
  bar: number;
  node: number;
  /** two — ненагруженный узел из двух стержней не на одной прямой; three — из трёх, два на одной прямой. */
  rule: 'two' | 'three';
}

const parallel = (u: [number, number], v: [number, number]) => Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-9;

/** Нулевые стержни по признакам (с повторным применением после исключения найденных). */
export function zeroBars(t: Truss): ZeroBar[] {
  const found: ZeroBar[] = [];
  const zero = new Set<number>();
  const loaded = new Set([...t.loads.filter((l) => Math.abs(l.F) > 1e-12).map((l) => l.node), ...t.supports.map((s) => s.node)]);
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < t.nodes.length; i++) {
      if (loaded.has(i)) continue;
      const act = barsAt(t, i).filter((k) => !zero.has(k));
      const add = (k: number, rule: ZeroBar['rule']) => {
        if (zero.has(k)) return;
        zero.add(k);
        found.push({ bar: k, node: i, rule });
        changed = true;
      };
      if (act.length === 2 && !parallel(barDir(t, act[0], i), barDir(t, act[1], i))) {
        add(act[0], 'two');
        add(act[1], 'two');
      } else if (act.length === 3) {
        const d = act.map((k) => barDir(t, k, i));
        for (let j = 0; j < 3; j++) {
          const [p, q] = [0, 1, 2].filter((x) => x !== j);
          if (parallel(d[p], d[q]) && !parallel(d[p], d[j])) add(act[j], 'three');
        }
      }
    }
  }
  return found;
}

/* ---------- порядок вырезания узлов ---------- */

export interface JointStep {
  node: number;
  /** Стержни, усилия которых находим в этом узле (одно или два). */
  bars: number[];
}

/** Узлы по очереди: в каждом не больше двух неизвестных усилий (два — не на одной прямой). Реакции известны. */
export function jointOrder(t: Truss, known0: Iterable<number>): { steps: JointStep[]; rest: number[] } {
  const known = new Set(known0);
  const steps: JointStep[] = [];
  for (let progress = true; progress && known.size < t.bars.length; ) {
    progress = false;
    for (let i = 0; i < t.nodes.length; i++) {
      const unk = barsAt(t, i).filter((k) => !known.has(k));
      if (!unk.length || unk.length > 2) continue;
      if (unk.length === 2 && parallel(barDir(t, unk[0], i), barDir(t, unk[1], i))) continue;
      steps.push({ node: i, bars: unk });
      unk.forEach((k) => known.add(k));
      progress = true;
      break;
    }
  }
  return { steps, rest: t.bars.map((_, k) => k).filter((k) => !known.has(k)) };
}

/* ---------- метод сечений (Риттера) ---------- */

export interface RitterCut {
  bar: number;
  /** Два других рассечённых стержня. */
  others: [number, number];
  /** Узлы отсечённой части, для которой пишем уравнение. */
  side: number[];
  /** Точка Риттера — пересечение линий двух других стержней; null — они параллельны. */
  point: [number, number] | null;
  /** Если параллельны — ось проекций, перпендикулярная им. */
  axis: [number, number] | null;
  /** Узел стержня bar в отсечённой части. */
  at: number;
}

function lineCross(t: Truss, j: number, k: number): [number, number] | null {
  const P = t.nodes[t.bars[j].a],
    [ux, uy] = barDir(t, j, t.bars[j].a);
  const Q = t.nodes[t.bars[k].a],
    [vx, vy] = barDir(t, k, t.bars[k].a);
  const den = ux * vy - uy * vx;
  if (Math.abs(den) < 1e-9) return null;
  const s = ((Q.x - P.x) * vy - (Q.y - P.y) * vx) / den;
  return [P.x + s * ux, P.y + s * uy];
}

/** Сечение через три стержня, одно из которых — bar, делящее ферму на две части. */
export function ritterCut(t: Truss, bar: number): RitterCut | null {
  const m = t.bars.length;
  const weight = (side: number[]) => t.loads.filter((l) => side.includes(l.node)).length + t.supports.filter((s) => side.includes(s.node)).length;
  let best: RitterCut | null = null;
  for (let j = 0; j < m; j++)
    for (let k = j + 1; k < m; k++) {
      if (j === bar || k === bar) continue;
      const cut = new Set([bar, j, k]);
      const comps = components(t, cut);
      if (comps.length !== 2) continue;
      const inA = new Set(comps[0]);
      if (![bar, j, k].every((x) => inA.has(t.bars[x].a) !== inA.has(t.bars[x].b))) continue;
      const point = lineCross(t, j, k);
      let axis: [number, number] | null = null;
      if (point) {
        // Точка Риттера на линии искомого стержня — уравнение моментов его не содержит.
        const [ux, uy] = barDir(t, bar, t.bars[bar].a),
          P = t.nodes[t.bars[bar].a];
        if (Math.abs((point[0] - P.x) * uy - (point[1] - P.y) * ux) < 1e-9) continue;
      } else {
        const [ux, uy] = barDir(t, j, t.bars[j].a);
        axis = [-uy, ux];
        const [bx, by] = barDir(t, bar, t.bars[bar].a);
        if (Math.abs(bx * axis[0] + by * axis[1]) < 1e-9) continue;
      }
      const side = weight(comps[0]) <= weight(comps[1]) ? comps[0] : comps[1];
      const at = side.includes(t.bars[bar].a) ? t.bars[bar].a : t.bars[bar].b;
      const c: RitterCut = { bar, others: [j, k], side, point, axis, at };
      // Предпочтение: точка Риттера (а не проекция), меньшая отсечённая часть.
      const score = (x: RitterCut) => (x.point ? 0 : 1000) + weight(x.side) * 10 + x.side.length;
      if (!best || score(c) < score(best)) best = c;
    }
  return best;
}

/** Усилие в стержне по сечению Риттера (при известных реакциях) — независимая от узлов проверка. */
export function ritterForce(t: Truss, res: TrussResult, c: RitterCut): number {
  const inSide = new Set(c.side);
  // Внешние силы части: нагрузки и реакции в её узлах.
  const forces: { x: number; y: number; fx: number; fy: number }[] = [];
  for (const l of t.loads)
    if (inSide.has(l.node)) {
      const [ux, uy] = unitOf(l.angle);
      forces.push({ x: t.nodes[l.node].x, y: t.nodes[l.node].y, fx: l.F * ux, fy: l.F * uy });
    }
  res.reactions.forEach((r, j) => {
    if (inSide.has(r.node)) forces.push({ x: t.nodes[r.node].x, y: t.nodes[r.node].y, fx: res.R[j] * r.ux, fy: res.R[j] * r.uy });
  });
  const [ux, uy] = barDir(t, c.bar, c.at),
    A = t.nodes[c.at];
  if (c.point) {
    const [px, py] = c.point;
    const mom = (x: number, y: number, fx: number, fy: number) => (x - px) * fy - (y - py) * fx;
    const known = forces.reduce((s, f) => s + mom(f.x, f.y, f.fx, f.fy), 0);
    return -known / mom(A.x, A.y, ux, uy);
  }
  const [nx, ny] = c.axis!;
  const known = forces.reduce((s, f) => s + f.fx * nx + f.fy * ny, 0);
  return -known / (ux * nx + uy * ny);
}
