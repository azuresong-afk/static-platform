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

  it('«по нормали» объяснено простыми словами', () => {
    const [post] = explainTexts(analyze(loadPreset('post'), { explain: true }).doc, 'Освобождаемся от связей');
    expect(post).toContain('перпендикулярно (под прямым углом) к поверхности — это и называют «по нормали»');
  });

  it('проекции наклонной силы — через угол с осью, от которой отсчитан угол', () => {
    const proj = (k: PresetKey) =>
      explainTexts(analyze(loadPreset(k), { explain: true }).doc, 'Освобождаемся от связей').filter((t) => t.startsWith('Сила'));
    // Угол от горизонтального направления: на x — cos, на y — sin.
    expect(proj('simple')).toEqual([
      'Сила F задана углом 60° к направлению «влево», то есть угол отсчитан от оси x. Проекция на ось x — через cos этого угла, на другую ось — через sin: на x — F·cos 60°, на y — F·sin 60°; знак берём по направлению составляющей.',
    ]);
    // Угол от вертикального направления: на y — cos, на x — sin.
    expect(proj('pframe')).toEqual([
      'Сила F_2 задана углом 30° к направлению «вниз», то есть угол отсчитан от оси y. Проекция на ось y — через cos этого угла, на другую ось — через sin: на x — F_2·sin 30°, на y — F_2·cos 30°; знак берём по направлению составляющей.',
    ]);
  });

  it('угол больше 90° приводится к острому углу с той же осью', () => {
    const s = presetStructure({
      pts: [[0, 0], [2, 0], [4, 0]],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'roller', at: 2, side: 'below' },
        { type: 'force', at: 1, F: 10, ref: 'right', rot: 'ccw', alpha: 120, unknown: false },
      ],
    });
    const { doc, solution } = analyze(s, { explain: true });
    const [t] = explainTexts(doc, 'Освобождаемся от связей').filter((x) => x.startsWith('Сила'));
    expect(t).toContain('задана углом 120° к направлению «вправо»');
    expect(t).toContain('острый угол между линией действия силы и осью x: 60°');
    expect(t).toContain('на x — F·cos 60°, на y — F·sin 60°');
    // Числа: F = 10 под 120° → Fx = −5, Fy = 8,66; X_A = 5.
    expect(solution.vals.X_A).toBeCloseTo(5, 12);
  });

  it('пояснения есть во всех шагах решённой задачи', () => {
    const { doc } = analyze(loadPreset('pframe'), { explain: true });
    for (const title of ['Освобождаемся от связей', 'Заменяем распределённую нагрузку равнодействующей', 'Проверяем статическую определимость', 'Составляем и решаем уравнения равновесия', 'Проверка', 'Ответ'])
      expect(explainTexts(doc, title).length, title).toBeGreaterThan(0);
  });
});
