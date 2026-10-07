/** Символьный движок и уравнения Лагранжа: задачи Мещерского §48, проверка производных и интегрирования. */
import { describe, expect, it } from 'vitest';
import { solveLagrange, type LagCoord, type LagProblem } from '../src/modules/lagrange/model/lagrange';
import { add, d, evalSym, expand, parseSym, setCoordNames, sub, symText, type Sym } from '../src/shared/sym';

const C = (name: string, q0 = 0.3, v0 = 0, Q = '', eq = 0): LagCoord => ({ name, q0, v0, Q, eq });
const P = (o: Record<string, number>) => Object.entries(o).map(([name, value]) => ({ name, value }));
const solve = (pr: LagProblem) => {
  const r = solveLagrange(pr);
  if (!r.ok) throw new Error(r.field + ': ' + r.error);
  setCoordNames(r.ctx.coords);
  return r;
};
const ctx = { coords: ['x', 'φ'], params: ['m', 'l', 'g', 'r'] };
const S = (src: string): Sym => {
  const r = parseSym(src, ctx);
  if (!r.ok) throw new Error(r.error);
  return r.s;
};
/** Выражения равны: разность после раскрытия скобок — нуль. */
const same = (a: Sym, b: Sym) => expect(symText(expand(sub(a, b)))).toBe('0');

describe('символьный движок', () => {
  it('разбор: неявное умножение, греческие буквы латиницей, штрихи — производные', () => {
    same(S("m l^2 phi'^2/2"), S("1/2*m*l²*φ'^2"));
    same(S('mgl cos φ'), S('m*g*l*cos(φ)'));
    expect(parseSym('k x', ctx)).toMatchObject({ ok: false });
    expect(parseSym("m'", ctx)).toMatchObject({ ok: false });
  });
  it('частные производные и полная производная по времени', () => {
    const T = S("m (l + r φ)^2 φ'^2 / 2");
    same(d(T, { k: 'var', name: 'φ', ord: 1 }), S("m (l + r φ)^2 φ'"));
    same(d(S("m (l + r φ)^2 φ'"), { k: 'time', isCoord: (n) => n === 'x' || n === 'φ' }), S("m (l + r φ)^2 φ'' + 2 m r (l + r φ) φ'^2"));
    same(d(S('sin(2φ) + ln(l + x) + sqrt(l^2 - x^2)'), { k: 'var', name: 'x', ord: 0 }), S('1/(l + x) - x/sqrt(l^2 - x^2)'));
  });
  it('значение совпадает с численной производной', () => {
    const f = S('cos(φ)^3 tg(φ/2) + exp(-x) arctg(x φ)');
    const df = d(f, { k: 'var', name: 'φ', ord: 0 });
    const at = (φ: number) => evalSym(f, (n) => (n === 'φ' ? φ : n === 'x' ? 0.7 : 1));
    const h = 1e-6;
    expect(evalSym(df, (n) => (n === 'φ' ? 0.4 : n === 'x' ? 0.7 : 1))).toBeCloseTo((at(0.4 + h) - at(0.4 - h)) / (2 * h), 7);
  });
  it('sin² + cos² = 1 в кинетической энергии маятника в декартовых координатах', () => {
    const r = solve({ coords: [C('φ')], params: P({ m: 1, l: 1, g: 9.81 }), T: "m((l φ' cos φ)^2 + (l φ' sin φ)^2)/2", P: '-m g l cos φ', tEnd: 0 });
    expect(symText(r.T)).toBe('l²·m·φ̇²/2');
    expect(symText(r.rows[0].Ered)).toBe('l·φ̈ + g·sin φ');
  });
  void add;
});

describe('Мещерский 48.11: маятник на нити, навёрнутой на цилиндр', () => {
  const r = solve({ coords: [C('φ')], params: P({ m: 1, l: 1, r: 0.2, g: 9.81 }), T: "m(l + rφ)^2 φ'^2/2", P: '-m g (l + r φ) cos φ + m g r sin φ', tEnd: 5 });
  it('(l + rφ)φ̈ + rφ̇² + g sin φ = 0 после сокращения на m(l + rφ)', () => {
    expect(symText(r.rows[0].Ered)).toBe('(l + r·φ)·φ̈ + r·φ̇² + g·sin φ');
  });
  it('интеграл энергии сохраняется при интегрировании', () => expect(r.energyDrift!).toBeLessThan(1e-9));
  it('малые колебания: ω² = g/l', () => expect(r.small!.w2[0]).toBeCloseTo(9.81, 12));
});

