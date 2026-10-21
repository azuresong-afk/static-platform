/** Эпюры Q и M для балок: эталон Антонова, готовые задачи, независимая проверка по правой части. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyzeBeam, valuesAt, type Beam } from '../src/modules/bending/model/beam';
import { analyze } from '../src/modules/frames/analyze';
import { loadPreset, presetStructure } from '../src/modules/frames/model/presets';
import type { Structure } from '../src/modules/frames/model/types';
import { polyEval } from '../src/shared/poly';
import { cutRight } from './helpers/cut';
import { BENDING_PRESETS } from '../src/modules/bending/presets';
import { bendingDoc } from '../src/modules/bending/text/solution';
import { DEFAULT_CONVENTIONS } from '../src/shared/conventions';
import { inlineText } from '../src/shared/doc';

const beamOf = (s: Structure): { beam: Beam; a: ReturnType<typeof analyze> } => {
  const a = analyze(s);
  const r = analyzeBeam(s, a);
  if (!r.ok) throw new Error('не балка: ' + r.why);
  return { beam: r.beam, a };
};

describe('Антонов, рис. 8.5: шарнир A, каток B через 3l, q на правых 2l', () => {
  // l = 1, q = 3: Q = 2 и −4; M(l) = 2; M_max = 8/9·q·l² = 8/3 в z = l + 2/3·l.
  const s = presetStructure({
    pts: [[0, 0], [1, 0], [3, 0]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 2, side: 'below' },
      { type: 'dist', from: 1, to: 2, q1: 3, q2: 3, dir: 'down' },
    ],
  });
  const { beam } = beamOf(s);
  it('два участка', () => expect(beam.spans.map((sp) => [sp.from, sp.to, sp.L])).toEqual([['A', 'B', 1], ['B', 'C', 2]]));
  it('Q = ⅔ql на первом участке и −4/3·ql у опоры', () => {
    expect(valuesAt(beam, 0.5).Q).toBeCloseTo(2, 12);
    expect(valuesAt(beam, 3, 'left').Q).toBeCloseTo(-4, 12);
  });
  it('M(l) = ⅔ql², M_max = 8/9·ql² при z = 2/3·l на втором участке', () => {
    expect(valuesAt(beam, 1).M).toBeCloseTo(2, 12);
    const sp = beam.spans[1];
    expect(sp.extrema).toHaveLength(1);
    expect(sp.extrema[0]).toBeCloseTo(2 / 3, 12);
    expect(polyEval(sp.M, sp.extrema[0])).toBeCloseTo(8 / 3, 12);
    expect(valuesAt(beam, 3, 'left').M).toBeCloseTo(0, 12);
  });
});

describe('консоль: заделка слева, сила F на конце', () => {
  const s = presetStructure({ pts: [[0, 0], [2, 0]], items: [{ type: 'fixed', at: 0, side: 'left' }, { type: 'force', at: 1, F: 5, ref: 'down', rot: 'cw', alpha: 0, unknown: false }] });
  const { beam } = beamOf(s);
  it('Q = +5 (справа сила вниз), M в заделке = −F·l, на конце 0', () => {
    expect(valuesAt(beam, 1).Q).toBeCloseTo(5, 12);
    expect(valuesAt(beam, 0).M).toBeCloseTo(-10, 12);
    expect(valuesAt(beam, 2, 'left').M).toBeCloseTo(0, 12);
  });
});

/** Главная проверка: Q и M слева (модуль) совпадают с независимым расчётом справа. */
function checkAgainstRight(s: Structure) {
  const { beam, a } = beamOf(s);
  const tol = 1e-9 * Math.max(1, beam.scaleM, beam.scaleQ * beam.L);
  for (const sp of beam.spans)
    for (const t of [0.013, 0.25, 0.5, 0.77, 0.987]) {
      const x = sp.x0 + t * sp.L;
      const left = valuesAt(beam, x);
      const right = cutRight(s, a.solution.vals, a.model.unknowns, x);
      expect(Math.abs(left.Q - right.Q)).toBeLessThan(tol);
      expect(Math.abs(left.M - right.M)).toBeLessThan(tol);
    }
  // M на конце балки равен моменту пары, приложенной там (0, если пары нет); в заделке — её реактивный момент, это тоже пара.
  // Слева: M(0+) = −m (пара против часовой — «+» m); справа: M(L−) = +m.
  const coupleAt = (x: number) => beam.couples.filter((c) => Math.abs(c.x - x) < 1e-9).reduce((acc, c) => acc + c.m, 0);
  const [first, last] = [beam.points[0], beam.points[beam.points.length - 1]];
  expect(Math.abs(valuesAt(beam, first.x, 'right').M + coupleAt(first.x))).toBeLessThan(tol);
  expect(Math.abs(valuesAt(beam, last.x, 'left').M - coupleAt(last.x))).toBeLessThan(tol);
  // Во внутреннем шарнире без пары M = 0.
  for (const p of beam.points) if (p.hinge && !coupleAt(p.x)) expect(Math.abs(valuesAt(beam, p.x).M)).toBeLessThan(tol);
  // Скачки: Q — на сосредоточенную силу (вверх — «+»), M — на пару (по часовой — «+»).
  for (const p of beam.points.slice(1, -1)) {
    const l = valuesAt(beam, p.x, 'left'),
      r = valuesAt(beam, p.x, 'right');
    const fy = beam.forces.filter((f) => Math.abs(f.x - p.x) < 1e-9).reduce((acc, f) => acc + f.F[1], 0);
    expect(Math.abs(r.Q - l.Q - fy)).toBeLessThan(tol);
    expect(Math.abs(r.M - l.M + coupleAt(p.x))).toBeLessThan(tol);
  }
}

