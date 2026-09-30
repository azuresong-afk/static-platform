/** Пространственное тело: ответы Мещерского §8 и независимая проверка шести условий равновесия. */
import { describe, expect, it } from 'vitest';
import { buildModel, solveBody, type Body } from '../src/modules/spacebody/model/body';
import { BODY_PRESETS } from '../src/modules/spacebody/presets';

const printedUnit = (v: number) => {
  const s = String(Math.abs(v));
  const dd = s.includes('.') ? s.split('.')[1].length : 0;
  return dd > 6 ? 1e-9 : 2 * Math.pow(10, -dd);
};

/** Своими средствами: главный вектор и главный момент относительно начала координат. */
function wrench(b: Body, vals: Record<string, number>) {
  const m = buildModel(b);
  let F = [0, 0, 0],
    M = [0, 0, 0];
  const addF = (r: number[], f: number[]) => {
    F = F.map((v, i) => v + f[i]);
    M = [M[0] + r[1] * f[2] - r[2] * f[1], M[1] + r[2] * f[0] - r[0] * f[2], M[2] + r[0] * f[1] - r[1] * f[0]];
  };
  for (const u of m.unknowns) addF(u.r, u.u.map((x) => x * vals[u.key]));
  for (const k of m.knowns) if (k.kind === 'f') addF(k.r, k.u.map((x) => x * k.val));
  for (const p of b.pairs) M = M.map((v, i) => v + p.M[i]);
  return { F, M };
}

describe('Мещерский §8', () => {
  for (const [key, p] of Object.entries(BODY_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const b = p.body as Body;
      const sol = solveBody(buildModel(b));
      expect(sol.status, key).toBe('ok');
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(sol.vals[k] - book), `${k}: ${sol.vals[k]} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
      const w = wrench(b, sol.vals);
      [...w.F, ...w.M].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-8));
    });
});

describe('определимость', () => {
  const base = BODY_PRESETS.m826.body as Body;
  it('лишняя опора — неопределима; без острия пластинка поворачивается вокруг AB — равновесие невозможно', () => {
    expect(solveBody(buildModel({ ...base, supports: [...base.supports, { kind: 'rod', at: 2, to: 0 }] })).status).toBe('indeterminate');
    expect(solveBody(buildModel({ ...base, supports: base.supports.slice(0, 2) })).status).toBe('noequilibrium');
  });
  it('шесть стержней, неудачно расположенных (все параллельны z), — изменяема', () => {
    const rods = [0, 1, 2, 3, 4, 5].map((i) => ({ kind: 'normal' as const, at: i % 4, n: [0, 0, 1] as [number, number, number] }));
    expect(solveBody(buildModel({ ...base, supports: rods })).status).toBe('mechanism');
  });
  it('незакреплённое перемещение при нагрузке вдоль него — равновесие невозможно', () => {
    const b = BODY_PRESETS.m825.body as Body;
    expect(solveBody(buildModel(b)).status).toBe('ok');
    expect(solveBody(buildModel({ ...b, forces: [...b.forces, { at: 7, mode: 'comp', F: 1, c: [0, 1, 0] }] })).status).toBe('noequilibrium');
  });
});

it('вал: P = 2, реакции уравновешивают', () => {
  const b = BODY_PRESETS.shaft.body as Body;
  const sol = solveBody(buildModel(b));
  expect(sol.status).toBe('ok');
  expect(sol.vals.P).toBeCloseTo(2, 12);
  [...wrench(b, sol.vals).F, ...wrench(b, sol.vals).M].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
});
