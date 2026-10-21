/** Пункт 24, «Динамика точки»: §27 — сила по пути и скорости, несколько центров, постоянная сила, баллистика, наклонная плоскость. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { parseExtra, plotSvg, rk4, solveExtra } from '../src/shared/extra';
import { POINT_EXTRA_ASKS, centers, parseTable, shell } from '../src/modules/pointdyn/model/extra';
import { POINT_EXTRA_PRESETS, type PointExtraKey } from '../src/modules/pointdyn/extraPresets';
import { PointStore } from '../src/modules/pointdyn/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;

describe('готовые задачи §27 (пункт 24)', () => {
  for (const [key, ps] of Object.entries(POINT_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(POINT_EXTRA_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
});

describe('независимая проверка', () => {
  it('27.39: интегрирование v̇ = v·dv/dx из x = a√(v − b) даёт то же время', () => {
    const [a, b, v0] = [2, 1, 2];
    // x(t): v = b + x²/a², dv/dt = (2x/a²)·ẋ, ẋ = v ⇒ ẍ = ... проще: dx/dt = v(x) = b + x²/a²
    const x0 = a * Math.sqrt(v0 - b);
    const r = rk4((_t, y) => [b + (y[0] * y[0]) / (a * a)], [x0], 0, 0.6, 6000);
    const target = 2 * v0;
    const i = r.findIndex((p) => b + (p.y[0] * p.y[0]) / (a * a) >= target);
    const out = solveExtra(POINT_EXTRA_ASKS, POINT_EXTRA_PRESETS.x2739.problem, false);
    expect(r[i].t).toBeCloseTo(out.vals.t, 3);
  });
  it('27.39: сила F = 2mv√(v − b)/a совпадает с m·v·dv/dx', () => {
    const out = solveExtra(POINT_EXTRA_ASKS, POINT_EXTRA_PRESETS.x2739.problem, false);
    expect(out.vals.F0).toBeCloseTo((2 * 1 * 2 * Math.sqrt(2 - 1)) / 2, 5);
    expect(out.vals.F1).toBeCloseTo((2 * 1 * 4 * Math.sqrt(4 - 1)) / 2, 5);
  });
  it('27.39: функция, не возрастающая по v, — понятная ошибка', () => {
    const p = { ...POINT_EXTRA_PRESETS.x2739.problem, s: { X: '10 - v' } };
    expect(solveExtra(POINT_EXTRA_ASKS, p, false).ok).toBe(false);
  });
  it('27.60: интегрирование уравнений движения с двумя центрами даёт x = a + bt, y = a·cos(√(2k)t)', () => {
    const p = POINT_EXTRA_PRESETS.x2760.problem.n;
    const k = 1,
      a = 1,
      b = 0.5;
    const r = rk4((t, y) => [y[2], y[3], -k * y[0] - k * (y[0] - 2 * (a + b * t)), -k * y[1] - k * y[1]], [p.x0, p.y0, p.vx0, p.vy0], 0, 3, 6000);
    const e = r[r.length - 1];
    expect(e.y[0]).toBeCloseTo(a + b * 3, 6);
    expect(e.y[1]).toBeCloseTo(a * Math.cos(Math.sqrt(2 * k) * 3), 6);
  });
  it('27.59: n центров ⇒ эллипс с центром в точке, взвешенной по kᵢ; по формуле решения и интегрированием совпадают', () => {
    const P = {
      nc: 3,
      k: [1, 2, 3],
      cx: [0, 4, -2],
      cy: [1, 0, 3],
      wx: [0, 0, 0],
      wy: [0, 0, 0],
      fx: 0,
      fy: 0,
      x0: 1,
      y0: 2,
      vx0: 0.3,
      vy0: -0.7,
    };
    const c = centers(P);
    expect(c.c0[0]).toBeCloseTo((0 + 8 - 6) / 6, 12);
    const r = rk4(
      (_t, y) => {
        let ax = 0,
          ay = 0;
        for (let i = 0; i < 3; i++) {
          ax += P.k[i] * (P.cx[i] - y[0]);
          ay += P.k[i] * (P.cy[i] - y[1]);
        }
        return [y[2], y[3], ax, ay];
      },
      [P.x0, P.y0, P.vx0, P.vy0],
      0,
      5,
      10000,
    );
    const e = r[r.length - 1];
    const [x, y] = c.pos(5);
    expect(e.y[0]).toBeCloseTo(x, 7);
    expect(e.y[1]).toBeCloseTo(y, 7);
    // траектория замкнута: через период возвращается в начало
    expect(c.pos(c.T)[0]).toBeCloseTo(P.x0, 9);
    // площадь эллипса πab = π|A × B|
    expect(c.a * c.b).toBeCloseTo(Math.abs(c.A[0] * c.B[1] - c.A[1] * c.B[0]), 9);
  });
  it('27.66: при c₁/c = 2 траектория проходит через центр O, скорость там равна v₀', () => {
    const out = solveExtra(POINT_EXTRA_ASKS, POINT_EXTRA_PRESETS.x2766.problem, false);
    expect(out.vals.dmin).toBeLessThan(1e-3);
    expect(out.vals.vmin).toBeCloseTo(1.5, 3);
  });
  it('27.66: при c₁/c = 3 до центра не доходит (наименьшее расстояние = r₀(1 − 2c/c₁)... > 0)', () => {
    const p = { ...POINT_EXTRA_PRESETS.x2766.problem, n: { ...POINT_EXTRA_PRESETS.x2766.problem.n, k1: 3 } };
    expect(solveExtra(POINT_EXTRA_ASKS, p, false).vals.dmin).toBeGreaterThan(0.1);
  });
  it('27.41: без сопротивления численный расчёт совпадает с v₀²sin²α/(2g), v₀²sin2α/g', () => {
    const s = shell(700, 45, 9.81, null);
    expect(s.H).toBeCloseTo((700 * 700 * 0.5) / (2 * 9.81), 0);
    expect(s.L).toBeCloseTo((700 * 700) / 9.81, 0);
  });
  it('27.41: с сопротивлением выше и дальше не летит; вес снаряда в таблице замедлений не нужен', () => {
    const tab = parseTable('0:0; 350:10; 700:40');
    if (typeof tab === 'string') throw new Error(tab);
    const r = shell(700, 45, 9.81, tab),
      v = shell(700, 45, 9.81, null);
    expect(r.H).toBeLessThan(v.H);
    expect(r.L).toBeLessThan(v.L);
    expect(typeof parseTable('1:2')).toBe('string');
    expect(typeof parseTable('0:0; 0:1')).toBe('string');
  });
  it('27.64: найденные v₁ и T удовлетворяют уравнениям равновесия в проекциях', () => {
    const out = solveExtra(POINT_EXTRA_ASKS, POINT_EXTRA_PRESETS.x2764.problem, false);
    const tga = 1 / 30,
      f = 0.1,
      W = 300,
      v2 = 12;
    const a = Math.atan(tga);
    const v = Math.hypot(out.vals.v1, v2);
    const F = f * W * Math.cos(a);
    expect(F * (out.vals.v1 / v)).toBeCloseTo(W * Math.sin(a), 8);
    expect(F * (v2 / v)).toBeCloseTo(out.vals.T, 8);
  });
  it('27.64: при tg α ≥ f — ошибка', () => {
    const p = { ...POINT_EXTRA_PRESETS.x2764.problem, n: { ...POINT_EXTRA_PRESETS.x2764.problem.n, tga: 0.2 } };
    expect(solveExtra(POINT_EXTRA_ASKS, p, false).ok).toBe(false);
  });
  it('неверные данные — ошибка, а не NaN', () => {
    for (const a of POINT_EXTRA_ASKS) {
      const out = solveExtra(POINT_EXTRA_ASKS, { ask: a.id, n: Object.fromEntries(Object.keys(a.n).map((k) => [k, -1])), s: a.s ?? {} }, true);
      expect(out.ok, a.id).toBe(false);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
    }
  });
});

describe('состояние: задачи пункта 24', () => {
  it('готовые задачи открываются на втором экране, файл проекта — без потерь', () => {
    const st = new PointStore();
    for (const k of Object.keys(POINT_EXTRA_PRESETS) as PointExtraKey[]) {
      st.loadPreset(k);
      expect(st.get().view).toBe('extra');
      const file = st.exportProject(new Date(2026, 9, 21));
      const st2 = new PointStore();
      expect(st2.importProject(file.text)).toBe(true);
      expect(st2.get().extra).toEqual(st.get().extra);
      expect(st2.get().view).toBe('extra');
    }
  });
  it('ввод, смена вопроса, число центров и отмена', () => {
    const st = new PointStore();
    st.loadPreset('x2765');
    st.typeXNum('vy0', 5);
    expect(st.get().extra.n.vy0).toBe(5);
    st.pick('nc', '3');
    expect(st.get().extra.s.nc).toBe('3');
    st.setXAsk('law');
    expect(st.get().extra.ask).toBe('law');
    st.undo();
    expect(st.get().extra.ask).toBe('centers');
    st.setView('main');
    expect(st.get().view).toBe('main');
  });
  it('старый файл открывается на основном экране', () => {
    const st = new PointStore();
    const file = JSON.parse(st.exportProject().text);
    delete file.extra;
    delete file.view;
    const st2 = new PointStore();
    st2.loadPreset('x2765');
    expect(st2.importProject(JSON.stringify(file))).toBe(true);
    expect(st2.get().view).toBe('main');
  });
  it('разбор: формула и таблица сохраняются', () => {
    const r = parseExtra({ ask: 'ball', n: { v0: 300 }, s: { tab: '0:0; 10:1' } }, POINT_EXTRA_ASKS);
    expect(r?.n.v0).toBe(300);
    expect(r?.s.tab).toBe('0:0; 10:1');
  });
});
