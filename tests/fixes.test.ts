/** Исправленные ошибки прототипа, влиявшие на расчёт (согласовано). */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { presetStructure } from '../src/model/presets';
import { inlineText } from '../src/text/doc';

const text = (d: ReturnType<typeof analyze>['doc']) =>
  d.steps
    .flatMap((s) => s.blocks)
    .map((b) => (b.k === 'eq' ? b.lines.map((l) => inlineText(l.c)).join('\n') : 'c' in b ? inlineText(b.c) : ''))
    .join('\n');

describe('№1: определимость — по рангу', () => {
  it('четыре вертикальных катка: изменяема, а не неопределима', () => {
    const s = presetStructure({
      pts: [[0, 0], [2, 0], [4, 0], [6, 0]],
      items: [0, 1, 2, 3].map((i) => ({ type: 'roller' as const, at: i, side: 'below' as const })),
    });
    const { solution, html } = analyze(s);
    expect(solution.rank).toBe(2);
    expect(solution.status).toBe('mechanism');
    expect(html).toContain('Система геометрически изменяема');
    expect(html).toContain('независимых уравнений только 2');
    expect(html).not.toContain('Степень статической неопределимости');
  });

  it('заделка + каток: неопределима, степень n − 3 = 1', () => {
    const s = presetStructure({
      pts: [[0, 0], [6, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'roller', at: 1, side: 'below' },
      ],
    });
    const { solution, html } = analyze(s);
    expect(solution.status).toBe('indeterminate');
    expect(html).toContain('Степень статической неопределимости: 1.');
  });
});

describe('№2: знакопеременная распределённая нагрузка', () => {
  const cantilever = (q1: number, q2: number) =>
    presetStructure({
      pts: [[0, 0], [3, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'dist', from: 0, to: 1, q1, q2, dir: 'down' },
      ],
    });

  it('q1 = −q2: равнодействующая 0, но пара сил не теряется', () => {
    // q(s) = 2 − 4s/3 (вниз). Момент нагрузки относительно A: −∫q(s)·s ds = −(9 − 12) = +3, значит M_A = −3.
    const { solution, model } = analyze(cantilever(2, -2));
    expect(solution.status).toBe('ok');
    expect(solution.vals.M_A).toBeCloseTo(-3, 12);
    expect(solution.vals.Y_A).toBeCloseTo(0, 12);
    const d = model.dists[0];
    expect(d.split?.l1).toBeCloseTo(1.5, 12);
    expect(d.split?.parts.map((p) => [p.Q, p.d, p.dir])).toEqual([
      [1.5, 0.5, 'down'],
      [1.5, 2.5, 'up'],
    ]);
  });

  it('q1 = 4, q2 = −2: две силы, числа совпадают с интегрированием', () => {
    // R = ∫q = (4 − 2)/2·3 = 3 вниз; момент ∫q·s ds = 3²·(4/6 + (−2)/3) = 0.
    const { solution, doc } = analyze(cantilever(4, -2));
    expect(solution.vals.Y_A).toBeCloseTo(3, 12);
    expect(solution.vals.M_A).toBeCloseTo(0, 12);
    const t = text(doc);
    expect(t).toContain('меняет знак: q = 0 на расстоянии 2 м от точки A');
    expect(t).toContain('Q′ = ½·|qнач|·l′ = ½·4·2 = 4 кН');
    expect(t).toContain('Q″ = ½·|qкон|·l″ = ½·2·1 = 1 кН');
    expect(t).toContain('направлена вверх');
    expect(t).not.toContain('центр тяжести трапеции');
  });
});