describe('готовые задачи «Балок и рам»: совпадение с расчётом справа', () => {
  for (const k of ['simple', 'cantilever', 'rod', 'lever', 'gerber'] as const) it(k, () => checkAgainstRight(loadPreset(k)));
  it('рамы не считаются балками', () => {
    const s = loadPreset('pframe');
    const r = analyzeBeam(s, analyze(s));
    expect(r).toEqual({ ok: false, why: 'notbeam' });
  });
});

describe('случайные балки', () => {
  const beamArb = fc
    .record({
      lens: fc.array(fc.constantFrom(0.5, 1, 1.5, 2, 2.5, 3), { minLength: 1, maxLength: 5 }),
      plan: fc.constantFrom('pin+roller', 'fixed-left', 'fixed-right', 'pin+roller-mid', 'gerber'),
      loads: fc.array(
        fc.oneof(
          fc.record({ type: fc.constant('force' as const), at: fc.nat(), F: fc.constantFrom(2, 5, 8, 12.5), alpha: fc.constantFrom(0, 30, 45, 90, 120), ref: fc.constantFrom('down', 'up', 'left' as const) }),
          fc.record({ type: fc.constant('moment' as const), at: fc.nat(), M: fc.constantFrom(2, 6, 10), dir: fc.constantFrom('cw', 'ccw' as const) }),
          fc.record({ type: fc.constant('dist' as const), from: fc.nat(), to: fc.nat(), q1: fc.constantFrom(0, 1, 2, 4, -3), q2: fc.constantFrom(0, 2, 3, 5), dir: fc.constantFrom('down', 'up' as const) }),
        ),
        { minLength: 1, maxLength: 5 },
      ),
    })
    .map(({ lens, plan, loads }) => {
      const pts: [number, number][] = [[0, 0]];
      lens.forEach((l) => pts.push([pts[pts.length - 1][0] + l, 0]));
      const n = pts.length;
      const items: Record<string, unknown>[] = [];
      let hinges: number[] | undefined;
      if (plan === 'pin+roller') items.push({ type: 'pin', at: 0, side: 'below' }, { type: 'roller', at: n - 1, side: 'below' });
      if (plan === 'fixed-left') items.push({ type: 'fixed', at: 0, side: 'left' });
      if (plan === 'fixed-right') items.push({ type: 'fixed', at: n - 1, side: 'right' });
      if (plan === 'pin+roller-mid') items.push({ type: 'pin', at: 0, side: 'below' }, { type: 'roller', at: Math.max(1, n - 2), side: 'below' });
      if (plan === 'gerber' && n >= 3) {
        items.push({ type: 'fixed', at: 0, side: 'left' }, { type: 'roller', at: n - 1, side: 'below' });
        hinges = [1];
      }
      for (const l of loads) {
        if (l.type === 'dist') {
          const a = l.from % n,
            b = l.to % n;
          if (a !== b) items.push({ ...l, from: a, to: b });
        } else if (l.type === 'force') items.push({ type: 'force', at: l.at % n, F: l.F, ref: l.ref, rot: 'ccw', alpha: l.alpha, unknown: false });
        else items.push({ ...l, at: l.at % n, unknown: false });
      }
      return presetStructure({ pts, items: items as never, hinges });
    });

  it('Q и M по левой части совпадают с независимым расчётом по правой; M = 0 на свободных концах и в шарнирах', () => {
    let ok = 0;
    fc.assert(
      fc.property(beamArb, (s) => {
        const a = analyze(s);
        if (a.solution.status !== 'ok') return;
        ok++;
        checkAgainstRight(s);
      }),
      { numRuns: 3000, seed: 20260928 },
    );
    expect(ok).toBeGreaterThan(2000);
  });
});

