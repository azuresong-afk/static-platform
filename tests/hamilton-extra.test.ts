/** Пункт 31, «Устойчивость и нелинейные колебания»: второй экран — ответы Мещерского §52, 55, 56 и независимая проверка. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { plotSvg, rk4, solveExtra } from '../src/shared/extra';
import { evalSym, symText } from '../src/shared/sym';
import { HAM_ASKS } from '../src/modules/hamilton/model/extra';
import { HAM_EXTRA_PRESETS } from '../src/modules/hamilton/extraPresets';
import { solveConstr } from '../src/modules/hamilton/model/constr';
import { freePeriodic, measure, simulate } from '../src/modules/hamilton/model/impact';
import { HamStore } from '../src/modules/hamilton/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;

describe('готовые задачи §52, 55, 56 (пункт 31)', () => {
  for (const [key, ps] of Object.entries(HAM_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(HAM_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
});

describe('независимая проверка', () => {
  it('52.7: определитель в общем виде — это уравнение книги', () => {
    const r = solveConstr({
      coords: ['x1', 'y1', 'x2', 'y2'],
      params: { P: 1, l: 1 },
      Pi: 'P (y1 + y2)/2',
      cons: ['f(x1, y1)', 'f(x2, y2)', '(x2 − x1)^2 + (y2 − y1)^2 − l^2'],
      fdef: '',
      keep: '',
      box: 1,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.concrete).toBeNull();
    const D = r.general.det!;
    expect(symText(D)).toContain('∂f/∂x₁');
    // Случайные значения: P·[(x₂ − x₁)(fx₁fy₂ + fy₁fx₂) − 2(y₂ − y₁)fx₁fx₂] (с точностью до множителя).
    for (let i = 0; i < 5; i++) {
      const v: Record<string, number> = {
        P: 1.3,
        x1: Math.sin(i),
        y1: Math.cos(2 * i),
        x2: 0.3 * i,
        y2: -0.2 * i + 0.1,
        '∂f/∂x₁': 0.7 + i,
        '∂f/∂y₁': -0.4 * i,
        '∂f/∂x₂': 1.1,
        '∂f/∂y₂': 0.5 - i,
      };
      const book = v.P * ((v.x2 - v.x1) * (v['∂f/∂x₁'] * v['∂f/∂y₂'] + v['∂f/∂y₁'] * v['∂f/∂x₂']) - 2 * (v.y2 - v.y1) * v['∂f/∂x₁'] * v['∂f/∂x₂']);
      expect(Math.abs(evalSym(D, (n) => v[n]))).toBeCloseTo(Math.abs(book), 10);
    }
  });
  it('56.4: интегрирование без событий — свободное движение от максимума до упора', () => {
    const r = rk4((_t, y) => [y[1], -y[0]], [1, 0], 0, (2 * Math.PI) / 3, 4000);
    expect(r[r.length - 1].y[0]).toBeCloseTo(-0.5, 8);
    const s = simulate({ f: (x) => -x, lo: -0.5, hi: null, e: 1, fric: null, x0: 1, v0: 0, tEnd: 30, steps: 20000 });
    expect(measure(s)!.T).toBeCloseTo((4 * Math.PI) / 3, 8);
  });
  it('56.9: при чётном s работа силы за период равна нулю', () => {
    const r = freePeriodic((x) => -x, -0.5, 0.5, (2 * Math.PI * 2) / 6, 6, 100)!;
    expect(r.I / r.path).toBeLessThan(1e-9);
  });
  it('56.8: удар с e < 1 и трение — расчёт не ломается, энергия убывает', () => {
    const s = simulate({ f: (x) => -x, lo: -0.5, hi: 0.5, e: 0.8, fric: { u: 0, H: 0.02, Hs: 0.03 }, x0: 0, v0: 2, tEnd: 60, steps: 20000 });
    expect(Math.max(...s.v.slice(-200).map(Math.abs))).toBeLessThan(2);
  });
});

describe('второй экран: состояние раздела', () => {
  it('готовая задача открывает второй экран, файл проекта его хранит', () => {
    const st = new HamStore();
    st.loadPreset('x5519');
    expect(st.get().view).toBe('extra');
    const f = st.exportProject();
    const st2 = new HamStore();
    expect(st2.importProject(f.text)).toBe(true);
    expect(st2.get().view).toBe('extra');
    expect(st2.get().extra.ask).toBe('tops');
    st2.loadPreset('m5524');
    expect(st2.get().view).toBe('main');
  });
});
