/**
 * Диаграмма Максвелла–Кремоны плоской фермы.
 *
 * Обозначения Боу: плоскость делится стержнями и линиями действия внешних сил на области — внешние (между соседними
 * внешними силами) и внутренние (панели фермы). Каждой области отвечает точка диаграммы; стержень или внешняя сила,
 * разделяющие две области, изображаются отрезком между их точками. Обходя узел по часовой стрелке, переходим из области L
 * в область R через стержень (силу): p_R − p_L = сила, действующая на узел. Многоугольник сил каждого узла замыкается,
 * а каждый стержень входит в диаграмму один раз — вектор параллелен стержню, его длина — усилие.
 *
 * Построение: многоугольник внешних сил (нагрузки и реакции) → узлы по очереди, в каждом одна новая область — точка
 * находится как пересечение двух линий, проведённых параллельно неизвестным стержням. Усилия, снятые с диаграммы,
 * сверяются с решением фермы (src/modules/truss).
 *
 * Условия: ферма плоская без пересечения стержней вне узлов, линии действия внешних сил выходят наружу и не пересекаются.
 * Внешние силы в одном узле (нагрузка и реакция опоры) складываются в одну равнодействующую.
 */
import { barDir, nodeName, type Truss, type TrussResult } from '../../truss/model/truss';

export type V2 = [number, number];

export interface ExtForce {
  node: number;
  /** Равнодействующая внешних сил в узле, действующая на узел. */
  f: V2;
  /** Подпись: «R_A», «F_C» … */
  label: string;
  hasReaction: boolean;
  hasLoad: boolean;
  /** Направление линии действия наружу (от узла). */
  out: V2;
}

export interface Face {
  id: number;
  name: string;
  outer: boolean;
  /** Положение подписи на чертеже фермы. */
  label: V2;
  /** Точка диаграммы; null — построить не удалось. */
  pt: V2 | null;
  /** Номер шага построения (0 — многоугольник внешних сил). */
  step: number;
}

export interface BarVec {
  bar: number;
  /** Области слева и справа при обходе узла a по часовой стрелке. */
  L: number;
  R: number;
  /** Усилие, снятое с диаграммы: проекция вектора на направление от a к b. */
  N: number;
}

export interface ExtVec {
  ext: number;
  L: number;
  R: number;
}

export interface CremonaStep {
  node: number;
  face: number;
  /** Стержни, параллельно которым проведены линии (в порядке обхода). */
  bars: [number, number];
}

export interface Cremona {
  ok: boolean;
  /** Почему диаграмму построить нельзя. */
  error?: string;
  ext: ExtForce[];
  faces: Face[];
  bars: BarVec[];
  extVecs: ExtVec[];
  steps: CremonaStep[];
  /** Точки остальных областей получены из решения, а не построением. */
  fallback: boolean;
  /** Наибольшее расхождение усилий диаграммы с решением фермы. */
  maxErr: number;
  /** Узлы, где внешняя сила идёт вдоль линии стержня внутрь (диаграмма всё равно строится). */
  note?: string;
}

const EPS = 1e-9;
const TWO_PI = Math.PI * 2;
const norm = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

interface HE {
  from: number;
  to: number;
  /** Стержень (≥ 0) или −1 − номер внешней силы. */
  ref: number;
  ang: number;
  twin: number;
  next: number;
  face: number;
}

function segCross(a: V2, b: V2, c: V2, d: V2): boolean {
  const o = (p: V2, q: V2, r: V2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(a, b, c),
    d2 = o(a, b, d),
    d3 = o(c, d, a),
    d4 = o(c, d, b);
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
}

/** Половинки рёбер плоского графа и обход граней: грань слева, внутренние — против часовой стрелки. */
function buildHalfEdges(
  pos: V2[],
  edges: { a: number; b: number; ref: number }[],
): { he: HE[]; out: Map<number, number[]>; faceCount: number; area: number[] } {
  const he: HE[] = [];
  edges.forEach((e) => {
    const [pa, pb] = [pos[e.a], pos[e.b]];
    he.push({ from: e.a, to: e.b, ref: e.ref, ang: Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), twin: he.length + 1, next: -1, face: -1 });
    he.push({ from: e.b, to: e.a, ref: e.ref, ang: Math.atan2(pa[1] - pb[1], pa[0] - pb[0]), twin: he.length - 1, next: -1, face: -1 });
  });
  const out = new Map<number, number[]>();
  he.forEach((h, i) => out.set(h.from, [...(out.get(h.from) ?? []), i]));
  // Исходящие рёбра каждой вершины — по убыванию угла (по часовой стрелке).
  for (const list of out.values()) list.sort((p, q) => he[q].ang - he[p].ang);
  he.forEach((h, i) => {
    // Следующее ребро грани: первое по часовой стрелке от обратного.
    const list = out.get(h.to)!;
    const k = list.indexOf(h.twin);
    he[i].next = list[(k + 1) % list.length];
  });
  let faceCount = 0;
  const area: number[] = [];
  he.forEach((_, i) => {
    if (he[i].face >= 0) return;
    let a2 = 0,
      j = i;
    do {
      he[j].face = faceCount;
      const p = pos[he[j].from],
        q = pos[he[j].to];
      a2 += p[0] * q[1] - q[0] * p[1];
      j = he[j].next;
    } while (j !== i);
    area.push(a2 / 2);
    faceCount++;
  });
  return { he, out, faceCount, area };
}

