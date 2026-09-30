/**
 * Фермы: ответы Мещерского (§5) для реакций и усилий во всех стержнях, независимая проверка равновесия
 * узлов и частей, метод Риттера и нулевые стержни против общего решения.
 */
import { describe, expect, it } from 'vitest';
import { jointOrder, ritterCut, ritterForce, solveTruss, zeroBars, type Truss } from '../src/modules/truss/model/truss';
import { TRUSS_PRESETS } from '../src/modules/truss/presets';

/** Две единицы последнего напечатанного знака (книга решает графически и округляет). */
function printedUnit(v: number): number {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return 2 * Math.pow(10, -d);
}

/** Независимо: сумма сил в каждом узле (свои направления стержней и реакций). */
function nodeResiduals(t: Truss, N: number[], R: Record<string, number>) {
  const f = t.nodes.map(() => [0, 0]);
  t.bars.forEach((q, k) => {
    const P = t.nodes[q.a],
      Q = t.nodes[q.b],
      L = Math.hypot(Q.x - P.x, Q.y - P.y);
    const ux = (Q.x - P.x) / L,
      uy = (Q.y - P.y) / L;
    // Растянутый стержень тянет оба узла к себе.
    f[q.a][0] += N[k] * ux;
    f[q.a][1] += N[k] * uy;
    f[q.b][0] -= N[k] * ux;
    f[q.b][1] -= N[k] * uy;
  });
  for (const l of t.loads) {
    f[l.node][0] += l.F * Math.cos((l.angle * Math.PI) / 180);
    f[l.node][1] += l.F * Math.sin((l.angle * Math.PI) / 180);
  }
  const letter = 'ABCDEHKLNOPTUVWZ';
  for (const s of t.supports) {
    const n = letter[s.node];
    if (s.kind === 'pin') {
      f[s.node][0] += R['X_' + n];
      f[s.node][1] += R['Y_' + n];
    } else {
      f[s.node][0] += R['R_' + n] * Math.cos((s.angle * Math.PI) / 180);
      f[s.node][1] += R['R_' + n] * Math.sin((s.angle * Math.PI) / 180);
    }
  }
  return f.flat();
}

describe('Мещерский: фермы', () => {
  for (const [key, p] of Object.entries(TRUSS_PRESETS))
    it(`${p.title}`, () => {
      const t = p.truss as Truss;
      const res = solveTruss(t);
      expect(res.status, key).toBe('ok');
      const R = Object.fromEntries(res.reactions.map((r, j) => [r.key, res.R[j]]));
      for (const [k, book] of Object.entries(p.book.reactions)) expect(Math.abs(R[k] - book), `${k}: ${R[k]} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
      p.book.bars.forEach((book, k) => expect(Math.abs(res.N[k] - book), `стержень ${k + 1}: ${res.N[k]} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9));
      nodeResiduals(t, res.N, R).forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
    });
});

describe('методы решения согласуются с общим решением', () => {
  for (const [key, p] of Object.entries(TRUSS_PRESETS)) {
    const t = p.truss as Truss;
    const res = solveTruss(t);
    it(`${key}: нулевые стержни по признакам действительно не нагружены`, () => {
      for (const z of zeroBars(t)) expect(Math.abs(res.N[z.bar])).toBeLessThan(1e-9);
    });
    it(`${key}: вырезание узлов находит все стержни`, () => {
      const { rest, steps } = jointOrder(t, zeroBars(t).map((z) => z.bar));
      expect(rest).toEqual([]);
      for (const s of steps) expect(s.bars.length).toBeGreaterThan(0);
    });
    it(`${key}: метод Риттера даёт то же усилие`, () => {
      let cuts = 0;
      t.bars.forEach((_, k) => {
        const c = ritterCut(t, k);
        if (!c) return;
        cuts++;
        expect(ritterForce(t, res, c), `стержень ${k + 1}`).toBeCloseTo(res.N[k], 9);
      });
      expect(cuts).toBeGreaterThan(0);
      expect(ritterCut(t, p.ritter!)).not.toBeNull();
    });
  }
});

