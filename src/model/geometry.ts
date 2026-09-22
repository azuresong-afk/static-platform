import { DIRV, OPP, SIDES, ptName, forceAngle } from './constants';
import { r3 } from './format';
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
  /** Направления участков, выходящих из узла. */
  adj: Record<string, Set<Dir>>;
  root: string;
  /** Участки в порядке обхода (по узлу-потомку). */
  segOrder: Seg[];
}

/** Координаты узлов обходом дерева участков от корня (узла, в который не входит ни один участок). */
export function geom(s: Pick<Structure, 'nodes' | 'segs'>): Geom {
  const inc = new Set(s.segs.map((q) => q.b));
  const root = (s.nodes.find((n) => !inc.has(n.id)) || s.nodes[0]).id;
  const kids: Record<string, Seg[]> = {};
  const adj: Record<string, Set<Dir>> = {};
  const pos: Record<string, Pt> = {};
  const parent: Record<string, Seg> = {};
  const order: string[] = [];
  s.nodes.forEach((n) => {
    adj[n.id] = new Set();
    kids[n.id] = [];
  });
  s.segs.forEach((q) => {
    if (kids[q.a]) kids[q.a].push(q);
    if (adj[q.a]) adj[q.a].add(q.dir);
    if (adj[q.b]) adj[q.b].add(OPP[q.dir]);
  });
  const visit = (id: string, x: number, y: number): void => {
    if (id in pos) return;
    pos[id] = [x, y];
    order.push(id);
    (kids[id] || []).forEach((q) => {
      parent[q.b] = q;
      const d = DIRV[q.dir];
      visit(q.b, x + d[0] * q.len, y + d[1] * q.len);
    });
  };
  visit(root, 0, 0);
  let mx = Infinity,
    my = Infinity;
  Object.values(pos).forEach(([x, y]) => {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
  });
  Object.keys(pos).forEach((k) => (pos[k] = [r3(pos[k][0] - mx), r3(pos[k][1] - my)]));
  const name: Record<string, string> = {};
  order.forEach((id, i) => (name[id] = ptName(i)));
  const segOrder = order.filter((id) => parent[id]).map((id) => parent[id]);
  return { pos, order, name, parent, adj, root, segOrder };
}

/** Все узлы достижимы, участки не пересекаются и не накладываются (касаться можно только общим концом). */
export function geomOK(s: Pick<Structure, 'nodes' | 'segs'>): boolean {
  const g = geom(s);
  if (Object.keys(g.pos).length !== s.nodes.length) return false;
  const S = s.segs.map((q) => ({ s: q, A: g.pos[q.a], B: g.pos[q.b] }));
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) {
      const p = S[i],
        q = S[j];
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
    lca = pa.find((id) => sb.has(id))!;
  return [...pa.slice(0, pa.indexOf(lca) + 1), ...pb.slice(0, pb.indexOf(lca)).reverse()];
}

export type DistGeom =
  | { ok: false; why: 'zero' | 'line' }
  | { ok: true; horiz: boolean; P: Pt; Q: Pt; len: number };

/** Участок под распределённой нагрузкой: начало и конец должны лежать на одной прямой по раме. */
export function distGeom(g: Geom, it: Pick<DistItem, 'from' | 'to'>): DistGeom {
  const P = g.pos[it.from],
    Q = g.pos[it.to];
  if (!P || !Q || it.from === it.to) return { ok: false, why: 'zero' };
  const horiz = Math.abs(P[1] - Q[1]) < 1e-9,
    vert = Math.abs(P[0] - Q[0]) < 1e-9;
  if (!horiz && !vert) return { ok: false, why: 'line' };
  for (const id of pathNodes(g, it.from, it.to)) {
    const R = g.pos[id];
    if ((horiz && Math.abs(R[1] - P[1]) > 1e-9) || (vert && Math.abs(R[0] - P[0]) > 1e-9)) return { ok: false, why: 'line' };
  }
  return { ok: true, horiz, P, Q, len: horiz ? Math.abs(Q[0] - P[0]) : Math.abs(Q[1] - P[1]) };
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
 * - направление распределённой нагрузки приводится к перпендикуляру участка;
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
        if (dg.horiz && (it.dir === 'left' || it.dir === 'right')) it.dir = 'down';
        if (!dg.horiz && (it.dir === 'up' || it.dir === 'down')) it.dir = 'right';
      }
      items.push(it);
      return it;
    }
    if (!(it.at in g.pos)) it.at = first;
    if ((it.type === 'roller' && it.side !== 'tilt') || it.type === 'pin' || it.type === 'fixed')
      it.angle = SIDES[(it.side as keyof typeof SIDES) || 'below'].ang;
    const [x, y] = g.pos[it.at];
    const r: PointItem = { ...it, x, y };
    if (it.type === 'force') r.angle = forceAngle(it);
    items.push(r);
    return it;
  });
  return { structure: { nodes: s.nodes, segs: s.segs, items: norm }, g, items };
}
