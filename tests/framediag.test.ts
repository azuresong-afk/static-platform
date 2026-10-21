/** Эпюры N, Q, M для рам: ручной расчёт Г-образной рамы, равновесие всех узлов, совпадение с балкой. */
import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '../src/modules/bending/model/beam';
import { analyze } from '../src/modules/frames/analyze';
import { loadPreset, PRESET_TITLES, presetStructure, type PresetKey } from '../src/modules/frames/model/presets';
import type { Structure } from '../src/modules/frames/model/types';
import { analyzeFrame, canonical, type FrameDiag } from '../src/modules/framediag/model/frame';
import { polyEval } from '../src/shared/poly';
import { FRAME_PRESETS } from '../src/modules/framediag/presets';
import { frameDoc } from '../src/modules/framediag/text/solution';
import { plotDir, renderFrameDiagrams } from '../src/modules/framediag/draw/frame';
import { DEFAULT_CONVENTIONS } from '../src/shared/conventions';

const frameOf = (s: Structure): FrameDiag => {
  const r = analyzeFrame(s, analyze(s));
  if (!r.ok) throw new Error('нет эпюр: ' + r.why);
  return r.frame;
};
const at = (fr: FrameDiag, from: string, to: string) => {
  const b = fr.bars.find((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from))!;
  // Значения у точки from и у точки to (M — со знаком «растянуты волокна со стороны plusSide»).
  const zf = b.from === from ? 0 : b.L,
    zt = b.L - zf;
  const v = (k: 'N' | 'Q' | 'M', z: number) => polyEval(b[k], z);
  return { b, N: [v('N', zf), v('N', zt)], Q: [v('Q', zf), v('Q', zt)], M: [v('M', zf), v('M', zt)] };
};

describe('Г-образная рама с заделкой (gframe): ручной расчёт', () => {
  const fr = frameOf(loadPreset('gframe'));
  it('ригель CD: своя часть — свободный конец D; Q = 10, M = 10z, растянуты верхние волокна', () => {
    const r = at(fr, 'D', 'C');
    expect(r.b.from).toBe('D');
    expect(r.b.plusSide).toBe('сверху');
    expect(r.N[0]).toBeCloseTo(0, 12);
    expect(r.Q[0]).toBeCloseTo(10, 12);
    expect(r.M[0]).toBeCloseTo(0, 12);
    expect(r.M[1]).toBeCloseTo(30, 12);
  });
  it('стойка BC: N = −10 (сжатие), Q = 2z, M(C) = 30 + 4 = 34 — растянуты левые волокна', () => {
    const r = at(fr, 'C', 'B');
    expect(r.b.from).toBe('C');
    expect(r.b.plusSide).toBe('слева');
    expect(r.N[0]).toBeCloseTo(-10, 12);
    expect(r.Q[0]).toBeCloseTo(0, 12);
    expect(r.Q[1]).toBeCloseTo(4, 12);
    expect(r.M[0]).toBeCloseTo(34, 12);
    // Нагрузка q вправо выше сечения тоже изгибает стойку вправо — растянуты левые волокна: M = 34 + q·z²/2.
    expect(r.M[1]).toBeCloseTo(34 + 4, 12);
  });
  it('стойка AB: в заделке M = 34 + 2·4²/2 = 50', () => {
    const r = at(fr, 'B', 'A');
    expect(Math.abs(r.M[1])).toBeCloseTo(50, 12);
    expect(r.Q[1]).toBeCloseTo(8, 12);
  });
});

const keys = Object.keys(PRESET_TITLES) as PresetKey[];
describe('равновесие каждого узла (участки берут разные стороны независимо)', () => {
  for (const k of keys) {
    const s = loadPreset(k);
    const r = analyzeFrame(s, analyze(s));
    if (!r.ok) continue;
    it(PRESET_TITLES[k], () => {
      const sc = Math.max(1, r.frame.scaleN, r.frame.scaleQ, r.frame.scaleM);
      for (const j of r.frame.joints) {
        expect(Math.abs(j.sum.x) / sc, `${j.name}: ΣX`).toBeLessThan(1e-9);
        expect(Math.abs(j.sum.y) / sc, `${j.name}: ΣY`).toBeLessThan(1e-9);
        expect(Math.abs(j.sum.m) / sc, `${j.name}: ΣM`).toBeLessThan(1e-9);
      }
    });
  }
});

