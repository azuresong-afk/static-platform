/**
 * Эпюры N, Q, M для плоской рамы-дерева (в том числе с наклонными стержнями) по найденным реакциям
 * из «Балок и рам». Метод сечений — src/modules/bending/model/forces.ts.
 *
 * Каждый участок рамы (Seg) — свой участок эпюр. Сечение делит раму-дерево на две части; «своя» — та, где
 * меньше сил (без неизвестных реакций, если можно). Координата z отсчитывается от конца участка со стороны
 * своей части (P0) к другому концу (P1), u — орт P0→P1, n — u, повёрнутый на 90° против часовой.
 *
 * Правила знаков (от направления обхода не зависят):
 *   N > 0 — растяжение;
 *   Q > 0 — сила своей части вращает её относительно сечения по часовой стрелке;
 *   M — откладывается со стороны растянутых (или сжатых) волокон; в формулах M > 0, если растянуты волокна
 *       со стороны −n (справа по ходу z: у горизонтального участка, пройденного слева направо, — снизу).
 */
import { dirOf } from '../../../shared/format';
import { polyAdd, polyDeriv, polyEval, rootsInside, type Poly } from '../../../shared/poly';
import type { Analysis } from '../../frames/analyze';
import { loadAngle } from '../../frames/model/constants';
import { distGeom, pathNodes, resolve, type Geom, type Pt } from '../../frames/model/geometry';
import type { DistItem, Seg, Structure } from '../../frames/model/types';
import type { Action } from '../../frames/solver/model';
import { coupleContribution, distBehindContribution, distOwnContribution, forceContribution, frameOf, type Contribution } from '../../bending/model/forces';

export type FTermSrc =
  | { kind: 'force'; act: Action; val: number; r: Pt }
  | { kind: 'couple'; act: Action; val: number }
  /** Кусок распределённой нагрузки целиком в своей части: от A до B, интенсивность qa → qb по направлению d. */
  | { kind: 'distBehind'; item: DistItem; S: string; A: Pt; B: Pt; qa: number; qb: number; d: Pt }
  /** Нагрузка на самом участке: q(z) = qa + k·z. */
  | { kind: 'distOwn'; item: DistItem; S: string; qa: number; k: number; d: Pt };

export interface FTerm {
  src: FTermSrc;
  c: Contribution;
}

export interface Bar {
  index: number;
  seg: Seg;
  /** Узлы начала (со стороны своей части) и конца, их имена и координаты. */
  id0: string;
  id1: string;
  from: string;
  to: string;
  P0: Pt;
  P1: Pt;
  L: number;
  u: Pt;
  n: Pt;
  terms: FTerm[];
  N: Poly;
  Q: Poly;
  M: Poly;
  /** z внутри участка, где Q = 0 (экстремум M). */
  extrema: number[];
  /** Где растянуты волокна при M > 0 (сторона −n): «снизу», «сверху», «слева», «справа». */
  plusSide: 'снизу' | 'сверху' | 'слева' | 'справа';
}

export interface FramePoint {
  id: string;
  name: string;
  pos: Pt;
  hinge: boolean;
}

/** Равновесие узла: силы и моменты от концов участков и внешние силы и пары в узле. */
export interface JointCheck {
  id: string;
  name: string;
  /** Моменты концов участков, действующие на узел (против часовой — «+»), и от какого участка. */
  ends: { bar: number; other: string; m: number; F: Pt }[];
  /** Внешние силы и пары в узле (нагрузки и реакции). */
  F: Pt;
  m: number;
  sum: { x: number; y: number; m: number };
}

export interface FrameDiag {
  points: FramePoint[];
  bars: Bar[];
  forces: { act: Action; val: number; node: string; F: Pt }[];
  couples: { act: Action; val: number; node: string; m: number }[];
  joints: JointCheck[];
  scaleN: number;
  scaleQ: number;
  scaleM: number;
}

export type FrameResult = { ok: true; frame: FrameDiag } | { ok: false; why: 'empty' | 'status' | 'baddist' };


/** Узлы поддерева с корнем id (включая его). */
function subtree(g: Geom, segs: Seg[], id: string): Set<string> {
  const kids: Record<string, string[]> = {};
  for (const q of segs) (kids[q.a] ||= []).push(q.b);
  const out = new Set<string>();
  const st = [id];
  while (st.length) {
    const x = st.pop()!;
    if (out.has(x) || !(x in g.pos)) continue;
    out.add(x);
    st.push(...(kids[x] ?? []));
  }
  return out;
}

const sideName = (m: Pt): Bar['plusSide'] => (Math.abs(m[1]) > 1e-9 ? (m[1] < 0 ? 'снизу' : 'сверху') : m[0] < 0 ? 'слева' : 'справа');

