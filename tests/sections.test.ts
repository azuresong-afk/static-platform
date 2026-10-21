/** Подбор сечения: сортамент, расчёт, ручные эталоны. */
import { describe, expect, it } from 'vitest';
import { ceilMm, design } from '../src/modules/sections/model/design';
import { GOST_8239 } from '../src/modules/sections/model/sortament';
import { sectionsDoc } from '../src/modules/sections/text/solution';
import { DEFAULT_PARAMS, parseParams, SectionsStore } from '../src/modules/sections/ui/store';
import { analyze } from '../src/modules/frames/analyze';
import { Store as FramesStore } from '../src/modules/frames/ui/store';
import { DEFAULT_CONVENTIONS } from '../src/shared/conventions';
import { inlineText } from '../src/shared/doc';

describe('сортамент ГОСТ 8239-89 согласован', () => {
  for (const p of GOST_8239)
    it(`№${p.no}`, () => {
      const rel = (a: number, b: number) => Math.abs(a - b) / b;
      expect(rel((2 * p.Ix) / (p.h / 10), p.Wx)).toBeLessThan(0.005);
      expect(rel((2 * p.Iy) / (p.b / 10), p.Wy)).toBeLessThan(0.005);
      expect(rel(Math.sqrt(p.Ix / p.A), p.ix)).toBeLessThan(0.005);
      expect(rel(Math.sqrt(p.Iy / p.A), p.iy)).toBeLessThan(0.007);
      expect(rel(0.785 * p.A, p.m)).toBeLessThan(0.005);
      // Площадь по размерам меньше табличной на скругления — в пределах 1–2,5 %.
      const geo = (2 * p.b * p.t + (p.h - 2 * p.t) * p.s) / 100;
      expect(p.A / geo - 1).toBeGreaterThan(0.01);
      expect(p.A / geo - 1).toBeLessThan(0.025);
      // Статический момент полусечения ≈ 0,56…0,59 Wx.
      expect(p.Sx / p.Wx).toBeGreaterThan(0.56);
      expect(p.Sx / p.Wx).toBeLessThan(0.59);
    });
  it('номера по возрастанию Wx', () => GOST_8239.slice(1).forEach((p, i) => expect(p.Wx).toBeGreaterThan(GOST_8239[i].Wx)));
});

describe('Антонов, задача 2, схема 7, группа 10: M = 120 кН·м, Q = 40 кН, σт = 230 МПа, n = 1,3, [τ] = 70 МПа', () => {
  const sigma = 230 / 1.3;
  const d = design({ M: 120, Q: 40, sigma, tau: 70, k: 2, overload: 0 });
  it('W ≥ M/[σ] = 678,26 см³', () => expect(d.Wreq).toBeCloseTo(678.26, 2));
  it('прямоугольник h = 2b: b = ∛(3W/2) = 10,058 → 10,1 см, h = 20,2 см, A = 204,02 см²', () => {
    expect(d.rect.bCalc).toBeCloseTo(10.058, 3);
    expect([d.rect.b, d.rect.h]).toEqual([10.1, 20.2]);
    expect(d.rect.A).toBeCloseTo(204.02, 2);
    expect(d.rect.tau).toBeCloseTo((1.5 * 40 * 10) / 204.02, 6);
  });
  it('круг: d = ∛(32W/π) = 19,05 → 19,1 см, A = 286,52 см²', () => {
    expect(d.circle.dCalc).toBeCloseTo(19.05, 2);
    expect(d.circle.d).toBe(19.1);
    expect(d.circle.A).toBeCloseTo(286.52, 2);
  });
  it('двутавр №36 (Wx = 743 см³; №33 с Wx = 597 не проходит), τ = Q·Sx/(Ix·s) = 16,86 МПа', () => {
    expect(d.ibeam?.p.no).toBe('36');
    expect(d.ibeam?.prev?.no).toBe('33');
    expect(d.ibeam?.sigma).toBeCloseTo(161.51, 2);
    expect(d.ibeam?.tau).toBeCloseTo(16.86, 2);
    expect(d.ibeam?.tauOk).toBe(true);
  });
  it('самое лёгкое — двутавр', () => expect(d.best).toBe('ibeam'));
  it('перенапряжение 5 %: №33 даёт σ = 201 МПа > 1,05·176,9 = 185,8 — всё равно №36', () =>
    expect(design({ M: 120, Q: 40, sigma, tau: 70, k: 2, overload: 5 }).ibeam?.p.no).toBe('36'));
});

