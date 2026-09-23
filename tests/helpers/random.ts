/** Генераторы случайных конструкций для fast-check. */
import fc from 'fast-check';
import { addSeg } from '../../src/model/edit';
import { geom } from '../../src/model/geometry';
import { createIdGen } from '../../src/model/ids';
import type { Dir, Item, ItemData, LoadDir, RefDir, Side, Structure } from '../../src/model/types';

const DIRS: Dir[] = ['r', 'l', 'u', 'd'];
const SIDES: Side[] = ['below', 'above', 'left', 'right'];
const LENS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 1.25, 3.2];
const ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330];

/** Рама: до 6 участков, каждый — из уже существующей точки в свободном направлении. */
export const frameArb = fc
  .array(fc.record({ from: fc.nat(), dir: fc.constantFrom(...DIRS), len: fc.constantFrom(...LENS) }), { minLength: 1, maxLength: 6 })
  .map((steps) => {
    const ids = createIdGen();
    let s: Structure = { nodes: [{ id: ids.node() }], segs: [], items: [] };
    for (const st of steps) {
      const r = addSeg(s, s.nodes[st.from % s.nodes.length].id, st.dir, st.len, ids);
      if (r.ok) s = r.s;
    }
    if (!s.segs.length) s = (addSeg(s, s.nodes[0].id, 'r', 2, ids) as { s: Structure }).s;
    return { s, ids };
  });

type SupportPlan = 'pin+roller' | 'fixed' | 'pin+rod' | 'rod×3' | 'roller×3' | 'pin+tilt' | 'pin+unknownF' | 'roller+roller+unknownM';

const loadArb = fc.oneof(
  fc.record({
    type: fc.constant('force' as const),
    at: fc.nat(),
    F: fc.constantFrom(2, 5, 6, 8, 10, 12.5),
    ref: fc.constantFrom<RefDir>('right', 'left', 'up', 'down'),
    rot: fc.constantFrom<'cw' | 'ccw'>('cw', 'ccw'),
    alpha: fc.constantFrom(0, 0, 30, 45, 60, 90, 120, 150, 200),
  }),
  fc.record({ type: fc.constant('weight' as const), at: fc.nat(), G: fc.constantFrom(3, 5, 10, 12) }),
  fc.record({ type: fc.constant('moment' as const), at: fc.nat(), M: fc.constantFrom(2, 4, 6, 10), dir: fc.constantFrom<'cw' | 'ccw'>('cw', 'ccw') }),
  fc.record({
    type: fc.constant('dist' as const),
    seg: fc.nat(),
    // Знакопеременная нагрузка, в том числе q1 = −q2 (там прототип терял пару сил — баг №2).
    q1: fc.constantFrom(0, 1, 2, 3, 4, -1),
    q2: fc.constantFrom(0, 1, 2, 3, 5, -2, -4, -1),
    dir: fc.constantFrom<LoadDir>('down', 'up', 'left', 'right'),
  }),
);

/** Конструкция с опорами, дающими (как правило) определимую систему, и случайными нагрузками. */
export const structureArb = fc
  .record({
    frame: frameArb,
    plan: fc.constantFrom<SupportPlan>('pin+roller', 'fixed', 'pin+rod', 'rod×3', 'roller×3', 'pin+tilt', 'pin+unknownF', 'roller+roller+unknownM'),
    pts: fc.array(fc.nat(), { minLength: 3, maxLength: 3 }),
    sides: fc.array(fc.constantFrom(...SIDES), { minLength: 3, maxLength: 3 }),
    angles: fc.array(fc.constantFrom(...ANGLES), { minLength: 3, maxLength: 3 }),
    loads: fc.array(loadArb, { maxLength: 4 }),
  })
  .map(({ frame, plan, pts, sides, angles, loads }) => {
    const { s, ids } = frame;
    const g = geom(s);
    const node = (i: number) => g.order[i % g.order.length];
    const items: Item[] = [];
    const add = (it: ItemData) => items.push({ id: ids.item(), ...it } as Item);
    const roller = (i: number) => add({ type: 'roller', at: node(pts[i]), side: sides[i], angle: 90 });
    switch (plan) {
      case 'pin+roller':
        add({ type: 'pin', at: node(pts[0]), side: sides[0] });
        roller(1);
        break;
      case 'fixed':
        add({ type: 'fixed', at: node(pts[0]), side: sides[0] });
        break;
      case 'pin+rod':
        add({ type: 'pin', at: node(pts[0]), side: sides[0] });
        add({ type: 'rod', at: node(pts[1]), angle: angles[1] });
        break;
      case 'rod×3':
        for (let i = 0; i < 3; i++) add({ type: 'rod', at: node(pts[i]), angle: angles[i] });
        break;
      case 'roller×3':
        for (let i = 0; i < 3; i++) roller(i);
        break;
      case 'pin+tilt':
        add({ type: 'pin', at: node(pts[0]), side: sides[0] });
        add({ type: 'roller', at: node(pts[1]), side: 'tilt', angle: angles[1] });
        break;
      case 'pin+unknownF':
        add({ type: 'pin', at: node(pts[0]), side: sides[0] });
        add({ type: 'force', at: node(pts[1]), F: 1, ref: 'down', rot: 'cw', alpha: angles[1] % 180, unknown: true });
        break;
      case 'roller+roller+unknownM':
        roller(0);
        roller(1);
        add({ type: 'moment', at: node(pts[2]), M: 1, dir: 'ccw', unknown: true });
        break;
    }
    for (const l of loads) {
      if (l.type === 'dist') {
        const q = s.segs[l.seg % s.segs.length];
        add({ type: 'dist', from: q.a, to: q.b, q1: l.q1, q2: l.q2, dir: l.dir });
      } else if (l.type === 'force') add({ ...l, at: node(l.at), unknown: false });
      else if (l.type === 'moment') add({ ...l, at: node(l.at), unknown: false });
      else add({ ...l, at: node(l.at) });
    }
    return { ...s, items } as Structure;
  });
