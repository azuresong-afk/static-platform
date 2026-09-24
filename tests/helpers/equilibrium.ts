/**
 * Независимая проверка равновесия. Намеренно не использует модули решателя и геометрии:
 * координаты — свой обход дерева, направления опор и сил — свои таблицы,
 * распределённая нагрузка — численное интегрирование по Симпсону (точно для линейной q),
 * а не формула центра тяжести трапеции.
 */
import type { Structure } from '../../src/model/types';

const DV: Record<string, [number, number]> = { r: [1, 0], l: [-1, 0], u: [0, 1], d: [0, -1] };
const SIDE_ANG: Record<string, number> = { below: 90, above: 270, left: 0, right: 180 };
const REF_ANG: Record<string, number> = { right: 0, up: 90, left: 180, down: 270 };
const LOAD_ANG: Record<string, number> = { down: 270, up: 90, right: 0, left: 180 };
const unit = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

export interface UnknownRef {
  key: string;
  itemId: string;
  /** X, Y, M, R, S или F. */
  L: string;
}

interface Wrench {
  x: number;
  y: number;
  fx: number;
  fy: number;
  /** Момент пары, против часовой — «+». */
  m: number;
}

function coords(s: Structure): Record<string, [number, number]> {
  const incoming = new Set(s.segs.map((q) => q.b));
  const root = s.nodes.find((n) => !incoming.has(n.id))!.id;
  const pos: Record<string, [number, number]> = { [root]: [0, 0] };
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    for (const q of s.segs)
      if (q.a === id) {
        const d = DV[q.dir];
        pos[q.b] = [pos[id][0] + d[0] * q.len, pos[id][1] + d[1] * q.len];
        queue.push(q.b);
      }
  }
  return pos;
}

/**
 * Все силы и пары, действующие на тело, при найденных значениях неизвестных.
 * skipDist — распределённые нагрузки, которые решатель не учитывает (точки не на одной прямой).
 */
export function wrenches(s: Structure, vals: Record<string, number>, unknowns: UnknownRef[], skipDist: Set<string>): Wrench[] {
  const pos = coords(s);
  const out: Wrench[] = [];
  const unk = (itemId: string, L: string) => {
    const u = unknowns.find((x) => x.itemId === itemId && x.L === L);
    if (!u) throw new Error(`нет неизвестного ${L} для ${itemId}`);
    return vals[u.key];
  };
  for (const it of s.items) {
    if (it.type === 'dist') {
      if (skipDist.has(it.id)) continue;
      const P = pos[it.from],
        Q = pos[it.to];
      const [nx, ny] = unit(LOAD_ANG[it.dir]);
      // Симпсон по 2 интервалам точен для кубики; подынтегральные выражения — не выше квадратичных.
      const N = 2;
      const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      for (let i = 0; i <= N; i++) {
        const t = i / N,
          w = (i === 0 || i === N ? 1 : 4) / (3 * N);
        const q = it.q1 + (it.q2 - it.q1) * t;
        out.push({ x: P[0] + (Q[0] - P[0]) * t, y: P[1] + (Q[1] - P[1]) * t, fx: nx * q * L * w, fy: ny * q * L * w, m: 0 });
      }
      continue;
    }
    const [x, y] = pos[it.at];
    switch (it.type) {
      case 'fixed':
      case 'pin':
        if (it.type === 'fixed') out.push({ x, y, fx: 0, fy: 0, m: unk(it.id, 'M') });
        out.push({ x, y, fx: unk(it.id, 'X'), fy: unk(it.id, 'Y'), m: 0 });
        break;
      case 'roller': {
        const [ux, uy] = unit(it.side === 'tilt' ? (it.angle as number) : SIDE_ANG[it.side]);
        const R = unk(it.id, 'R');
        out.push({ x, y, fx: ux * R, fy: uy * R, m: 0 });
        break;
      }
      case 'rod': {
        const [ux, uy] = unit(it.angle);
        const S = unk(it.id, 'S');
        out.push({ x, y, fx: ux * S, fy: uy * S, m: 0 });
        break;
      }
      case 'force': {
        const [ux, uy] = unit(REF_ANG[it.ref] + (it.rot === 'ccw' ? 1 : -1) * it.alpha);
        const F = it.unknown ? unk(it.id, 'F') : it.F;
        out.push({ x, y, fx: ux * F, fy: uy * F, m: 0 });
        break;
      }
      case 'weight':
        out.push({ x, y, fx: 0, fy: -it.G, m: 0 });
        break;
      case 'moment': {
        const M = it.unknown ? unk(it.id, 'M') : it.M;
        out.push({ x, y, fx: 0, fy: 0, m: (it.dir === 'ccw' ? 1 : -1) * M });
        break;
      }
    }
  }
  return out;
}

