/** Пункт 24, «Переменная масса»: §45 — общий вид уравнения, обратные и оптимизационные задачи, ротор, центр переменной массы. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { parseExtra, plotSvg, rk4, solveExtra } from '../src/shared/extra';
import { VARMASS_ASKS, aeroV2, centerOrbit, effic, pendulum, rocketLaw, rotorOmega, slopeRocket, softLanding, zOpt } from '../src/modules/varmass/model/extra';
import { VARMASS_EXTRA_PRESETS, type VarExtraKey } from '../src/modules/varmass/extraPresets';
import { VmStore } from '../src/modules/varmass/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;

describe('готовые задачи §45 (пункт 24)', () => {
  for (const [key, ps] of Object.entries(VARMASS_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(VARMASS_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
});

describe('независимая проверка', () => {
  it('45.3: интегрирование уравнения 45.2 даёт все три высоты книги (0,54; 5,65; 18,4 км)', () => {
    for (const [t, km, tol] of [
      [10, 0.54, 0.01],
      [30, 5.65, 0.005],
      [50, 18.4, 0.005],
    ] as const) {
      const c = rocketLaw('1 - t/100', '0', 2000, 9.81, 1000, 0, 0, t);
      if ('error' in c) throw new Error(c.error);
      expect(near(c.r[c.r.length - 1].y[0] / 1000, km, tol), `${t}: ${c.r[c.r.length - 1].y[0]}`).toBe(true);
    }
  });
  it('45.2: сопротивление R(x, v) входит в уравнение с верным знаком', () => {
    const a = rocketLaw('1 - t/100', '0', 2000, 9.81, 1000, 0, 0, 20);
    const b = rocketLaw('1 - t/100', '0,5*v^2', 2000, 9.81, 1000, 0, 0, 20);
    if ('error' in a || 'error' in b) throw new Error('разбор');
    expect(b.r[b.r.length - 1].y[1]).toBeLessThan(a.r[a.r.length - 1].y[1]);
  });
  it('45.1: без сопротивления и при m = const период малых колебаний 2π√(l/g)', () => {
    const c = pendulum('3', 9.81, 1, 0, 0.01, 0, 6);
    if ('error' in c) throw new Error(c.error);
    // φ(t) = φ₀cos(√(g/l)t): в t = T/4 ноль
    const q = (2 * Math.PI * Math.sqrt(1 / 9.81)) / 4;
    const r = pendulum('3', 9.81, 1, 0, 0.01, 0, q);
    if ('error' in r) throw new Error(r.error);
    expect(Math.abs(r.r[r.r.length - 1].y[0])).toBeLessThan(1e-5);
  });
  it('45.1: убывающая масса усиливает затухание', () => {
    const a = pendulum('2', 9.81, 1, 0.3, 0.3, 0, 10),
      b = pendulum('2 - 0,15t', 9.81, 1, 0.3, 0.3, 0, 10);
    if ('error' in a || 'error' in b) throw new Error('разбор');
    const amp = (r: { y: number[] }[]) => Math.max(...r.slice(-400).map((p) => Math.abs(p.y[0])));
    expect(amp(b.r)).toBeLessThan(amp(a.r));
  });
  it('45.30: скорость аэростата — по формуле книги и интегрированием уравнения 45.29', () => {
    const [Q, P, gam, beta, g, H0] = [1000, 1500, 5, 0.01, 9.81, 20];
    const r = rk4((_t, y) => [y[1], -g + (P * g) / (Q + gam * y[0]) - (((beta * g + gam) / (Q + gam * y[0])) * y[1] * y[1])], [H0, 0], 0, 12, 12000);
    for (let i = 1000; i <= 12000; i += 2200) {
      const [x, v] = r[i].y;
      expect(v * v).toBeCloseTo(aeroV2(Q, P, gam, beta, g, H0, x), 4);
    }
  });
  it('45.25: с найденным α скорость у поверхности нулевая (интегрирование)', () => {
    const [H, v0, ve, g, R] = [100000, 2000, 3000, 1.62, 1737000];
    const { alpha } = softLanding(H, v0, ve, g, R);
    const r = rk4((_t, y) => [y[1], -((g * R * R) / (R + y[0]) ** 2) + alpha * ve], [H, -v0], 0, 300, 300000);
    // корабль останавливается (v = 0) у самой поверхности: x в этот момент ≈ 0
    const i = r.findIndex((p) => p.y[1] >= 0);
    expect(i).toBeGreaterThan(0);
    expect(Math.abs(r[i].y[0])).toBeLessThan(5);
  });
  it('45.27: ракета на наклонной прямой — ускорение w и нулевое поперечное из интегрирования с тягой Φ под углом β', () => {
    const [w, al, H, ve, g] = [20, 45, 10000, 2500, 9.81];
    const s = slopeRocket(w, al, H, ve, g);
    const a = (al * Math.PI) / 180;
    // тяга на единицу массы: компоненты вдоль направления β от горизонта
    const fx = s.Fm * Math.cos(s.beta),
      fy = s.Fm * Math.sin(s.beta);
    expect(fx).toBeCloseTo(w * Math.cos(a), 9);
    expect(fy - g).toBeCloseTo(w * Math.sin(a), 9);
    // масса по закону m = m₀exp(−Fm·t/ve): к концу z = exp(Fm·t/ve)
    expect(s.z).toBeCloseTo(Math.exp((s.Fm * s.t) / ve), 12);
    // высота за время t: ½·w·sinα·t² = H
    expect(0.5 * w * Math.sin(a) * s.t * s.t).toBeCloseTo(H, 6);
  });
  it('45.36–45.37: ω(t) удовлетворяет J(t)·ω̇ = Rqv_e − M и = Rqv_e − bω', () => {
    const [Jp, m0, r, R, q, ve] = [0.02, 0.1, 0.05, 0.1, 0.01, 2000];
    const J = (t: number) => Jp + (m0 - q * t) * r * r;
    for (const [M, b] of [
      [0.05, 0],
      [0, 0.001],
    ]) {
      const sim = rk4((t, y) => [(R * q * ve - M - b * y[0]) / J(t)], [0], 0, m0 / q, 20000);
      expect(sim[sim.length - 1].y[0]).toBeCloseTo(rotorOmega(Jp, m0, r, R, q, ve, M, b, m0 / q), 6);
    }
  });
  it('45.35: замена ξ = x/(1 + αt), τ = t/(1 + αt) переводит движение в кеплерово (расхождение мало)', () => {
    const c = centerOrbit(1, 0.3, 1, 0, 0, 0.8, 3);
    expect(c.dev).toBeLessThan(1e-7);
    // та же орбита в (ξ, η): энергия сохраняется
    const E = (y: number[]) => 0.5 * (y[2] ** 2 + y[3] ** 2) - 1 / Math.hypot(y[0], y[1]);
    expect(E(c.xi[c.xi.length - 1].y)).toBeCloseTo(E(c.xi[0].y), 7);
  });
  it('45.35: тип орбиты по знаку энергии (эллипс, гипербола)', () => {
    expect(centerOrbit(1, 0.2, 1, 0, 0, 0.8, 5).kind).toBe('эллиптическая');
    expect(centerOrbit(1, 0.2, 1, 0, 0, 1.6, 5).kind).toBe('гиперболическая');
  });
  it('45.20: к.п.д. имеет единственный максимум при ln z = 2(z − 1)/z', () => {
    const z = zOpt();
    expect(effic(z)).toBeGreaterThan(effic(z * 0.9));
    expect(effic(z)).toBeGreaterThan(effic(z * 1.1));
    expect(Math.log(z)).toBeCloseTo((2 * (z - 1)) / z, 9);
  });
  it('неверные данные — ошибка, а не NaN', () => {
    for (const a of VARMASS_ASKS) {
      const out = solveExtra(VARMASS_ASKS, { ask: a.id, n: Object.fromEntries(Object.keys(a.n).map((k) => [k, -1])), s: a.s ?? {} }, true);
      expect(out.ok, a.id).toBe(false);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
    }
  });
  it('формула с ошибкой в законе массы — понятное сообщение', () => {
    const p = { ...VARMASS_EXTRA_PRESETS.x452.problem, s: { f: '1 - ', R: '0' } };
    const out = solveExtra(VARMASS_ASKS, p, true);
    expect(out.ok).toBe(false);
    expect(out.errors.join()).toContain('f(t)');
  });
});

describe('состояние: задачи пункта 24', () => {
  it('готовые задачи открываются на втором экране, файл проекта — без потерь', () => {
    const st = new VmStore();
    for (const k of Object.keys(VARMASS_EXTRA_PRESETS) as VarExtraKey[]) {
      st.loadPreset(k);
      expect(st.get().view).toBe('extra');
      const file = st.exportProject(new Date(2026, 9, 21));
      const st2 = new VmStore();
      expect(st2.importProject(file.text)).toBe(true);
      expect(st2.get().extra).toEqual(st.get().extra);
    }
  });
  it('смена вопроса не ломает ступени ракеты (setAsk — старый, setXAsk — новый)', () => {
    const st = new VmStore();
    st.loadPreset('x455');
    st.setXAsk('rotor');
    expect(st.get().extra.ask).toBe('rotor');
    st.setAsk('z');
    expect(st.get().problem.stages.ask).toBe('z');
    st.setView('main');
    expect(st.get().view).toBe('main');
  });
  it('старый файл открывается на основном экране', () => {
    const st = new VmStore();
    const file = JSON.parse(st.exportProject().text);
    delete file.extra;
    delete file.view;
    const st2 = new VmStore();
    st2.loadPreset('x455');
    expect(st2.importProject(JSON.stringify(file))).toBe(true);
    expect(st2.get().view).toBe('main');
  });
  it('разбор: недостающие поля — по умолчанию', () => {
    const r = parseExtra({ ask: 'rotor', n: { q: 0.5 }, s: {} }, VARMASS_ASKS);
    expect(r?.n.q).toBe(0.5);
    expect(r?.s.drag).toBe('const');
  });
});
