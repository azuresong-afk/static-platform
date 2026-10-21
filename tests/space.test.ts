/**
 * Пространственный брус (Антонов, задача 3): ручной эталон и независимая проверка — усилия в сечении по части
 * со стороны заделки (реакции + нагрузки, распределённая — численным интегрированием) равны усилиям от свободной
 * части с обратным знаком.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AX, cross, points, solveFrame3, type Axis, type Frame3, type V3 } from '../src/modules/space/model/frame3d';
import { polyEval } from '../src/shared/poly';
import { spaceDoc } from '../src/modules/space/text/solution';
import { parseFrame, SpaceStore } from '../src/modules/space/ui/store';
import { inlineText } from '../src/shared/doc';

// По мотивам схемы 16: из заделки участок 2l «к зрителю» (−y), сила P = 25 в его середине вдоль +x,
// затем участок 2l влево (−x) с нагрузкой q = 10 вниз. l = 1 м, круг, [σ] = 160 МПа.
const scheme16: Frame3 = {
  segs: [
    { axis: 'y', sign: -1, l: 1 },
    { axis: 'y', sign: -1, l: 1 },
    { axis: 'x', sign: -1, l: 2 },
  ],
  loads: [
    { kind: 'P', node: 1, axis: 'x', v: 25 },
    { kind: 'q', seg: 2, axis: 'z', v: -10 },
  ],
  section: 'circle',
  c: 0.8,
  sigma: 160,
  hyp: 3,
};

describe('ручной эталон (по мотивам схемы 16)', () => {
  const r = solveFrame3(scheme16);
  it('в заделке M = (40; −20; 25): M_к = 20, изгиб 40 и 25', () => {
    const s0 = r.segs[0];
    expect(polyEval(s0.Mk, 0)).toBeCloseTo(20, 10);
    expect(s0.Mb.map((c) => [c.axis, polyEval(c.poly, 0)])).toEqual([
      ['x', 40],
      ['z', 25],
    ]);
  });
  it('реакции: R = (−25; 0; 20), M_R = (−40; 20; −25)', () => {
    expect(r.R.map((x) => x + 0)).toEqual([-25, 0, 20]);
    expect(r.MR.map((x) => x + 0)).toEqual([-40, 20, -25]);
  });
  it('опасное сечение — заделка: M_экв = √2625 = 51,235; W = 320,22 см³; d = 14,83 → 149 мм', () => {
    expect(r.danger.seg).toBe(0);
    expect(r.danger.s).toBe(0);
    expect(r.danger.Meq).toBeCloseTo(Math.sqrt(2625), 10);
    expect(r.Wreq).toBeCloseTo(320.22, 2);
    expect(r.size.calc).toBeCloseTo(14.83, 2);
    expect(r.size.D).toBe(14.9);
  });
  it('в начале участка с q остаётся только кручение 20 кН·м', () => {
    const s2 = r.segs[2];
    // Участок 2 вдоль −x: M_к — проекция на −x, изгиб — по y и z.
    expect(Math.abs(polyEval(s2.Mk, 0))).toBeCloseTo(0, 10);
    const s1 = r.segs[1];
    expect(polyEval(s1.Mk, 1)).toBeCloseTo(20, 10);
    s1.Mb.forEach((c) => expect(polyEval(c.poly, 1)).toBeCloseTo(0, 10));
  });
  it('кольцо d/D = 0,8: D = ∛(32·W/(π·(1 − 0,8⁴))) = 17,68 → 177 мм, d = 141 мм', () => {
    const k = solveFrame3({ ...scheme16, section: 'ring' });
    expect(k.size.calc).toBeCloseTo(Math.cbrt((32 * 320.2175) / (Math.PI * (1 - 0.8 ** 4))), 3);
    expect(k.size.D).toBe(17.7);
    expect(k.size.d).toBe(14.1);
  });
  it('четвёртая гипотеза: √(40² + 25² + 0,75·20²) = 50,25', () => expect(solveFrame3({ ...scheme16, hyp: 4 }).danger.Meq).toBeCloseTo(Math.sqrt(2525), 10));
});

/** Усилия в сечении по части со стороны заделки: реакции и нагрузки до сечения. */
function wallSide(f: Frame3, R: V3, MR: V3, i: number, s: number): { F: V3; M: V3 } {
  const pts = points(f);
  const t = AX[f.segs[i].axis].map((x) => x * f.segs[i].sign) as V3;
  const P = pts[i].map((x, k) => x + s * t[k]) as V3;
  const F: V3 = [...R];
  const M: V3 = [...MR];
  const addF = (r: V3, Fv: V3) => {
    for (let k = 0; k < 3; k++) F[k] += Fv[k];
    const m = cross(r.map((x, k) => x - P[k]) as V3, Fv);
    for (let k = 0; k < 3; k++) M[k] += m[k];
  };
  addF(pts[0], [0, 0, 0]);
  for (let k = 0; k < 3; k++) M[k] += cross(pts[0].map((x, j) => x - P[j]) as V3, R)[k];
  for (const ld of f.loads) {
    if (ld.kind === 'P' && ld.node <= i) addF(pts[ld.node], AX[ld.axis].map((x) => x * ld.v) as V3);
    if (ld.kind === 'M' && ld.node <= i) for (let k = 0; k < 3; k++) M[k] += AX[ld.axis][k] * ld.v;
    if (ld.kind === 'q' && ld.seg <= i) {
      const a = pts[ld.seg],
        b = pts[ld.seg + 1];
      const upto = ld.seg < i ? 1 : s / f.segs[i].l;
      const n = 64;
      for (let k = 0; k <= n; k++) {
        const u = (upto * k) / n;
        const w = ((k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * upto) / (3 * n);
        const r = a.map((x, j) => x + (b[j] - x) * u) as V3;
        addF(r, AX[ld.axis].map((x) => x * ld.v * f.segs[ld.seg].l * w) as V3);
      }
    }
  }
  return { F, M };
}

describe('случайные брусья', () => {
  const axis = fc.constantFrom<Axis>('x', 'y', 'z');
  const arb = fc
    .record({
      segs: fc.array(fc.record({ axis, sign: fc.constantFrom<1 | -1>(1, -1), l: fc.constantFrom(0.5, 1, 1.5, 2) }), { minLength: 1, maxLength: 4 }),
      loads: fc.array(
        fc.oneof(
          fc.record({ kind: fc.constant('P' as const), node: fc.nat(), axis, v: fc.constantFrom(-20, 5, 10, 25) }),
          fc.record({ kind: fc.constant('M' as const), node: fc.nat(), axis, v: fc.constantFrom(-10, 10, 15) }),
          fc.record({ kind: fc.constant('q' as const), seg: fc.nat(), axis, v: fc.constantFrom(-10, 4, 10) }),
        ),
        { minLength: 1, maxLength: 5 },
      ),
    })
    .map(({ segs, loads }) => ({
      segs,
      loads: loads.map((l) => (l.kind === 'q' ? { ...l, seg: l.seg % segs.length } : { ...l, node: 1 + (l.node % segs.length) })),
      section: 'circle' as const,
      c: 0.8,
      sigma: 160,
      hyp: 3 as const,
    }));

  it('усилия от свободной части = −усилия от части со стороны заделки (3000 случаев)', () => {
    fc.assert(
      fc.property(arb, (f) => {
        const r = solveFrame3(f);
        for (const sg of r.segs)
          for (const u of [0.1, 0.5, 0.9]) {
            const s = u * sg.L;
            const w = wallSide(f, r.R, r.MR, sg.index, s);
            const scale = Math.max(1, ...w.F.map(Math.abs), ...w.M.map(Math.abs), ...r.MR.map(Math.abs));
            // Свободная часть: F·ось и M·ось по компонентам.
            const free = (axis: Axis, which: 'F' | 'M') => {
              const all = [...sg.Q.map((c) => ({ ...c, w: 'F' })), ...sg.Mb.map((c) => ({ ...c, w: 'M' }))].find((c) => c.axis === axis && c.w === which);
              if (all) return polyEval(all.poly, s);
              const along = which === 'F' ? polyEval(sg.N, s) : polyEval(sg.Mk, s);
              return along * sg.sign;
            };
            for (const ax of ['x', 'y', 'z'] as Axis[]) {
              const k = ax === 'x' ? 0 : ax === 'y' ? 1 : 2;
              expect(Math.abs(free(ax, 'F') + w.F[k])).toBeLessThan(1e-8 * scale);
              expect(Math.abs(free(ax, 'M') + w.M[k])).toBeLessThan(1e-8 * scale);
            }
          }
        // Опасное сечение — наибольший M_экв на мелкой сетке.
        let best = 0;
        for (const sg of r.segs)
          for (let k = 0; k <= 200; k++) {
            const s = (sg.L * k) / 200;
            const [m1, m2] = sg.Mb.map((c) => polyEval(c.poly, s));
            best = Math.max(best, Math.hypot(m1, m2, polyEval(sg.Mk, s)));
          }
        expect(r.danger.Meq).toBeGreaterThanOrEqual(best - 1e-9 * Math.max(1, best));
      }),
      { numRuns: 3000, seed: 3 },
    );
  });
});

describe('вкладка: текст, файл, правки', () => {
  const text = (fr: Frame3) =>
    spaceDoc(fr, solveFrame3(fr))
      .steps.map((st) => st.title + '\n' + st.blocks.map((bl) => (bl.k === 'p' ? inlineText(bl.c) : bl.k === 'eq' ? bl.lines.map((l) => inlineText(l.c)).join('\n') : bl.k === 'ul' ? bl.items.map(inlineText).join('\n') : bl.k === 'answer' ? bl.rows.map((x) => inlineText(x.val) + ' ' + x.note).join('\n') : '')).join('\n'))
      .join('\n');
  it('решение: формулы от свободного конца, опасное сечение, диаметр', () => {
    const t = text(scheme16);
    expect(t).toContain('Mx(s) = 20 + 20·s;   в B: 20,  в A: 40');
    expect(t).toContain('My(s) = −5·s^2;   в D: 0,  в C: −20');
    expect(t).toContain('в точке A: Mx = 40, Mz = 25, Mк = 20 → Mэкв = 51,235');
    expect(t.match(/в точке B: Mx = 20/g)).toHaveLength(1);
    expect(t).toContain('Принимаем d = 149 мм.');
  });
  it('кольцо: D и d в ответе', () => expect(text({ ...scheme16, section: 'ring' })).toContain('D = 177 мм, d = 141 мм'));
  it('сохранить → открыть; испорченный файл — ошибка', () => {
    const a = new SpaceStore({ preset: 's9' });
    a.typeLoadValue(1, 30);
    const { text: file } = a.exportProject();
    expect(JSON.parse(file).module).toBe('space3');
    const b = new SpaceStore();
    expect(b.importProject(file)).toBe(true);
    expect(b.get().frame).toEqual(a.get().frame);
    expect(b.get().frame.loads[1].v).toBe(-30);
    const o = JSON.parse(file);
    o.frame.loads[0].seg = 7;
    const c = new SpaceStore();
    expect(c.importProject(JSON.stringify(o), 'x.json')).toBe(false);
    expect(c.get().notice?.text).toMatch(/Нагрузка №1/);
    expect(parseFrame({ ...o.frame, hyp: 5 }).ok).toBe(false);
  });
  it('правки: участок, направление нагрузки, отмена', () => {
    const s = new SpaceStore();
    s.addSeg();
    expect(s.get().frame.segs).toHaveLength(4);
    s.setLoad(0, { dir: -1 });
    expect(s.get().frame.loads[0].v).toBe(-25);
    s.removeSeg();
    s.undo();
    s.undo();
    expect(s.get().frame.loads[0].v).toBe(25);
  });
});
