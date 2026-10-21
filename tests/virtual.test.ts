/** Принцип возможных перемещений: задачи Мещерского §46 и совпадение с уравнениями равновесия «Балок и рам». */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { loadPreset, PRESET_TITLES, presetStructure, type Preset, type PresetKey } from '../src/modules/frames/model/presets';
import { virtualWork, type Release } from '../src/modules/virtual/model/virtual';
import { M4619, M4620, M4621, M4625, M4626, VIRTUAL_PRESETS } from '../src/modules/virtual/presets';
import { virtualDoc } from '../src/modules/virtual/text/solution';
import { renderVirtual } from '../src/modules/virtual/draw/virtual';

const rel = (p: Preset) => {
  const s = presetStructure(p);
  const r = virtualWork(s, analyze(s));
  if (!r.ok) throw new Error(r.why + JSON.stringify(analyze(s).solution.status) + JSON.stringify(p.pts));
  return (name: string): Release => {
    const x = r.releases.find((q) => q.unknown.L + (q.unknown.S ? '_' + q.unknown.S : '') === name);
    if (!x) throw new Error(name + ' нет; есть ' + r.releases.map((q) => q.unknown.L + '_' + q.unknown.S).join(', '));
    return x;
  };
};
const down = (at: number, F: number) => ({ type: 'force' as const, at, F, ref: 'down' as const, rot: 'cw' as const, alpha: 0, unknown: false });

describe('Мещерский 46.19: составная балка на трёх опорах (a = 1)', () => {
  const p: Preset = {
    pts: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [6, 0], [8, 0]],
    hinges: [2],
    items: [{ type: 'pin', at: 0, side: 'below' }, down(1, 2), down(3, 6), { type: 'roller', at: 4, side: 'below' }, down(5, 3), { type: 'roller', at: 6, side: 'below' }],
  };
  const r = rel(p);
  it('R_A = 1, R_B = 10,5, R_D = −0,5', () => {
    expect(r('Y_A').value).toBeCloseTo(1, 12);
    expect(r('R_E').value).toBeCloseTo(10.5, 12);
    expect(r('R_K').value).toBeCloseTo(-0.5, 12);
  });
  it('при отбрасывании опоры A движется только левая часть — поворот вокруг шарнира C', () => {
    const m = r('Y_A').motions;
    expect(m[0].kind).toBe('rot');
    expect(m[0].center![0]).toBeCloseTo(2, 12);
    expect(m[0].center![1]).toBeCloseTo(0, 12);
    expect(m[1].kind).toBe('still');
  });
});

describe('Мещерский 46.20: пара на участке BD, при которой R_D = 0', () => {
  const r = rel({
    pts: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [6, 0], [8, 0]],
    hinges: [2],
    items: [{ type: 'pin', at: 0, side: 'below' }, down(1, 2), down(3, 6), { type: 'roller', at: 4, side: 'below' }, down(5, 3), { type: 'moment', at: 6, M: 1, dir: 'ccw', unknown: true }],
  });
  it('|M| = 2a', () => expect(Math.abs(r('M').value)).toBeCloseTo(2, 12));
});

describe('Мещерский 46.21–46.22: балка из трёх частей с заделкой (a = 1, P = 1)', () => {
  const r = rel({
    pts: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]],
    hinges: [2, 6],
    items: [{ type: 'roller', at: 0, side: 'below' }, down(1, 1), down(3, 1), { type: 'roller', at: 4, side: 'below' }, down(5, 1), down(7, 1), { type: 'fixed', at: 8, side: 'right' }],
  });
  it('R_E = 0,5P, m_E = 0', () => {
    expect(r('Y_N').value).toBeCloseTo(0.5, 12);
    expect(r('M_N').value).toBeCloseTo(0, 12);
  });
});

describe('Мещерский 46.25: Г-образная рама, защемлённая в стене, с шарниром C (P1 = 4, P2 = 2, l = 2, h = 1)', () => {
  const r = rel({
    pts: [[0, 3], [0.5, 3], [1, 3], [3, 3], [3, 2], [3, 0]],
    hinges: [2],
    items: [
      { type: 'fixed', at: 0, side: 'left' },
      down(1, 4),
      { type: 'force', at: 4, F: 2, ref: 'left', rot: 'cw', alpha: 0, unknown: false },
      { type: 'roller', at: 5, side: 'below' },
    ],
  });
  it('Y_A = P1 − P2·h/l = 3', () => expect(r('Y_A').value).toBeCloseTo(3, 12));
  it('правая часть поворачивается вокруг угла рамы', () => {
    const m = r('Y_A').motions[1];
    expect(m.kind).toBe('rot');
    expect(m.center![0]).toBeCloseTo(3, 12);
    expect(m.center![1]).toBeCloseTo(3, 12);
  });
});

describe('Мещерский 46.26–46.27: стойка в заделке, балки BC и CD (h = 1, P1 = 3, P2 = 2)', () => {
  const r = rel({
    pts: [[0, 0], [0, 1], [1, 1.5], [2, 2], [2, 1], [2, 0]],
    hinges: [1, 3],
    items: [
      { type: 'fixed', at: 0, side: 'below' },
      { type: 'force', at: 2, F: 3, ref: 'right', rot: 'cw', alpha: 0, unknown: false },
      { type: 'force', at: 4, F: 2, ref: 'right', rot: 'cw', alpha: 0, unknown: false },
      { type: 'pin', at: 5, side: 'below' },
    ],
  });
  it('|X_A| = P1 + P2/2 = 4, |m_A| = (P1 + P2/2)·h = 4', () => {
    expect(Math.abs(r('X_A').value)).toBeCloseTo(4, 12);
    expect(Math.abs(r('M_A').value)).toBeCloseTo(4, 12);
  });
  it('при отбрасывании горизонтальной связи балка BC движется поступательно', () => {
    expect(r('X_A').motions[1].kind).toBe('trans');
  });
});

describe('совпадение с уравнениями равновесия во всех готовых задачах «Балок и рам»', () => {
  for (const k of Object.keys(PRESET_TITLES) as PresetKey[]) {
    const s = loadPreset(k);
    const r = virtualWork(s, analyze(s));
    if (!r.ok) continue;
    it(PRESET_TITLES[k], () => {
      for (const x of r.releases) expect(x.value, x.unknown.key).toBeCloseTo(x.ref, 9);
    });
  }
});

describe('готовые задачи: Мещерский из presets, текст и чертёж', () => {
  it('ответы', () => {
    expect(rel(M4619)('R_E').value).toBeCloseTo(10.5, 12);
    expect(Math.abs(rel(M4620)('M').value)).toBeCloseTo(2, 12);
    expect(rel(M4621)('Y_N').value).toBeCloseTo(0.5, 12);
    expect(rel(M4625)('Y_A').value).toBeCloseTo(3, 12);
    expect(Math.abs(rel(M4626)('M_A').value)).toBeCloseTo(4, 12);
  });
  for (const [k, p] of Object.entries(VIRTUAL_PRESETS))
    it(p.title, () => {
      const s = p.build();
      const a = analyze(s);
      const r = virtualWork(s, a);
      if (!r.ok) throw new Error(r.why);
      const doc = virtualDoc(a.model, r.releases, { explain: true });
      const txt = JSON.stringify(doc);
      expect(txt, k).not.toMatch(/NaN|undefined|Infinity|не совпадает/);
      for (const x of r.releases) expect(renderVirtual(s, a.model, x).svg, k).not.toMatch(/NaN|undefined|Infinity/);
    });
});
