/**
 * Свойства на случайных конструкциях:
 * - для определимой системы найденные реакции действительно уравновешивают тело
 *   (проверка независимым расчётом, а не теми же коэффициентами уравнений);
 * - проверочное уравнение сходится;
 * - операции редактирования сохраняют корректную геометрию.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { addSeg, setSegDir, setSegLen, splitSeg } from '../src/model/edit';
import { geom, geomOK, resolve } from '../src/model/geometry';
import { checkPasses } from '../src/solver/check';
import { residuals, wrenches } from './helpers/equilibrium';
import { frameArb, structureArb } from './helpers/random';

describe('случайные определимые конструкции', () => {
  it('реакции уравновешивают тело; проверочное уравнение сходится', () => {
    const stats: Record<string, number> = {};
    fc.assert(
      fc.property(structureArb, (s) => {
        const { model, solution } = analyze(s);
        stats[solution.status] = (stats[solution.status] || 0) + 1;
        if (solution.status !== 'ok') return;
        const norm = resolve(s).structure;
        const ws = wrenches(norm, solution.vals, model.unknowns, new Set(model.badDists.map((b) => b.it.id)));
        const pts = model.pts.map((p) => [p.x, p.y] as [number, number]);
        const r = residuals(ws, [[0, 0], [7, -3], ...pts]);
        const tol = 1e-9 * r.scale;
        expect(Math.abs(r.fx)).toBeLessThan(tol);
        expect(Math.abs(r.fy)).toBeLessThan(tol);
        r.ms.forEach((m) => expect(Math.abs(m)).toBeLessThan(tol));
        if (solution.check) expect(checkPasses(solution.check.r, solution.vals)).toBe(true);
        // Все неизвестные найдены и конечны.
        for (const u of model.unknowns) expect(Number.isFinite(solution.vals[u.key])).toBe(true);
      }),
      { numRuns: 1500, seed: 20260922 },
    );
    // Генератор должен давать в основном определимые системы, иначе проверка ничего не стоит.
    expect(stats.ok ?? 0).toBeGreaterThan(900);
  });

  it('статус «равновесие невозможно» — только когда нагрузку действительно нельзя уравновесить', () => {
    fc.assert(
      fc.property(structureArb, (s) => {
        const { solution } = analyze(s);
        if (solution.status !== 'noequilibrium') return;
        // Невязка в каком-то уравнении существенна по сравнению с масштабом уравнения.
        expect(Math.abs(solution.badR as number)).toBeGreaterThan(1e-6);
      }),
      { numRuns: 800, seed: 7 },
    );
  });
});

describe('геометрия при редактировании', () => {
  const ops = fc.array(
    fc.oneof(
      fc.record({ op: fc.constant('add' as const), from: fc.nat(), dir: fc.constantFrom('r', 'l', 'u', 'd' as const), len: fc.constantFrom(0.5, 1, 2, 3) }),
      fc.record({ op: fc.constant('split' as const), seg: fc.nat(), t: fc.double({ min: 0, max: 1, noNaN: true }) }),
      fc.record({ op: fc.constant('len' as const), seg: fc.nat(), len: fc.constantFrom(0.5, 1, 2.5, 4) }),
      fc.record({ op: fc.constant('dir' as const), seg: fc.nat(), dir: fc.constantFrom('r', 'l', 'u', 'd' as const) }),
    ),
    { maxLength: 12 },
  );

  it('после любой последовательности правок участки не пересекаются, левая нижняя точка — (0; 0)', () => {
    fc.assert(
      fc.property(frameArb, ops, ({ s: s0, ids }, list) => {
        let s = s0;
        for (const o of list) {
          const seg = s.segs[(o as { seg?: number }).seg! % s.segs.length];
          const r =
            o.op === 'add'
              ? addSeg(s, s.nodes[o.from % s.nodes.length].id, o.dir, o.len, ids)
              : o.op === 'split'
                ? splitSeg(s, seg.id, o.t * seg.len, ids)
                : o.op === 'len'
                  ? setSegLen(s, seg.id, o.len)
                  : setSegDir(s, seg.id, o.dir);
          if (r.ok) s = r.s;
          expect(geomOK(s)).toBe(true);
        }
        const g = geom(s);
        const xs = Object.values(g.pos).map((p) => p[0]),
          ys = Object.values(g.pos).map((p) => p[1]);
        expect(Math.min(...xs)).toBe(0);
        expect(Math.min(...ys)).toBe(0);
        expect(g.order.length).toBe(s.nodes.length);
        expect(s.segs.length).toBe(s.nodes.length - 1);
        expect(new Set(Object.values(g.name)).size).toBe(s.nodes.length);
      }),
      { numRuns: 400, seed: 3 },
    );
  });
});
