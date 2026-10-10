/**
 * Твёрдое тело в пространстве на опорах (Мещерский §8): точки с координатами, опоры (сферический шарнир,
 * подпятник, подшипник или петля, стержень или нить, гладкая опора), силы и пары. Шесть уравнений равновесия:
 * три проекции и три момента относительно осей. Уравнения-кандидаты — проекции и моменты относительно осей,
 * проходящих через опорные точки; решаем как в «Балках и рамах»: сначала уравнения с одним неизвестным.
 */
import { gauss } from '../../../shared/gauss';
import { rankOf } from '../../../shared/rank';

export type V3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export const AXES: Axis[] = ['x', 'y', 'z'];
export const AX: Record<Axis, V3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export interface BodyPoint {
  name: string;
  x: number;
  y: number;
  z: number;
}
/**
 * ball — сферический шарнир, thrust — подпятник (X, Y, Z); bearing — подшипник, петля или цилиндрический шарнир
 * с осью axis (две реакции поперёк оси); rod — стержень или нить к неподвижной точке to (усилие вдоль, «+» — от to к телу);
 * normal — гладкая опора (острие): реакция вдоль вектора n.
 */
export type SupportKind = 'ball' | 'thrust' | 'bearing' | 'rod' | 'normal';
export interface BodySupport {
  kind: SupportKind;
  at: number;
  axis?: Axis;
  /** Для стержня: неподвижный конец (номер точки). */
  to?: number;
  /** Для гладкой опоры: направление реакции. */
  n?: V3;
}
/** Сила: по составляющим (comp) или модулем F вдоль направления к точке to (toward). */
export interface BodyForce {
  at: number;
  mode: 'comp' | 'toward';
  F: number;
  /** Составляющие для mode = comp. */
  c?: V3;
  to?: number;
  /** Модуль неизвестен — ищем (направление известно). */
  unknown?: boolean;
  /**
   * Связанная сила: модуль равен k·(модуль силы с номером link), например натяжения ветвей ремня T = 2t.
   * Если та сила неизвестна, связанная входит в уравнения той же неизвестной; если известна — известна и эта.
   */
  link?: number;
  k?: number;
  /** Обозначение (G, P, T…). */
  name?: string;
}
/** Пара сил: вектор момента (составляющие по осям). */
export interface BodyPair {
  M: V3;
  name?: string;
}
export interface Body {
  points: BodyPoint[];
  supports: BodySupport[];
  forces: BodyForce[];
  pairs: BodyPair[];
  /** Для чертежа: рёбра тела (пары точек) и грани (многоугольники). */
  edges: [number, number][];
  faces: number[][];
}

export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
export const unit = (a: V3): V3 => {
  const L = norm(a) || 1;
  return [clean(a[0] / L), clean(a[1] / L), clean(a[2] / L)];
};
export const P3 = (b: Body, i: number): V3 => [b.points[i].x, b.points[i].y, b.points[i].z];

/** Силовой фактор: сила (единичное направление u в точке r) или пара (вектор u). */
export interface Action {
  /** Обозначение: буква и индекс. */
  L: string;
  S: string;
  kind: 'f' | 'm';
  r: V3;
  u: V3;
  /** Известное значение (для неизвестных — нет). */
  val?: number;
  key?: string;
  /** Для реакций — номер опоры. */
  sup?: number;
  /** Связанная сила: множитель к неизвестной key и её обозначение. */
  mult?: number;
  of?: { L: string; S: string };
  /** Известная сила, связанная с известной: T = k·t (только для пояснения; в уравнения входит модулем val). */
  rel?: { k: number; of: { L: string; S: string } };
}

export interface Candidate {
  /** 'Fx' | 'Fy' | 'Fz' | 'Mx' … ; для моментов — точка, через которую проходит ось. */
  type: 'F' | 'M';
  axis: Axis;
  P: number | null;
  coeffs: Record<string, number>;
  /** Сумма известных слагаемых. */
  cst: number;
  terms: { a: Action; c: number }[];
}

export interface BodyModel {
  unknowns: (Action & { key: string })[];
  knowns: (Action & { val: number })[];
  /** Силы, связанные с неизвестными (T = k·t). */
  dependents: (Action & { key: string })[];
  cands: Candidate[];
}

