/**
 * Графическая статика (Мещерский §5): диаграмма Кремоны против решения «Ферм» и ответов книги, верёвочный многоугольник против
 * уравнений равновесия, цепь — H = qL²/(8f).
 */
import { describe, expect, it } from 'vitest';
import { solveTruss } from '../src/modules/truss/model/truss';
import { TRUSS_PRESETS } from '../src/modules/truss/presets';
import { cremona, planarityError } from '../src/modules/graphstat/model/cremona';
import { beamEquilibrium, chain, funicular } from '../src/modules/graphstat/model/funicular';
import { GRAPH_PRESETS } from '../src/modules/graphstat/presets';

const trussKeys = Object.entries(GRAPH_PRESETS).filter(([, p]) => p.kind === 'truss');
const beamKeys = Object.entries(GRAPH_PRESETS).filter(([, p]) => p.kind === 'beam');

describe('Диаграмма Максвелла–Кремоны', () => {
  for (const [key, p] of trussKeys) {
    if (p.kind !== 'truss') continue;
    it(`${key}: построение сходится без обращения к решению, усилия совпадают`, () => {
      const res = solveTruss(p.truss);
      expect(res.status).toBe('ok');
      const cr = cremona(p.truss, res);
      expect(cr.error).toBeUndefined();
      expect(cr.ok).toBe(true);
      // Все точки — построением (пересечение двух параллелей), решение фермы только для сверки.
      expect(cr.fallback).toBe(false);
      expect(cr.maxErr).toBeLessThan(1e-9);
      cr.bars.forEach((bv) => expect(bv.N).toBeCloseTo(res.N[bv.bar], 8));
      // Число областей: внешних — по числу внешних сил, внутренних — m − n + 1.
      const inner = cr.faces.filter((f) => !f.outer).length;
      expect(inner).toBe(p.truss.bars.length - p.truss.nodes.length + 1);
      expect(cr.faces.filter((f) => f.outer).length).toBe(cr.ext.length);
      // Шаги построения — по одному на внутреннюю область.
      expect(cr.steps.length).toBe(inner);
    });
    if (p.book)
      it(`${key}: усилия по диаграмме совпадают с ответом книги`, () => {
        const cr = cremona(p.truss, solveTruss(p.truss));
        p.book!.bars.forEach((v, k) => {
          const got = cr.bars.find((b) => b.bar === k)!.N;
          expect(Math.abs(got - v)).toBeLessThanOrEqual(Math.max(0.02 * Math.abs(v), 0.06));
        });
      });
  }

  it('5.14: стержни пересекаются вне узла — диаграмма не строится, причина названа', () => {
    const t = TRUSS_PRESETS.m514.truss;
    expect(planarityError(t)).toMatch(/пересекаются/);
    const cr = cremona(t, solveTruss(t));
    expect(cr.ok).toBe(false);
    expect(cr.error).toMatch(/пересекаются/);
  });

  it('многоугольник внешних сил замкнут: сумма внешних сил равна нулю', () => {
    for (const [, p] of trussKeys) {
      if (p.kind !== 'truss') continue;
      const cr = cremona(p.truss, solveTruss(p.truss));
      const sx = cr.ext.reduce((s, e) => s + e.f[0], 0),
        sy = cr.ext.reduce((s, e) => s + e.f[1], 0);
      expect(Math.hypot(sx, sy)).toBeLessThan(1e-9);
    }
  });
});

describe('Верёвочный многоугольник', () => {
  for (const [key, p] of beamKeys) {
    if (p.kind !== 'beam') continue;
    it(`${key}: реакции по построению совпадают с равновесием и с ответом книги`, () => {
      const r = funicular(p.beam);
      expect(r.error).toBeUndefined();
      expect(r.ok).toBe(true);
      expect(r.maxErr).toBeLessThan(1e-9);
      expect(Math.hypot(...r.RA)).toBeCloseTo(p.book.RA, 1);
      expect(Math.hypot(...r.RB)).toBeCloseTo(p.book.RB, 1);
    });
    it(`${key}: результат не зависит от выбора полюса`, () => {
      const a = funicular({ ...p.beam, pole: 3 }),
        b = funicular({ ...p.beam, pole: 17 });
      expect(a.RB[0]).toBeCloseTo(b.RB[0], 9);
      expect(a.RB[1]).toBeCloseTo(b.RB[1], 9);
      expect(a.RA[1]).toBeCloseTo(b.RA[1], 9);
    });
  }

  it('5.4: X_A = 1 т, Y_A = 1,92 т, R_B вертикальна', () => {
    const p = GRAPH_PRESETS.m54;
    const r = funicular(p.beam);
    expect(r.RA[0]).toBeCloseTo(1, 9);
    expect(r.RA[1]).toBeCloseTo(2 + Math.sqrt(3) - (4 + 5 * Math.sqrt(3)) / 7, 9);
    expect(r.RB[0]).toBeCloseTo(0, 9);
  });

  it('каток под углом: реакция B идёт по заданному направлению', () => {
    const inp = {
      xA: 0,
      xB: 6,
      angleB: 60,
      loads: [
        { x: 2, F: 3, angle: 270 },
        { x: 5, F: 1, angle: 200 },
      ],
    };
    const r = funicular(inp);
    const eq = beamEquilibrium(inp)!;
    expect(r.ok).toBe(true);
    expect(r.RB[0]).toBeCloseTo(eq.RB[0], 9);
    expect(r.RB[1]).toBeCloseTo(eq.RB[1], 9);
    expect(Math.atan2(r.RB[1], r.RB[0])).toBeCloseTo(Math.atan2(Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)), 9);
  });

  it('вырождения называются: нет нагрузок, совпавшие опоры, реакция вдоль балки', () => {
    expect(funicular({ xA: 0, xB: 4, angleB: 90, loads: [] }).error).toMatch(/Нагрузок нет/);
    expect(funicular({ xA: 1, xB: 1, angleB: 90, loads: [{ x: 0, F: 1, angle: 270 }] }).error).toMatch(/совпадают/);
    expect(funicular({ xA: 0, xB: 4, angleB: 0, loads: [{ x: 2, F: 1, angle: 270 }] }).error).toMatch(/вдоль оси/);
  });
});

describe('Цепной мост 5.16', () => {
  const p = GRAPH_PRESETS.m516;
  it('H = qL²/(8f) = 20 т — ответ книги', () => {
    const c = chain(p.chain);
    expect(c.ok).toBe(true);
    expect(c.H).toBeCloseTo(p.book.T, 9);
    expect(c.Tmid).toBeCloseTo(20, 9);
    expect(c.Tsup).toBeCloseTo(Math.hypot(20, 8), 9);
  });
  it('вершины многоугольника — на параболе (с точностью до разбиения), стрела в середине f', () => {
    const c = chain({ ...p.chain, n: 40 });
    const L = p.chain.L,
      f = p.chain.f;
    c.V.forEach(([x, y]) => expect(Math.abs(y - (-4 * f * x * (L - x)) / (L * L))).toBeLessThan(0.01));
    // Середина пролёта: ордината ломаной между двумя средними вершинами.
    const mid = c.V.filter(([x]) => Math.abs(x - L / 2) < L / 40);
    expect((mid[0][1] + mid[1][1]) / 2).toBeCloseTo(-f, 6);
  });
  it('нагрузка на цепь делится поровну', () => {
    expect(chain({ ...p.chain, chains: 1 }).H).toBeCloseTo(40, 9);
  });
});