/** Канонический обход участка: слева направо, вертикальный — снизу вверх. */
export function canonical(A: Pt, B: Pt): boolean {
  return Math.abs(A[0] - B[0]) < 1e-9 ? A[1] < B[1] : A[0] < B[0];
}

export function analyzeFrame(s: Structure, a: Analysis): FrameResult {
  const { model: m, solution: sol } = a;
  if (!s.segs.length) return { ok: false, why: 'empty' };
  if (sol.status !== 'ok') return { ok: false, why: 'status' };
  if (m.badDists.length) return { ok: false, why: 'baddist' };
  const { g, items } = resolve(s);
  const hinge = new Set(s.nodes.filter((n) => n.hinge).map((n) => n.id));
  const points: FramePoint[] = g.order.map((id) => ({ id, name: g.name[id], pos: g.pos[id], hinge: hinge.has(id) }));
  const nodeAt = (x: number, y: number): string => {
    let best = g.order[0],
      bd = Infinity;
    for (const id of g.order) {
      const d = Math.hypot(g.pos[id][0] - x, g.pos[id][1] - y);
      if (d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  };

  const distIds = new Set(items.filter((it) => it.type === 'dist').map((it) => it.id));
  const forces: FrameDiag['forces'] = [];
  const couples: FrameDiag['couples'] = [];
  for (const act of [...m.unknowns.filter((u) => !u.hinge), ...m.knowns.filter((k) => !distIds.has(k.itemId))]) {
    const val = act.key !== undefined ? sol.vals[act.key] : (act.val as number);
    const node = nodeAt(act.x, act.y);
    if (act.kind === 'm') couples.push({ act, val, node, m: act.s * val });
    else forces.push({ act, val, node, F: [act.dx * val, act.dy * val] });
  }

  // Распределённые нагрузки — кусками по участкам.
  interface Piece {
    it: DistItem;
    S: string;
    seg: Seg;
    a: string;
    b: string;
    qa: number;
    qb: number;
    d: Pt;
  }
  const pieces: Piece[] = [];
  const segBetween = (p: string, q: string) => s.segs.find((x) => (x.a === p && x.b === q) || (x.a === q && x.b === p))!;
  for (const it of items) {
    if (it.type !== 'dist') continue;
    const dg = distGeom(g, it);
    if (!dg.ok) continue;
    const dd = dirOf(loadAngle(it.dir, dg.ang));
    const d: Pt = [dd.dx, dd.dy];
    const P = g.pos[it.from],
      Lt = dg.len;
    const qAt = (id: string) => +it.q1 + ((+it.q2 - +it.q1) * Math.hypot(g.pos[id][0] - P[0], g.pos[id][1] - P[1])) / Lt;
    const path = pathNodes(g, it.from, it.to);
    for (let i = 0; i + 1 < path.length; i++)
      pieces.push({ it, S: m.labels[it.id]?.S ?? '', seg: segBetween(path[i], path[i + 1]), a: path[i], b: path[i + 1], qa: qAt(path[i]), qb: qAt(path[i + 1]), d });
  }

  /** Слагаемые для участка q, если своя часть — со стороны узла id0. */
  const termsFor = (q: Seg, id0: string, own: Set<string>, P0: Pt, P1: Pt): FTerm[] => {
    const f = frameOf(P0, P1);
    const terms: FTerm[] = [];
    for (const fo of forces) if (own.has(fo.node)) terms.push({ src: { kind: 'force', act: fo.act, val: fo.val, r: g.pos[fo.node] }, c: forceContribution(f, g.pos[fo.node], fo.F) });
    for (const co of couples) if (own.has(co.node)) terms.push({ src: { kind: 'couple', act: co.act, val: co.val }, c: coupleContribution(co.m) });
    for (const pc of pieces) {
      if (pc.seg === q) {
        const [qa, qb] = pc.a === id0 ? [pc.qa, pc.qb] : [pc.qb, pc.qa];
        const k = (qb - qa) / f.L;
        terms.push({ src: { kind: 'distOwn', item: pc.it, S: pc.S, qa, k, d: pc.d }, c: distOwnContribution(f, qa, k, pc.d) });
      } else if (own.has(pc.a) && own.has(pc.b)) {
        const A = g.pos[pc.a],
          B = g.pos[pc.b];
        terms.push({
          src: { kind: 'distBehind', item: pc.it, S: pc.S, A, B, qa: pc.qa, qb: pc.qb, d: pc.d },
          c: distBehindContribution(f, { kind: 'dist', id: pc.it.id, P0: A, P1: B, q0: pc.qa, q1: pc.qb, d: pc.d }),
        });
      }
    }
    return terms;
  };

  const all = new Set(g.order);
  const bars: Bar[] = g.segOrder.map((q, index) => {
    const below = subtree(g, s.segs, q.b);
    const above = new Set([...all].filter((x) => !below.has(x)));
    // Варианты: своя часть — поддерево узла b (обход b → a) или остальное (a → b).
    const opts = [
      { id0: q.a, id1: q.b, own: above },
      { id0: q.b, id1: q.a, own: below },
    ].map((o) => {
      const P0 = g.pos[o.id0],
        P1 = g.pos[o.id1];
      const terms = termsFor(q, o.id0, o.own, P0, P1);
      const reactions = terms.filter((t) => (t.src.kind === 'force' || t.src.kind === 'couple') && t.src.act.key !== undefined).length;
      return { ...o, P0, P1, terms, cost: (reactions ? 1000 : 0) + terms.filter((t) => t.src.kind !== 'distOwn').length * 10 + (canonical(P0, P1) ? 0 : 1) };
    });
    const best = opts[0].cost <= opts[1].cost ? opts[0] : opts[1];
    const f = frameOf(best.P0, best.P1);
    const sum = (key: 'N' | 'Q' | 'M') => best.terms.reduce<Poly>((acc, t) => polyAdd(acc, t.c[key]), [0]);
    return {
      index,
      seg: q,
      id0: best.id0,
      id1: best.id1,
      from: g.name[best.id0],
      to: g.name[best.id1],
      P0: best.P0,
      P1: best.P1,
      L: f.L,
      u: f.u,
      n: f.n,
      terms: best.terms,
      N: sum('N'),
      Q: sum('Q'),
      M: sum('M'),
      extrema: [],
      plusSide: sideName([-f.n[0], -f.n[1]]),
    };
  });

  const scaleN = Math.max(1e-12, ...bars.map((b) => Math.max(Math.abs(polyEval(b.N, 0)), Math.abs(polyEval(b.N, b.L)))));
  const scaleQ = Math.max(1e-12, ...bars.map((b) => Math.max(Math.abs(polyEval(b.Q, 0)), Math.abs(polyEval(b.Q, b.L)))));
  for (const b of bars) b.extrema = rootsInside(polyDeriv(b.M), 0, b.L, scaleQ);
  const scaleM = Math.max(1e-12, ...bars.flatMap((b) => [0, b.L, ...b.extrema].map((z) => Math.abs(polyEval(b.M, z)))));

  // Равновесие узлов.
  const joints: JointCheck[] = points.map((p) => {
    const e: JointCheck['ends'] = [];
    for (const b of bars) {
      if (b.id0 === p.id) {
        const N = polyEval(b.N, 0),
          Q = polyEval(b.Q, 0);
        e.push({ bar: b.index, other: b.to, m: polyEval(b.M, 0), F: [N * b.u[0] - Q * b.n[0], N * b.u[1] - Q * b.n[1]] });
      } else if (b.id1 === p.id) {
        const N = polyEval(b.N, b.L),
          Q = polyEval(b.Q, b.L);
        e.push({ bar: b.index, other: b.from, m: -polyEval(b.M, b.L), F: [-N * b.u[0] + Q * b.n[0], -N * b.u[1] + Q * b.n[1]] });
      }
    }
    const F: Pt = [0, 0];
    for (const fo of forces) if (fo.node === p.id) (F[0] += fo.F[0]), (F[1] += fo.F[1]);
    const mm = couples.filter((c) => c.node === p.id).reduce((acc, c) => acc + c.m, 0);
    return {
      id: p.id,
      name: p.name,
      ends: e,
      F,
      m: mm,
      sum: { x: F[0] + e.reduce((a2, x) => a2 + x.F[0], 0), y: F[1] + e.reduce((a2, x) => a2 + x.F[1], 0), m: mm + e.reduce((a2, x) => a2 + x.m, 0) },
    };
  });

  return { ok: true, frame: { points, bars, forces, couples, joints, scaleN, scaleQ, scaleM } };
}

/** Наибольшие по модулю N, Q, M: значение, участок и z. */
export function frameMaxima(fr: FrameDiag): Record<'N' | 'Q' | 'M', { v: number; bar: number; z: number }> {
  const r = { N: { v: 0, bar: 0, z: 0 }, Q: { v: 0, bar: 0, z: 0 }, M: { v: 0, bar: 0, z: 0 } };
  for (const b of fr.bars)
    for (const key of ['N', 'Q', 'M'] as const) {
      const zs = [0, b.L, ...rootsInside(polyDeriv(b[key]), 0, b.L, key === 'M' ? fr.scaleQ : Math.max(fr.scaleN, fr.scaleQ))];
      for (const z of zs) {
        const v = polyEval(b[key], z);
        if (Math.abs(v) > Math.abs(r[key].v) + 1e-12) r[key] = { v, bar: b.index, z };
      }
    }
  return r;
}