export function buildModel(b: Body): BodyModel {
  const unknowns: (Action & { key: string })[] = [];
  const knowns: (Action & { val: number })[] = [];
  /** Связанные с неизвестными силы (T = k·t): входят в уравнения неизвестной t с множителем k. */
  const dependents: (Action & { key: string })[] = [];
  const used = new Set<string>();
  let sup = 0;
  const addU = (L: string, S: string, r: V3, u: V3) => {
    let key = L + '_' + S;
    while (used.has(key)) key += "'";
    used.add(key);
    unknowns.push({ L, S: S + key.slice(L.length + 1 + S.length), kind: 'f', r, u, key, sup });
  };
  for (const [j, s] of b.supports.entries()) {
    sup = j;
    const r = P3(b, s.at),
      nm = b.points[s.at].name;
    if (s.kind === 'ball' || s.kind === 'thrust') for (const a of AXES) addU(a.toUpperCase(), nm, r, AX[a]);
    else if (s.kind === 'bearing') for (const a of AXES.filter((x) => x !== (s.axis ?? 'z'))) addU(a.toUpperCase(), nm, r, AX[a]);
    else if (s.kind === 'rod') addU('S', nm, r, unit(sub3(r, P3(b, s.to ?? 0))));
    else addU('R', nm, r, unit(s.n ?? [0, 0, 1]));
  }
  const cnt: Record<string, number> = {};
  b.forces.forEach((f) => (cnt[f.name ?? 'F'] = (cnt[f.name ?? 'F'] ?? 0) + 1));
  const idx: Record<string, number> = {};
  // Связь действует, если ведущая сила существует, не та же и сама не связана.
  const linkOf = (j: number) => {
    const f = b.forces[j];
    return f.link != null && f.link !== j && b.forces[f.link] && b.forces[f.link].link == null ? f.link : null;
  };
  const info = b.forces.map((f) => {
    const L = f.name ?? 'F';
    idx[L] = (idx[L] ?? 0) + 1;
    const S = cnt[L] > 1 ? String(idx[L]) : '';
    const r = P3(b, f.at);
    const dir: V3 = f.mode === 'toward' ? sub3(P3(b, f.to ?? 0), r) : (f.c ?? [0, 0, -1]);
    // По составляющим модуль — длина вектора; направление — его орт.
    const mag = f.mode === 'toward' ? f.F : norm(dir);
    return { L, S, r, u: unit(dir), mag, key: '' };
  });
  b.forces.forEach((f, j) => {
    if (linkOf(j) != null) return;
    const { L, S, r, u, mag } = info[j];
    if (f.unknown) {
      let key = L + (S ? '_' + S : '');
      while (used.has(key)) key += "'";
      used.add(key);
      info[j].key = key;
      unknowns.push({ L, S, kind: 'f', r, u, key });
    } else knowns.push({ L, S, kind: 'f', r, u, val: mag });
  });
  b.forces.forEach((f, j) => {
    const m = linkOf(j);
    if (m == null) return;
    const { L, S, r, u } = info[j];
    const k = f.k ?? 1;
    if (info[m].key) dependents.push({ L, S, kind: 'f', r, u, key: info[m].key, mult: k, of: { L: info[m].L, S: info[m].S } });
    else knowns.push({ L, S, kind: 'f', r, u, val: k * info[m].mag, rel: { k, of: { L: info[m].L, S: info[m].S } } });
  });
  b.pairs.forEach((p, i) => knowns.push({ L: p.name ?? 'M', S: b.pairs.length > 1 ? String(i + 1) : '', kind: 'm', r: [0, 0, 0], u: unit(p.M), val: norm(p.M) }));

  const all: Action[] = [...unknowns, ...dependents, ...knowns];
  const coef = (a: Action, type: 'F' | 'M', axis: Axis, P: V3 | null) => {
    const e = AX[axis];
    if (type === 'F') return a.kind === 'f' ? dot(a.u, e) : 0;
    if (a.kind === 'm') return dot(a.u, e);
    return dot(cross(sub3(a.r, P!), a.u), e);
  };
  const cands: Candidate[] = [];
  const add = (type: 'F' | 'M', axis: Axis, P: number | null) => {
    const Pv = P == null ? ([0, 0, 0] as V3) : P3(b, P);
    const c: Candidate = { type, axis, P, coeffs: {}, cst: 0, terms: [] };
    for (const a of all) {
      const k = clean(coef(a, type, axis, Pv));
      if (Math.abs(k) < 1e-12) continue;
      c.terms.push({ a, c: k });
      if (a.key) c.coeffs[a.key] = (c.coeffs[a.key] ?? 0) + k * (a.mult ?? 1);
      else c.cst += k * (a.val as number);
    }
    cands.push(c);
  };
  // Моменты относительно осей через опорные точки (в порядке опор), затем проекции.
  const supportPts = [...new Set(b.supports.map((s) => s.at))];
  for (const P of supportPts) for (const a of AXES) add('M', a, P);
  for (const a of AXES) add('F', a, null);
  return { unknowns, knowns, dependents, cands };
}

