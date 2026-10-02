/** Готовые задачи: классические сосуды (проверка по точным формулам) и примеры по схемам задачи 4 Антонова. */
import type { Segment, VesselProblem } from './model/vessel';

export interface VesselPreset {
  title: string;
  problem: VesselProblem;
  note?: string;
}

const cyl = (r: number, h: number): Segment => ({ kind: 'cyl', r1: r, r2: r, p: 0, h });
const cone = (r1: number, r2: number, half: number): Segment => ({ kind: 'cone', r1, r2, p: half, h: 0 });
const sph = (r1: number, r2: number, R: number): Segment => ({ kind: 'sph', r1, r2, p: R, h: 0 });
const v = (o: Partial<VesselProblem>): VesselProblem => ({ segs: [], pg: 0, rho: 0, level: 0, support: 'ground', zs: 0, sigma: 100, g: 9.81, ...o });
const coneH = (r: number, half: number) => r / Math.tan((half * Math.PI) / 180);

export const VESSEL_PRESETS = {
  a1: {
    title: 'Антонов, задача 4: рис. 1, данные строки 1 (сфера, цилиндр, конус; на лапах)',
    problem: v({ segs: [cone(0, 1, 15), cyl(1, 20), sph(1, 0, 1)], pg: 0.4, rho: 1100, level: coneH(1, 15) + 14, support: 'lugs', zs: coneH(1, 15) + 20 }),
    note: 'α = 30° — угол при вершине нижнего конуса (половина 15°), H₁ = 20 м — цилиндр, H₂ = 14 м — уровень жидкости от низа цилиндра, D = 2 м, R = 1 м, p = 0,4 МПа, ρ = 1100 кг/м³; лапы — на стыке цилиндра и полусферы. Прочтение рисунка — наше, ответа в пособии нет.',
  },
  a2: {
    title: 'Антонов, задача 4: рис. 2, данные строки 2 (цилиндр на основании, коническая крышка)',
    problem: v({ segs: [cyl(1, 25), cone(1, 0, 45)], pg: 0.3, rho: 1200, level: 18, support: 'ground' }),
    note: 'Угол при вершине крышки 2α = 90°, H₁ = 25 м — цилиндр, H₂ = 18 м — уровень жидкости, D = 2 м, p = 0,3 МПа, ρ = 1200 кг/м³. Прочтение рисунка — наше, ответа в пособии нет.',
  },
  cylgas: {
    title: 'Цилиндр под давлением газа: σ_t = pr/δ, σ_m = pr/(2δ)',
    problem: v({ segs: [cyl(1, 4)], pg: 1 }),
    note: 'Точная формула: δ = pr/[σ] = 1·1/100 = 10 мм.',
  },
  sphgas: {
    title: 'Сферический резервуар под давлением газа: σ = pR/(2δ)',
    problem: v({ segs: [sph(0, 2, 2), sph(2, 0, 2)], pg: 1, support: 'lugs', zs: 2 }),
    note: 'σ_m = σ_t = pR/(2δ): при том же давлении сфера вдвое тоньше цилиндра того же радиуса.',
  },
  conetank: {
    title: 'Конический резервуар с жидкостью, подвешенный за верхний край',
    problem: v({ segs: [cone(0, 3 * Math.tan(Math.PI / 6), 30)], rho: 1000, level: 3, support: 'lugs', zs: 3 }),
    note: 'σ_t = γ(H − y)y·tg α/(δ cos α), наибольшее при y = H/2; σ_m = γy·tg α(H − 2y/3)/(2δ cos α), наибольшее при y = 3H/4.',
  },
  ellhead: {
    title: 'Цилиндр с эллиптическим днищем a/b = 2 под давлением газа',
    problem: v({ segs: [cyl(1, 2), { kind: 'ell', r1: 1, r2: 0, p: 0, h: 0.5 }], pg: 1 }),
    note: 'На экваторе днища σ_t = (pa/δ)(1 − a²/(2b²)) = −pa/δ — сжатие; на полюсе σ = pa²/(2bδ).',
  },
} satisfies Record<string, VesselPreset>;

export type VesselPresetKey = keyof typeof VESSEL_PRESETS;
