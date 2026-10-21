import { OPP, SIDES, ptName, forceAngle, segAngle, segVec, normAng } from './constants';
import { r3 } from '../../../shared/format';
import type { Dir, DistItem, Item, Seg, Structure } from './types';

export type Pt = [number, number];

export interface Geom {
  /** Координаты узлов, м; левая нижняя точка — (0; 0). */
  pos: Record<string, Pt>;
  /** Узлы в порядке обхода дерева от корня. */
  order: string[];
  /** Имя точки (A, B, C…) по порядку обхода. */
  name: Record<string, string>;
  /** Участок, ведущий в узел из его родителя. */
  parent: Record<string, Seg>;
  /** Направления участков по осям, выходящих из узла (наклонные сюда не входят — они в rays). */
  adj: Record<string, Set<Dir>>;
  /** Углы к оси x всех участков, выходящих из узла, град (0…360). */
  rays: Record<string, number[]>;
  /** Есть наклонные участки. */
  inclined: boolean;
  root: string;
  /** Участки в порядке обхода (по узлу-потомку). */
  segOrder: Seg[];
  /** Номер тела (дерева участков) для каждой точки: 0 — основное, 1, 2… — тела, поставленные от других (Node.place). */
  body: Record<string, number>;
}

/** Округление координат с наклонными участками: только шум вычислений (1e-12 м), не миллиметры. */
const r12 = (v: number) => Math.round(v * 1e12) / 1e12 + 0;

/**
 * Координаты узлов обходом дерева участков от корня (узла, в который не входит ни один участок и который не поставлен
 * от другого тела). Затем — отдельные тела: их начальная точка смещена от точки уже построенного тела (Node.place).
 */
export function geom(s: Pick<Structure, 'nodes' | 'segs'> & { search?: unknown }): Geom {
  const inc = new Set(s.segs.map((q) => q.b));
  const root = (s.nodes.find((n) => !inc.has(n.id) && !n.place) || s.nodes[0]).id;
  const kids: Record<string, Seg[]> = {};
  const adj: Record<string, Set<Dir>> = {};
  const rays: Record<string, number[]> = {};
  const pos: Record<string, Pt> = {};
  const parent: Record<string, Seg> = {};
  const order: string[] = [];
  s.nodes.forEach((n) => {
    adj[n.id] = new Set();
    rays[n.id] = [];
    kids[n.id] = [];
  });
  s.segs.forEach((q) => {
    if (kids[q.a]) kids[q.a].push(q);
    if (q.dir !== 'a') {
      if (adj[q.a]) adj[q.a].add(q.dir);
      if (adj[q.b]) adj[q.b].add(OPP[q.dir]);
    }
    const t = segAngle(q);
    if (rays[q.a]) rays[q.a].push(t);
    if (rays[q.b]) rays[q.b].push(normAng(t + 180));
  });
  const inclined = s.segs.some((q) => q.dir === 'a');
  const body: Record<string, number> = {};
  let nb = 0;
  const visit = (id: string, x: number, y: number): void => {
    if (id in pos) return;
    pos[id] = [x, y];
    body[id] = nb;
    order.push(id);
    (kids[id] || []).forEach((q) => {
      parent[q.b] = q;
      const d = segVec(q);
      visit(q.b, x + d[0] * q.len, y + d[1] * q.len);
    });
  };
  visit(root, 0, 0);
  // Отдельные тела — в порядке точек; тело, поставленное от ещё не построенного, ждёт следующего прохода.
  for (let more = true; more; ) {
    more = false;
    for (const n of s.nodes)
      if (n.place && !(n.id in pos) && n.place.from in pos && !inc.has(n.id)) {
        const [fx, fy] = pos[n.place.from];
        nb++;
        visit(n.id, fx + n.place.dx, fy + n.place.dy);
        more = true;
      }
  }
  let mx = Infinity,
    my = Infinity;
  Object.values(pos).forEach(([x, y]) => {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
  });
  // Рамы из участков по осям — с точностью до миллиметра, как в прототипе; с наклонными и с отдельными телами
  // (их место задаётся смещением, у тел-точек — любыми координатами) — без огрубления.
  // При поиске положения равновесия — тоже без огрубления: иначе корень найдётся лишь с точностью до миллиметра.
  const rr = inclined || nb > 0 || s.search ? r12 : r3;
  Object.keys(pos).forEach((k) => (pos[k] = [rr(pos[k][0] - mx), rr(pos[k][1] - my)]));
  const name: Record<string, string> = {};
  order.forEach((id, i) => (name[id] = ptName(i)));
  const segOrder = order.filter((id) => parent[id]).map((id) => parent[id]);
  return { pos, order, name, parent, adj, rays, inclined, root, segOrder, body };
}

