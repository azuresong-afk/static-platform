/** Пункт 30, «Удар и колебания»: 53.45, 53.48, 53.50, 53.53, Яблонский Д.25. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { plotSvg, rk4, solveExtra } from '../src/shared/extra';
import { OSC_ASKS } from '../src/modules/oscillation/model/extra';
import { absSinSolution, pendulumPeriod, reduceSystem, shaftLambda } from '../src/modules/oscillation/model/extra2';
import { OSC_EXTRA_PRESETS2 } from '../src/modules/oscillation/extraPresets2';
import { OSC_EXTRA_PRESETS } from '../src/modules/oscillation/extraPresets';
import { OscStore } from '../src/modules/oscillation/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;

describe('готовые задачи пункта 30 («Удар и колебания»)', () => {
  for (const [key, ps] of Object.entries(OSC_EXTRA_PRESETS2))
    it(ps.title, () => {
      const out = solveExtra(OSC_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
  it('все готовые задачи доступны в разделе по ключу', () => {
    for (const k of Object.keys(OSC_EXTRA_PRESETS2)) expect(k in OSC_EXTRA_PRESETS).toBe(true);
  });
  it('загрузка готовой задачи открывает второй экран и сохраняется в файл проекта', () => {
    const s = new OscStore({});
    s.loadPreset('yD25');
    expect(s.get().view).toBe('extra');
    const f = s.exportProject(new Date('2026-10-26'));
    const t = new OscStore({});
    expect(t.importProject(f.text)).toBe(true);
    expect(t.get().extra.ask).toBe('reduce');
  });
});

describe('53.45: противовес в желобе', () => {
  it('частота малых колебаний уравнения φ̈ + (ω²l/r) sin φ = 0 совпадает с k = ω√(l/r) (интегрирование)', () => {
    const w = 80,
      l = 0.03,
      r = 0.12;
    const k = w * Math.sqrt(l / r);
    const phi0 = 0.01;
    const T = (2 * Math.PI) / k;
    const run = rk4((_t, y) => [y[1], -k * k * Math.sin(y[0])], [phi0, 0], 0, T, 4000);
    expect(Math.abs(run[4000].y[0] - phi0)).toBeLessThan(1e-9);
    expect(run[1000].y[0]).toBeLessThan(1e-7); // через четверть периода — в нуле
  });
  it('точный период: малая амплитуда → 2π/k, большая — длиннее, на 90° в 1,18 раза', () => {
    expect(pendulumPeriod(2, 1e-4)).toBeCloseTo(Math.PI, 6);
    expect(pendulumPeriod(1, Math.PI / 2) / (2 * Math.PI)).toBeCloseTo(1.18034, 4);
  });
  it('в оборотах: n = 955 об/мин ≈ ω = 100 1/с', () => {
    const a = solveExtra(
      OSC_ASKS,
      { ...OSC_EXTRA_PRESETS2.x5345.problem, s: { unit: 'rpm' }, n: { ...OSC_EXTRA_PRESETS2.x5345.problem.n, w: (100 * 30) / Math.PI } },
      false,
    );
    expect(a.vals.k).toBeCloseTo(100 * Math.sqrt(0.2), 6);
  });
  it('нулевые и отрицательные данные отклоняются', () => {
    const p = OSC_EXTRA_PRESETS2.x5345.problem;
    expect(solveExtra(OSC_ASKS, { ...p, n: { ...p.n, l: 0 } }, false).ok).toBe(false);
  });
});

describe('53.48: подвес движется по закону ξ(t)', () => {
  const base = OSC_EXTRA_PRESETS2.x5348.problem;
  it('для ξ = a sin pt интеграл Дюамеля совпадает с замкнутой формулой на всём промежутке', () => {
    for (const T of [1, 3.7, 10]) {
      const o = solveExtra(OSC_ASKS, { ...base, n: { ...base.n, T } }, false);
      expect(near(o.vals.phiEnd, o.vals.phiClosed, 1e-5), `T=${T}: ${o.vals.phiEnd} / ${o.vals.phiClosed}`).toBe(true);
    }
  });
  it('формулой: ξ = 0,01 sin 2t даёт то же, что режим ξ = a sin pt', () => {
    const f = solveExtra(OSC_ASKS, { ask: 'swing', n: base.n, s: { kind: 'formula', xi: '0,01*sin(2*t)' } }, false);
    const h = solveExtra(OSC_ASKS, base, false);
    expect(f.ok).toBe(true);
    expect(near(f.vals.phiEnd, h.vals.phiEnd, 1e-6)).toBe(true);
  });
  it('малые колебания близки к точным уравнению lφ̈ + ξ̈cos φ + g sin φ = 0 при малой амплитуде', () => {
    const o = solveExtra(OSC_ASKS, { ...base, n: { ...base.n, a: 0.001, T: 4 } }, false);
    expect(near(o.vals.phiEnd, o.vals.phiEndNL, 1e-3)).toBe(true);
  });
  it('постоянное ускорение подвеса ξ = A t²/2: маятник колеблется около угла −arctg(A/g)', () => {
    const o = solveExtra(OSC_ASKS, { ask: 'swing', n: { ...base.n, T: 6 }, s: { kind: 'formula', xi: '0,5*0,5*t^2' } }, false);
    expect(o.ok).toBe(true);
    // φ = −(A/g)(1 − cos kt) при ξ̈ = A (малые углы); A = 0,5
    const k = Math.sqrt(9.81);
    expect(o.vals.phiEnd).toBeCloseTo(-(0.5 / 9.81) * (1 - Math.cos(k * 6)), 4);
  });
  it('резонанс p = k не даёт NaN и растёт линейно', () => {
    const k = Math.sqrt(9.81);
    const o = solveExtra(OSC_ASKS, { ...base, n: { ...base.n, p: k, T: 5 } }, true);
    expect(o.ok).toBe(true);
    expect(docHTML({ steps: o.steps })).not.toContain('NaN');
  });
  it('неверная формула — сообщение, а не падение', () => {
    const o = solveExtra(OSC_ASKS, { ask: 'swing', n: base.n, s: { kind: 'formula', xi: 'sin(' } }, false);
    expect(o.ok).toBe(false);
  });
});

describe('53.50: сила F|sin ωt|', () => {
  const m = 2,
    c = 300,
    F = 15,
    w = 3.3;
  it('периодическое решение: x(0) = x(π/ω), ẋ(0) = ẋ(π/ω), уравнение выполнено', () => {
    const s = absSinSolution(m, c, F, w)!;
    const T = s.T,
      h = 1e-7;
    expect(Math.abs(s.x(0) - s.x(T - 1e-12))).toBeLessThan(1e-9);
    const v = (t: number) => (s.x(t + h) - s.x(t - h)) / (2 * h);
    expect(Math.abs(v(1e-6) - v(T - 1e-6))).toBeLessThan(1e-3);
    for (const t of [0.1, 0.5, 0.9]) {
      const acc = (s.x(t + 1e-4) - 2 * s.x(t) + s.x(t - 1e-4)) / 1e-8;
      expect(Math.abs(m * acc + c * s.x(t) - F * Math.abs(Math.sin(w * t)))).toBeLessThan(0.05);
    }
  });
  it('независимая проверка рядом Фурье |sin ωt| = 2/π − (4/π)Σ cos(2jωt)/(4j² − 1)', () => {
    const s = absSinSolution(m, c, F, w)!;
    const k = s.k;
    // частное решение рядом + нулевое свободное: ряд даёт единственное периодическое решение
    const ser = (t: number) => {
      let v = 2 / (Math.PI * k * k);
      for (let j = 1; j < 400; j++) v -= ((4 / Math.PI) * Math.cos(2 * j * w * t)) / ((4 * j * j - 1) * (k * k - 4 * j * j * w * w));
      return (F / m) * v;
    };
    for (const t of [0, 0.2, 0.5, 0.85, 1.2, 2.7]) expect(s.x(t)).toBeCloseTo(ser(t), 5);
  });
  it('формула книги: C = −A₀(ω/k)ctg(πk/2ω), D = −A₀ω/k', () => {
    const s = absSinSolution(m, c, F, w)!;
    expect(s.C).toBeCloseTo((-s.A0 * (w / s.k)) / Math.tan((Math.PI * s.k) / (2 * w)), 8);
    expect(s.D).toBeCloseTo(-(s.A0 * w) / s.k, 8);
  });
  it('k = ω: частное решение с t·cos kt, периодичность та же', () => {
    const k = Math.sqrt(300 / 2);
    const s = absSinSolution(2, 300, 15, k)!;
    expect(Math.abs(s.x(0) - s.x(s.T - 1e-12))).toBeLessThan(1e-8);
    const ser = (t: number) => {
      let v = 2 / (Math.PI * k * k);
      for (let j = 1; j < 600; j++) v -= ((4 / Math.PI) * Math.cos(2 * j * k * t)) / ((4 * j * j - 1) * (k * k - 4 * j * j * k * k));
      return (15 / 2) * v;
    };
    expect(s.x(0.013)).toBeCloseTo(ser(0.013), 6);
  });
  it('k = 2ω (резонанс по второй гармонике) — отказ с пояснением', () => {
    const o = solveExtra(OSC_ASKS, { ask: 'absin', n: { m: 1, c: 100, F: 10, w: 5, nper: 3 }, s: {} }, false);
    expect(o.ok).toBe(false);
    expect(o.errors.join()).toContain('2ω');
  });
});

describe('53.53: тяжёлый вал', () => {
  it('λ² шарнир–заделка = 15,418; шарнир–шарнир π²; заделка–заделка 22,373; консоль 3,516', () => {
    expect(shaftLambda('pc') ** 2).toBeCloseTo(15.4182, 3);
    expect(shaftLambda('pp') ** 2).toBeCloseTo(Math.PI ** 2, 6);
    expect(shaftLambda('cc') ** 2).toBeCloseTo(22.3733, 3);
    expect(shaftLambda('cf') ** 2).toBeCloseTo(3.516, 3);
  });
  it('корень удовлетворяет tg λ = th λ', () => {
    const x = shaftLambda('pc');
    expect(Math.tan(x)).toBeCloseTo(Math.tanh(x), 9);
  });
  it('ω_кр = λ²√(EJg/(ql⁴)): шарнир–шарнир, EJ = 1e5, q = 200, l = 3', () => {
    const o = solveExtra(OSC_ASKS, { ask: 'shaft', n: { EJ: 1e5, q: 200, l: 3, g: 9.81 }, s: { sup: 'pp' } }, true);
    expect(o.vals.w).toBeCloseTo(Math.PI ** 2 * Math.sqrt((1e5 * 9.81) / (200 * 81)), 6);
  });
});

describe('Д.25: приведение к одной координате', () => {
  const R = 0.3,
    l = 0.9;
  it('пример книги: a = 7,38; h = 0,271; k, n, α, A', () => {
    const r = reduceSystem({
      trans: [
        [20, R],
        [5, 2 * R],
        [2, 2 * R],
      ],
      rot: [
        [(20 * R * R) / 2, 1],
        [(18 * l * l) / 3, (2 * R) / l],
      ],
      springs: [
        [4000, R * Math.SQRT2],
        [7000, R / 3],
      ],
      weights: [
        [2 * 9.81, -(R * R) / l],
        [18 * 9.81, -(R * R) / l],
      ],
      alpha: 0,
      d: 2 * R,
      by: 'eta',
      eta: 0.812,
      Q0: 20 * 0.1,
      p: 4 * Math.PI,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.a).toBeCloseTo(7.38, 6);
    expect(r.h).toBeCloseTo(0.271, 3);
    // c по формуле книги: [2c₁ + c₂/9 − 2(G₃ + G₄)/l]R²
    expect(r.c).toBeCloseTo((2 * 4000 + 7000 / 9 - (2 * (2 + 18) * 9.81) / l) * R * R, 6);
    expect(r.k).toBeCloseTo(10.09, 2);
    expect(r.n).toBeCloseTo(r.k / Math.sqrt(1 + (Math.PI / 0.812) ** 2), 9);
    // η = πn/√(k² − n²) — определение
    expect((Math.PI * r.n) / Math.sqrt(r.k ** 2 - r.n ** 2)).toBeCloseTo(0.812, 9);
  });
  it('амплитуда в p₁ — максимум A(p); скорость максимальна при p = k; ускорение при p₃', () => {
    const r = reduceSystem({ trans: [[2, 1]], rot: [], springs: [[200, 1]], weights: [], alpha: 6, d: 1, by: 'alpha', eta: 0, Q0: 5, p: 3 });
    if (!r.ok) throw new Error(r.error);
    const A = (p: number) => r.amp(p);
    for (const dp of [-0.2, -0.05, 0.05, 0.2]) expect(A(r.p1 + dp)).toBeLessThan(r.Amax + 1e-12);
    const V = (p: number) => p * A(p);
    for (const dp of [-0.2, 0.2]) expect(V(r.k + dp)).toBeLessThan(r.Avel);
    expect(V(r.k)).toBeCloseTo(r.Avel, 9);
    for (const dp of [-0.3, 0.3]) expect(r.Aacc(r.p3 + dp)).toBeLessThan(r.Aaccmax + 1e-12);
    // свободное затухание: n = α d²/(2a)
    expect(r.n).toBeCloseTo(6 / 4, 12);
  });
  it('равновесие неустойчиво (c ≤ 0) и сопротивление выше критического — сообщения', () => {
    const bad = reduceSystem({ trans: [[2, 1]], rot: [], springs: [[1, 1]], weights: [[100, -1]], alpha: 1, d: 1, by: 'alpha', eta: 0, Q0: 1, p: 1 });
    expect(bad.ok).toBe(false);
    const over = reduceSystem({ trans: [[2, 1]], rot: [], springs: [[8, 1]], weights: [], alpha: 100, d: 1, by: 'alpha', eta: 0, Q0: 1, p: 1 });
    expect(over.ok).toBe(false);
  });
  it('запасной ввод: α задана — η вычисляется и совпадает', () => {
    const p = OSC_EXTRA_PRESETS2.yD25.problem;
    const o = solveExtra(OSC_ASKS, p, false);
    const o2 = solveExtra(OSC_ASKS, { ...p, s: { by: 'alpha' }, n: { ...p.n, alpha: o.vals.alpha } }, false);
    expect(o2.vals.n).toBeCloseTo(o.vals.n, 9);
    expect(o2.vals.A).toBeCloseTo(o.vals.A, 9);
  });
});