describe('подбор', () => {
  it('размеры округляются вверх до миллиметра', () => {
    expect(ceilMm(10.01)).toBe(10.1);
    expect(ceilMm(10.1)).toBe(10.1);
    expect(ceilMm(9.99999999999)).toBe(10);
  });
  it('подобранные сечения выдерживают [σ]; меньший двутавр — нет', () => {
    for (const M of [1, 7.5, 30, 120, 400]) {
      const d = design({ M, Q: 10, sigma: 160, tau: 100, k: 1.5, overload: 0 });
      expect(d.rect.sigma).toBeLessThanOrEqual(160 + 1e-9);
      expect(d.circle.sigma).toBeLessThanOrEqual(160 + 1e-9);
      expect(d.ibeam!.sigma).toBeLessThanOrEqual(160 + 1e-9);
      if (d.ibeam!.prev) expect((M * 1e3) / d.ibeam!.prev.Wx).toBeGreaterThan(160);
      expect(d.rect.h / d.rect.b).toBeGreaterThanOrEqual(1.5 - 1e-9);
    }
  });
  it('момент больше, чем выдерживает №60: двутавра нет', () => expect(design({ M: 600, Q: 10, sigma: 160, tau: 100, k: 2, overload: 0 }).ibeam).toBeNull());
});

describe('текст решения и файл проекта', () => {
  const text = (doc: ReturnType<typeof sectionsDoc>) =>
    doc.steps
      .map((st) => st.title + '\n' + st.blocks.map((bl) => (bl.k === 'p' ? inlineText(bl.c) : bl.k === 'eq' ? bl.lines.map((l) => inlineText(l.c)).join('\n') : bl.k === 'ul' ? bl.items.map(inlineText).join('\n') : bl.k === 'answer' ? bl.rows.map((r) => inlineText(r.val) + ' ' + r.note).join('\n') : '')).join('\n'))
      .join('\n');
  const sigma = 230 / 1.3;
  const d = design({ M: 120, Q: 40, sigma, tau: 70, k: 2, overload: 0 });

  it('решение: [σ] через σт/n, W, размеры, двутавр, касательные, ответ', () => {
    const t = text(sectionsDoc({ d, M: 120, Q: 40, where: { M: 'в точке D', Q: 'в точке D' }, sigma, sigmaT: { sT: 230, n: 1.3 }, tau: 70, k: 2, overload: 0 }, DEFAULT_CONVENTIONS));
    expect(t).toContain('[σ] = σт/n = 230/1,3 = 176,92 МПа');
    expect(t).toContain('= 678,26 см³');
    expect(t).toContain('Принимаем b = 101 мм, h = 202 мм.');
    expect(t).toContain('Принимаем d = 191 мм.');
    expect(t).toContain('Меньший двутавр №33 (W = 597 см³) не подходит');
    expect(t).toContain('= 16,86 МПа ≤ 70 МПа — условие выполнено');
    expect(t).toContain('Оптимальное сечение — двутавр №36.');
  });

  it('обозначения с индексами: W_x, I_x, M_x', () => {
    const t = text(sectionsDoc({ d, M: 120, Q: 40, where: null, sigma, tau: 70, k: 2, overload: 0 }, { ...DEFAULT_CONVENTIONS, indexed: true }));
    expect(t).toContain('W_x ≥ |M_x|max/[σ]');
    expect(t).toContain('I_x·s');
  });

  it('сохранить → открыть: исходные данные и схема восстанавливаются', () => {
    const a = new SectionsStore(new FramesStore({ preset: 'simple' }));
    a.load({ ...DEFAULT_PARAMS, sigmaMode: 'yield', sigmaT: 230, n: 1.3, tau: 70, overload: 5 });
    const { text: file } = a.exportProject();
    expect(JSON.parse(file)).toMatchObject({ format: 'statika-project', version: 2, module: 'sections', section: { sigmaT: 230, overload: 5 } });
    const b = new SectionsStore(new FramesStore({ preset: 'cantilever' }));
    expect(b.importProject(file, 'x.statika.json')).toBe(true);
    expect(b.get().p).toEqual(a.get().p);
    expect(analyze(b.frames.get().s).html).toBe(analyze(a.frames.get().s).html);
    b.undo();
    expect(b.get().p).toEqual(DEFAULT_PARAMS);
  });

  it('испорченные исходные данные — понятная ошибка, ничего не меняется', () => {
    const a = new SectionsStore(new FramesStore({ preset: 'simple' }));
    const o = JSON.parse(a.exportProject().text);
    o.section.tau = -5;
    const b = new SectionsStore(new FramesStore({ preset: 'cantilever' }));
    const s0 = b.frames.get().s;
    expect(b.importProject(JSON.stringify(o), 'bad.json')).toBe(false);
    expect(b.frames.get().notice?.text).toMatch(/\[τ\] должно быть положительным/);
    expect(b.frames.get().s).toBe(s0);
    expect(parseParams({ ...DEFAULT_PARAMS, source: 'x' }).ok).toBe(false);
  });

  it('файл «Балок и рам» во вкладке подбора открывает схему, исходные данные не трогает', () => {
    const f = new FramesStore({ preset: 'gerber' });
    const b = new SectionsStore(new FramesStore({ preset: 'simple' }));
    b.load({ ...DEFAULT_PARAMS, tau: 55 });
    expect(b.importProject(f.exportProject().text)).toBe(true);
    expect(b.get().p.tau).toBe(55);
    expect(b.frames.get().s.nodes.some((n) => n.hinge)).toBe(true);
  });
});
