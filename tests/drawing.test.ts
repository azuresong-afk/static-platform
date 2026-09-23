/** Чертёж: разметка SVG совпадает с прототипом (оба вида, с выделением и без). */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { renderDrawing, type View } from '../src/draw/drawing';
import { loadPreset, type PresetKey } from '../src/model/presets';
import type { Structure } from '../src/model/types';
import { goldenPresets, goldenRandom, modeOf, normHTML, normSVG, type GoldenCase } from './helpers/golden';

function compare(s: Structure, g: GoldenCase, views: View[]) {
  const { model, solution } = analyze(s);
  for (const view of views) {
    const d = renderDrawing(s, model, solution, { view, sel: g.sel ?? null });
    expect(d.viewBox, view).toBe(g.svg[view].viewBox);
    expect(normSVG(d.svg), view).toBe(normHTML(g.svg[view].html));
  }
}

describe('чертёж: готовые задачи', () => {
  for (const [key, g] of Object.entries(goldenPresets)) it(key, () => compare(loadPreset(key as PresetKey), g, ['construct', 'schema']));
});

describe('чертёж: случайные конструкции', () => {
  for (const g of goldenRandom)
    it(`seed ${g.seed}`, () => {
      const s = { nodes: g.input!.nodes, segs: g.input!.segs, items: g.input!.items };
      const mode = modeOf(s, g);
      // Где расчёт исправлен (баги №1, №2), расходится штамп со статусом и равнодействующие на расчётной схеме.
      if (mode === 'strict') compare(s, g, ['construct', 'schema']);
      else if (mode === 'split') compare(s, g, ['construct']);
    });
});
