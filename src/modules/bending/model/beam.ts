/**
 * Прямая горизонтальная балка: участки и эпюры Q, M по найденным реакциям («Балки и рамы»).
 * Сечение рассматривается слева: своя часть — всё, что левее начала участка, и сам участок до сечения;
 * координата z участка отсчитывается от его левого края (0 ≤ z ≤ l).
 */
import { dirOf } from '../../../shared/format';
import { polyAdd, polyEval, polyDeriv, rootsInside, type Poly } from '../../../shared/poly';
import type { Analysis } from '../../frames/analyze';
import { LOADDIR } from '../../frames/model/constants';
import { resolve, type Pt } from '../../frames/model/geometry';
import type { DistItem, Structure } from '../../frames/model/types';
import type { Action } from '../../frames/solver/model';
import { coupleContribution, distBehindContribution, distOwnContribution, forceContribution, frameOf, type Contribution } from './forces';

/** Откуда слагаемое (для записи формул). */
export type TermSrc =
  | { kind: 'force'; act: Action; val: number; /** Расстояние от силы до начала участка. */ arm: number }
  | { kind: 'couple'; act: Action; val: number }
  /** Распределённая нагрузка левее участка: кусок от x0 до x1 с интенсивностью qa → qb. */
  /** dn — проекция направления нагрузки на поперечную ось (вверх +1, вниз −1). */
  | { kind: 'distBehind'; item: DistItem; S: string; qa: number; qb: number; x0: number; x1: number; /** До начала участка. */ to: number; dn: number }
  /** Распределённая нагрузка на самом участке: q(z) = qa + k·z. */
  | { kind: 'distOwn'; item: DistItem; S: string; qa: number; k: number; dn: number };

export interface Term {
  src: TermSrc;
  c: Contribution;
}

export interface Span {
  index: number;
  /** Точки на концах (имена) и координаты. */
  from: string;
  to: string;
  x0: number;
  x1: number;
  L: number;
  terms: Term[];
  N: Poly;
  Q: Poly;
  M: Poly;
  /** Сечения внутри участка, где Q = 0 (экстремум M), — z от начала участка. */
  extrema: number[];
}

export interface BeamPoint {
  id: string;
  name: string;
  x: number;
  hinge: boolean;
  /** В точке есть сосредоточенная сила (включая реакцию) или пара. */
  loaded: boolean;
}

export interface Beam {
  L: number;
  points: BeamPoint[];
  spans: Span[];
  /** Внешние сосредоточенные силы и пары с найденными значениями (для проверок скачков). */
  forces: { act: Action; val: number; x: number; F: Pt }[];
  couples: { act: Action; val: number; x: number; m: number }[];
  /** Есть продольные силы (горизонтальные составляющие) — эпюра N не нулевая. */
  hasN: boolean;
  scaleQ: number;
  scaleM: number;
}

export type BeamResult = { ok: true; beam: Beam } | { ok: false; why: 'notbeam' | 'status' | 'baddist' };

const EPS = 1e-9;

