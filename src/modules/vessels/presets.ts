/** Готовые задачи: схемы задачи 4 Антонова (по рисунку и строке таблицы) и классические сосуды (точные формулы). */
import type { AntData } from './model/antonov';
import type { Segment, VesselProblem } from './model/vessel';

/** Задача: по схеме Антонова (рисунок и числа таблицы) или свой сосуд из участков. */
export interface VesselTask {
  mode: 'ant' | 'custom';
  ant: AntData;
  custom: VesselProblem;
}
export interface VesselPreset {
  title: string;
  task: VesselTask;
  note?: string;
}

const cyl = (r: number, h: number): Segment => ({ kind: 'cyl', r1: r, r2: r, p: 0, h });
const cone = (r1: number, r2: number, half: number): Segment => ({ kind: 'cone', r1, r2, p: half, h: 0 });
const sph = (r1: number, r2: number, R: number): Segment => ({ kind: 'sph', r1, r2, p: R, h: 0 });
const v = (o: Partial<VesselProblem>): VesselProblem => ({ segs: [], pg: 0, rho: 0, level: 0, support: 'ground', zs: 0, sigma: 100, g: 9.81, tube: 0, ...o });
export const ANT0: AntData = { fig: 1, alpha: 30, H1: 20, H2: 14, H3: 0, D: 2, R: 1, Rb: 0, p: 0.4, rho3: 1.1, sigma: 100 };
export const CUSTOM0: VesselProblem = v({ segs: [cyl(1, 4)], pg: 1 });
const ant = (o: Partial<AntData>): VesselTask => ({ mode: 'ant', ant: { ...ANT0, ...o }, custom: CUSTOM0 });
const own = (o: Partial<VesselProblem>): VesselTask => ({ mode: 'custom', ant: ANT0, custom: v(o) });

export const VESSEL_PRESETS = {
  f1r1: {
    title: 'Антонов, задача 4: рис. 1, строка 1 (полусфера, цилиндр, коническое днище; на лапах)',
    task: ant({ fig: 1, alpha: 30, H1: 20, H2: 14, D: 2, R: 1, p: 0.4, rho3: 1.1 }),
    note: 'Схема I таблицы 12.4 — рис. 1. Ответа в пособии нет.',
  },
  f2r4: {
    title: 'Антонов, задача 4: рис. 2, строка 4 (цилиндр на основании, коническая крышка)',
    task: ant({ fig: 2, alpha: 60, H1: 10, H2: 7, D: 4, p: 0.2, rho3: 1.1 }),
    note: 'Схема II — рис. 2. Ответа в пособии нет.',
  },
  f4r10: {
    title: 'Антонов, задача 4: рис. 4, строка 10 (с пьезометром)',
    task: ant({ fig: 4, alpha: 30, H1: 20, H2: 14, H3: 10, D: 3, R: 1.5, p: 0, rho3: 1.3 }),
    note: 'Схема IV — рис. 4: давление газа задаёт трубка, p_г = ρg(H₁ + H₃ − H₂). Ответа в пособии нет.',
  },
  f5r13: {
    title: 'Антонов, задача 4: рис. 5, строка 13 (сферический сегмент, лапы у днища)',
    task: ant({ fig: 5, alpha: 30, H1: 20, H2: 15, D: 2.5, R: 3.5, p: 0.3, rho3: 1.2 }),
    note: 'Схема V — рис. 5. Ответа в пособии нет.',
  },
  f8r22: {
    title: 'Антонов, задача 4: рис. 8, строка 22 (цилиндр с пьезометром)',
    task: ant({ fig: 8, alpha: 30, H1: 10, H2: 7, H3: 10, D: 6, p: 0, rho3: 1.1 }),
    note: 'Схема VIII — рис. 8. Ответа в пособии нет.',
  },
  cylgas: {
    title: 'Цилиндр под давлением газа: σ_t = pr/δ, σ_m = pr/(2δ)',
    task: own({ segs: [cyl(1, 4)], pg: 1 }),
    note: 'Точная формула: δ = pr/[σ] = 1·1/100 = 10 мм.',
  },
  sphgas: {
    title: 'Сферический резервуар под давлением газа: σ = pR/(2δ)',
    task: own({ segs: [sph(0, 2, 2), sph(2, 0, 2)], pg: 1, support: 'lugs', zs: 2 }),
    note: 'σ_m = σ_t = pR/(2δ): при том же давлении сфера вдвое тоньше цилиндра того же радиуса.',
  },
  conetank: {
    title: 'Конический резервуар с жидкостью, подвешенный за верхний край',
    task: own({ segs: [cone(0, 3 * Math.tan(Math.PI / 6), 30)], rho: 1000, level: 3, support: 'lugs', zs: 3 }),
    note: 'σ_t = γ(H − y)y·tg α/(δ cos α), наибольшее при y = H/2; σ_m = γy·tg α(H − 2y/3)/(2δ cos α), наибольшее при y = 3H/4.',
  },
  ellhead: {
    title: 'Цилиндр с эллиптическим днищем a/b = 2 под давлением газа',
    task: own({ segs: [cyl(1, 2), { kind: 'ell', r1: 1, r2: 0, p: 0, h: 0.5 }], pg: 1 }),
    note: 'На экваторе днища σ_t = (pa/δ)(1 − a²/(2b²)) = −pa/δ — сжатие; на полюсе σ = pa²/(2bδ).',
  },
} satisfies Record<string, VesselPreset>;

export type VesselPresetKey = keyof typeof VESSEL_PRESETS;

/** Задача → сосуд для расчёта (при схеме Антонова — построенный по рисунку). */
export function taskProblem(t: VesselTask): { problem: VesselProblem; errors: string[]; reading: string[] } {
  if (t.mode === 'custom') return { problem: t.custom, errors: [], reading: [] };
  return antonovVessel(t.ant);
}
import { antonovVessel } from './model/antonov';