/** В конструкции несколько тел (точки, поставленные от других тел) или связи между ними. */
export const hasBodies = (s: Pick<Structure, 'nodes' | 'links'>): boolean => s.nodes.some((n) => n.place) || !!s.links?.length;

const EPS = 1e-7;
/** Расстояние от точки P до отрезка AB. */
function distToSeg(P: Pt, A: Pt, B: Pt): number {
  const ux = B[0] - A[0],
    uy = B[1] - A[1],
    l2 = ux * ux + uy * uy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((P[0] - A[0]) * ux + (P[1] - A[1]) * uy) / l2)) : 0;
  return Math.hypot(P[0] - A[0] - t * ux, P[1] - A[1] - t * uy);
}
/** Расстояние со знаком от точки P до прямой AB. */
const side = (A: Pt, B: Pt, P: Pt) => ((B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0])) / (Math.hypot(B[0] - A[0], B[1] - A[1]) || 1);
/** Отрезки AB и CD имеют общую точку (пересекаются или касаются). */
function touch(A: Pt, B: Pt, C: Pt, D: Pt): boolean {
  const d1 = side(A, B, C),
    d2 = side(A, B, D),
    d3 = side(C, D, A),
    d4 = side(C, D, B);
  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
  return distToSeg(C, A, B) < EPS || distToSeg(D, A, B) < EPS || distToSeg(A, C, D) < EPS || distToSeg(B, C, D) < EPS;
}

/**
 * Все узлы достижимы, участки не пересекаются и не накладываются (касаться можно только общим концом).
 * Участки разных тел не проверяются: тела касаются друг друга, а грань одного может лежать на грани другого.
 */
export function geomOK(s: Pick<Structure, 'nodes' | 'segs'>): boolean {
  const g = geom(s);
  if (Object.keys(g.pos).length !== s.nodes.length) return false;
  const S = s.segs.map((q) => ({ s: q, A: g.pos[q.a], B: g.pos[q.b] }));
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) {
      const p = S[i],
        q = S[j];
      if (g.body[p.s.a] !== g.body[q.s.a]) continue;
      if (p.s.dir === 'a' || q.s.dir === 'a') {
        // Наклонный участок: с общим концом участки не должны идти из него в одну сторону,
        // без общего конца — не должны иметь ни одной общей точки.
        const common = [p.s.a, p.s.b].find((n) => n === q.s.a || n === q.s.b);
        if (common) {
          const O = g.pos[common],
            U = p.s.a === common ? p.B : p.A,
            V = q.s.a === common ? q.B : q.A;
          const ux = U[0] - O[0],
            uy = U[1] - O[1],
            vx = V[0] - O[0],
            vy = V[1] - O[1];
          const lu = Math.hypot(ux, uy),
            lv = Math.hypot(vx, vy);
          if (Math.abs(ux * vy - uy * vx) / (lu * lv) < 1e-9 && ux * vx + uy * vy > 0) return false;
          continue;
        }
        if (touch(p.A, p.B, q.A, q.B)) return false;
        continue;
      }
      const ix0 = Math.max(Math.min(p.A[0], p.B[0]), Math.min(q.A[0], q.B[0])),
        ix1 = Math.min(Math.max(p.A[0], p.B[0]), Math.max(q.A[0], q.B[0]));
      const iy0 = Math.max(Math.min(p.A[1], p.B[1]), Math.min(q.A[1], q.B[1])),
        iy1 = Math.min(Math.max(p.A[1], p.B[1]), Math.max(q.A[1], q.B[1]));
      if (ix0 > ix1 + 1e-9 || iy0 > iy1 + 1e-9) continue;
      const shared = [p.s.a, p.s.b].filter((n) => n === q.s.a || n === q.s.b);
      if (shared.length && Math.abs(ix1 - ix0) < 1e-9 && Math.abs(iy1 - iy0) < 1e-9) {
        const P = g.pos[shared[0]];
        if (Math.abs(P[0] - ix0) < 1e-9 && Math.abs(P[1] - iy0) < 1e-9) continue;
      }
      return false;
    }
  return true;
}

