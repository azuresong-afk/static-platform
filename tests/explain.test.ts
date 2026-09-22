/** Режим подробных пояснений: добавляет абзацы, но не меняет остальной текст решения. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { loadPreset, PRESETS, presetStructure, type PresetKey } from '../src/model/presets';
import type { Block, Doc } from '../src/text/doc';
import { docHTML, inlineText } from '../src/text/doc';
import { goldenRandom } from './helpers/golden';

const withoutExplain = (d: Doc): Doc => ({
  steps: d.steps.map((s) => ({ ...s, blocks: s.blocks.filter((b) => !(b.k === 'p' && b.cls === 'explain')) })),
});
const explainTexts = (d: Doc, title: string) =>
  d.steps
    .filter((s) => s.title === title)
    .flatMap((s) => s.blocks)
    .filter((b) => b.k === 'p' && b.cls === 'explain')
    .map((b) => inlineText((b as Extract<Block, { k: 'p' }>).c));

describe('пояснения к ходу решения', () => {
  const inputs = [
    ...Object.keys(PRESETS).map((k) => ({ name: k, s: loadPreset(k as PresetKey), nt: [] as string[] })),
    ...goldenRandom.slice(0, 200).map((g) => ({ name: 'seed ' + g.seed, s: g.input!, nt: g.input!.notTarget })),
  ];
  for (const { name, s, nt } of inputs)
    it(`без пояснений текст тот же: ${name}`, () => {
      const plain = analyze(s, { notTarget: new Set(nt) });
      const ex = analyze(s, { notTarget: new Set(nt), explain: true });
      expect(docHTML(withoutExplain(ex.doc))).toBe(plain.html);
      expect(ex.solution).toEqual(plain.solution);
    });

  it('simple: объяснено, почему в каждом уравнении одно неизвестное', () => {
    const { doc } = analyze(loadPreset('simple'), { explain: true });
    const t = explainTexts(doc, 'Составляем и решаем уравнения равновесия');
    expect(t).toEqual([
      'Уравнение моментов относительно точки A. X_A, Y_A не входят: их линии действия проходят через точку A, плечи равны нулю. Остаётся одно неизвестное — R_E.',
      'Уравнение моментов относительно точки E. X_A не входит: линия действия проходит через точку E, плечо равно нулю. Значение R_E уже найдено. Остаётся одно неизвестное — Y_A.',
      'Уравнение проекций на ось x. Значения Y_A, R_E уже найдены. Остаётся одно неизвестное — X_A.',
    ]);
  });

  it('cantilever: реакция, перпендикулярная оси, не входит в уравнение проекций', () => {
    const { doc } = analyze(loadPreset('cantilever'), { explain: true });
    const t = explainTexts(doc, 'Составляем и решаем уравнения равновесия');
    expect(t).toContain('Уравнение проекций на ось x. Y_A не входит: сила перпендикулярна оси x, её проекция равна нулю. Значение M_A уже найдено. Остаётся одно неизвестное — X_A.');
  });

  it('о каждом типе опоры — только если он есть в задаче; правило знака стержня', () => {
    const [bracket] = explainTexts(analyze(loadPreset('bracket'), { explain: true }).doc, 'Освобождаемся от связей');
    expect(bracket).toContain('Шарнирно-неподвижная опора');
    expect(bracket).toContain('«+» означает, что стержень сжат');
    expect(bracket).not.toContain('заделка');
    expect(bracket).not.toContain('каток');
    const [lever] = explainTexts(analyze(loadPreset('lever'), { explain: true }).doc, 'Освобождаемся от связей');
    expect(lever).toContain('Для искомой нагрузки направление тоже принимаем');
  });

  it('искомый момент не входит в уравнение проекций', () => {
    // Катки в A (вертикальная реакция) и C (горизонтальная), искомый момент в B: первым берётся ΣFx.
    const s = presetStructure({
      pts: [[0, 0], [3, 0], [3, 2]],
      items: [
        { type: 'roller', at: 0, side: 'below' },
        { type: 'roller', at: 2, side: 'left' },
        { type: 'moment', at: 1, M: 1, dir: 'ccw', unknown: true },
        { type: 'force', at: 1, F: 5, ref: 'right', rot: 'cw', alpha: 0, unknown: false },
      ],
    });
    const t = explainTexts(analyze(s, { explain: true }).doc, 'Составляем и решаем уравнения равновесия');
    expect(t[0]).toBe(
      'Уравнение проекций на ось x. R_A не входит: сила перпендикулярна оси x, её проекция равна нулю. M — момент, в уравнения проекций не входит. Остаётся одно неизвестное — R_C.',
    );
  });

  it('пояснения есть во всех шагах решённой задачи', () => {
    const { doc } = analyze(loadPreset('pframe'), { explain: true });
    for (const title of ['Освобождаемся от связей', 'Заменяем распределённую нагрузку равнодействующей', 'Проверяем статическую определимость', 'Составляем и решаем уравнения равновесия', 'Проверка', 'Ответ'])
      expect(explainTexts(doc, title).length, title).toBeGreaterThan(0);
  });
});
