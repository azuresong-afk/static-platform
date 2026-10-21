/**
 * Трение и односторонние связи: границы искомой нагрузки против книги и формул, равновесие и неравенства
 * в предельных состояниях (независимый расчёт сил), проверка возможности равновесия и наименьшего f.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { resolve } from '../src/modules/frames/model/geometry';
import { presetStructure, type Preset } from '../src/modules/frames/model/presets';
import { parseProject, serializeProject } from '../src/modules/frames/model/project';
import { TEXTBOOK_FRICTION } from '../src/modules/frames/model/textbook';
import type { Structure } from '../src/modules/frames/model/types';
import { residuals, wrenches } from './helpers/equilibrium';
import { structureArb } from './helpers/random';

const printedUnit = (v: number) => {
  const s = String(Math.abs(v));
  return 2 * Math.pow(10, -(s.includes('.') ? s.split('.')[1].length : 0));
};

/** Равновесие (независимо) и все неравенства связей при найденных реакциях. */
function expectAdmissible(s0: Structure, vals: Record<string, number>) {
  const s = resolve(s0).structure;
  const { model } = analyze(s);
  const r = residuals(wrenches(s, vals, model.unknowns, new Set()), [[0, 0], [3, -2], ...model.pts.map((p) => [p.x, p.y] as [number, number])]);
  const tol = 1e-7 * r.scale;
  expect(Math.abs(r.fx)).toBeLessThan(tol);
  expect(Math.abs(r.fy)).toBeLessThan(tol);
  r.ms.forEach((m) => expect(Math.abs(m)).toBeLessThan(tol));
  for (const sp of model.supports) {
    const it = sp.it;
    const v = (L: string) => vals[sp.list.find((u) => u.L === L)!.key];
    if (it.type === 'roller' && it.oneSided) expect(v('R')).toBeGreaterThan(-1e-7);
    if (it.type === 'rough') {
      expect(v('N')).toBeGreaterThan(-1e-7);
      expect(Math.abs(v('Fтр'))).toBeLessThanOrEqual(it.f * v('N') + 1e-7);
      if ((it.k ?? 0) > 0) expect(Math.abs(v('Mк'))).toBeLessThanOrEqual((it.k ?? 0) * v('N') + 1e-7);
    }
  }
}