/** Узлы на пути по дереву от a до b включительно. */
export function pathNodes(g: Geom, a: string, b: string): string[] {
  const up = (id: string): string[] => {
    const r = [id];
    while (g.parent[id]) {
      id = g.parent[id].a;
      r.push(id);
    }
    return r;
  };
  const pa = up(a),
    pb = up(b),
    sb = new Set(pb),
    lca = pa.find((id) => sb.has(id));
  // Точки разных тел путём по участкам не соединены.
  if (lca === undefined) return [a, b];
  return [...pa.slice(0, pa.indexOf(lca) + 1), ...pb.slice(0, pb.indexOf(lca)).reverse()];
}

export type DistGeom =
  | { ok: false; why: 'zero' | 'line' }
  | {
      ok: true;
      /** Прямая горизонтальна (h), вертикальна (v) или наклонна (a). */
      axis: 'h' | 'v' | 'a';
      horiz: boolean;
      P: Pt;
      Q: Pt;
      /** Длина по оси участка. */
      len: number;
      /** Угол прямой к оси x в пределах (−90°; 90°]: 0 — горизонталь, 90 — вертикаль. */
      ang: number;
    };

/** Участок под распределённой нагрузкой: начало и конец должны лежать на одной прямой по раме. */
export function distGeom(g: Geom, it: Pick<DistItem, 'from' | 'to'>): DistGeom {
  const P = g.pos[it.from],
    Q = g.pos[it.to];
  if (!P || !Q || it.from === it.to) return { ok: false, why: 'zero' };
  if (g.body[it.from] !== g.body[it.to]) return { ok: false, why: 'line' };
  const horiz = Math.abs(P[1] - Q[1]) < 1e-9,
    vert = Math.abs(P[0] - Q[0]) < 1e-9;
  if (!horiz && !vert) {
    // Наклонная прямая: все точки пути по раме — на прямой PQ.
    for (const id of pathNodes(g, it.from, it.to)) if (Math.abs(side(P, Q, g.pos[id])) > EPS) return { ok: false, why: 'line' };
    let ang = (Math.atan2(Q[1] - P[1], Q[0] - P[0]) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang <= -90) ang += 180;
    return { ok: true, axis: 'a', horiz, P, Q, len: Math.hypot(Q[0] - P[0], Q[1] - P[1]), ang };
  }
  for (const id of pathNodes(g, it.from, it.to)) {
    const R = g.pos[id];
    if ((horiz && Math.abs(R[1] - P[1]) > 1e-9) || (vert && Math.abs(R[0] - P[0]) > 1e-9)) return { ok: false, why: 'line' };
  }
  return { ok: true, axis: horiz ? 'h' : 'v', horiz, P, Q, len: horiz ? Math.abs(Q[0] - P[0]) : Math.abs(Q[1] - P[1]), ang: horiz ? 0 : 90 };
}

/** Элемент с координатами точки и углом (для опор — угол реакции, для силы — угол к оси x). */
export type PointItem = Exclude<Item, DistItem> & { x: number; y: number; angle?: number };
export type ResolvedItem = PointItem | DistItem;

export interface Resolved {
  /** Конструкция после поправок, которые прототип записывает в состояние (перечислены у resolve). */
  structure: Structure;
  g: Geom;
  items: ResolvedItem[];
}

/**
 * Аналог resolve() прототипа, но без мутаций: возвращает поправленную копию конструкции
 * и элементы с координатами. Поправки те же, что прототип вносит в состояние:
 * - элемент, привязанный к исчезнувшему узлу, переезжает в первую точку (распределённая — от первой до последней);
 * - направление распределённой нагрузки приводится к перпендикуляру участка (у наклонных участков
 *   допустимы и направления по осям, и нормали; у горизонтальных и вертикальных нормаль заменяется осью);
 * - угол опор (кроме наклонного катка) берётся по опорной поверхности.
 */
