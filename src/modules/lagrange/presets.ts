/**
 * Готовые задачи вкладки «Уравнения Лагранжа» (Мещерский §48). Буквенные данные заданы числами только для
 * интегрирования и частот; уравнения выводятся в буквах.
 */
import type { LagCoord, LagParam, LagProblem } from './model/lagrange';

const C = (name: string, q0: number, v0 = 0, Q = '', eq = 0): LagCoord => ({ name, q0, v0, Q, eq });
const P = (o: Record<string, number>): LagParam[] => Object.entries(o).map(([name, value]) => ({ name, value }));

export const LAGRANGE_PRESETS = {
  m4811: {
    title: 'Мещерский 48.11: маятник на нити, навёрнутой на цилиндр',
    note: 'Ответ: (l + rφ)φ̈ + rφ̇² + g sin φ = 0. Π отсчитана от центра цилиндра: y = r sin φ − (l + rφ) cos φ.',
    problem: { coords: [C('φ', 0.5)], params: P({ m: 1, l: 1, r: 0.2, g: 9.81 }), T: "m(l + rφ)^2 φ'^2/2", P: 'm g (r sin φ − (l + r φ) cos φ)', tEnd: 6 },
  },
  m4827: {
    title: 'Мещерский 48.27: точка на окружности, вращающейся с постоянной ω',
    note: 'Ответ: θ̈ + (g/a − ω² cos θ) sin θ = 0. Интеграл энергии T + Π не сохраняется (угловую скорость поддерживает момент), сохраняется интеграл Якоби.',
    problem: { coords: [C('θ', 1)], params: P({ m: 1, a: 1, ω: 4, g: 9.81 }), T: "m a^2 (θ'^2 + ω^2 sin^2 θ)/2", P: '-m g a cos θ', tEnd: 6 },
  },
  m4828: {
    title: 'Мещерский 48.28: точка в кольцевой трубе, вращающейся под моментом M',
    note: 'Ответ: ma²θ̈ − ma² sin θ cos θ·φ̇² + mga sin θ = 0;  (J + ma² sin²θ)φ̈ + 2ma² sin θ cos θ·θ̇φ̇ = M.',
    problem: { coords: [C('θ', 0.8), C('φ', 0, 2, 'M')], params: P({ m: 1, a: 0.5, J: 0.4, M: 0.2, g: 9.81 }), T: "m a^2 (θ'^2 + φ'^2 sin^2 θ)/2 + J φ'^2/2", P: '-m g a cos θ', tEnd: 6 },
  },
  m4837: {
    title: 'Мещерский 48.37–48.38: эллиптический маятник (ползун и шарик на стержне)',
    note: 'Ответ: d/dt[(m₁ + m₂)ẋ + m₂lφ̇ cos φ] = 0;  lφ̈ + ẍ cos φ + g sin φ = 0. Период малых колебаний T = 2π√(m₁l/((m₁ + m₂)g)).',
    problem: { coords: [C('x', 0), C('φ', 0.4)], params: P({ m1: 2, m2: 1, l: 1, g: 9.81 }), T: "(m1 + m2) x'^2/2 + m2 l x' φ' cos φ + m2 l^2 φ'^2/2", P: '-m2 g l cos φ', tEnd: 6 },
  },
  m4835: {
    title: 'Мещерский 48.35: две массы на стержне, связанные пружиной',
    note: 'Частота колебаний ω² = c(m₁ + m₂)/(m₁m₂); вторая частота нулевая — центр масс движется равномерно.',
    problem: { coords: [C('x1', 0, 1, '', 0), C('x2', 1, 0, '', 1)], params: P({ m1: 1, m2: 2, c: 50, l: 1 }), T: "m1 x1'^2/2 + m2 x2'^2/2", P: 'c (x2 − x1 − l)^2/2', tEnd: 3 },
  },
  damped: {
    title: 'Маятник с вязким сопротивлением: непотенциальная сила Q = −bφ̇',
    note: 'Сопротивление пропорционально угловой скорости; энергия убывает.',
    problem: { coords: [C('φ', 1, 0, "−b φ'")], params: P({ m: 1, l: 1, b: 0.3, g: 9.81 }), T: "m l^2 φ'^2/2", P: '−m g l cos φ', tEnd: 10 },
  },
} satisfies Record<string, { title: string; note: string; problem: LagProblem }>;

export type LagrangePresetKey = keyof typeof LAGRANGE_PRESETS;
