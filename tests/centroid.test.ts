/** Центр тяжести: ответы Мещерского §9, формулы и независимая проверка интегрированием по сетке. */
import { describe, expect, it } from 'vitest';
import { partProps, solveCentroid, type CProblem } from '../src/modules/centroid/model/centroid';
import { CENTROID_PRESETS } from '../src/modules/centroid/presets';

const printedUnit = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return 2 * Math.pow(10, -d);
};

describe('Мещерский §9', () => {
  for (const [key, p] of Object.entries(CENTROID_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const r = solveCentroid(p.problem as CProblem);
      expect(r.c, key).not.toBeNull();
      const [x, y, z] = r.c!;
      const got: Record<string, number> = { x, y, z, diag: (x + y) / Math.SQRT2 };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book))
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
    });
  it('9.7: x_C по расчёту 8,04 (в книге 8,19 — не достигается ни при каком положении галереи)', () => {
    const r = solveCentroid(CENTROID_PRESETS.m97.problem as CProblem);
    const ex = (25.6 * (16 / 3) + 2.4 * (172.5 - 2 * 9.5)) / (25.6 + 2.4 * 15.5);
    expect(r.c![0]).toBeCloseTo(ex, 12);
    expect(Math.abs(r.c![0] - 8.19)).toBeGreaterThan(0.1);
  });
  it('9.14: из квадрата вырезан треугольник AEB, E — центр тяжести остатка при y_E = 0,634a', () => {
    const y = 0.634;
    const r = solveCentroid({ mode: 'area', parts: [{ kind: 'rect', p: { x: 0, y: 0, w: 1, h: 1 }, s: 1, k: 1 }, { kind: 'tri', p: { x1: 0, y1: 0, x2: 1, y2: 0, x3: 0.5, y3: y }, s: -1, k: 1 }] });
    expect(r.c![0]).toBeCloseTo(0.5, 12);
    expect(Math.abs(r.c![1] - y)).toBeLessThan(0.002);
  });
  it('9.4 и 9.8: формулы книги', () => {
    // Диск r₁ = 2 с отверстием r₂ = 1, центр отверстия в r₁/2: x_C = −r₁r₂²/(2(r₁² − r₂²)).
    const d = solveCentroid({ mode: 'area', parts: [{ kind: 'circle', p: { cx: 0, cy: 0, r: 2 }, s: 1, k: 1 }, { kind: 'circle', p: { cx: 1, cy: 0, r: 1 }, s: -1, k: 1 }] });
    expect(d.c![0]).toBeCloseTo(-(2 * 1) / (2 * (4 - 1)), 12);
    // Уголок a = 10, b = 6, d = 1: x = (a² + bd − d²)/(2(a + b − d)), y = (b² + ad − d²)/(2(b + a − d)).
    const L = solveCentroid({ mode: 'area', parts: [{ kind: 'rect', p: { x: 0, y: 0, w: 10, h: 1 }, s: 1, k: 1 }, { kind: 'rect', p: { x: 0, y: 1, w: 1, h: 5 }, s: 1, k: 1 }] });
    expect(L.c![0]).toBeCloseTo((100 + 6 - 1) / (2 * 15), 12);
    expect(L.c![1]).toBeCloseTo((36 + 10 - 1) / (2 * 15), 12);
  });
  it('9.21 и проволока: грузы и линии', () => {
    const k = solveCentroid({ mode: 'mass', parts: [6, 3, 4.6].map((y, i) => ({ kind: 'point' as const, p: { x: 0, y, z: 0, w: [1900, 450, 500][i] }, s: 1 as const, k: 1 })) });
    expect(Math.abs(k.c![1] - 5.28)).toBeLessThanOrEqual(0.02);
    expect(solveCentroid(CENTROID_PRESETS.arc.problem as CProblem).c![1]).toBeCloseTo(2 / (Math.PI + 2), 12);
  });
});

describe('формулы частей — против численного интегрирования', () => {
  /** Площадь и центр тяжести по сетке точек, попадающих в фигуру. */
  function grid(inside: (x: number, y: number) => boolean, x0: number, x1: number, y0: number, y1: number, n = 800) {
    let A = 0,
      sx = 0,
      sy = 0;
    const hx = (x1 - x0) / n,
      hy = (y1 - y0) / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = x0 + (i + 0.5) * hx,
          y = y0 + (j + 0.5) * hy;
        if (inside(x, y)) {
          A += hx * hy;
          sx += x * hx * hy;
          sy += y * hx * hy;
        }
      }
    return { A, x: sx / A, y: sy / A };
  }
  const ang = (x: number, y: number) => ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  it('сектор 20°…130°', () => {
    const r = partProps({ kind: 'sector', p: { cx: 0, cy: 0, r: 2, a1: 20, a2: 130 }, s: 1, k: 1 });
    const g = grid((x, y) => Math.hypot(x, y) <= 2 && ang(x, y) >= 20 && ang(x, y) <= 130, -2, 2, -2, 2);
    expect(r.m).toBeCloseTo(g.A, 2);
    expect(r.c[0]).toBeCloseTo(g.x, 2);
    expect(r.c[1]).toBeCloseTo(g.y, 2);
  });
  it('сегмент 200°…320°', () => {
    const r = partProps({ kind: 'segment', p: { cx: 0, cy: 0, r: 2, a1: 200, a2: 320 }, s: 1, k: 1 });
    // Сегмент: внутри круга и по другую сторону хорды от центра.
    const P = [2 * Math.cos((200 * Math.PI) / 180), 2 * Math.sin((200 * Math.PI) / 180)],
      Q = [2 * Math.cos((320 * Math.PI) / 180), 2 * Math.sin((320 * Math.PI) / 180)];
    const side = (x: number, y: number) => (Q[0] - P[0]) * (y - P[1]) - (Q[1] - P[1]) * (x - P[0]);
    const g = grid((x, y) => Math.hypot(x, y) <= 2 && Math.sign(side(x, y)) !== Math.sign(side(0, 0)), -2, 2, -2, 2);
    expect(r.m).toBeCloseTo(g.A, 2);
    expect(r.c[0]).toBeCloseTo(g.x, 2);
    expect(r.c[1]).toBeCloseTo(g.y, 2);
  });
  it('многоугольник (трапеция) и треугольник', () => {
    const t = partProps({ kind: 'poly', p: {}, pts: [[0, 0], [5, 0], [2, 5], [0, 5]], s: 1, k: 1 });
    const g = grid((x, y) => y >= 0 && y <= 5 && x >= 0 && x <= 5 - (3 * y) / 5, 0, 5, 0, 5);
    expect(t.m).toBeCloseTo(g.A, 2);
    expect(t.c[0]).toBeCloseTo(g.x, 2);
    expect(t.c[1]).toBeCloseTo(g.y, 2);
  });
  it('тела: полушар, конус, цилиндр — объёмы и центры', () => {
    const h = partProps({ kind: 'hemi', p: { x: 1, y: 2, z: 3, r: 2, ax: 0, dir: -1 }, s: 1, k: 1 });
    expect(h.m).toBeCloseTo((2 / 3) * Math.PI * 8, 12);
    expect(h.c).toEqual([1 - 0.75, 2, 3]);
    const c = partProps({ kind: 'cone', p: { x: 0, y: 0, z: 0, r: 1, h: 4, ax: 1, dir: 1 }, s: 1, k: 1 });
    expect(c.c[1]).toBeCloseTo(1, 12);
  });
});
