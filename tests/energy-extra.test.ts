/** Пункт 24, «Кинетическая энергия»: нить, трос, падающие тела, J·dω/dt — ответы Мещерского §38 и независимая проверка. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { plotSvg, rk4, solveExtra, parseExtra } from '../src/shared/extra';
import { ENERGY_ASKS, fallRod, jw, ladder, pulley, tableRope } from '../src/modules/energy/model/extra';
import { ENERGY_EXTRA_PRESETS, type EnergyExtraKey } from '../src/modules/energy/extraPresets';
import { EnergyStore } from '../src/modules/energy/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;
const G = 9.81;

describe('готовые задачи §38 (пункт 24)', () => {
  for (const [key, ps] of Object.entries(ENERGY_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(ENERGY_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
});

describe('независимая проверка', () => {
  it('38.18 с трением: интегрирование x″ = (g/L)((1 + f)x − fL) приходит в x = L за T', () => {
    const L = 2,
      l = 0.5,
      f = 0.3;
    const { T, v } = tableRope(L, l, f);
    const r = rk4((_t, y) => [y[1], (G / L) * ((1 + f) * y[0] - f * L)], [l, 0], 0, T, 4000);
    const e = r[r.length - 1].y;
    expect(e[0]).toBeCloseTo(L, 6);
    expect(e[1]).toBeCloseTo(v, 5);
  });
  it('38.15: при h = h_max скорость нулевая, а дальше — нет (v² < 0)', () => {
    const { hmax } = pulley(1.5, 1, 1, 0);
    expect(pulley(1.5, 1, 1, hmax).v2).toBeCloseTo(0, 9);
    expect(pulley(1.5, 1, 1, hmax * 1.1).v2).toBeLessThan(0);
  });
  it('38.35: уравнение Лагранжа для стержня даёт ту же скорость центра и реакцию пола', () => {
    const a = 1,
      P = 1,
      h = 0.5;
    let ph = 1e-5,
      w = 0,
      t = 0;
    const dt = 1e-4;
    const f = (y: number[]) => {
      const s = Math.sin(y[0]),
        c = Math.cos(y[0]);
      return [y[1], (3 * G * s) / a / (1 + 3 * s * s) - (3 * s * c * y[1] * y[1]) / (1 + 3 * s * s)];
    };
    let y = [ph, w];
    while (a * Math.cos(y[0]) > h && t < 20) {
      const k1 = f(y),
        k2 = f(y.map((v, i) => v + (dt / 2) * k1[i])),
        k3 = f(y.map((v, i) => v + (dt / 2) * k2[i])),
        k4 = f(y.map((v, i) => v + dt * k3[i]));
      y = y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      t += dt;
    }
    const s = Math.sin(y[0]),
      c = Math.cos(y[0]);
    const phdd = f(y)[1];
    const N = P * (1 + (-a * (s * phdd + c * y[1] * y[1])) / G);
    const r = fallRod(a, a * c, P);
    expect(a * s * y[1]).toBeCloseTo(r.vC, 3);
    expect(N).toBeCloseTo(r.N, 3);
  });
  it('38.34: кинетическая энергия стороны по координатам центра тяжести совпадает с (l² + ρ²)θ̇²/2', () => {
    const l = 1,
      rho = 0.5,
      th = 0.7,
      d = 1e-6;
    const D = (q: number): [number, number] => [-l * Math.sin(q), l * Math.cos(q)];
    const [x1, y1] = D(th - d),
      [x2, y2] = D(th + d);
    const v2 = (((x2 - x1) / (2 * d)) ** 2 + ((y2 - y1) / (2 * d)) ** 2);
    expect(v2 + rho * rho).toBeCloseTo(l * l + rho * rho, 6);
    // реакция пола: N = P(1 + ÿ_D/g) совпадает с численным вторым производным y_D(t) при θ̈ = g l sinθ/(l² + ρ²)
    const h0 = 1.5,
      h = 1;
    const e = ladder(l, rho, h0, h, 1);
    const k = l * l + rho * rho;
    const yD = (q: number) => l * Math.cos(q);
    const w2 = (G * (h0 - h)) / k;
    const dd = 1e-5;
    const q0 = e.th;
    // y(θ(t)): ÿ = y″(θ)·θ̇² + y′(θ)·θ̈
    const ypp = (yD(q0 + dd) - 2 * yD(q0) + yD(q0 - dd)) / (dd * dd),
      yp = (yD(q0 + dd) - yD(q0 - dd)) / (2 * dd);
    expect(1 + (ypp * w2 + yp * ((G * l * Math.sin(q0)) / k)) / G).toBeCloseTo(e.N, 5);
  });
  it('38.51: J_пр совпадает с кинетической энергией по скоростям звеньев', () => {
    const R = 0.3,
      r = 0.1,
      m = 2,
      M = 1;
    const { J } = jw({ hypo: false, P: m, Q: M, R, r, M0: 0, alpha: 0, Mfr: 0, w0: 0, t: 0, byWeight: false });
    const w = 1;
    const T = 0.5 * ((m * (R + r) ** 2) / 3) * w * w + 0.5 * M * ((R + r) * w) ** 2 + 0.5 * ((M * r * r) / 2) * (((R + r) * w) / r) ** 2;
    expect(J).toBeCloseTo(2 * T, 12);
  });
  it('38.51: ω(t) удовлетворяет J·dω/dt = M₀ − αω − M_тр·R/r', () => {
    const p = ENERGY_EXTRA_PRESETS.x3851.problem;
    const n: Record<string, number> = { ...p.n, Mfr: 0.2 };
    const c = jw({ hypo: false, P: n.P, Q: n.Q, R: n.R, r: n.r, M0: n.M0, alpha: n.alpha, Mfr: n.Mfr, w0: 0, t: 0, byWeight: false });
    const r = rk4((_t, y) => [(n.M0 - n.alpha * y[0] - (n.Mfr * n.R) / n.r) / c.J], [0], 0, 1, 2000);
    const out = solveExtra(ENERGY_ASKS, { ...p, n }, false);
    expect(out.vals.w).toBeCloseTo(r[r.length - 1].y[0], 6);
  });
  it('38.53: время торможения — интегрирование J·dω/dt = −M_тр·R/r', () => {
    const p = ENERGY_EXTRA_PRESETS.x3853.problem;
    const out = solveExtra(ENERGY_ASKS, p, false);
    const c = jw({ hypo: true, P: p.n.P, Q: p.n.Q, R: p.n.R, r: p.n.r, M0: 0, alpha: 0, Mfr: p.n.Mfr, w0: 0, t: 0, byWeight: false });
    const dec = (p.n.Mfr * p.n.R) / p.n.r / c.J;
    expect(out.vals.tau).toBeCloseTo(p.n.w0 / dec, 9);
    expect(out.vals.phi).toBeCloseTo((p.n.w0 * p.n.w0) / (2 * dec), 9);
  });
  it('неверные данные — понятная ошибка, а не NaN', () => {
    for (const a of ENERGY_ASKS) {
      const out = solveExtra(ENERGY_ASKS, { ask: a.id, n: Object.fromEntries(Object.keys(a.n).map((k) => [k, -1])), s: a.s ?? {} }, true);
      expect(out.ok).toBe(false);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
    }
  });
});

describe('состояние: задачи пункта 24', () => {
  it('готовые задачи открываются на втором экране, файл проекта — без потерь', () => {
    const st = new EnergyStore();
    for (const k of Object.keys(ENERGY_EXTRA_PRESETS) as EnergyExtraKey[]) {
      st.loadPreset(k);
      expect(st.get().view).toBe('extra');
      const file = st.exportProject(new Date(2026, 9, 21));
      const st2 = new EnergyStore();
      expect(st2.importProject(file.text)).toBe(true);
      expect(st2.get().extra).toEqual(st.get().extra);
      expect(st2.get().view).toBe('extra');
    }
  });
  it('ввод, смена вопроса и отмена', () => {
    const st = new EnergyStore();
    st.loadPreset('x3835');
    st.typeNum('h', 0.25);
    expect(st.get().extra.n.h).toBe(0.25);
    st.setXAsk('table');
    expect(st.get().extra.ask).toBe('table');
    st.undo();
    expect(st.get().extra.ask).toBe('rod');
  });
  it('старый файл (только problem) открывается на основном экране', () => {
    const st = new EnergyStore();
    const file = JSON.parse(st.exportProject().text);
    delete file.extra;
    delete file.view;
    const st2 = new EnergyStore();
    st2.loadPreset('x3835');
    expect(st2.importProject(JSON.stringify(file))).toBe(true);
    expect(st2.get().view).toBe('main');
  });
  it('разбор: лишнее отбрасывается, недостающее — по умолчанию', () => {
    const r = parseExtra({ ask: 'rod', n: { a: 2 }, s: {} }, ENERGY_ASKS);
    expect(r?.n.a).toBe(2);
    expect(r?.n.P).toBe(1);
    expect(parseExtra({ ask: 'нет', n: {}, s: {} }, ENERGY_ASKS)).toBeNull();
  });
});
