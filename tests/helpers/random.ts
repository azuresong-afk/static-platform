/** Генераторы случайных конструкций для fast-check. */
import fc from 'fast-check';
import { addSeg, addSegXY } from '../../src/modules/frames/model/edit';
import { geom } from '../../src/modules/frames/model/geometry';
import { createIdGen } from '../../src/shared/ids';
import type { Dir, Item, ItemData, LoadDir, RefDir, Side, Structure } from '../../src/modules/frames/model/types';

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

const loadArb = (loadDirs: LoadDir[]) =>
  fc.oneof(
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
      dir: fc.constantFrom<LoadDir>(...loadDirs),
    }),
  );

/** Рама с наклонными участками: по углу и длине или по проекциям (иррациональная длина). */
export const inclinedFrameArb = fc
  .array(
    fc.oneof(
      fc.record({ from: fc.nat(), dir: fc.constantFrom(...DIRS), len: fc.constantFrom(...LENS) }),
      fc.record({ from: fc.nat(), ang: fc.constantFrom(30, 45, 60, 120, 135, 150, 210, 240, 300, 330, 17.5), len: fc.constantFrom(...LENS) }),
      fc.record({ from: fc.nat(), dx: fc.constantFrom(1, 2, -1.5, 3, -4), dy: fc.constantFrom(1, -1, 2.5, 3, -2) }),
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((steps) => {
    const ids = createIdGen();
    let s: Structure = { nodes: [{ id: ids.node() }], segs: [], items: [] };
    for (const st of steps) {
      const from = s.nodes[st.from % s.nodes.length].id;
      const r =
        'dx' in st ? addSegXY(s, from, st.dx, st.dy, ids) : 'ang' in st ? addSeg(s, from, 'a', st.len, ids, st.ang) : addSeg(s, from, st.dir, st.len, ids);
      if (r.ok) s = r.s;
    }
    if (!s.segs.length) s = (addSeg(s, s.nodes[0].id, 'a', 2, ids, 30) as { s: Structure }).s;
    return { s, ids };
  });

/** Конструкция с опорами, дающими (как правило) определимую систему, и случайными нагрузками. */
export const structureArb = makeStructureArb(frameArb, ['down', 'up', 'left', 'right']);
/** То же на рамах с наклонными участками; нагрузка бывает и по нормали к участку. */
export const inclinedStructureArb = makeStructureArb(inclinedFrameArb, ['down', 'up', 'left', 'right', 'nu', 'nd']);

function makeStructureArb(frames: typeof frameArb, loadDirs: LoadDir[]) {
  return fc
    .record({
      frame: frames,
      plan: fc.constantFrom<SupportPlan>('pin+roller', 'fixed', 'pin+rod', 'rod×3', 'roller×3', 'pin+tilt', 'pin+unknownF', 'roller+roller+unknownM'),
      pts: fc.array(fc.nat(), { minLength: 3, maxLength: 3 }),
      sides: fc.array(fc.constantFrom(...SIDES), { minLength: 3, maxLength: 3 }),
      angles: fc.array(fc.constantFrom(...ANGLES), { minLength: 3, maxLength: 3 }),
      loads: fc.array(loadArb(loadDirs), { maxLength: 4 }),
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
}