describe('Мещерский 48.27: точка на вращающейся окружности', () => {
  const r = solve({ coords: [C('θ')], params: P({ m: 1, a: 1, ω: 2, g: 9.81 }), T: "m a^2 (θ'^2 + ω^2 sin^2 θ)/2", P: '-m g a cos θ', tEnd: 5 });
  it('θ̈ + (g/a − ω² cos θ) sin θ = 0', () => {
    expect(symText(r.rows[0].Ered)).toBe('a·θ̈ − a·ω²·sin θ·cos θ + g·sin θ');
    expect(symText(r.acc1!)).toBe('(a·ω²·cos θ − g)·sin θ/a');
  });
  it('сохраняется интеграл Якоби, а не T + Π', () => expect(r.energyDrift!).toBeLessThan(1e-9));
});

describe('Мещерский 48.28: точка в трубе-кольце, вращающемся под моментом M', () => {
  const r = solve({ coords: [C('theta'), C('phi', 0, 1, 'M')], params: P({ m: 1, a: 1, J: 2, M: 0.5, g: 9.81 }), T: "m a^2 (theta'^2 + phi'^2 sin^2 theta)/2 + J phi'^2/2", P: '-m g a cos theta', tEnd: 2 });
  it('уравнения как в ответе', () => {
    expect(symText(r.rows[0].Ered)).toBe('a·θ̈ − a·sin θ·cos θ·φ̇² + g·sin θ');
    expect(symText(r.rows[1].Ered)).toBe('J·φ̈ + a²·m·sin² θ·φ̈ + 2·a²·m·sin θ·cos θ·θ̇·φ̇ − M');
  });
  it('с моментом M энергия не сохраняется — проверка не делается', () => expect(r.energyDrift).toBeNull());
});

describe('Мещерский 48.37–48.38: эллиптический маятник', () => {
  const pr = (T: string): LagProblem => ({ coords: [C('x', 0, 0), C('φ', 0.2)], params: P({ m1: 2, m2: 1, l: 1, g: 9.81 }), T, P: '-m2 g l cos φ', tEnd: 5 });
  const r = solve(pr("(m1 + m2) x'^2/2 + m2 l x' φ' cos φ + m2 l^2 φ'^2/2"));
  it('уравнения', () => {
    expect(symText(r.rows[0].Ered)).toBe('(m₁ + m₂)·ẍ + l·m₂·cos φ·φ̈ − l·m₂·sin φ·φ̇²');
    expect(symText(r.rows[1].Ered)).toBe('cos φ·ẍ + l·φ̈ + g·sin φ');
  });
  it('период малых колебаний T = 2π√(m₁l/((m₁ + m₂)g))', () => {
    const w = Math.sqrt(r.small!.w2[1]);
    expect((2 * Math.PI) / w).toBeCloseTo(2 * Math.PI * Math.sqrt((2 * 1) / (3 * 9.81)), 12);
    expect(r.small!.w2[0]).toBeCloseTo(0, 12);
  });
  it('T в декартовых координатах даёт те же ускорения', () => {
    const r2 = solve(pr("m1 x'^2/2 + m2((x' + l φ' cos φ)^2 + (l φ' sin φ)^2)/2"));
    r2.acc0.forEach((a, i) => expect(a).toBeCloseTo(r.acc0[i], 12));
  });
});

describe('Мещерский 48.35: две массы на пружине', () => {
  const r = solve({ coords: [C('x1', 0, 1, '', 0), C('x2', 1, 0, '', 1)], params: P({ m1: 1, m2: 2, c: 10, l: 1 }), T: "m1 x1'^2/2 + m2 x2'^2/2", P: 'c (x2 - x1 - l)^2/2', tEnd: 5 });
  it('ω² = c(m₁ + m₂)/(m₁m₂), вторая частота нулевая (поступательное движение)', () => {
    expect(r.small!.residual).toBeCloseTo(0, 12);
    expect(r.small!.w2[0]).toBeCloseTo(0, 12);
    expect(r.small!.w2[1]).toBeCloseTo((10 * 3) / 2, 12);
  });
  it('центр масс движется равномерно: (m₁x₁ + m₂x₂) = v_c·t', () => {
    const { t, q } = r.sim!;
    const k = t.length - 1;
    expect(1 * q[0][k] + 2 * q[1][k] - (1 * 0 + 2 * 1)).toBeCloseTo(1 * t[k], 8);
  });
});

describe('ошибки ввода', () => {
  it('неизвестное обозначение и ускорение в T', () => {
    expect(solveLagrange({ coords: [C('x')], params: P({ m: 1 }), T: "m x'^2/2 + k", P: '', tEnd: 0 })).toMatchObject({ ok: false, field: 'T' });
    expect(solveLagrange({ coords: [C('x')], params: P({ m: 1 }), T: "m x''", P: '', tEnd: 0 })).toMatchObject({ ok: false, field: 'T' });
    expect(solveLagrange({ coords: [C('x')], params: P({ m: 1 }), T: "m x'^2/2", P: "x'", tEnd: 0 })).toMatchObject({ ok: false, field: 'P' });
    expect(solveLagrange({ coords: [C('x'), C('x')], params: [], T: "x'^2", P: '', tEnd: 0 })).toMatchObject({ ok: false, field: 'names' });
  });
});
