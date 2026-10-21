/** Наклонные участки: правка, проверка геометрии, файл проекта, тексты, границы других разделов. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { analyzeBeam } from '../src/modules/bending/model/beam';
import { addSeg, addSegXY, fixedSide, pinSide, removeSeg, setSegAng, setSegDir, splitSeg } from '../src/modules/frames/model/edit';
import { distGeom, geom, geomOK } from '../src/modules/frames/model/geometry';
import { loadPreset } from '../src/modules/frames/model/presets';
import { parseProject, serializeProject } from '../src/modules/frames/model/project';
import type { Structure } from '../src/modules/frames/model/types';
import { givenData } from '../src/modules/frames/text/given';
import { createIdGen } from '../src/shared/ids';
import { inlineHTML } from '../src/shared/doc';

const base = () => {
  const ids = createIdGen();
  const s: Structure = { nodes: [{ id: ids.node() }], segs: [], items: [] };
  return { s, ids };
};
const ok = (r: ReturnType<typeof addSeg>): Structure => {
  if (!r.ok) throw new Error('правка отклонена: ' + (r.msg ?? r.reason));
  return r.s;
};

describe('правка наклонных участков', () => {
  it('по проекциям 4 × 3: точная длина 5, угол atan(3/4), точка (4; 3)', () => {
    const { s, ids } = base();
    const t = ok(addSegXY(s, s.nodes[0].id, 4, 3, ids));
    expect(t.segs[0].dir).toBe('a');
    expect(t.segs[0].len).toBe(5);
    expect(t.segs[0].ang).toBeCloseTo((Math.atan2(3, 4) * 180) / Math.PI, 12);
    expect(geom(t).pos[t.nodes[1].id]).toEqual([4, 3]);
  });

  it('угол, кратный 90°, и проекция без наклона дают участок по оси', () => {
    const { s, ids } = base();
    expect(ok(addSeg(s, s.nodes[0].id, 'a', 2, ids, 90)).segs[0]).toMatchObject({ dir: 'u', len: 2 });
    expect(ok(addSegXY(s, s.nodes[0].id, -3, 0, ids)).segs[0]).toMatchObject({ dir: 'l', len: 3 });
    const t = ok(addSeg(s, s.nodes[0].id, 'a', 2, ids, 30));
    const u = ok(setSegAng(t, t.segs[0].id, 180));
    expect(u.segs[0].dir).toBe('l');
    expect(u.segs[0].ang).toBeUndefined();
    expect(setSegAng(t, t.segs[0].id, 30)).toMatchObject({ ok: false, reason: 'noop' });
  });

  it('разделение участка по проекциям сохраняет положение конца', () => {
    const { s, ids } = base();
    const t = ok(addSegXY(s, s.nodes[0].id, 1, 1, ids));
    const u = ok(splitSeg(t, t.segs[0].id, 0.5, ids));
    const g = geom(u);
    expect(u.segs.map((q) => q.dir)).toEqual(['a', 'a']);
    expect(g.pos[t.nodes[1].id]).toEqual([1, 1]);
  });

  it('пересечение и наложение с наклонными участками запрещены, общий конец — можно', () => {
    const { s, ids } = base();
    const t = ok(addSeg(s, s.nodes[0].id, 'r', 4, ids));
    // Из (0; 0) под 45° и из (4; 0) под 135° — пересекутся в (2; 2), если оба длиной больше 2√2.
    const u = ok(addSeg(t, t.nodes[0].id, 'a', 4, ids, 45));
    expect(addSeg(u, t.nodes[1].id, 'a', 4, ids, 135)).toMatchObject({ ok: false, reason: 'overlap' });
    expect(addSeg(u, t.nodes[1].id, 'a', 2, ids, 135).ok).toBe(true);
    // Тот же угол из той же точки — занято.
    expect(addSeg(u, u.nodes[0].id, 'a', 1, ids, 45)).toMatchObject({ ok: false, reason: 'occupied' });
    // Касание концом середины другого участка.
    expect(addSegXY(u, t.nodes[1].id, -2, 2, ids)).toMatchObject({ ok: false, reason: 'overlap' });
  });

  it('убрать участок нельзя, если наклонные соседи лягут друг на друга', () => {
    const { s, ids } = base();
    const t = ok(addSeg(s, s.nodes[0].id, 'r', 2, ids));
    const u = ok(addSeg(t, t.nodes[0].id, 'a', 2, ids, 30));
    const v = ok(addSeg(u, t.nodes[1].id, 'a', 2, ids, 30));
    expect(removeSeg(v, v.segs[0].id)).toMatchObject({ ok: false, reason: 'overlap' });
  });

  it('смена направления в наклонное и обратно', () => {
    const s = loadPreset('simple');
    const t = ok(setSegDir(s, s.segs[3].id, 'a', 330));
    expect(geomOK(t)).toBe(true);
    expect(t.segs[3]).toMatchObject({ dir: 'a', ang: 330 });
    expect(ok(setSegDir(t, t.segs[3].id, 'r')).segs[3].ang).toBeUndefined();
  });

  it('опоры по умолчанию обходят наклонный участок', () => {
    const { s, ids } = base();
    const t = ok(addSeg(s, s.nodes[0].id, 'a', 3, ids, 250));
    const g = geom(t);
    expect(pinSide(g, t.nodes[0].id)).toBe('left');
    expect(fixedSide(g, t.nodes[1].id)).toBe('below');
  });
});

describe('распределённая нагрузка на наклонном участке', () => {
  it('прямая через несколько участков одного наклона — одна нагрузка', () => {
    const s = loadPreset('ladder');
    const g = geom(s);
    const dg = distGeom(g, { from: s.nodes[0].id, to: s.nodes[3].id });
    expect(dg.ok && dg.axis === 'a' && Math.abs(dg.len - 3) < 1e-12 && Math.abs(dg.ang - 45) < 1e-9).toBe(true);
  });

  it('нормаль у горизонтального и вертикального участка заменяется направлением по оси', () => {
    const s = loadPreset('simple');
    const d = s.items.find((i) => i.type === 'dist')!;
    const t: Structure = { ...s, items: s.items.map((i) => (i === d ? { ...d, dir: 'nd' as const } : i)) };
    expect(analyze(t).model.dists[0].o.angle).toBe(270);
  });

  it('текст: нагрузка перпендикулярно участку и пояснение про длину по оси', () => {
    const a = analyze(loadPreset('rafter'), { explain: true });
    expect(a.html).toContain('перпендикулярно участку (под углом 300° к оси x)');
    expect(a.html).toContain('интенсивность q отнесена к его длине');
    const plain = analyze(loadPreset('rafter')).html;
    expect(plain).not.toContain('интенсивность q отнесена');
  });
});

describe('файл проекта и отчёт', () => {
  it('наклонный участок сохраняется с углом и открывается без потерь', () => {
    const s = loadPreset('rafter');
    const text = serializeProject({ title: 'Стропила', structure: s, notTarget: [] });
    const segs = JSON.parse(text).structure.segs;
    expect(segs[0]).toMatchObject({ dir: 'a', ang: 30 });
    const r = parseProject(text);
    expect(r.ok && r.project.structure).toEqual(s);
  });

  it('угол, кратный 90°, в файле превращается в направление по оси; без угла — ошибка', () => {
    const s = loadPreset('rafter');
    const raw = JSON.parse(serializeProject({ title: 'т', structure: s, notTarget: [] }));
    raw.structure.segs[1] = { ...raw.structure.segs[1], ang: -90 };
    const r = parseProject(JSON.stringify(raw));
    expect(r.ok && r.project.structure.segs[1]).toMatchObject({ dir: 'd' });
    delete raw.structure.segs[1].ang;
    const bad = parseProject(JSON.stringify(raw));
    expect(!bad.ok && bad.errors.join(' ')).toMatch(/угол ang/);
    raw.structure.items[3].dir = 'sideways';
    expect(parseProject(JSON.stringify(raw)).ok).toBe(false);
  });

  it('«Дано» перечисляет наклонные участки', () => {
    const s = loadPreset('ladder');
    const gv = givenData(s.items, analyze(s).model);
    expect(gv.inclined.map((r) => inlineHTML(r))).toHaveLength(3);
    expect(inlineHTML(gv.inclined[0])).toContain('длина 1 м, под углом 45° к горизонту (вправо и вверх)');
    expect(givenData(loadPreset('simple').items, analyze(loadPreset('simple')).model).inclined).toEqual([]);
  });
});

it('«Изгиб» не принимает раму с наклонными участками', () => {
  const s = loadPreset('ladder');
  expect(analyzeBeam(s, analyze(s))).toMatchObject({ ok: false, why: 'notbeam' });
});
