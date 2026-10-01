/** Формулы от t: разбор, вычисление, производная (против численной), запись. */
import { describe, expect, it } from 'vitest';
import { diff, evalExpr, parseExpr, printExpr, type Expr } from '../src/shared/expr';

const P = (s: string): Expr => {
  const r = parseExpr(s);
  if (!r.ok) throw new Error(r.error);
  return r.e;
};

describe('разбор и вычисление', () => {
  const cases: [string, (t: number) => number][] = [
    ['10 sin(π t/2)', (t) => 10 * Math.sin((Math.PI * t) / 2)],
    ['10sin(πt/2)', (t) => 10 * Math.sin((Math.PI * t) / 2)],
    ['490t − 245(1 − exp(−2t))', (t) => 490 * t - 245 * (1 - Math.exp(-2 * t))],
    ['0,1(cos 50t + 0,0625cos 100t)', (t) => 0.1 * (Math.cos(50 * t) + 0.0625 * Math.cos(100 * t))],
    ['3cos2πt', (t) => 3 * Math.cos(2 * Math.PI * t)],
    ['t^2/2 + 3t^3', (t) => t ** 2 / 2 + 3 * t ** 3],
    ['-t^2', (t) => -(t ** 2)],
    ['2^-t', (t) => 2 ** -t],
    ['sqrt(1 + t²)'.replace('²', '^2'), (t) => Math.sqrt(1 + t * t)],
    ['ch(2t) + sh t', (t) => Math.cosh(2 * t) + Math.sinh(t)],
    ['arctg(t)·ln(1+t)', (t) => Math.atan(t) * Math.log(1 + t)],
    ['sin(t)^2', (t) => Math.sin(t) ** 2],
    ['1,5e-3 t', (t) => 1.5e-3 * t],
  ];
  for (const [s, f] of cases)
    it(s, () => {
      const e = P(s);
      for (const t of [0.3, 1.1, 2.7]) expect(evalExpr(e, t)).toBeCloseTo(f(t), 10);
    });
  it('ошибки', () => {
    for (const s of ['sin(', '2 +', 'q t', '1,2,3', '(t'])
      expect(parseExpr(s).ok, s).toBe(false);
  });
});

describe('производная', () => {
  const srcs = ['10 sin(π t/2)', '490t − 245(1 − exp(−2t))', 't^3 − 2t', 'sqrt(1+t^2)', 'tg(t) + ctg(t)', 'arcsin(t/3) + arccos(t/4)', 't^t', 'ln(t)/t', 'th(t)·ch(t)', 'abs(t − 1)'];
  for (const s of srcs)
    it(s, () => {
      const e = P(s),
        d1 = diff(e),
        d2 = diff(d1);
      for (const t of [0.4, 1.3, 2.2]) {
        const h = 1e-4;
        expect(evalExpr(d1, t)).toBeCloseTo((evalExpr(e, t + h) - evalExpr(e, t - h)) / (2 * h), 5);
        expect(evalExpr(d2, t)).toBeCloseTo((evalExpr(d1, t + h) - evalExpr(d1, t - h)) / (2 * h), 4);
      }
    });
  it('запись производной', () => {
    expect(printExpr(diff(P('10 sin(π t/2)')))).toBe('15,708cos(1,5708t)');
    expect(printExpr(diff(P('3t^2 + 2t')))).toBe('6t + 2');
  });
});