export function resolve(s: Structure): Resolved {
  const g = geom(s);
  const first = g.order[0],
    last = g.order[g.order.length - 1];
  const items: ResolvedItem[] = [];
  const norm: Item[] = s.items.map((src) => {
    const it = { ...src } as Item;
    if (it.type === 'dist') {
      if (!(it.from in g.pos)) it.from = first;
      if (!(it.to in g.pos)) it.to = last;
      const dg = distGeom(g, it);
      if (dg.ok) {
        if (dg.axis === 'h' && (it.dir === 'left' || it.dir === 'right')) it.dir = 'down';
        if (dg.axis === 'v' && (it.dir === 'up' || it.dir === 'down')) it.dir = 'right';
        if (dg.axis === 'h' && (it.dir === 'nu' || it.dir === 'nd')) it.dir = it.dir === 'nu' ? 'up' : 'down';
        if (dg.axis === 'v' && (it.dir === 'nu' || it.dir === 'nd')) it.dir = it.dir === 'nu' ? 'left' : 'right';
      }
      items.push(it);
      return it;
    }
    if (!(it.at in g.pos)) it.at = first;
    if (((it.type === 'roller' || it.type === 'rough' || it.type === 'slide') && it.side !== 'tilt') || it.type === 'pin' || it.type === 'fixed')
      it.angle = SIDES[(it.side as keyof typeof SIDES) || 'below'].ang;
    const [x, y] = g.pos[it.at];
    const r: PointItem = { ...it, x, y };
    if (it.type === 'force') r.angle = forceAngle(it);
    items.push(r);
    return it;
  });
  const structure: Structure = { nodes: s.nodes, segs: s.segs, items: norm };
  if (s.search) structure.search = s.search;
  // Связи — только между существующими точками; касание — между разными точками.
  if (s.links)
    structure.links = s.links.filter((l) => l.a in g.pos && l.b in g.pos && (l.type === 'thread' ? (l.via ?? []).every((id) => id in g.pos) : l.a !== l.b));
  return { structure, g, items };
}

/** Разбиение рамы на жёсткие части по внутренним шарнирам. */
export interface Parts {
  count: number;
  /** Номер части (0, 1, …) для каждого участка. */
  segPart: Record<string, number>;
  /** Части, к которым примыкает точка (по возрастанию). У шарнира их две и больше. */
  nodeParts: Record<string, number[]>;
  /** Действующие соединения частей (в порядке обхода): шарниры и скользящие заделки, где сходятся хотя бы две части. */
  hinges: string[];
  /** Соединения скользящей заделкой: узел → угол нормали к направляющей, град. */
  slides: Record<string, number>;
  /**
   * Число независимых уравнений равновесия каждой части: 3, у тела-точки (точки отдельного тела без участков) — 2.
   */
  dof: number[];
  /** Тела-точки: номер части → точка. */
  points: Record<number, string>;
}

/**
 * Участки, соединённые в обычной точке, — одна жёсткая часть; в точке-шарнире они разделяются.
 * Части нумеруются в порядке обхода (часть 0 содержит первый участок от корня).
 */
export function partsOf(s: Pick<Structure, 'nodes' | 'segs'>, g: Geom): Parts {
  const hinge = new Set(s.nodes.filter((n) => n.hinge || n.slide != null).map((n) => n.id));
  const parent: Record<string, string> = {};
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  s.segs.forEach((q) => (parent[q.id] = q.id));
  const incident: Record<string, string[]> = {};
  s.segs.forEach((q) => {
    (incident[q.a] ||= []).push(q.id);
    (incident[q.b] ||= []).push(q.id);
  });
  for (const [node, list] of Object.entries(incident)) {
    if (hinge.has(node)) continue;
    for (let i = 1; i < list.length; i++) parent[find(list[i])] = find(list[0]);
  }
  const num: Record<string, number> = {};
  const segPart: Record<string, number> = {};
  const points: Record<number, string> = {};
  // Нумерация — в порядке обхода точек: участок, ведущий в точку, или тело-точка (точка без участков).
  // В одной раме это тот же порядок, что обход участков.
  const multi = s.nodes.some((n) => n.place);
  let count = 0;
  for (const id of g.order) {
    const q = g.parent[id];
    if (q) {
      const r = find(q.id);
      if (!(r in num)) num[r] = count++;
      segPart[q.id] = num[r];
    } else if (multi && !incident[id]?.length) points[count++] = id;
  }
  const pointOf = Object.fromEntries(Object.entries(points).map(([p, id]) => [id, +p]));
  const nodeParts: Record<string, number[]> = {};
  for (const id of g.order) nodeParts[id] = id in pointOf ? [pointOf[id]] : [...new Set((incident[id] || []).map((sid) => segPart[sid]))].sort((a, b) => a - b);
  if (!s.segs.length && !multi) for (const id of g.order) nodeParts[id] = [0];
  const hinges = g.order.filter((id) => hinge.has(id) && nodeParts[id].length >= 2);
  const slides: Record<string, number> = {};
  for (const n of s.nodes) if (n.slide != null && hinges.includes(n.id)) slides[n.id] = n.slide;
  count = Math.max(count, 1);
  const dof = Array.from({ length: count }, (_, p) => (p in points ? 2 : 3));
  return { count, segPart, nodeParts, hinges, slides, dof, points };
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const roman = (i: number): string => ROMAN[i] ?? String(i + 1);