describe('горизонтальная балка — как во вкладке «Изгиб»', () => {
  for (const k of ['simple', 'cantilever', 'gerber', 'rod', 'bracket'] as PresetKey[]) {
    it(PRESET_TITLES[k], () => {
      const s = loadPreset(k);
      const a = analyze(s);
      const br = analyzeBeam(s, a);
      if (!br.ok) throw new Error(br.why);
      const fr = frameOf(s);
      for (const b of fr.bars) {
        const left = canonical(b.P0, b.P1);
        for (const t of [0, 0.3, 0.7, 1]) {
          const z = t * b.L;
          const x = b.P0[0] + b.u[0] * z;
          const sp = br.beam.spans.find((q) => x >= q.x0 - 1e-9 && x <= q.x1 + 1e-9 && (t === 0 ? (left ? x < q.x1 - 1e-9 : x > q.x0 + 1e-9) : t === 1 ? (left ? x > q.x0 + 1e-9 : x < q.x1 - 1e-9) : true))!;
          const zb = x - sp.x0;
          expect(polyEval(b.Q, z)).toBeCloseTo(polyEval(sp.Q, zb), 9);
          expect(polyEval(b.N, z)).toBeCloseTo(polyEval(sp.N, zb), 9);
          // При обходе слева направо M > 0 — растянуты нижние волокна, как у балки; при обратном — знак другой.
          expect(polyEval(b.M, z) * (left ? 1 : -1)).toBeCloseTo(polyEval(sp.M, zb), 9);
        }
      }
    });
  }
});

describe('наклонная рама: стойка, наклонный ригель, нагрузка нормально к ригелю', () => {
  const s = presetStructure({
    pts: [[0, 0], [0, 3], { l: 4, a: 30 }, { l: 2, a: 0 }],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 3, side: 'below' },
      { type: 'dist', from: 1, to: 2, q1: 2, q2: 5, dir: 'nd' },
      { type: 'force', at: 2, F: 7, ref: 'right', rot: 'cw', alpha: 20, unknown: false },
      { type: 'moment', at: 1, M: 3, dir: 'ccw', unknown: false },
    ],
  });
  const fr = frameOf(s);
  it('узлы в равновесии', () => {
    for (const j of fr.joints) {
      expect(Math.abs(j.sum.x)).toBeLessThan(1e-9);
      expect(Math.abs(j.sum.y)).toBeLessThan(1e-9);
      expect(Math.abs(j.sum.m)).toBeLessThan(1e-9);
    }
  });
  it('M = 0 на шарнирно опёртых и свободных концах', () => {
    expect(at(fr, 'A', 'B').M[0]).toBeCloseTo(0, 9);
    expect(at(fr, 'D', 'C').M[0]).toBeCloseTo(0, 9);
  });
  it('dM/dz = Q на каждом участке (численно)', () => {
    for (const b of fr.bars)
      for (const z of [0.1, b.L / 2, b.L - 0.1]) {
        const h = 1e-6;
        expect((polyEval(b.M, z + h) - polyEval(b.M, z - h)) / (2 * h)).toBeCloseTo(polyEval(b.Q, z), 5);
      }
  });
});

describe('ветвящаяся рама (Т-образная)', () => {
  // Стойка из заделки, наверху ригель в обе стороны с силами на концах.
  const s = presetStructure({ pts: [[0, 0], [0, 3], [-2, 3]], items: [{ type: 'fixed', at: 0, side: 'below' }, { type: 'force', at: 2, F: 4, ref: 'down', rot: 'cw', alpha: 0, unknown: false }] });
  it('строится и узлы в равновесии', () => {
    const fr = frameOf(s);
    for (const j of fr.joints) expect(Math.abs(j.sum.m)).toBeLessThan(1e-9);
  });
});

describe('текст решения и чертёж для всех готовых задач', () => {
  for (const [k, p] of Object.entries(FRAME_PRESETS)) {
    it(p.title, () => {
      const s = p.build();
      const fr = frameOf(s);
      for (const c of [DEFAULT_CONVENTIONS, { ...DEFAULT_CONVENTIONS, mSide: 'tension' as const, indexed: true }]) {
        const doc = frameDoc(fr, c, { explain: true });
        const txt = doc.steps.map((st) => st.title + ' ' + JSON.stringify(st.blocks)).join('\n');
        expect(txt, k).not.toMatch(/NaN|undefined|Infinity/);
        expect(doc.steps.filter((st) => st.title.startsWith('Участок'))).toHaveLength(fr.bars.length);
        const d = renderFrameDiagrams(fr, c, { N: { L: 'N', S: '', unit: '' }, Q: { L: 'Q', S: '', unit: '' }, M: { L: 'M', S: '', unit: '' } });
        for (const key of ['N', 'Q', 'M'] as const) expect(d.dg[key].svg + d.dg[key].viewBox, k).not.toMatch(/NaN|undefined|Infinity/);
      }
    });
  }
  it('Г-рама: эпюра M на растянутых волокнах — по другую сторону, чем на сжатых', () => {
    const fr = frameOf(loadPreset('gframe'));
    const b = fr.bars[0];
    const a = plotDir(b, 'M', DEFAULT_CONVENTIONS),
      t = plotDir(b, 'M', { ...DEFAULT_CONVENTIONS, mSide: 'tension' });
    expect(a[0] + t[0]).toBeCloseTo(0, 12);
    expect(a[1] + t[1]).toBeCloseTo(0, 12);
  });
});
