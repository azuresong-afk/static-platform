import { describe, expect, it } from 'vitest';
import { addItem, addSeg, defaults, removeSeg, setSegDir, setSegLen, splitSeg } from '../src/model/edit';
import { geom, resolve } from '../src/model/geometry';
import { createIdGen, idGenAfter, type IdGen } from '../src/model/ids';
import { loadPreset, presetStructure } from '../src/model/presets';
import type { Structure } from '../src/model/types';
import { goldenRandom } from './helpers/golden';

/** Элементы в состоянии прототипа хранят угол силы; в порте он производный. */
const stripForceAngle = (s: Structure): Structure => ({
  ...s,
  items: s.items.map((it) => {
    const r = { ...it } as Record<string, unknown>;
    if (it.type === 'force') delete r.angle;
    return r as unknown as (typeof s.items)[number];
  }),
});

/** Генератор, выдающий те же идентификаторы, что получил прототип. */
function idsLike(before: Structure, after: Structure): IdGen {
  const newNode = after.nodes.find((n) => !before.nodes.some((m) => m.id === n.id))!.id;
  const newSeg = after.segs.find((q) => !before.segs.some((m) => m.id === q.id))!.id;
  return { node: () => newNode, seg: () => newSeg, item: () => 'e0' };
}

describe('golden: убрать и разделить участок', () => {
  const cases = goldenRandom.filter((g) => g.remove);
  it('в наборе есть и удачные, и неудачные разделения', () => {
    expect(cases.some((g) => g.split!.ok)).toBe(true);
    expect(cases.some((g) => !g.split!.ok)).toBe(true);
  });
  for (const g of cases)
    it(`seed ${g.seed}`, () => {
      const inp = g.input!;
      const s = resolve({ nodes: inp.nodes, segs: inp.segs, items: inp.items }).structure;
      const rm = removeSeg(s, g.remove!.seg);
      expect(rm.ok).toBe(g.remove!.ok);
      if (!rm.ok) expect(rm.msg ?? '').toBe(g.remove!.msg);
      else expect(rm.s).toEqual(stripForceAngle(g.remove!.result!));

      const sp = g.split!;
      const r = splitSeg(s, sp.seg, sp.t, sp.ok ? idsLike(s, sp.result!) : createIdGen());
      expect(r.ok).toBe(sp.ok);
      if (r.ok) expect(r.s).toEqual(stripForceAngle(sp.result!));
    });
});

describe('операции редактирования', () => {
  it('добавить участок: проверки и сообщения', () => {
    const s = loadPreset('simple');
    const ids = idGenAfter(s);
    const g = geom(s);
    const A = g.order[0];
    expect(addSeg(s, A, 'u', 0, ids)).toMatchObject({ ok: false, msg: 'Длина должна быть больше нуля.' });
    expect(addSeg(s, A, 'u', 1001, ids)).toMatchObject({ ok: false });
    expect(addSeg(s, A, 'r', 1, ids)).toMatchObject({ ok: false, msg: 'Из этой точки в этом направлении уже идёт участок.' });
    expect(addSeg(s, A, 'l', 1, ids).ok).toBe(true);
    const up = addSeg(s, A, 'u', 2.5, ids);
    expect(up.ok).toBe(true);
    if (up.ok) expect(geom(up.s).pos[up.s.nodes.at(-1)!.id]).toEqual([0, 2.5]);
  });

  it('пересечение и наложение участков запрещено', () => {
    // П-образная рама: правую стойку нельзя повернуть влево — ляжет на ригель.
    const s = loadPreset('pframe');
    const last = s.segs.at(-1)!;
    expect(setSegDir(s, last.id, 'l')).toMatchObject({ ok: false, msg: 'В этом направлении участок наложится на другой.' });
    // Г-образная рама: консоль вниз ляжет на стойку, влево — можно (координаты сдвинутся, левая нижняя точка снова (0; 0)).
    const gs = loadPreset('gframe');
    const cant = gs.segs.at(-1)!;
    expect(setSegDir(gs, cant.id, 'd').ok).toBe(false);
    const left = setSegDir(gs, cant.id, 'l');
    expect(left.ok).toBe(true);
    if (left.ok) expect(geom(left.s).pos[gs.nodes[0].id]).toEqual([3, 0]);
    // Крюк: удлинение последнего участка вниз пересекает первый.
    const hook = presetStructure({ pts: [[0, 0], [4, 0], [4, 2], [2, 2], [2, 1]], items: [] });
    const tip = hook.segs.at(-1)!;
    expect(setSegLen(hook, tip.id, 1.5).ok).toBe(true);
    expect(setSegLen(hook, tip.id, 3)).toMatchObject({ ok: false, msg: 'При такой длине участки пересекаются.' });
    expect(setSegLen(s, last.id, 0)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(setSegLen(s, last.id, last.len)).toMatchObject({ ok: false, reason: 'noop' });
  });

  it('разделить участок посередине: длины и имена точек', () => {
    const s = loadPreset('indet');
    const r = splitSeg(s, s.segs[0].id, 3, idGenAfter(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.s.segs.map((q) => q.len)).toEqual([3, 3]);
    const g = geom(r.s);
    expect(g.order.map((id) => g.name[id])).toEqual(['A', 'B', 'C']);
    expect(splitSeg(s, s.segs[0].id, 0, idGenAfter(s)).ok).toBe(false);
    expect(splitSeg(s, s.segs[0].id, 6, idGenAfter(s)).ok).toBe(false);
  });

  it('новый элемент: значения по умолчанию', () => {
    const s = loadPreset('blank');
    expect(defaults(s, 'pin')).toEqual({ at: s.nodes[0].id, side: 'below' });
    expect(defaults(s, 'fixed')).toEqual({ at: s.nodes[0].id, side: 'left' });
    expect(defaults(s, 'roller')).toEqual({ at: s.nodes[1].id, side: 'below', angle: 90 });
    expect(defaults(s, 'dist')).toEqual({ from: s.nodes[0].id, to: s.nodes[1].id, q1: 2, q2: 2, dir: 'down' });
    // Сосредоточенная нагрузка на балке из двух точек — сначала точка посередине.
    const r = addItem(s, 'force', idGenAfter(s));
    expect(r.s.nodes.length).toBe(3);
    expect(r.s.items.at(-1)).toMatchObject({ type: 'force', F: 10, ref: 'down', alpha: 0, unknown: false });
    const g = geom(r.s);
    expect(g.pos[(r.s.items.at(-1) as { at: string }).at]).toEqual([2, 0]);
  });
});
