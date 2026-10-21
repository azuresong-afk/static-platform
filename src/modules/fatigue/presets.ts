/**
 * Готовые примеры вкладки «Усталостная прочность» (Антонов, гл. 11). В пособии к главе 11 числовых задач нет:
 * числа условные (сталь σ_в = 600, σ_т = 360, σ₋₁ = 0,45σ_в = 270, τ₋₁ = 0,6σ₋₁ МПа), ответы — по формулам пособия.
 */
import type { Cycle, FatigueProblem } from './model/fatigue';

export interface FatiguePreset {
  title: string;
  problem: FatigueProblem;
  note: string;
}
const cyc = (o: Partial<Cycle>): Cycle => ({ on: true, mode: 'minmax', max: 0, min: 0, m: 0, a: 0, ...o });
const off: Cycle = { on: false, mode: 'minmax', max: 0, min: 0, m: 0, a: 0 };
const steel = { sigB: 600, sigT: 360, sig1: 270, tau1: 162, tauB: 0 };
const part = { kMode: 'mult' as const, Ks: 2, Kt: 1.6, KF: 0.9, Kd: 0.8, beta: 1, Kv: 1, nAllow: 1.5 };
const fat = (o: Partial<FatigueProblem>): FatigueProblem => ({ ...steel, ...part, sigma: off, tau: off, ...o });

export const FATIGUE_PRESETS = {
  f111: {
    title: 'Антонов, рис. 11.1: вращающийся вал под постоянной силой — симметричный цикл',
    problem: fat({ sigma: cyc({ max: 60, min: -60 }) }),
    note: 'Изгибающий момент постоянен, вал вращается: σ = (M/W) sin ωt, σ_max = −σ_min = 60 МПа. K_σ = 2, K_F = 0,9, K_d = 0,8, β = 1 (числа условные).',
  },
  f114: {
    title: 'Антонов, рис. 11.4: пульсационный цикл — запас по нормальным напряжениям',
    problem: fat({ sigma: cyc({ max: 120, min: 0 }) }),
    note: 'σ_min = 0, σ_max = 120 МПа: σ_m = σ_a = 60 МПа. Запас меньше [n] = 1,5 (числа условные).',
  },
  f116: {
    title: 'Антонов, п. 11.6: вал с поверхностным упрочнением — коэффициент K',
    problem: fat({ sigma: cyc({ max: 80, min: -80 }), kMode: 'surf', Kv: 1.5 }),
    note: 'K = (K_σ/K_d + 1/K_F − 1)/K_v, K_v = 1,5 (обкатка роликами, закалка ТВЧ…); симметричный цикл 80 МПа (числа условные).',
  },
  f117: {
    title: 'Антонов, п. 11.7: изгиб с кручением вала — формула Гафа и Полларда',
    problem: fat({ sigma: cyc({ max: 50, min: -50 }), tau: cyc({ max: 40, min: 0 }) }),
    note: 'Изгиб — симметричный цикл 50 МПа, кручение — пульсационный 0…40 МПа; K_σ = 2, K_τ = 1,6; ψ_τ = 0,5ψ_σ (числа условные).',
  },
} satisfies Record<string, FatiguePreset>;
export type FatiguePresetKey = keyof typeof FATIGUE_PRESETS;
