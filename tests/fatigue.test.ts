/** Усталостная прочность (Антонов, гл. 11): цикл, предел выносливости детали, запасы. */
import { describe, expect, it } from 'vitest';
import { renderFatigue } from '../src/modules/fatigue/draw/fatigue';
import { cycleOf, solveFatigue, type FatigueProblem } from '../src/modules/fatigue/model/fatigue';
import { FATIGUE_PRESETS } from '../src/modules/fatigue/presets';
import { fatigueDoc } from '../src/modules/fatigue/text/solution';
import { FatigueStore, parseFatigue } from '../src/modules/fatigue/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

const P = (k: keyof typeof FATIGUE_PRESETS) => FATIGUE_PRESETS[k].problem as FatigueProblem;

describe('характеристики цикла (п. 11.2)', () => {
  const c = (max: number, min: number) => cycleOf({ on: true, mode: 'minmax', max, min, m: 0, a: 0 });
  it('симметричный, пульсационный, асимметричный, постоянный', () => {
    expect(c(60, -60)).toMatchObject({ m: 0, a: 60, R: -1, kind: 'симметричный цикл (R = −1)' });
    expect(c(120, 0)).toMatchObject({ m: 60, a: 60, R: 0, kind: 'пульсационный (отнулевой) цикл (R = 0)' });
    expect(c(100, 20)).toMatchObject({ m: 60, a: 40, R: 0.2, kind: 'асимметричный цикл' });
    expect(c(50, 50)).toMatchObject({ a: 0, kind: 'постоянное напряжение (статическое нагружение)' });
    // R = σ_min/σ_max с алгебраическими max и min — как в пособии (в том числе при сжатии).
    expect(c(-10, -50).R).toBeCloseTo(5, 12);
    expect(c(0, -40).R).toBeNull();
    // Порядок ввода не важен; задание через σ_m, σ_a.
    expect(c(-60, 60)).toMatchObject({ max: 60, min: -60 });
    expect(cycleOf({ on: true, mode: 'ma', max: 0, min: 0, m: 30, a: -20 })).toMatchObject({ max: 50, min: 10 });
  });
});

describe('готовые примеры — по формулам пособия', () => {
  it('рис. 11.1: симметричный цикл, K_D = K_σ/(K_F·K_d·β)', () => {
    const r = solveFatigue(P('f111'));
    const KD = 2 / (0.9 * 0.8 * 1);
    expect(r.sigma!.KD).toBeCloseTo(KD, 12);
    expect(r.sigma!.limD).toBeCloseTo(270 / KD, 12);
    expect(r.n).toBeCloseTo(270 / (KD * 60), 12);
    expect(r.okN).toBe(true);
    expect(r.n1).toBeCloseTo(1 / (60 / 270), 12);
  });
  it('рис. 11.4: пульсационный цикл — запас меньше [n]', () => {
    const r = solveFatigue(P('f114'));
    expect(r.n).toBeCloseTo(270 / ((2 / 0.72) * 60 + (270 / 600) * 60), 12);
    expect(r.okN).toBe(false);
    expect(docText(fatigueDoc(P('f114'), r))).toContain('запас недостаточен');
  });
  it('п. 11.6: K_D = (K_σ/K_d + 1/K_F − 1)/K_v', () => {
    const r = solveFatigue(P('f116'));
    const KD = (2 / 0.8 + 1 / 0.9 - 1) / 1.5;
    expect(r.sigma!.KD).toBeCloseTo(KD, 12);
    expect(r.n).toBeCloseTo(270 / (KD * 80), 12);
  });
  it('п. 11.7: изгиб с кручением — 1/n² = 1/n_σ² + 1/n_τ²', () => {
    const r = solveFatigue(P('f117'));
    const ns = 270 / ((2 / 0.72) * 50);
    const nt = 162 / ((1.6 / 0.72) * 20 + 0.5 * (270 / 600) * 20);
    expect(r.sigma!.n).toBeCloseTo(ns, 12);
    expect(r.tau!.n).toBeCloseTo(nt, 12);
    expect(r.n).toBeCloseTo(1 / Math.sqrt(1 / ns ** 2 + 1 / nt ** 2), 12);
    // ψ_τ = τ₋₁/τ_в, если τ_в задан.
    expect(solveFatigue({ ...P('f117'), tauB: 360 }).tau!.psi).toBeCloseTo(162 / 360, 12);
  });
  for (const [key, p] of Object.entries(FATIGUE_PRESETS))
    it(`${key}: текст и чертёж без NaN; группа «Гл. 11» в «Задачнике»`, () => {
      const r = solveFatigue(p.problem as FatigueProblem);
      for (const x of [docText(fatigueDoc(p.problem as FatigueProblem, r, { explain: true })), renderFatigue(p.problem as FatigueProblem, r).svg])
        expect(x).not.toMatch(/NaN|undefined/);
      expect(taskInfo(p.title)).toMatchObject({ book: 'ant', group: 'ant:ch11', groupTitle: 'Гл. 11. Усталостная прочность' });
    });
  it('номера: «рис. 11.1», «п. 11.7»; старые названия «рис. 7.2» — как раньше', () => {
    expect(taskInfo(FATIGUE_PRESETS.f117.title).num).toBe('п. 11.7');
    expect(taskInfo(FATIGUE_PRESETS.f111.title).num).toBe('рис. 11.1');
    expect(taskInfo('Антонов, рис. 7.2: моменты').num).toBe('рис. 7.2');
  });
});

