/** Пункт 30, «Колебания систем»: 54.10, 54.11, 54.23–54.26, 54.41. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { plotSvg, rk4, solveExtra } from '../src/shared/extra';
import { VIB_ASKS, rodOnThread, torsionAbsorber, twoPendulums, wirePendulums } from '../src/modules/vibration/model/extra';
import { eigenSym } from '../src/modules/vibration/model/linalg';
import { solveVib, type VibProblem } from '../src/modules/vibration/model/vibration';
import { defaultProblem, energy } from '../src/modules/vibration/presets';
import { VIB_EXTRA_PRESETS } from '../src/modules/vibration/extraPresets';
import { VibStore } from '../src/modules/vibration/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;
const G = 9.81;
const Q = (name: string, eq = 0) => ({ name, eq, q0: 0, v0: 0, H: '' });
const par = (o: Record<string, number>) => Object.entries(o).map(([name, value]) => ({ name, value }));
const viaEngine = (e: Parameters<typeof energy>[0]) => {
  const pr: VibProblem = { ...defaultProblem(), src: 'energy', energy: energy(e) };
  const r = solveVib(pr);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.modes.map((m) => m.k);
};

describe('готовые задачи пункта 30 («Колебания систем»)', () => {
  for (const [key, ps] of Object.entries(VIB_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(VIB_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
  it('второй экран открывается готовой задачей и сохраняется в файл проекта', () => {
    const s = new VibStore({});
    s.loadPreset('x5424');
    expect(s.get().view).toBe('extra');
    const f = s.exportProject(new Date('2026-10-26'));
    const t = new VibStore({});
    expect(t.importProject(f.text)).toBe(true);
    expect(t.get().extra.ask).toBe('twopend');
    expect(t.get().view).toBe('extra');
  });
});

describe('54.9–54.11: стержень на нити', () => {
  it('54.9 при l = L/2: k₁ = 0,677√(g/l), k₂ = 2,558√(g/l); формы 0,847 и −1,180', () => {
    const r = rodOnThread(1, 0.5, G)!;
    const k0 = Math.sqrt(G / 0.5);
    expect(r.k[0] / k0).toBeCloseTo(0.677, 3);
    expect(r.k[1] / k0).toBeCloseTo(2.558, 3);
    expect(r.mu[0]).toBeCloseTo(0.847, 3);
    expect(r.mu[1]).toBeCloseTo(-1.18, 2);
  });
  it('сверка с движком Лагранжа (T и Π нелинейные, линеаризация)', () => {
    const L = 1.3,
      l = 0.4;
    const k = viaEngine({
      coords: [Q('φ1'), Q('φ2')],
      params: par({ m: 1, L, l, g: G }),
      T: "m (l^2 φ1'^2 + L^2 φ2'^2/4 + l L φ1' φ2' cos(φ1 − φ2))/2 + m L^2 φ2'^2/24",
      P: '−m g (l cos φ1 + L cos φ2/2)',
    });
    const r = rodOnThread(L, l, G)!;
    expect(k[0]).toBeCloseTo(r.k[0], 8);
    expect(k[1]).toBeCloseTo(r.k[1], 8);
  });
  it('54.10: отношение → 1 − L/(4l) с ошибкой порядка (L/l)²', () => {
    let prev = Infinity;
    for (const e of [0.2, 0.1, 0.05, 0.025]) {
      const r = rodOnThread(e, 1, G)!;
      const err = Math.abs(r.k[0] / Math.sqrt(G) - (1 - e / 4));
      expect(err).toBeLessThan(0.5 * e * e);
      expect(err).toBeLessThan(prev);
      prev = err;
    }
  });
  it('54.11: отношение → 1 − 9l/(16L) с ошибкой порядка (l/L)²', () => {
    for (const e of [0.1, 0.05, 0.025]) {
      const r = rodOnThread(1, e, G)!;
      const err = Math.abs(r.k[0] / Math.sqrt((3 * G) / 2) - (1 - (9 / 16) * e));
      expect(err).toBeLessThan(3 * e * e);
    }
  });
});

describe('54.23: ползун с маятником', () => {
  it('при c = (P₁ + P₂)/l главные частоты равны; при других c — нет', () => {
    const base = VIB_EXTRA_PRESETS.x5423.problem;
    const a = solveExtra(VIB_ASKS, base, false);
    expect(a.vals.k1).toBeCloseTo(a.vals.k2, 10);
    const b = solveExtra(VIB_ASKS, { ...base, s: { find: 'check' }, n: { ...base.n, c: 2 * a.vals.cStar } }, false);
    expect(b.vals.k1 / b.vals.k2).toBeCloseTo(Math.SQRT2, 9);
  });
  it('независимо: энергия T, Π движка (с точным членом связи) даёт те же частоты', () => {
    const P1 = 20,
      P2 = 5,
      l = 0.5,
      c = 31;
    const k = viaEngine({
      coords: [Q('x'), Q('φ')],
      params: par({ m1: P1 / G, m2: P2 / G, l, c, g: G }),
      T: "(m1 + m2) x'^2/2 − m2 l x' φ' sin(φ) + m2 l^2 φ'^2/2",
      P: 'c x^2/2 − m2 g l cos φ',
    });
    expect(k[0]).toBeCloseTo(Math.min(Math.sqrt((c * G) / (P1 + P2)), Math.sqrt(G / l)), 8);
    expect(k[1]).toBeCloseTo(Math.max(Math.sqrt((c * G) / (P1 + P2)), Math.sqrt(G / l)), 8);
  });
  it('сопротивление: затухание h = b/(2m), без NaN', () => {
    const base = VIB_EXTRA_PRESETS.x5423.problem;
    const o = solveExtra(VIB_ASKS, { ...base, n: { ...base.n, b: 3 } }, true);
    expect(o.vals.h).toBeCloseTo(3 / (2 * (25 / G)), 9);
    expect(docHTML({ steps: o.steps })).not.toContain('NaN');
  });
});

describe('54.24: два маятника на пружине', () => {
  const R = 0.5,
    P = 10,
    c = 200,
    l0 = 0.6;
  it('равновесие: P tg α = c(l₀ − l), l = 2R sin α', () => {
    const r = twoPendulums(R, P, c, l0, G)!;
    expect(r.l).toBeCloseTo(2 * R * Math.sin(r.al), 12);
    expect(P * Math.tan(r.al)).toBeCloseTo(c * (l0 - r.l), 9);
  });
  it('частоты совпадают с линеаризацией Лагранжа около найденного равновесия (движок)', () => {
    const r = twoPendulums(R, P, c, l0, G)!;
    const k = viaEngine({
      coords: [Q('θ1', r.al), Q('θ2', r.al)],
      params: par({ m: P / G, R, c, l0, g: G, P }),
      T: "m R^2 (θ1'^2 + θ2'^2)/2",
      P: '−P R (cos θ1 + cos θ2) + c (2 R sin((θ1 + θ2)/2) − l0)^2/2',
    });
    const ka = Math.sqrt(r.ka2),
      ks = Math.sqrt(r.ks2);
    expect(k[0]).toBeCloseTo(Math.min(ka, ks), 7);
    expect(k[1]).toBeCloseTo(Math.max(ka, ks), 7);
  });
  it('пружина без напряжения (l₀ = l): стержни не откланяются от 2R sin α…', () => {
    // c → 0: α → 0, обе частоты → √(g/R)
    const r = twoPendulums(R, P, 1e-6, l0, G)!;
    expect(Math.sqrt(r.ka2)).toBeCloseTo(Math.sqrt(G / R), 3);
    expect(Math.sqrt(r.ks2)).toBeCloseTo(Math.sqrt(G / R), 3);
  });
});

describe('54.25: платформа с демпфером', () => {
  const base = VIB_EXTRA_PRESETS.x5425.problem;
  it('установившиеся амплитуды совпадают с интегрированием уравнений движения', () => {
    const [m1, m2, c1, c2, beta, a, p] = [2, 1, 400, 200, 5, 0.01, 10];
    const o = solveExtra(VIB_ASKS, base, false);
    const run = rk4(
      (t, y) => {
        const f = beta * (y[2] - y[3]);
        return [y[2], y[3], (c1 * (a * Math.sin(p * t) - y[0]) - c2 * (y[0] - y[1]) - f) / m1, (c2 * (y[0] - y[1]) + f) / m2];
      },
      [0, 0, 0, 0],
      0,
      40,
      40000,
    );
    // после затухания переходного процесса — амплитуда по последним двум секундам
    const tail = run.filter((s) => s.t > 38);
    expect(Math.max(...tail.map((s) => Math.abs(s.y[0])))).toBeCloseTo(o.vals.X1, 4);
    expect(Math.max(...tail.map((s) => Math.abs(s.y[1])))).toBeCloseTo(o.vals.X2, 4);
  });
  it('p → 0: обе амплитуды → a (платформа увлекает систему)', () => {
    const o = solveExtra(VIB_ASKS, { ...base, n: { ...base.n, p: 1e-3 } }, false);
    expect(o.vals.X1).toBeCloseTo(0.01, 6);
    expect(o.vals.X2).toBeCloseTo(0.01, 6);
  });
  it('произвольный ξ(t) формулой: ξ = 0,01 sin 10t даёт то же движение, что и режим установившихся колебаний (в конце)', () => {
    const o = solveExtra(VIB_ASKS, { ...base, s: { kind: 'formula', xi: '0,01*sin(10*t)' }, n: { ...base.n, T: 30 } }, true);
    expect(o.ok).toBe(true);
    expect(Math.abs(o.vals.x1)).toBeLessThan(0.05);
    expect(docHTML({ steps: o.steps })).not.toContain('NaN');
  });
  it('неверная формула — сообщение', () => {
    expect(solveExtra(VIB_ASKS, { ...base, s: { kind: 'formula', xi: 'sin(' } }, false).ok).toBe(false);
  });
});

describe('54.26: проволока с двумя маятниками', () => {
  it('точные частоты и приближение k ≈ √(g/l)(1 − μ/2), (1 − μ/6)', () => {
    const w = wirePendulums(1, 0.5, 0.6, 1000, G);
    const k0 = Math.sqrt(G / 0.5);
    // ошибка приближения — второго порядка по μ: (3/8)μ² и (1/24·…)μ²
    expect(Math.abs(w.kS - k0 * (1 - w.mu / 2))).toBeLessThan(0.4 * k0 * w.mu ** 2);
    expect(Math.abs(w.kA - k0 * (1 - w.mu / 6))).toBeLessThan(0.1 * k0 * w.mu ** 2);
  });
  it('интегрирование модели с массой проволоки → 0 даёт те же частоты (матричная проверка)', () => {
    // z = y + lφ, y = (m g a/P)Wφ, W = [[2,1],[1,2]]/3: (l I + (mga/P)W)φ̈ = −gφ
    const m = 1,
      l = 0.5,
      a = 0.6,
      P = 100;
    const mu = (m * G * a) / P;
    const Mx = [
      [l + (2 * mu) / 3, mu / 3],
      [mu / 3, l + (2 * mu) / 3],
    ];
    const Kx = [
      [G, 0],
      [0, G],
    ];
    const e = eigenSym(Kx, Mx)!;
    const w = wirePendulums(m, l, a, P, G);
    expect(Math.sqrt(e.lam[0])).toBeCloseTo(Math.min(w.kS, w.kA), 10);
    expect(Math.sqrt(e.lam[1])).toBeCloseTo(Math.max(w.kS, w.kA), 10);
  });
});

describe('54.41: маятниковый гаситель крутильных колебаний', () => {
  it('линеаризация совпадает с движком около равномерного вращения (T с членами Ω)', () => {
    const [J1, J2, Jc, m, l, a, c1, W] = [2, 1, 0.0005, 0.5, 0.2, 0.05, 500, 100];
    const { M, K } = torsionAbsorber(J1, J2, Jc, m, l, a, c1, W);
    const e = eigenSym(K, M)!;
    const mine = e.lam.map((x) => Math.sqrt(Math.max(0, x)));
    const k = viaEngine({
      coords: [Q('θ1'), Q('θ2'), Q('θ3')],
      params: par({ J1, J2, Jc, m, l, a, c1, W }),
      T: "J1 (W + θ1')^2/2 + (J2 + m l^2) (W + θ2')^2/2 + (Jc + m a^2) (W + θ3')^2/2 + m l a (W + θ2') (W + θ3') cos(θ2 − θ3)",
      P: 'c1 (θ2 − θ1)^2/2',
    });
    // движок отбрасывает нулевую частоту порядка: сверяем ненулевые
    const nz = (x: number[]) => x.filter((v) => v > 1e-6);
    expect(nz(k).length).toBe(2);
    nz(k).forEach((v, i) => expect(v).toBeCloseTo(nz(mine)[i], 5));
  });
  it('частота настройки обнуляет амплитуду массы II: θ₂ = 0 при p² = mlaΩ²/(J_C + ma²)', () => {
    const base = VIB_EXTRA_PRESETS.x5441.problem;
    const o = solveExtra(VIB_ASKS, base, false);
    const o2 = solveExtra(VIB_ASKS, { ...base, n: { ...base.n, p: o.vals.pTune } }, false);
    expect(o2.vals.th2).toBeLessThan(1e-9);
  });
  it('точечный маятник (J_C = 0): p_н = Ω√(l/a)', () => {
    const base = VIB_EXTRA_PRESETS.x5441.problem;
    const o = solveExtra(VIB_ASKS, { ...base, n: { ...base.n, Jc: 0 } }, false);
    expect(o.vals.pTune).toBeCloseTo(100 * Math.sqrt(0.2 / 0.05), 9);
  });
});