describe('Мещерский: опрокидывание и трение качения', () => {
  for (const p of TEXTBOOK_FRICTION)
    it(`${p.id} — ${p.title}`, () => {
      const s = presetStructure(p.preset);
      const { solution } = analyze(s);
      expect(solution.status).toBe('friction');
      const fr = solution.friction!;
      for (const [which, book] of [
        ['min', p.min],
        ['max', p.max],
      ] as const) {
        if (book === undefined) continue;
        const e = fr[which]!;
        if (!isFinite(book)) expect(e.value).toBe(book);
        else {
          expect(Math.abs(e.value - book), `${which}: ${e.value} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
          expectAdmissible(s, e.vals!);
        }
      }
    });
});

const R = (deg: number) => (deg * Math.PI) / 180;

describe('брус на наклонной плоскости', () => {
  // α = 30°, G = 10, f = 0,2, сила P вдоль плоскости вверх: P ∈ [G(sin α − f cos α); G(sin α + f cos α)].
  const block = (f: number): Preset => ({
    pts: [[0, 0], { l: 0.5, a: 30 }],
    items: [
      { type: 'rough', at: 0, side: 'tilt', angle: 120, f },
      { type: 'weight', at: 0, G: 10 },
      { type: 'force', at: 0, F: 1, ref: 'right', rot: 'ccw', alpha: 30, unknown: true },
    ],
  });
  it('границы по формулам; на верхней — брус готов скользить вверх', () => {
    const s = presetStructure(block(0.2));
    const fr = analyze(s).solution.friction!;
    expect(fr.min!.value).toBeCloseTo(10 * (Math.sin(R(30)) - 0.2 * Math.cos(R(30))), 9);
    expect(fr.max!.value).toBeCloseTo(10 * (Math.sin(R(30)) + 0.2 * Math.cos(R(30))), 9);
    expect(fr.max!.active.map((a) => [a.kind, a.sign])).toEqual([['slip', -1]]);
    expect(fr.min!.active.map((a) => [a.kind, a.sign])).toEqual([['slip', 1]]);
    expectAdmissible(s, fr.max!.vals!);
    expectAdmissible(s, fr.min!.vals!);
    expect(analyze(s, { explain: true }).html).toContain('готова скользить');
  });
  it('без силы: брус держится, если tg α ≤ f; наименьший f = tg 30°', () => {
    const noP = (f: number): Structure => {
      const s = presetStructure(block(f));
      return { ...s, items: s.items.filter((i) => i.type !== 'force') };
    };
    expect(analyze(noP(0.6)).solution.status).toBe('friction');
    expect(analyze(noP(0.55)).solution.status).toBe('noequilibrium');
    const fr = analyze(noP(0.3)).solution.friction!;
    expect(fr.lambda! * 0.3).toBeCloseTo(Math.tan(R(30)), 6);
  });
});

describe('лестница', () => {
  /** Лестница длиной 4 под углом a к полу: вес ладдера G в середине, груз Q на расстоянии d от низа. */
  const ladder = (a: number, fFloor: number, fWall: number, G: number, Q: number, d: number): Structure =>
    presetStructure({
      pts: d < 2 ? [[0, 0], { l: d, a }, { l: 2 - d, a }, { l: 2, a }] : d > 2 ? [[0, 0], { l: 2, a }, { l: d - 2, a }, { l: 4 - d, a }] : [[0, 0], { l: 2, a }, { l: 2, a }],
      items: [
        { type: 'rough', at: 0, side: 'below', f: fFloor },
        ...(fWall > 0 ? [{ type: 'rough' as const, at: d === 2 ? 2 : 3, side: 'right' as const, f: fWall }] : [{ type: 'roller' as const, at: d === 2 ? 2 : 3, side: 'right' as const, oneSided: true }]),
        { type: 'weight', at: d < 2 ? 2 : 1, G },
        ...(Q ? [{ type: 'weight' as const, at: d < 2 ? 1 : d > 2 ? 2 : 1, G: Q }] : []),
      ],
    });
  it('Мещерский 4.66: гладкая стена, человек наверху — tg α ≥ (P + 2p)/(2f(P + p))', () => {
    // P = 20, p = 60, f = 0,5: tg α ≥ 1,75, α ≥ 60,26°. Человек у верхнего конца — у стены.
    const mk = (a: number) => {
      const s = ladder(a, 0.5, 0, 20, 0, 2);
      return { ...s, items: [...s.items, { id: 'p', type: 'weight' as const, at: s.nodes[2].id, G: 60 }] };
    };
    expect(analyze(mk(61)).solution.status).toBe('friction');
    expect(analyze(mk(60)).solution.status).toBe('noequilibrium');
    const fr = analyze(mk(60)).solution.friction!;
    expect(fr.lambda! * 0.5).toBeCloseTo(140 / (160 * Math.tan(R(60))), 6);
  });
  it('Мещерский 4.67: трение о стену и пол, угол трения 15°, 60° к полу — наибольшее BP = AB/2', () => {
    const f = Math.tan(R(15));
    expect(analyze(ladder(60, f, f, 0, 10, 1.96)).solution.status).toBe('friction');
    expect(analyze(ladder(60, f, f, 0, 10, 2.04)).solution.status).toBe('noequilibrium');
  });
});

describe('случайные конструкции с трением и односторонними связями', () => {
  it('в предельных состояниях — равновесие и все неравенства связей', () => {
    let checked = 0;
    fc.assert(
      fc.property(structureArb, fc.nat(), fc.constantFrom(0.1, 0.3, 0.6), (s0, pick, f) => {
        // Каток → односторонний или опора с трением; одна искомая сила.
        const sups = s0.items.filter((i) => i.type === 'roller');
        if (!sups.length) return;
        const target = sups[pick % sups.length];
        const items = s0.items.map((i) =>
          i === target ? { id: i.id, type: 'rough' as const, at: i.at, side: i.side, angle: i.angle, f } : i.type === 'roller' ? { ...i, oneSided: true } : i,
        );
        if (!items.some((i) => i.type === 'force' && i.unknown)) items.push({ id: 'fx', type: 'force', at: s0.nodes[0].id, F: 1, ref: 'down', rot: 'cw', alpha: 30, unknown: true });
        if (items.filter((i) => (i.type === 'force' || i.type === 'moment') && i.unknown).length !== 1) return;
        const s: Structure = { ...s0, items };
        const { solution } = analyze(s);
        if (solution.status !== 'friction') return;
        const fr = solution.friction!;
        for (const e of [fr.min!, fr.max!]) {
          if (!isFinite(e.value)) continue;
          expectAdmissible(s, e.vals!);
          checked++;
        }
      }),
      { numRuns: 1500, seed: 42 },
    );
    expect(checked).toBeGreaterThan(200);
  });
});

it('файл проекта: опора с трением и односторонний каток', () => {
  const s = presetStructure(TEXTBOOK_FRICTION[2].preset);
  const s2 = presetStructure(TEXTBOOK_FRICTION[0].preset);
  for (const x of [s, s2]) {
    const r = parseProject(serializeProject({ title: 'т', structure: x, notTarget: [] }));
    expect(r.ok && r.project.structure).toEqual(x);
  }
  const raw = JSON.parse(serializeProject({ title: 'т', structure: s, notTarget: [] }));
  raw.structure.items[0].f = -1;
  expect(parseProject(JSON.stringify(raw)).ok).toBe(false);
});

it('готовые задачи «Брус на наклонной плоскости» и «Кран на рельсах»', async () => {
  const { loadPreset } = await import('../src/modules/frames/model/presets');
  const a = analyze(loadPreset('incline')).solution.friction!;
  expect(a.min!.value).toBeCloseTo(10 * (0.5 - 0.2 * Math.cos(R(30))), 9);
  expect(a.max!.value).toBeCloseTo(10 * (0.5 + 0.2 * Math.cos(R(30))), 9);
  expect(analyze(loadPreset('crane')).solution.friction!.max!.value).toBeCloseTo(5.18, 9);
});