describe('определимость', () => {
  const base = TRUSS_PRESETS.m514.truss as Truss;
  it('лишний стержень — статически неопределима', () => {
    expect(solveTruss({ ...base, bars: [...base.bars, { a: 0, b: 1 }] }).status).toBe('indeterminate');
  });
  it('без стержня — изменяема', () => {
    expect(solveTruss({ ...base, bars: base.bars.slice(1) }).status).toBe('mechanism');
  });
  it('счёт сходится, но связи мгновенно изменяемы: три шарнира на одной прямой', () => {
    const t: Truss = {
      nodes: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ],
      bars: [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
      ],
      supports: [
        { node: 0, kind: 'pin', angle: 90 },
        { node: 2, kind: 'pin', angle: 90 },
      ],
      loads: [{ node: 1, F: 1, angle: 270 }],
    };
    expect(solveTruss(t).status).toBe('mechanism');
  });
  it('ошибки данных', () => {
    const r = solveTruss({ ...base, bars: [...base.bars, { a: 2, b: 2 }] });
    expect(r.status).toBe('invalid');
    expect(r.errors.join(' ')).toMatch(/одном узле/);
  });
});

describe('нулевые стержни по признакам', () => {
  // Ферма-треугольник A–C–B с подвеской: узел D (ненагруженный, два стержня) и узел E на нижнем поясе (три стержня).
  const t: Truss = {
    nodes: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 5, y: 1 },
    ],
    // 1 A–D, 2 D–B, 3 A–C, 4 C–B, 5 C–D (третий в ненагруженном узле D, где 1 и 2 на одной прямой), 6 B–E, 7 C–E
    bars: [
      { a: 0, b: 3 },
      { a: 3, b: 1 },
      { a: 0, b: 2 },
      { a: 2, b: 1 },
      { a: 2, b: 3 },
      { a: 1, b: 4 },
      { a: 2, b: 4 },
    ],
    supports: [
      { node: 0, kind: 'pin', angle: 90 },
      { node: 1, kind: 'roller', angle: 90 },
    ],
    loads: [{ node: 2, F: 10, angle: 270 }],
  };
  it('находит оба признака и они подтверждаются расчётом', () => {
    const res = solveTruss(t);
    expect(res.status).toBe('ok');
    const z = zeroBars(t);
    expect(z.map((x) => [x.bar + 1, x.rule]).sort()).toEqual([
      [5, 'three'],
      [6, 'two'],
      [7, 'two'],
    ]);
    for (const x of z) expect(Math.abs(res.N[x.bar])).toBeLessThan(1e-9);
  });
});

describe('хранилище и файл фермы', () => {
  it('удаление узла убирает его стержни, опоры и силы и сдвигает номера', async () => {
    const { TrussStore } = await import('../src/modules/truss/ui/store');
    const s = new TrussStore({ preset: 'm57' });
    s.setRitter(6); // стержень 7 D–E
    s.removeNode(2); // узел C: уходят стержни 4, 5, 6 и сила 2 в C
    const t = s.get().truss;
    expect(t.nodes).toHaveLength(4);
    expect(t.bars).toEqual([
      { a: 0, b: 2 },
      { a: 2, b: 1 },
      { a: 3, b: 1 },
      { a: 2, b: 3 },
    ]);
    expect(t.loads.map((l) => l.node)).toEqual([0, 3, 1]);
    expect(s.get().ritter).toBe(3);
    s.undo();
    expect(s.get().truss.nodes).toHaveLength(5);
  });
  it('сохранение и открытие; ошибки в файле', async () => {
    const { TrussStore } = await import('../src/modules/truss/ui/store');
    const a = new TrussStore({ preset: 'm515' });
    const { text } = a.exportProject();
    const b = new TrussStore({ preset: 'm57' });
    expect(b.importProject(text)).toBe(true);
    expect(b.get().truss).toEqual(a.get().truss);
    expect(b.get().ritter).toBe(a.get().ritter);
    const bad = JSON.parse(text);
    bad.truss.bars[0].b = 99;
    expect(b.importProject(JSON.stringify(bad), 'x.json')).toBe(false);
    expect(b.get().notice?.text).toMatch(/Стержень №1/);
  });
});
