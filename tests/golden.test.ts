/**
 * Сверка с прототипом: для готовых задач и 600 случайных конструкций (tests/golden, снято
 * scripts/capture-golden.ts с prototype/statika.html) совпадают текст решения, статус, найденные
 * значения, порядок уравнений, коэффициенты уравнений-кандидатов, заголовки карточек и поправки состояния.
 *
 * Намеренные отличия от прототипа (согласованы):
 * - баг №1: при n > 3 и ранге < 3 статус «изменяема», а не «неопределима»;
 * - баг №2: знакопеременная распределённая нагрузка заменяется двумя силами (текст другой;
 *   числа те же, кроме случая q1 = −q2, где прототип терял пару сил).
 * Для таких случаев сравнивается всё, что должно совпасть, а отличия проверяются явно.
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
function expectClose(a: unknown, b: unknown, path = '', tol = 1e-12): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${path}: ${a} ≠ ${b}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) expectClose((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path + '.' + k, tol);
    return;
  }
  expect(a, path).toEqual(b);
}

type Mode = 'strict' | 'rank' | 'split' | 'cancel';

/** Какое намеренное отличие от прототипа затрагивает этот случай. */
function modeOf(s: Structure, g: GoldenCase): Mode {
  const { model } = analyze(s);
  const split = model.dists.filter((d) => d.split);
  if (split.some((d) => Math.abs(d.q1 + d.q2) < 1e-12)) return 'cancel';
  if (g.status === 'indeterminate' && (g.rank ?? 3) < 3) return 'rank';
  if (split.length) return 'split';
  return 'strict';
}

function compare(s: Structure, notTarget: string[], g: GoldenCase, mode: Mode = 'strict') {
  const { model, solution, html } = analyze(s, { notTarget: new Set(notTarget) });
  expect(solution.n).toBe(g.n);
  expect(solution.rank ?? null).toBe(g.rank);
  expect(s.items.map((it) => itemTitleHTML(model.labels[it.id]))).toEqual(Object.values(g.titles));
  expect(sizeText(model)).toBe(g.total);
  if (mode === 'rank') {
    // Баг №1 исправлен: ранг меньше трёх — система изменяема, решения нет.
    expect(solution.status).toBe('mechanism');
    expect(html).toContain('изменяема');
    return;
  }
  // В случае q1 = −q2 прототип считал неверно — там сверяем только структуру (числа проверяют свойства).
  if (mode === 'cancel') return;
  expect(solution.status).toBe(g.status);
  expectClose(solution.vals, g.vals, 'vals', mode === 'split' ? 1e-9 : 1e-12);
  expect(solution.steps.map((x) => [x.e.id, x.key])).toEqual(g.steps);
  expect(solution.joint ? { eqs: solution.joint.eqs.map((e) => e.id), keys: solution.joint.keys } : null).toEqual(g.joint);
  expect(solution.check?.e.id ?? null).toEqual(g.check?.e ?? null);
  // Коэффициенты при неизвестных те же; свободные члены — та же сумма, собранная из двух сил.
  expectClose(
    model.cands.map((e) => ({ id: e.id, coeffs: e.coeffs, cst: e.cst })),
    g.cands,
    'cands',
    mode === 'split' ? 1e-9 : 1e-12,
  );
  if (mode === 'strict') {
    expectClose(solution.check ? { r: solution.check.r } : null, g.check ? { r: g.check.r } : null, 'check');
    // Заголовки карточек — по порядку элементов (идентификаторы в прототипе зависят от истории счётчиков).
    expect(normHTML(html)).toBe(normHTML(g.html));
  }
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
    // Большинство случаев сверяются строго, включая текст.
    const modes = goldenRandom.map((g) => modeOf({ nodes: g.input!.nodes, segs: g.input!.segs, items: g.input!.items }, g));
    expect(modes.filter((m) => m === 'strict').length).toBeGreaterThan(400);
    expect(modes).toContain('rank');
    expect(modes).toContain('split');
  });

  for (const g of goldenRandom)
    it(`seed ${g.seed} (${g.status})`, () => {
      const inp = g.input!;
      const s: Structure = { nodes: inp.nodes, segs: inp.segs, items: inp.items };
      compare(s, inp.notTarget, g, modeOf(s, g));
      // Поправки, которые прототип вносит в состояние (перенос элементов, направление нагрузки, углы опор).
      const norm = resolve(s).structure.items.map((it) => {
        const r = { ...it } as Record<string, unknown>;
        if (it.type === 'force' || it.type === 'weight' || it.type === 'moment') delete r.angle;
        return r;
      });
      expect(norm).toEqual(g.normItems);
    });
});