/** ΣFx, ΣFy и ΣM относительно нескольких точек; scale — характерная величина для допуска. */
export function residuals(ws: Wrench[], points: [number, number][]) {
  const fx = ws.reduce((a, w) => a + w.fx, 0),
    fy = ws.reduce((a, w) => a + w.fy, 0);
  const ms = points.map(([px, py]) => ws.reduce((a, w) => a + (w.x - px) * w.fy - (w.y - py) * w.fx + w.m, 0));
  const span = Math.max(1, ...ws.map((w) => Math.max(Math.abs(w.x), Math.abs(w.y))));
  const scale = Math.max(1, ...ws.map((w) => Math.max(Math.abs(w.fx), Math.abs(w.fy)) * span + Math.abs(w.m)));
  return { fx, fy, ms, scale };
}

/**
 * Равновесие каждой части составной конструкции. Разбиение на части и принадлежность точек берутся из модели,
 * силы — независимо: сосредоточенные — как в wrenches(), распределённая нагрузка интегрируется отдельно
 * по каждому участку своей части; взаимные силы в шарнирах — со знаком «+» на часть on и «−» на часть from.
 */
export function partWrenches(
  s: Structure,
  vals: Record<string, number>,
  unknowns: (UnknownRef & { hinge?: { node: string; on: number; from: number } })[],
  parts: { count: number; segPart: Record<string, number>; nodeParts: Record<string, number[]> },
  skipDist: Set<string>,
): Wrench[][] {
  const pos = coords(s);
  const out: Wrench[][] = Array.from({ length: parts.count }, () => []);
  const carrier = (id: string) => parts.nodeParts[id][0];
  // Сосредоточенные силы и реакции — через общий расчёт по одному элементу.
  for (const it of s.items) {
    if (it.type === 'dist') continue;
    const one = { ...s, items: [it] } as Structure;
    out[carrier(it.at)].push(...wrenches(one, vals, unknowns, new Set()));
  }
  // Распределённая нагрузка: по участкам пути, каждый — своей части.
  for (const it of s.items) {
    if (it.type !== 'dist' || skipDist.has(it.id)) continue;
    const P = pos[it.from],
      Q = pos[it.to],
      L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    const [nx, ny] = unit(LOAD_ANG[it.dir]);
    const qAt = (pt: [number, number]) => it.q1 + ((it.q2 - it.q1) * Math.hypot(pt[0] - P[0], pt[1] - P[1])) / L;
    for (const q of s.segs) {
      const A = pos[q.a],
        B = pos[q.b];
      // Участок лежит на отрезке нагрузки?
      const on = (pt: [number, number]) => Math.abs(Math.hypot(pt[0] - P[0], pt[1] - P[1]) + Math.hypot(pt[0] - Q[0], pt[1] - Q[1]) - L) < 1e-9;
      if (!on(A) || !on(B)) continue;
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      for (let i = 0; i <= 2; i++) {
        const t = i / 2,
          w = (i === 1 ? 4 : 1) / 6;
        const pt: [number, number] = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
        const qv = qAt(pt);
        out[parts.segPart[q.id]].push({ x: pt[0], y: pt[1], fx: nx * qv * len * w, fy: ny * qv * len * w, m: 0 });
      }
    }
  }
  for (const u of unknowns) {
    if (!u.hinge) continue;
    const [x, y] = pos[u.hinge.node];
    const v = vals[u.key],
      fx = u.L === 'X' ? v : 0,
      fy = u.L === 'Y' ? v : 0;
    out[u.hinge.on].push({ x, y, fx, fy, m: 0 });
    out[u.hinge.from].push({ x, y, fx: -fx, fy: -fy, m: 0 });
  }
  return out;
}