describe('предупреждения и ошибки', () => {
  it('сжимающее среднее напряжение, K_D < 1, нет переменной составляющей', () => {
    expect(solveFatigue({ ...P('f111'), sigma: { on: true, mode: 'minmax', max: -20, min: -100, m: 0, a: 0 } }).warnings.join()).toContain('сжатие');
    expect(solveFatigue({ ...P('f111'), Ks: 0.5 }).warnings.join()).toContain('меньше 1');
    const st = solveFatigue({ ...P('f111'), sigma: { on: true, mode: 'minmax', max: 50, min: 50, m: 0, a: 0 } });
    expect(st.n).toBeCloseTo(270 / ((270 / 600) * 50), 12);
  });
  it('нет циклов, нулевые коэффициенты', () => {
    expect(solveFatigue({ ...P('f111'), sigma: { ...P('f111').sigma, on: false } }).ok).toBe(false);
    expect(solveFatigue({ ...P('f111'), KF: 0 }).ok).toBe(false);
    expect(solveFatigue({ ...P('f111'), sigB: 0 }).ok).toBe(false);
  });
});

describe('хранилище и файл', () => {
  it('переключение способа задания цикла сохраняет цикл; файл туда-обратно', () => {
    const st = new FatigueStore({ preset: 'f114' });
    st.setCycle('sigma', { mode: 'ma' });
    expect(st.get().problem.sigma).toMatchObject({ mode: 'ma', m: 60, a: 60 });
    st.typeCycle('sigma', 'a', 40);
    st.setCycle('sigma', { mode: 'minmax' });
    expect(st.get().problem.sigma).toMatchObject({ max: 100, min: 20 });
    st.setKMode('surf');
    st.typeNum('Kv', 1.3);
    st.setCycle('tau', { on: true });
    const f = st.exportProject(new Date(2026, 0, 1));
    const st2 = new FatigueStore();
    expect(st2.importProject(f.text)).toBe(true);
    expect(st2.get().problem).toEqual(st.get().problem);
    st.undo();
    expect(st.get().problem.tau.on).toBe(false);
  });
  it('неполные данные — ошибка', () => {
    expect(parseFatigue({}).ok).toBe(false);
    expect(parseFatigue({ ...P('f111'), sigma: { mode: 'x' } }).ok).toBe(false);
  });
});
