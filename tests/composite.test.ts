/** Составные конструкции с внутренними шарнирами: эталоны Мещерского и независимая проверка каждой части. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { presetStructure } from '../src/model/presets';
import { TEXTBOOK_COMPOSITE } from '../src/model/textbook';

const printedUnit = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 : 2 * Math.pow(10, -d);
};

describe('Мещерский: составные конструкции', () => {
  for (const p of TEXTBOOK_COMPOSITE)
    it(`${p.id} — ${p.title}`, () => {
      const { solution, model } = analyze(presetStructure(p.preset));
      expect(solution.status, JSON.stringify(solution.vals)).toBe('ok');
      expect(model.parts.count).toBe((p.preset.hinges?.length ?? 0) + 1);
      for (const [k, book] of Object.entries(p.answer))
        expect(Math.abs(solution.vals[k] - book), `${k}: получено ${solution.vals[k]}, в книге ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
    });
});

import fc from 'fast-check';
import { resolve } from '../src/model/geometry';
import type { Structure } from '../src/model/types';
import { partWrenches, residuals } from './helpers/equilibrium';
import { structureArb } from './helpers/random';

/** Каждая часть в равновесии: независимый пересчёт сил. */
function expectPartsBalanced(s0: Structure) {
  const s = resolve(s0).structure;
  const { model, solution } = analyze(s);
  const ws = partWrenches(s, solution.vals, model.unknowns, model.parts, new Set(model.badDists.map((b) => b.it.id)));
  ws.forEach((w, p) => {
    const r = residuals(w, [[0, 0], [3, -2], ...model.pts.map((q) => [q.x, q.y] as [number, number])]);
    const tol = 1e-9 * r.scale;
    expect(Math.abs(r.fx), `часть ${p}: ΣFx`).toBeLessThan(tol);
    expect(Math.abs(r.fy), `часть ${p}: ΣFy`).toBeLessThan(tol);
    r.ms.forEach((m) => expect(Math.abs(m), `часть ${p}: ΣM`).toBeLessThan(tol));
  });
}

describe('равновесие каждой части', () => {
  for (const p of TEXTBOOK_COMPOSITE) it(p.id, () => expectPartsBalanced(presetStructure(p.preset)));

  it('случайные составные конструкции', () => {
    let ok = 0;
    fc.assert(
      fc.property(structureArb, fc.array(fc.nat(), { minLength: 1, maxLength: 2 }), fc.array(fc.constantFrom('pin', 'roller', 'rod'), { minLength: 1, maxLength: 3 }), (s0, hs, extra) => {
        // Шарниры в случайных внутренних точках и добавочные опоры, чтобы система чаще была определимой.
        const inner = s0.nodes.filter((n) => s0.segs.filter((q) => q.a === n.id || q.b === n.id).length >= 2);
        if (!inner.length) return;
        const hinge = new Set(hs.map((i) => inner[i % inner.length].id));
        const s: Structure = {
          nodes: s0.nodes.map((n) => (hinge.has(n.id) ? { id: n.id, hinge: true } : n)),
          segs: s0.segs,
          items: [
            ...s0.items,
            ...extra.map((t, i) => {
              const at = s0.nodes[(i * 7 + 3) % s0.nodes.length].id;
              return t === 'rod' ? { id: 'x' + i, type: 'rod' as const, at, angle: 60 + 30 * i } : { id: 'x' + i, type: t, at, side: 'below' as const };
            }),
          ],
        };
        const { solution } = analyze(s);
        if (solution.status !== 'ok') return;
        ok++;
        expectPartsBalanced(s);
      }),
      { numRuns: 5000, seed: 11 },
    );
    expect(ok).toBeGreaterThan(150);
  });
});
