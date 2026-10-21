/** Пункт 26, «Сходящиеся силы»: система тел на шарнирах и задачи статики §2–4, 8 по формулам. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { parseExtra, plotSvg, solveExtra } from '../src/shared/extra';
import { CONV_ASKS, chainAngles, prismAlpha } from '../src/modules/converging/model/extra';
import { parseLinkage, solveLinkage } from '../src/modules/converging/model/linkage';
import { CONV_EXTRA_PRESETS, type ConvExtraKey } from '../src/modules/converging/extraPresets';
import { ConvStore } from '../src/modules/converging/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;

describe('готовые задачи пункта 26', () => {
  for (const [key, ps] of Object.entries(CONV_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(CONV_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      const html = docHTML({ steps: out.steps });
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
});

const lk = (a: string, b: string, c: string, d: string) => {
  const r = parseLinkage(a, b, c, d);
  if (!r.ok) throw new Error(r.errors.join(' '));
  return solveLinkage(r.lk);
};

describe('система тел на шарнирах', () => {
  it('ферма-треугольник: усилия совпадают с методом вырезания узлов', () => {
    // Равнобедренный треугольник, сила 2 вниз в вершине: стороны сжаты на 1/sin 45°, затяжка растянута на 1.
    const r = lk('A 0 0; B 2 0; C 1 1', 'A-B B-C A-C', 'A; B 90', 'C 2 270');
    expect(r.status).toBe('ok');
    expect(r.vals.S_AC).toBeCloseTo(-Math.SQRT2, 9);
    expect(r.vals.S_BC).toBeCloseTo(-Math.SQRT2, 9);
    expect(r.vals.S_AB).toBeCloseTo(1, 9);
    expect(r.vals.N_B).toBeCloseTo(1, 9);
  });
  it('механизм без уравновешивающей силы — равновесие невозможно; лишняя неизвестная — неопределимость', () => {
    expect(lk('A 0 0; B 0 1; C 1 1; D 1 0', 'A-B B-C C-D', 'A; D', 'B 1 0').status).toBe('mechanism');
    expect(lk('A 0 0; B 0 1; C 1 1; D 1 0', 'A-B B-C C-D', 'A; D', 'B ? 0; C ? 0').status).toBe('indeterminate');
  });
  it('3.33: Q = −2P/3 при любом наклоне звена CD (возможные перемещения)', () => {
    for (const d of [1.5, 2.5, 4]) {
      const C = [1, 2],
        E = [C[0] + (d - C[0]) / 4, 1.5];
      const r = lk(`A 0 0; K 0 1; B 0 2; C 1 2; E ${E[0]} ${E[1]}; D ${d} 0`, 'A-K-B B-C C-E-D', 'A; D', 'K P 1 0; E Q ? 0');
      expect(r.vals.Q).toBeCloseTo(-2 / 3, 9);
    }
  });
  it('ползун с трением: линия реакции отклонена на угол трения, P_min и P_max как в 2.71', () => {
    // Кривошип OB (r = 1) под 60° к вертикали, шатун AB под 20°, груз на барабане a = 0,3; f = 0,1.
    const ph = (20 * Math.PI) / 180,
      th = (60 * Math.PI) / 180;
    const B = [Math.sin(th), Math.cos(th)];
    const A = [B[0] - 2 * Math.sin(ph), B[1] + 2 * Math.cos(ph)];
    const pts = `O 0 0; B ${B[0]} ${B[1]}; A ${A[0]} ${A[1]}; K -0,3 0`;
    const S = 0.3 / Math.sin(ph + th);
    const P = (f: number) => {
      const r = lk(pts, 'O-B-K A-B', `O; A 0 ${f}`, 'K Q 1 270; A P ? 270');
      expect(r.status).toBe('ok');
      return Math.abs(r.vals.P);
    };
    expect(P(0)).toBeCloseTo(S * Math.cos(ph), 9);
    const lim = [P(0.1), P(-0.1)].sort((x, y) => x - y);
    expect(lim[0]).toBeCloseTo(S * (Math.cos(ph) - 0.1 * Math.sin(ph)), 9);
    expect(lim[1]).toBeCloseTo(S * (Math.cos(ph) + 0.1 * Math.sin(ph)), 9);
  });
  it('ошибки ввода называются по-русски', () => {
    const r = parseLinkage('A 0 0; A 1 1', 'A-Z', 'Q', 'A x 1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/дважды|нет точки/);
  });
});

describe('формулы', () => {
  it('верёвочный многоугольник: симметричная цепь — H = ΣQ/(2 tg α), средние звенья по формуле книги', () => {
    const r = chainAngles([1, 1, 1], 60, -60);
    expect(r.H).toBeCloseTo(-3 / (2 * Math.tan(Math.PI / 3)), 12);
    expect(r.ang[1]).toBeCloseTo(30, 9);
    expect(r.ang[2]).toBeCloseTo(-30, 9);
  });
  it('4.76: при A = C = 45° и равных весах tg α = f для любого f', () => {
    for (const f of [0.05, 0.2, 0.5]) expect(Math.tan((prismAlpha(1, 1, f, 45, 45) * Math.PI) / 180)).toBeCloseTo(f, 8);
  });
});

describe('экран и файл проекта', () => {
  it('готовая задача открывает экран задач и сохраняется в файл', () => {
    const st = new ConvStore();
    for (const k of Object.keys(CONV_EXTRA_PRESETS) as ConvExtraKey[]) {
      st.loadPreset(k);
      expect(st.get().view).toBe('extra');
      const f = st.exportProject();
      const st2 = new ConvStore();
      expect(st2.importProject(f.text)).toBe(true);
      expect(st2.get().view).toBe('extra');
      expect(st2.get().extra).toEqual(st.get().extra);
    }
    st.loadPreset('m27');
    expect(st.get().view).toBe('main');
  });
  it('отмена возвращает прежний вопрос; старый файл без extra открывается', () => {
    const st = new ConvStore();
    st.setView('extra');
    st.setXAsk('bifilar');
    st.setXAsk('wedge');
    st.undo();
    expect(st.get().extra.ask).toBe('bifilar');
    const file = JSON.parse(st.exportProject().text);
    delete file.extra;
    delete file.view;
    expect(new ConvStore().importProject(JSON.stringify(file))).toBe(true);
    expect(parseExtra({ ask: 'nope', n: {}, s: {} }, CONV_ASKS)).toBeNull();
  });
});