export type BodyStatus = 'ok' | 'indeterminate' | 'mechanism' | 'noequilibrium' | 'nosupport';

export interface Step {
  c: Candidate;
  key: string;
  before: Record<string, number>;
}
export interface BodySolution {
  status: BodyStatus;
  n: number;
  rank: number;
  steps: Step[];
  joint: { cands: Candidate[]; keys: string[] } | null;
  vals: Record<string, number>;
  /** Проверочное уравнение — ещё не использованное, с невязкой. */
  check: { c: Candidate; r: number } | null;
}

const residual = (c: Candidate, vals: Record<string, number>) => c.cst + Object.entries(c.coeffs).reduce((s, [k, v]) => s + v * (vals[k] ?? 0), 0);

export function solveBody(m: BodyModel): BodySolution {
  const keys = m.unknowns.map((u) => u.key),
    n = keys.length;
  const out: BodySolution = { status: 'ok', n, rank: 0, steps: [], joint: null, vals: {}, check: null };
  if (!n) return { ...out, status: 'nosupport' };
  const M = m.cands.map((c) => keys.map((k) => c.coeffs[k] ?? 0));
  out.rank = rankOf(M);
  // Ранг 6 — тело закреплено, но связей больше, чем нужно; меньше — какое-то перемещение не закреплено.
  if (out.rank < n) return { ...out, status: out.rank === 6 ? 'indeterminate' : 'mechanism' };
  const vals: Record<string, number> = {},
    used = new Set<Candidate>();
  for (let progress = true; progress && Object.keys(vals).length < n; ) {
    progress = false;
    for (const c of m.cands) {
      if (used.has(c)) continue;
      const rem = keys.filter((k) => !(k in vals) && Math.abs(c.coeffs[k] ?? 0) > 1e-12);
      if (rem.length !== 1) continue;
      const k = rem[0],
        before = { ...vals };
      vals[k] = -(c.cst + Object.entries(c.coeffs).reduce((s, [kk, v]) => s + (kk === k ? 0 : v * (vals[kk] ?? 0)), 0)) / c.coeffs[k];
      out.steps.push({ c, key: k, before });
      used.add(c);
      progress = true;
      break;
    }
  }
  const rest = keys.filter((k) => !(k in vals));
  if (rest.length) {
    const rows: number[][] = [],
      cs: Candidate[] = [];
    for (const c of m.cands) {
      if (used.has(c)) continue;
      const row = rest.map((k) => c.coeffs[k] ?? 0);
      if (rankOf([...rows, row]) > rows.length) {
        rows.push(row);
        cs.push(c);
      }
      if (rows.length === rest.length) break;
    }
    const rhs = cs.map((c) => -(c.cst + Object.entries(c.coeffs).reduce((s, [k, v]) => s + (rest.includes(k) ? 0 : v * vals[k]), 0)));
    gauss(rows, rhs).forEach((v, i) => (vals[rest[i]] = v));
    cs.forEach((c) => used.add(c));
    out.joint = { cands: cs, keys: rest };
  }
  for (const k of keys) if (Math.abs(vals[k]) < 1e-12) vals[k] = 0;
  out.vals = vals;
  // Все кандидаты должны выполняться; иначе нагрузку уравновесить нельзя.
  const scale = Math.max(1, ...m.knowns.map((k) => Math.abs(k.val) * (1 + norm(k.r))));
  const bad = m.cands.find((c) => Math.abs(residual(c, vals)) > 1e-7 * scale);
  if (bad) return { ...out, status: 'noequilibrium' };
  // Проверка — предпочтительно проекции (независимы от выбора осей моментов).
  const free = m.cands.filter((c) => !used.has(c) && Object.keys(c.coeffs).length > 0);
  const chk = free.find((c) => c.type === 'F') ?? free[0];
  if (chk) out.check = { c: chk, r: residual(chk, vals) };
  return out;
}