describe('текст решения', () => {
  const docText = (s: Structure, c = DEFAULT_CONVENTIONS, explain = false) => {
    const { beam } = beamOf(s);
    return bendingDoc(beam, c, { explain })
      .steps.map((st) => st.title + '\n' + st.blocks.map((bl) => (bl.k === 'p' ? inlineText(bl.c) : bl.k === 'eq' ? bl.lines.map((l) => inlineText(l.c)).join('\n') : bl.k === 'ul' ? bl.items.map(inlineText).join('\n') : bl.k === 'answer' ? bl.rows.map((r) => inlineText(r.val) + ' ' + r.note).join('\n') : '')).join('\n'))
      .join('\n');
  };
  const antonov7 = BENDING_PRESETS.antonov7.build();

  it('схема 7 Антонова: формулы по участкам, экстремум и опасное сечение', () => {
    const t = docText(antonov7);
    expect(t).toContain('Q(z1) = Y_A − q·z1');
    expect(t).toContain('= 33,077 − 10·z1');
    expect(t).toContain('Q = 0 при z1 = 3,308 — экстремум момента: M(3,308) = 54,704.');
    expect(t).toContain('M(z3) = Y_A·(10 + z3) + M − q·6·(7 + z3)');
    expect(t).toContain('M(z4) = Y_A·(13 + z4) + R_D·z4 + M − q·6·(10 + z4)');
    expect(t).toContain('|M|max = 120 в точке D — опасное сечение');
    expect(t).toContain('в точке C скачок M: −89,231 → −39,231 — на 50, это пара 50, направленная по часовой стрелке');
  });

  it('обозначения по настройке: ось x, Q_y и M_z; сторона эпюры — в правиле знаков', () => {
    const t = docText(antonov7, { mSide: 'tension', axis: 'x', indexed: true });
    expect(t).toContain('Q_y(x1) = Y_A − q·x1');
    expect(t).toContain('M_z(x2)');
    expect(t).toContain('строится на растянутых волокнах');
    expect(t).not.toMatch(/z\d/);
  });

  it('пояснения только добавляют абзацы', () => {
    const { beam } = beamOf(antonov7);
    const plain = bendingDoc(beam, DEFAULT_CONVENTIONS, { explain: false });
    const full = bendingDoc(beam, DEFAULT_CONVENTIONS, { explain: true });
    full.steps.forEach((st, i) => expect(st.blocks.filter((bl) => !(bl.k === 'p' && bl.cls === 'explain'))).toEqual(plain.steps[i].blocks));
  });

  it('готовые задачи вкладки — прямые определимые балки', () => {
    for (const p of Object.values(BENDING_PRESETS)) expect(analyzeBeam(p.build(), analyze(p.build())).ok).toBe(true);
  });
});
