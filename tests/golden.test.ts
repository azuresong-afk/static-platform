/**
 * Сверка с прототипом: для готовых задач и 600 случайных конструкций (tests/golden, снято
 * scripts/capture-golden.ts с prototype/statika.html) совпадают текст решения, статус, найденные
 * значения, порядок уравнений, коэффициенты уравнений-кандидатов, заголовки карточек и поправки состояния.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { resolve } from '../src/model/geometry';
import { loadPreset, type PresetKey } from '../src/model/presets';
import type { Structure } from '../src/model/types';
import { itemTitleHTML, sizeText } from '../src/text/labels';
import { goldenPresets, goldenRandom, normHTML, type GoldenCase } from './helpers/golden';

/**
 * Числа сравниваются с относительным допуском 1e-12: Math.sin/cos в Chromium (где снят эталон)
 * и в Node отличаются в последнем бите — V8 в Chromium собран с другой реализацией тригонометрии.
 * Текст решения, статусы и выбор уравнений сравниваются строго.
 */
function expectClose(a: unknown, b: unknown, path = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${path}: ${a} ≠ ${b}`).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(a), Math.abs(b)));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) expectClose((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path + '.' + k);
    return;
  }
  expect(a, path).toEqual(b);
}

function compare(s: Structure, notTarget: string[], g: GoldenCase) {
  const { model, solution, html } = analyze(s, { notTarget: new Set(notTarget) });
  expect(solution.status).toBe(g.status);
  expect(solution.n).toBe(g.n);
  expect(solution.rank ?? null).toBe(g.rank);
  expectClose(solution.vals, g.vals, 'vals');
  expect(solution.steps.map((x) => [x.e.id, x.key])).toEqual(g.steps);
  expect(solution.joint ? { eqs: solution.joint.eqs.map((e) => e.id), keys: solution.joint.keys } : null).toEqual(g.joint);
  expectClose(solution.check ? { e: solution.check.e.id, r: solution.check.r } : null, g.check, 'check');
  expectClose(model.cands.map((e) => ({ id: e.id, coeffs: e.coeffs, cst: e.cst })), g.cands, 'cands');
  expect(normHTML(html)).toBe(normHTML(g.html));
  // Заголовки карточек — по порядку элементов (идентификаторы в прототипе зависят от истории счётчиков).
  expect(s.items.map((it) => itemTitleHTML(model.labels[it.id]))).toEqual(Object.values(g.titles));
  expect(sizeText(model)).toBe(g.total);
}

describe('golden: готовые задачи', () => {
  for (const [key, g] of Object.entries(goldenPresets))
    it(key, () => {
      compare(loadPreset(key as PresetKey), [], g);
    });
});

describe('golden: случайные конструкции', () => {
  it('набор не пуст и покрывает все статусы', () => {
    const st = new Set(goldenRandom.map((g) => g.status));
    expect(goldenRandom.length).toBeGreaterThanOrEqual(500);
    for (const s of ['ok', 'indeterminate', 'mechanism', 'noequilibrium', 'nosupport']) expect(st.has(s), s).toBe(true);
    expect(goldenRandom.some((g) => g.joint)).toBe(true);
  });

  for (const g of goldenRandom)
    it(`seed ${g.seed} (${g.status})`, () => {
      const inp = g.input!;
      const s: Structure = { nodes: inp.nodes, segs: inp.segs, items: inp.items };
      compare(s, inp.notTarget, g);
      // Поправки, которые прототип вносит в состояние (перенос элементов, направление нагрузки, углы опор).
      const norm = resolve(s).structure.items.map((it) => {
        const r = { ...it } as Record<string, unknown>;
        if (it.type === 'force' || it.type === 'weight' || it.type === 'moment') delete r.angle;
        return r;
      });
      expect(norm).toEqual(g.normItems);
    });
});
