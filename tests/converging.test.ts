/** Сходящиеся силы и приведение: эталоны Мещерского §2, 6, 7 и независимые проверки. */
import { describe, expect, it } from 'vitest';
import { cross, reduceSystem, solveNode, type NodeProblem, type ReduceProblem } from '../src/modules/converging/model/forces';
import { CONV_PRESETS, type ConvPresetKey } from '../src/modules/converging/presets';
import { renderNode, renderReduce } from '../src/modules/converging/draw/converging';
import { nodeDoc, reduceDoc } from '../src/modules/converging/text/solution';
import { ConvStore, parseConv } from '../src/modules/converging/ui/store';

const printedUnit = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return 2 * Math.pow(10, -d);
};

describe('Мещерский: узел', () => {
  for (const [key, p] of Object.entries(CONV_PRESETS)) {
    if (p.problem.mode !== 'node' || !('book' in p)) continue;
    it(p.title, () => {
      const pr = (p.problem as { node: NodeProblem }).node;
      const r = solveNode(pr);
      expect(r.status, key).toBe('ok');
      expect(r.bad).toEqual([]);
      for (const [name, book] of Object.entries(p.book as Record<string, number>)) {
        const i = pr.forces.findIndex((f) => f.name === name);
        expect(Math.abs(r.vals[i] - book), `${name}: ${r.vals[i]} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
      }
      // Независимо: сумма всех сил в узле — нуль.
      const sum = [0, 1, 2].map((a) => pr.forces.reduce((s, f, i) => s + (f.kind === 'known' ? f.F : r.vals[i]) * r.dirs[i][a], 0));
      sum.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
    });
  }
  it('нить не может быть сжата', () => {
    const r = solveNode({ forces: [{ name: 'G', kind: 'known', F: 10, dirMode: 'ang', v: [0, 0, 0], ang: 90 }, { name: 'T', kind: 'rope', F: 0, dirMode: 'ang', v: [0, 0, 0], ang: 90 }] });
    expect(r.status).toBe('ok');
    expect(r.bad).toEqual([1]);
  });
  it('три неизвестных на плоскости — неопределима; одна при двух уравнениях — проверка равновесия', () => {
    const f = (ang: number) => ({ name: 'T', kind: 'rod' as const, F: 0, dirMode: 'ang' as const, v: [0, 0, 0] as [number, number, number], ang });
    const G = { name: 'G', kind: 'known' as const, F: 1, dirMode: 'ang' as const, v: [0, 0, 0] as [number, number, number], ang: 270 };
    expect(solveNode({ forces: [G, f(0), f(90), f(45)] }).status).toBe('indeterminate');
    expect(solveNode({ forces: [G, f(0)] }).status).toBe('noequilibrium');
    expect(solveNode({ forces: [G, f(90)] }).vals[1]).toBeCloseTo(1, 12);
  });
});

describe('Мещерский: приведение к простейшему виду', () => {
  for (const key of ['m76', 'm712'] as const) {
    const p = CONV_PRESETS[key];
    it(p.title, () => {
      const r = reduceSystem(p.problem.reduce as ReduceProblem);
      expect(r.kind).toBe('dynamo');
      const got = { R: Math.hypot(...r.R), Mstar: Math.abs(r.Mstar), x: r.xyPoint![0], y: r.xyPoint![1] };
      for (const [k, book] of Object.entries(p.book)) expect(Math.abs(got[k as keyof typeof got] - book), `${k}: ${got[k as keyof typeof got]}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
    });
  }
  it('7.6: углы оси с координатными осями: α = 90°, tg β = 2/3', () => {
    const r = reduceSystem(CONV_PRESETS.m76.problem.reduce as ReduceProblem);
    expect(r.R[0]).toBe(0);
    expect(r.R[2] / r.R[1]).toBeCloseTo(2 / 3, 12);
  });
  it('главный момент относительно точки на центральной оси — минимальный и параллелен R', () => {
    const pr = CONV_PRESETS.m712.problem.reduce as ReduceProblem;
    const r = reduceSystem(pr);
    const r2 = reduceSystem({ ...pr, O: r.axisPoint! });
    const c = cross(r2.R, r2.M);
    c.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
    expect(Math.hypot(...r2.M)).toBeCloseTo(Math.abs(r.Mstar), 9);
  });
  it('плоская система: равнодействующая, линия действия x·R_y − y·R_x = M_O', () => {
    const r = reduceSystem(CONV_PRESETS.plane.problem.reduce as ReduceProblem);
    expect(r.plane).toBe(true);
    expect(r.kind).toBe('resultant');
    const [x, y] = r.axisPoint!;
    expect(x * r.R[1] - y * r.R[0]).toBeCloseTo(r.M[2], 9);
  });
  it('пара и равновесие', () => {
    expect(reduceSystem({ forces: [{ name: 'a', r: [0, 0, 0], F: [1, 0, 0] }, { name: 'b', r: [0, 1, 0], F: [-1, 0, 0] }], pairs: [], O: [0, 0, 0] }).kind).toBe('pair');
    expect(reduceSystem({ forces: [{ name: 'a', r: [0, 0, 0], F: [1, 0, 0] }, { name: 'b', r: [5, 0, 0], F: [-1, 0, 0] }], pairs: [], O: [0, 0, 0] }).kind).toBe('equilibrium');
  });
});

describe('сходящиеся силы: файл проекта, чертёж и текст', () => {
  for (const [key, p] of Object.entries(CONV_PRESETS)) {
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new ConvStore({ preset: key as ConvPresetKey });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new ConvStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      const pr = p.problem;
      const out =
        pr.mode === 'node'
          ? [renderNode(pr.node, solveNode(pr.node)).svg, JSON.stringify(nodeDoc(pr.node, solveNode(pr.node), { explain: true }))]
          : [renderReduce(pr.reduce, reduceSystem(pr.reduce)).svg, JSON.stringify(reduceDoc(pr.reduce, reduceSystem(pr.reduce), { explain: true }))];
      for (const t of out) expect(t).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('чужой и испорченный файл не открываются', () => {
    const s = new ConvStore();
    expect(s.importProject(JSON.stringify({ format: 'statika-project', version: 1, module: 'centroid', problem: {} }))).toBe(false);
    expect(parseConv({ mode: 'node', node: { forces: [{ kind: 'rod' }] } }).ok).toBe(false);
    expect(parseConv({ mode: 'reduce', reduce: { forces: [], pairs: [], O: [0, 0, 0] } }).ok).toBe(false);
  });
  it('редактирование: смена режима, добавление и отмена', () => {
    const s = new ConvStore();
    s.addNodeForce();
    const p0 = s.get().problem;
    expect(p0.mode === 'node' && p0.node.forces.length).toBe(4);
    s.setMode('reduce');
    s.addPair();
    s.typeReduce('M', 0, 2, 7);
    const p = s.get().problem;
    expect(p.mode === 'reduce' && p.reduce.pairs[0].M[2]).toBe(7);
    s.undo();
    s.undo();
    s.undo();
    expect(s.get().problem.mode).toBe('node');
  });
});