/** Балка для эпюр: все участки горизонтальны, система определима и решена. */
export function analyzeBeam(s: Structure, a: Analysis): BeamResult {
  const { model: m, solution: sol } = a;
  if (s.segs.some((q) => q.dir !== 'r' && q.dir !== 'l')) return { ok: false, why: 'notbeam' };
  if (sol.status !== 'ok') return { ok: false, why: 'status' };
  if (m.badDists.length) return { ok: false, why: 'baddist' };
  const { g, items } = resolve(s);
  const distIds = new Set(items.filter((it) => it.type === 'dist').map((it) => it.id));

  // Сосредоточенные силы и пары: реакции (без взаимных сил в шарнирах), известные и найденные нагрузки.
  const forces: Beam['forces'] = [];
  const couples: Beam['couples'] = [];
  for (const act of [...m.unknowns.filter((u) => !u.hinge), ...m.knowns.filter((k) => !distIds.has(k.itemId))]) {
    const val = act.key !== undefined ? sol.vals[act.key] : (act.val as number);
    if (act.kind === 'm') couples.push({ act, val, x: act.x, m: act.s * val });
    else forces.push({ act, val, x: act.x, F: [act.dx * val, act.dy * val] });
  }
  const dists = items
    .filter((it): it is DistItem => it.type === 'dist')
    .map((it) => {
      const xa = g.pos[it.from][0],
        xb = g.pos[it.to][0];
      const d = dirOf(LOADDIR[it.dir].ang);
      // Интенсивность в точке x (линейно между концами).
      const qAt = (x: number) => +it.q1 + ((+it.q2 - +it.q1) * (x - xa)) / (xb - xa);
      return { it, lo: Math.min(xa, xb), hi: Math.max(xa, xb), qAt, d: [d.dx, d.dy] as Pt, S: m.labels[it.id]?.S ?? '' };
    });

  // Точки балки слева направо; участки — между точками, где что-то меняется.
  const hingeIds = new Set(s.nodes.filter((n) => n.hinge).map((n) => n.id));
  const pointItemsAt = new Set(items.filter((it) => it.type !== 'dist').map((it) => (it as { at: string }).at));
  const distEnds = new Set(items.flatMap((it) => (it.type === 'dist' ? [it.from, it.to] : [])));
  const points: BeamPoint[] = g.order
    .map((id) => ({ id, name: g.name[id], x: g.pos[id][0], hinge: hingeIds.has(id), loaded: pointItemsAt.has(id) }))
    .sort((p, q) => p.x - q.x);
  const L = points[points.length - 1].x;
  const breaks = points.filter((p, i) => i === 0 || i === points.length - 1 || p.hinge || p.loaded || distEnds.has(p.id));

  const spans: Span[] = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const A = breaks[i],
      B = breaks[i + 1];
    const f = frameOf([A.x, 0], [B.x, 0]);
    const terms: Term[] = [];
    for (const fo of forces)
      if (fo.x <= A.x + EPS) terms.push({ src: { kind: 'force', act: fo.act, val: fo.val, arm: A.x - fo.x }, c: forceContribution(f, [fo.x, 0], fo.F) });
    for (const co of couples) if (co.x <= A.x + EPS) terms.push({ src: { kind: 'couple', act: co.act, val: co.val }, c: coupleContribution(co.m) });
    for (const w of dists) {
      if (w.lo < A.x - EPS) {
        const x1 = Math.min(w.hi, A.x);
        const load = { kind: 'dist' as const, id: w.it.id, P0: [w.lo, 0] as Pt, P1: [x1, 0] as Pt, q0: w.qAt(w.lo), q1: w.qAt(x1), d: w.d };
        terms.push({
          src: { kind: 'distBehind', item: w.it, S: w.S, qa: load.q0, qb: load.q1, x0: w.lo, x1, to: A.x - x1, dn: w.d[1] },
          c: distBehindContribution(f, load),
        });
      }
      if (w.lo <= A.x + EPS && w.hi >= B.x - EPS) {
        const qa = w.qAt(A.x),
          k = (w.qAt(B.x) - qa) / f.L;
        terms.push({ src: { kind: 'distOwn', item: w.it, S: w.S, qa, k, dn: w.d[1] }, c: distOwnContribution(f, qa, k, w.d) });
      }
    }
    const sum = (key: 'N' | 'Q' | 'M') => terms.reduce<Poly>((acc, t) => polyAdd(acc, t.c[key]), [0]);
    const N = sum('N'),
      Q = sum('Q'),
      M = sum('M');
    spans.push({ index: i, from: A.name, to: B.name, x0: A.x, x1: B.x, L: f.L, terms, N, Q, M, extrema: [] });
  }

  const scaleQ = Math.max(1e-12, ...spans.flatMap((sp) => [polyEval(sp.Q, 0), polyEval(sp.Q, sp.L)].map(Math.abs)));
  for (const sp of spans) sp.extrema = rootsInside(polyDeriv(sp.M), 0, sp.L, scaleQ);
  const scaleM = Math.max(1e-12, ...spans.flatMap((sp) => [0, sp.L, ...sp.extrema].map((z) => Math.abs(polyEval(sp.M, z)))));
  const hasN = spans.some((sp) => sp.N.some((c) => Math.abs(c) > 1e-9 * scaleQ));
  return { ok: true, beam: { L, points, spans, forces, couples, hasN, scaleQ, scaleM } };
}

/** Значения Q и M в сечении балки x (слева — limit x−0, справа — x+0). */
export function valuesAt(b: Beam, x: number, side: 'left' | 'right' = 'right'): { Q: number; M: number } {
  const sp =
    side === 'right'
      ? (b.spans.find((s) => x >= s.x0 - EPS && x < s.x1 - EPS) ?? b.spans[b.spans.length - 1])
      : (b.spans.find((s) => x > s.x0 + EPS && x <= s.x1 + EPS) ?? b.spans[0]);
  const z = Math.min(Math.max(x - sp.x0, 0), sp.L);
  return { Q: polyEval(sp.Q, z), M: polyEval(sp.M, z) };
}