const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω';
const LATIN = 'abcdefghijklmnopqrstuvwxyz';
const faceName = (outer: boolean, k: number) => {
  const s = outer ? LATIN : GREEK;
  return s[k % s.length] + (k >= s.length ? '′'.repeat(Math.floor(k / s.length)) : '');
};

export function planarityError(t: Truss): string | null {
  const P = t.nodes.map((n): V2 => [n.x, n.y]);
  for (let i = 0; i < t.bars.length; i++)
    for (let j = i + 1; j < t.bars.length; j++) {
      const p = t.bars[i],
        q = t.bars[j];
      if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) continue;
      if (segCross(P[p.a], P[p.b], P[q.a], P[q.b]))
        return `Стержни ${i + 1} и ${j + 1} пересекаются вне узла: ферма не плоский граф, обозначения Боу к ней не применимы.`;
    }
  return null;
}

const isNear = (v: number, w: number, eps = 1e-9) => Math.abs(v - w) <= eps * Math.max(1, Math.abs(v), Math.abs(w));

export function cremona(t: Truss, res: TrussResult): Cremona {
  const empty: Cremona = { ok: false, ext: [], faces: [], bars: [], extVecs: [], steps: [], fallback: false, maxErr: 0 };
  if (res.status !== 'ok') return { ...empty, error: 'Диаграмму Кремоны строят для статически определимой фермы.' };
  const pe = planarityError(t);
  if (pe) return { ...empty, error: pe };
  const n = t.nodes.length;
  const pos: V2[] = t.nodes.map((p) => [p.x, p.y]);

  // Внешние силы: нагрузки и реакции, сложенные по узлам.
  const sum = new Map<number, { f: V2; load: boolean; react: boolean }>();
  const addF = (node: number, fx: number, fy: number, kind: 'load' | 'react') => {
    const s = sum.get(node) ?? { f: [0, 0] as V2, load: false, react: false };
    s.f = [s.f[0] + fx, s.f[1] + fy];
    s[kind] = true;
    sum.set(node, s);
  };
  for (const l of t.loads) {
    const a = (l.angle * Math.PI) / 180;
    addF(l.node, l.F * Math.cos(a), l.F * Math.sin(a), 'load');
  }
  res.reactions.forEach((r, j) => addF(r.node, res.R[j] * r.ux, res.R[j] * r.uy, 'react'));
  const scale = Math.max(1e-9, ...[...sum.values()].map((s) => Math.hypot(s.f[0], s.f[1])));
  const ext: ExtForce[] = [];
  [...sum.entries()]
    .sort((p, q) => p[0] - q[0])
    .forEach(([node, s]) => {
      const m = Math.hypot(s.f[0], s.f[1]);
      if (m < 1e-9 * scale) return;
      const nm = nodeName(node);
      const label = s.react && !s.load ? `R_${nm}` : s.load && !s.react ? `F_${nm}` : `R_${nm}`;
      ext.push({ node, f: s.f, label, hasReaction: s.react, hasLoad: s.load, out: [-s.f[0] / m, -s.f[1] / m] });
    });
  if (!ext.length) return { ...empty, error: 'Внешних сил нет — диаграмма вырождается в точку.' };

  // Грани фермы без внешних сил: внешний угол в каждом узле, чтобы выбрать, в какую сторону вести линию действия.
  const bare = buildHalfEdges(
    pos,
    t.bars.map((q, k) => ({ a: q.a, b: q.b, ref: k })),
  );
  let outerFace = 0;
  bare.area.forEach((a, f) => {
    if (a < bare.area[outerFace]) outerFace = f;
  });
  // Если ферма вырождена в «дерево» (нет внутренних граней), внешняя грань всего одна.
  const wedgeOf = (node: number): { start: number; size: number } | null => {
    // Угол внешней грани в узле: от направления следующего ребра против часовой стрелки до обратного.
    for (const i of bare.out.get(node) ?? []) {
      const h = bare.he[i];
      const e = bare.he[h.twin];
      if (e.face !== outerFace) continue;
      // h.twin входит в узел node; его грань — внешняя; следующее ребро — исходящее из node.
      const nx = bare.he[e.next];
      const size = norm(bare.he[e.twin].ang - nx.ang);
      return { start: nx.ang, size: size < EPS ? TWO_PI : size };
    }
    return null;
  };
  const inWedge = (w: { start: number; size: number }, d: V2) => {
    const off = norm(Math.atan2(d[1], d[0]) - w.start);
    return off > 1e-6 && off < w.size - 1e-6;
  };
  let note: string | undefined;
  for (const e of ext) {
    const w = wedgeOf(e.node);
    if (!w) continue;
    if (inWedge(w, e.out)) continue;
    const back: V2 = [-e.out[0], -e.out[1]];
    if (inWedge(w, back)) {
      e.out = back;
      note =
        (note ? note + ' ' : '') +
        'В узле ' +
        nodeName(e.node) +
        ' линия действия силы идёт внутрь фермы со стороны хвоста стрелки, поэтому она продолжена в сторону острия.';
    } else
      return {
        ...empty,
        ext,
        error: `Линия действия силы в узле ${nodeName(e.node)} проходит внутри фермы, а не наружу — области вокруг фермы однозначно обозначить нельзя.`,
      };
  }

  // Далёкие точки концов линий действия и кольцо между ними.
  let lo = [Infinity, Infinity],
    hi = [-Infinity, -Infinity];
  for (const p of pos) {
    lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])];
    hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])];
  }
  const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], 1);
  const cx = pos.reduce((s, p) => s + p[0], 0) / n,
    cy = pos.reduce((s, p) => s + p[1], 0) / n;
  const D = 100 * size;
  // Линия действия: короткий отрезок от узла наружу, дальше — по лучу от центра фермы (так линии разных сил не
  // пересекаются, даже если их продолжения пересеклись бы; для обозначений Боу важен лишь порядок вокруг фермы).
  const stubs: V2[] = [];
  const far: V2[] = [];
  const nExt = ext.length;
  const crossesBars = (a: V2, b: V2, node: number) => t.bars.some((q, k) => k >= 0 && q.a !== node && q.b !== node && segCross(a, b, pos[q.a], pos[q.b]));
  for (let i = 0; i < nExt; i++) {
    const u = pos[ext[i].node];
    let S: V2 | null = null;
    for (const f of [0.3, 0.1, 0.03]) {
      const c: V2 = [u[0] + f * size * ext[i].out[0], u[1] + f * size * ext[i].out[1]];
      if (!crossesBars(u, c, ext[i].node)) {
        S = c;
        break;
      }
    }
    if (!S) return { ...empty, ext, error: `Линия действия силы в узле ${nodeName(ext[i].node)} пересекает стержень фермы.` };
    let rx = S[0] - cx,
      ry = S[1] - cy;
    const rl = Math.hypot(rx, ry) || 1;
    rx /= rl;
    ry /= rl;
    const F: V2 = [S[0] + D * rx, S[1] + D * ry];
    if (crossesBars(S, F, -1)) return { ...empty, ext, error: `Линия действия силы в узле ${nodeName(ext[i].node)} уходит наружу сквозь ферму.` };
    stubs.push(S);
    far.push(F);
  }
  for (let i = 0; i < nExt; i++)
    for (let j = i + 1; j < nExt; j++)
      if (segCross(pos[ext[i].node], stubs[i], pos[ext[j].node], stubs[j]) || segCross(stubs[i], far[i], stubs[j], far[j]))
        return { ...empty, ext, error: `Линии действия сил в узлах ${nodeName(ext[i].node)} и ${nodeName(ext[j].node)} пересекаются вне фермы.` };
  // Кольцо: концы линий действия и вспомогательные точки на большой окружности (чтобы хорда не резала ферму).
  for (let k = 0; k < 8; k++) far.push([cx + 1.5 * D * Math.cos(((k + 0.5) * Math.PI) / 4), cy + 1.5 * D * Math.sin(((k + 0.5) * Math.PI) / 4)]);
  const order = far.map((_, i) => i).sort((p, q) => Math.atan2(far[q][1] - cy, far[q][0] - cx) - Math.atan2(far[p][1] - cy, far[p][0] - cx));
  const all: V2[] = [...pos, ...far, ...stubs];
  const edges: { a: number; b: number; ref: number }[] = t.bars.map((q, k) => ({ a: q.a, b: q.b, ref: k }));
  // Вершины: узлы, затем концы колец (far), затем концы коротких отрезков (stubs, смещение n + far.length).
  const sb = n + far.length;
  ext.forEach((e, i) => {
    edges.push({ a: e.node, b: sb + i, ref: -1 - i });
    edges.push({ a: sb + i, b: n + i, ref: 2e6 + i });
  });
  if (nExt < 2) return { ...empty, ext, error: 'Одна внешняя сила не уравновешена — проверьте реакции опор.' };
  order.forEach((i, k) => edges.push({ a: n + i, b: n + order[(k + 1) % order.length], ref: 1e6 + k }));
  const g = buildHalfEdges(all, edges);
  let ring = 0;
  g.area.forEach((a, f) => {
    if (a < g.area[ring]) ring = f;
  });

  // Грани: внешние — те, чья граница содержит ребро кольца; остальные внутренние.
  const faceIds = new Map<number, number>();
  const faces: Face[] = [];
  const touchesRing = new Set<number>();
  g.he.forEach((h) => {
    if (h.ref >= 1e6 && h.ref < 2e6) touchesRing.add(h.face);
  });
  touchesRing.delete(ring);
  // Внешние области нумеруем по часовой стрелке, начиная снизу: порядок по углу ребра кольца.
  const ringAng = (f: number) => {
    const h = g.he.find((x) => x.face === f && x.ref >= 1e6 && x.ref < 2e6)!;
    const m: V2 = [(all[h.from][0] + all[h.to][0]) / 2 - cx, (all[h.from][1] + all[h.to][1]) / 2 - cy];
    return norm(Math.atan2(m[1], m[0]) + Math.PI / 2);
  };
  const outerList = [...touchesRing].sort((p, q) => ringAng(q) - ringAng(p));
  outerList.forEach((f, k) => {
    faceIds.set(f, faces.length);
    faces.push({ id: faces.length, name: faceName(true, k), outer: true, label: [0, 0], pt: null, step: -1 });
  });
  let innerK = 0;
  for (let f = 0; f < g.faceCount; f++) {
    if (f === ring || faceIds.has(f)) continue;
    faceIds.set(f, faces.length);
    faces.push({ id: faces.length, name: faceName(false, innerK++), outer: false, label: [0, 0], pt: null, step: -1 });
  }
  const FL = (h: HE) => faceIds.get(h.face)!;

  // Подписи областей.
  faces.forEach((fc) => {
    const gf = [...faceIds.entries()].find(([, id]) => id === fc.id)![0];
    const hes = g.he.filter((h) => h.face === gf);
    if (fc.outer) {
      const sz = 0.5 * size;
      // Середина между концами двух внешних линий этой области.
      const pts: V2[] = [];
      for (const h of hes) {
        if (h.ref >= 0) continue;
        const i = -1 - h.ref;
        pts.push([pos[ext[i].node][0] + sz * ext[i].out[0], pos[ext[i].node][1] + sz * ext[i].out[1]]);
      }
      if (pts.length) fc.label = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    } else {
      const vs = [...new Set(hes.map((h) => h.from))].filter((v) => v < n);
      fc.label = [vs.reduce((s, v) => s + pos[v][0], 0) / vs.length, vs.reduce((s, v) => s + pos[v][1], 0) / vs.length];
    }
  });

  // Силы и области слева/справа при обходе узла по часовой стрелке.
  const extVecs: ExtVec[] = ext.map((_, i) => {
    const h = g.he.find((x) => x.ref === -1 - i && x.from < n)!;
    return { ext: i, L: FL(h), R: FL(g.he[h.twin]) };
  });
  const barVecs: BarVec[] = t.bars.map((_, k) => {
    const h = g.he.find((x) => x.ref === k && x.from === t.bars[k].a)!;
    return { bar: k, L: FL(h), R: FL(g.he[h.twin]), N: 0 };
  });

  // Шаг 0: многоугольник внешних сил.
  const outerIds = faces.filter((f) => f.outer).map((f) => f.id);
  faces[outerIds[0]].pt = [0, 0];
  faces[outerIds[0]].step = 0;
  for (let changed = true; changed; ) {
    changed = false;
    extVecs.forEach((ev, i) => {
      const a = faces[ev.L],
        b = faces[ev.R];
      if (a.pt && !b.pt) ((b.pt = [a.pt[0] + ext[i].f[0], a.pt[1] + ext[i].f[1]]), (b.step = 0), (changed = true));
      else if (b.pt && !a.pt) ((a.pt = [b.pt[0] - ext[i].f[0], b.pt[1] - ext[i].f[1]]), (a.step = 0), (changed = true));
    });
  }
  const poly = extVecs.every((ev, i) => {
    const a = faces[ev.L].pt,
      b = faces[ev.R].pt;
    return a && b && isNear(b[0] - a[0], ext[i].f[0], 1e-7) && isNear(b[1] - a[1], ext[i].f[1], 1e-7);
  });
  if (!poly || outerIds.some((f) => !faces[f].pt))
    return { ...empty, ext, faces, error: 'Многоугольник внешних сил не замкнулся: внешние силы не уравновешены.' };

  // Узлы по очереди: области вокруг узла по часовой стрелке и рёбра между ними.
  interface Around {
    ref: number;
    L: number;
    R: number;
    /** Единичный вектор стержня от узла; для внешней силы — null. */
    u: V2 | null;
  }
  const around = (node: number): Around[] =>
    (g.out.get(node) ?? [])
      .map((i) => g.he[i])
      .filter((h) => h.ref < 1e6)
      .map((h) => ({
        ref: h.ref,
        L: FL(h),
        R: FL(g.he[h.twin]),
        u: h.ref >= 0 ? (barDir(t, h.ref, node) as V2) : null,
      }));
  const steps: CremonaStep[] = [];
  let stepNo = 0;
  for (let progress = true; progress; ) {
    progress = false;
    for (let node = 0; node < n; node++) {
      const ar = around(node);
      const unk = [...new Set(ar.flatMap((x) => [x.L, x.R]).filter((f) => !faces[f].pt))];
      if (unk.length !== 1) continue;
      const G = unk[0];
      const into = ar.find((x) => x.R === G && x.L !== G && x.u);
      const leave = ar.find((x) => x.L === G && x.R !== G && x.u);
      if (!into || !leave || into.ref === leave.ref) continue;
      const P = faces[into.L].pt!,
        Q = faces[leave.R].pt!;
      // p = P + s·u1 = Q + r·u2.
      const u1 = into.u!,
        u2 = leave.u!;
      const den = u1[0] * u2[1] - u1[1] * u2[0];
      if (Math.abs(den) < 1e-9) continue;
      const s = ((Q[0] - P[0]) * u2[1] - (Q[1] - P[1]) * u2[0]) / den;
      faces[G].pt = [P[0] + s * u1[0], P[1] + s * u1[1]];
      faces[G].step = ++stepNo;
      steps.push({ node, face: G, bars: [into.ref, leave.ref] });
      progress = true;
    }
  }
  // Остальное (если построение застопорилось) — из решения фермы.
  let fallback = false;
  if (faces.some((f) => !f.pt)) {
    fallback = true;
    for (let changed = true; changed; ) {
      changed = false;
      barVecs.forEach((bv) => {
        const u = barDir(t, bv.bar, t.bars[bv.bar].a);
        const a = faces[bv.L],
          b = faces[bv.R];
        const d: V2 = [res.N[bv.bar] * u[0], res.N[bv.bar] * u[1]];
        if (a.pt && !b.pt) ((b.pt = [a.pt[0] + d[0], a.pt[1] + d[1]]), (b.step = ++stepNo), (changed = true));
        else if (b.pt && !a.pt) ((a.pt = [b.pt[0] - d[0], b.pt[1] - d[1]]), (a.step = ++stepNo), (changed = true));
      });
    }
  }
  let maxErr = 0;
  barVecs.forEach((bv) => {
    const a = faces[bv.L].pt,
      b = faces[bv.R].pt;
    if (!a || !b) return;
    const u = barDir(t, bv.bar, t.bars[bv.bar].a);
    bv.N = (b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1];
    // Вектор должен быть параллелен стержню.
    const perp = Math.abs((b[0] - a[0]) * u[1] - (b[1] - a[1]) * u[0]);
    maxErr = Math.max(maxErr, Math.abs(bv.N - res.N[bv.bar]), perp);
  });
  return { ok: faces.every((f) => f.pt), ext, faces, bars: barVecs, extVecs, steps, fallback, maxErr, note };
}
