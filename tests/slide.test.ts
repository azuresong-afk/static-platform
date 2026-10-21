/** Скользящая заделка в «Балках и рамах»: опора и соединение частей; пример задания С.3 Яблонского. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { renderDrawing } from '../src/modules/frames/draw/drawing';
import { parseProject, serializeProject } from '../src/modules/frames/model/project';
import type { Structure } from '../src/modules/frames/model/types';
import { YAB_FRAMES } from '../src/modules/frames/tasks';
import { Store } from '../src/modules/frames/ui/store';
import { virtualWork } from '../src/modules/virtual/model/virtual';
import { analyzeBeam } from '../src/modules/bending/model/beam';
import { taskInfo } from '../src/shared/tasks';

/** Балка длиной 4 м (точки A, B, C по обходу): в A — скользящая заделка, в C — каток, груз 10 в середине B. */
const beam = (slideSide: 'left' | 'below' | 'tilt', angle?: number): Structure => ({
  nodes: [{ id: 'a' }, { id: 'c' }, { id: 'b' }],
  segs: [
    { id: 's1', a: 'a', b: 'c', dir: 'r', len: 2 },
    { id: 's2', a: 'c', b: 'b', dir: 'r', len: 2 },
  ],
  items: [
    { id: 'i1', type: 'slide', at: 'a', side: slideSide, ...(angle != null ? { angle } : {}) },
    { id: 'i2', type: 'roller', at: 'b', side: 'below' },
    { id: 'i3', type: 'weight', at: 'c', G: 10 },
  ],
});

describe('скользящая заделка — опора', () => {
  it('вертикальная направляющая: вертикальную нагрузку целиком несёт каток, в заделке — момент', () => {
    const a = analyze(beam('left'));
    expect(a.solution.status).toBe('ok');
    expect(a.solution.vals.R_C).toBeCloseTo(10, 12);
    expect(a.solution.vals.R_A).toBeCloseTo(0, 12);
    // ΣM_A = M_A − 10·2 + R_C·4 = 0.
    expect(a.solution.vals.M_A).toBeCloseTo(-20, 12);
    expect(a.html).toMatch(/Скользящая заделка/);
    expect(a.html).toMatch(/направляющая вертикальна/);
  });
  it('горизонтальная направляющая с катком под балкой — механизм (горизонтальное смещение свободно)', () => {
    expect(analyze(beam('below')).solution.status).toBe('mechanism');
  });
  it('наклонная направляющая: равновесие выполняется', () => {
    const a = analyze(beam('tilt', 60));
    expect(a.solution.status).toBe('ok');
    const R = a.solution.vals.R_A,
      RB = a.solution.vals.R_C;
    // ΣX: R cos 60° = 0 ⇒ R = 0 (каток вертикален); ΣY: R sin 60° + R_C = 10.
    expect(R).toBeCloseTo(0, 12);
    expect(RB).toBeCloseTo(10, 12);
  });
  it('«Возможные перемещения» дают те же реакции; эпюры «Изгиба» строятся', () => {
    const s = beam('left');
    const a = analyze(s);
    const v = virtualWork(s, a);
    expect(v.ok).toBe(true);
    if (v.ok) for (const r of v.releases) expect(r.value).toBeCloseTo(r.ref, 9);
    const bm = analyzeBeam(s, a);
    expect(JSON.stringify(bm)).not.toMatch(/NaN/);
  });
});

describe('скользящая заделка между частями — пример С.3 Яблонского', () => {
  for (const t of YAB_FRAMES)
    it(t.title, () => {
      const s = t.build();
      const a = analyze(s, { explain: true });
      expect(a.solution.status).toBe('ok');
      for (const [k, book] of Object.entries(t.answerVals)) expect(Math.abs(a.solution.vals[k] - book), k).toBeLessThan(0.011);
      const v = virtualWork(s, a);
      expect(v.ok).toBe(true);
      if (v.ok) for (const r of v.releases) expect(r.value).toBeCloseTo(r.ref, 9);
      const d = JSON.stringify(renderDrawing(s, a.model, a.solution, { view: 'schema', sel: null }));
      expect(d).not.toMatch(/NaN|undefined/);
      expect(taskInfo(t.title)).toMatchObject({ book: 'yab', group: 'yab:С.3', num: 'С.3' });
    });
  it('текст: соединение описано как скользящая заделка, взаимные сила и момент', () => {
    const a = analyze(YAB_FRAMES[1].build(), { explain: true });
    expect(a.html).toMatch(/Расчленяем конструкцию по скользящим заделкам/);
    expect(a.html).toMatch(/В скользящей заделке/);
    expect(a.html).toMatch(/взаимных сил и моментов в соединениях частей: 2/);
    // Сумма моментов взаимных пар по частям равна нулю: уравнения всей конструкции их не содержат.
    expect(a.model.unknowns.filter((u) => u.hinge?.slide).map((u) => u.L)).toEqual(['R', 'M']);
  });
});

describe('файл проекта и редактор', () => {
  it('опора и соединение сохраняются и открываются без потерь', () => {
    const s = YAB_FRAMES[1].build();
    s.items.push({ id: 'zz', type: 'slide', at: s.nodes[2].id, side: 'tilt', angle: 30, angleName: 'α' });
    const text = serializeProject({ title: 'т', structure: s, notTarget: [] });
    const p = parseProject(text);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.project.structure.nodes.find((n) => n.slide != null)?.slide).toBe(90);
      expect(p.project.structure.items.find((i) => i.type === 'slide')).toMatchObject({ side: 'tilt', angle: 30, angleName: 'α' });
    }
    expect(text).toMatch(/"slide":\s*90/);
    expect(parseProject(text.replace(/"slide":\s*90/, '"slide": "x"')).ok).toBe(false);
  });
  it('шарнир и скользящая заделка в одной точке заменяют друг друга; отмена возвращает', () => {
    const st = new Store();
    st.loadStructure(YAB_FRAMES[0].build(st.ids), YAB_FRAMES[0].title);
    const C = st.get().s.nodes.find((n) => n.hinge)!.id;
    st.setSlideJoint(C, 90);
    expect(st.get().s.nodes.find((n) => n.id === C)).toEqual({ id: C, slide: 90 });
    expect(analyze(st.get().s).solution.vals.X_A).toBeCloseTo(-5.5, 9);
    st.setHinge(C, true);
    expect(st.get().s.nodes.find((n) => n.id === C)).toEqual({ id: C, hinge: true });
    st.undo();
    expect(st.get().s.nodes.find((n) => n.id === C)).toEqual({ id: C, slide: 90 });
  });
  it('новая опора «скользящая заделка» по умолчанию — направляющая вдоль участка', () => {
    const st = new Store();
    st.loadPreset('cantilever');
    st.addItem('slide');
    const it = st.get().s.items.find((i) => i.type === 'slide')!;
    // Участок горизонтален — направляющая горизонтальна, реакция вертикальна.
    expect(it).toMatchObject({ side: expect.stringMatching(/below|above/) });
  });
});
