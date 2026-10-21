/**
 * Сосуды задачи 4 Антонова (рис. 1–16, стр. 172–173 пособия): построение по номеру рисунка и числам таблицы 12.4.
 *
 * Прочтение рисунков (по стрелкам размеров и дугам углов):
 *  — H₁, H₂ — высоты вертикальных участков: у сосудов с цилиндром и коническим днищем H₁ — высота цилиндра,
 *    H₂ — уровень жидкости от низа цилиндра; у ступенчатых (рис. 3, 7, 11, 15) H₂ — нижний цилиндр,
 *    H₁ — от основания до верха верхнего цилиндра; у рис. 12 и 16 H₁ — средний (усечённый) конус, H₂ — нижний конус;
 *  — α — угол между образующей и осью; на переходных конусах рис. 3, 7, 11, 15 — между образующей и горизонталью;
 *    подписи 2α и 3α — полный угол при вершине (половина — α и 1,5α);
 *  — H₃ — уровень в пьезометре над верхом цилиндра (рис. 4, 8, 10); на рис. 12 — диаметр основания верхнего конуса;
 *  — лапы — на уровне, отмеченном на рисунке; без лап сосуд стоит на основании.
 */
import { fmt } from '../../../shared/format';
import type { Segment, VesselProblem } from './vessel';

export interface AntData {
  fig: number;
  alpha: number;
  H1: number;
  H2: number;
  H3: number;
  D: number;
  R: number;
  /** Высота эллиптической крышки (полуось R_b) — только рис. 13. */
  Rb: number;
  /** Давление газа, МПа (у схем с пьезометром не задаётся). */
  p: number;
  /** ρ·10⁻³, кг/м³ — как в таблице (1,1 → 1100 кг/м³). */
  rho3: number;
  sigma: number;
}

/** Какие величины нужны для рисунка. */
export type AntKey = 'alpha' | 'H1' | 'H2' | 'H3' | 'D' | 'R' | 'Rb' | 'p';
export const ANT_NEEDS: Record<number, AntKey[]> = {
  1: ['alpha', 'H1', 'H2', 'D', 'R', 'p'],
  2: ['alpha', 'H1', 'H2', 'D', 'p'],
  3: ['alpha', 'H1', 'H2', 'D', 'R', 'p'],
  4: ['alpha', 'H1', 'H2', 'H3', 'D', 'R'],
  5: ['alpha', 'H1', 'H2', 'D', 'R', 'p'],
  6: ['alpha', 'H1', 'H2', 'D', 'p'],
  7: ['alpha', 'H1', 'H2', 'D', 'R', 'p'],
  8: ['alpha', 'H1', 'H2', 'H3', 'D'],
  9: ['alpha', 'H1', 'H2', 'D', 'p'],
  10: ['alpha', 'H1', 'H2', 'H3', 'D', 'R'],
  11: ['alpha', 'H1', 'H2', 'D', 'R', 'p'],
  12: ['alpha', 'H1', 'H2', 'H3', 'p'],
  13: ['alpha', 'H1', 'H2', 'D', 'Rb', 'p'],
  14: ['alpha', 'H1', 'D', 'R', 'p'],
  15: ['alpha', 'H1', 'H2', 'D', 'R', 'p'],
  16: ['alpha', 'H1', 'H2', 'R', 'p'],
};

const rad = (d: number) => (d * Math.PI) / 180;
const cyl = (r: number, h: number): Segment => ({ kind: 'cyl', r1: r, r2: r, p: 0, h });
/** Конус по половине угла при вершине (от оси). */
const coneAx = (r1: number, r2: number, half: number): Segment => ({ kind: 'cone', r1, r2, p: half, h: 0 });
const sph = (r1: number, r2: number, R: number): Segment => ({ kind: 'sph', r1, r2, p: R, h: 0 });
const hAx = (dr: number, half: number) => Math.abs(dr) / Math.tan(rad(half));

export function antonovVessel(a: AntData): { problem: VesselProblem; errors: string[]; reading: string[] } {
  const errors: string[] = [];
  const reading: string[] = [];
  const need = ANT_NEEDS[a.fig];
  if (!need) return { problem: blank(a), errors: ['Номер рисунка — от 1 до 16.'], reading };
  for (const k of need) if (!(a[k] > 0)) errors.push(`Задайте ${LABEL[k]} (положительное число).`);
  if (!(a.rho3 > 0)) errors.push('Задайте плотность ρ·10⁻³ (положительное число).');
  if (need.includes('alpha') && !(a.alpha < 90)) errors.push('Угол α — меньше 90°.');
  if (errors.length) return { problem: blank(a), errors, reading };
  const rD = a.D / 2,
    al = a.alpha;
  let segs: Segment[] = [];
  let level = 0,
    support: 'ground' | 'lugs' = 'lugs',
    zs = 0,
    tube = 0;
  const pg = need.includes('p') ? a.p : 0;
  const fig = a.fig;
  if ([1, 4, 5, 6, 9, 10, 13].includes(fig)) {
    // Коническое днище (α от оси), цилиндр H₁, крышка; H₂ — уровень от низа цилиндра.
    const hc = hAx(rD, al);
    const top: Segment = fig === 1 || fig === 4 || fig === 5 || fig === 10 ? sph(rD, 0, a.R) : fig === 13 ? { kind: 'ell', r1: rD, r2: 0, p: 0, h: a.Rb } : coneAx(rD, 0, 1.5 * al);
    if ((top.kind === 'sph') && a.R < rD - 1e-9) errors.push(`Радиус сферы R = ${fmt(a.R, 4)} м меньше радиуса цилиндра D/2 = ${fmt(rD, 4)} м — крышка не получается.`);
    segs = [coneAx(0, rD, al), cyl(rD, a.H1), top];
    level = hc + a.H2;
    zs = [5, 9, 10, 13].includes(fig) ? hc : hc + a.H1;
    if ([4, 10].includes(fig)) tube = hc + a.H1 + a.H3;
    reading.push(`днище — конус, α = ${fmt(al, 4)}° между образующей и осью (высота ${round(hc)} м); цилиндр D = ${fmt(a.D, 4)} м, H₁ = ${fmt(a.H1, 4)} м; уровень жидкости H₂ = ${fmt(a.H2, 4)} м от низа цилиндра`);
    reading.push(top.kind === 'sph' ? `крышка — сферический сегмент радиуса R = ${fmt(a.R, 4)} м${Math.abs(a.R - rD) < 1e-9 ? ' (полусфера)' : ''}` : top.kind === 'ell' ? `крышка — эллипсоид вращения с полуосями D/2 = ${fmt(rD, 4)} м и R_b = ${fmt(a.Rb, 4)} м` : `крышка — конус с углом при вершине 3α = ${fmt(3 * al, 4)}° (половина ${fmt(1.5 * al, 4)}°)`);
    reading.push(`лапы — ${zs === hc ? 'на стыке днища и цилиндра' : 'на стыке цилиндра и крышки'}`);
    if (tube) reading.push(`пьезометр: уровень в трубке на H₃ = ${fmt(a.H3, 4)} м выше верха цилиндра — давление газа p_г = ρg(H₁ + H₃ − H₂)`);
  } else if (fig === 2 || fig === 8) {
    segs = [cyl(rD, a.H1), coneAx(rD, 0, al)];
    level = a.H2;
    support = 'ground';
    if (fig === 8) tube = a.H1 + a.H3;
    reading.push(`цилиндр D = ${fmt(a.D, 4)} м, H₁ = ${fmt(a.H1, 4)} м на основании; уровень жидкости H₂ = ${fmt(a.H2, 4)} м; крышка — конус с углом при вершине 2α = ${fmt(2 * al, 4)}° (половина ${fmt(al, 4)}°)`);
    if (tube) reading.push(`пьезометр: уровень в трубке на H₃ = ${fmt(a.H3, 4)} м выше верха цилиндра — давление газа p_г = ρg(H₁ + H₃ − H₂)`);
  } else if ([3, 7, 11, 15].includes(fig)) {
    // Ступенчатые: нижний цилиндр H₂, переходный конус (α от горизонтали), верхний цилиндр до H₁, сферическая крышка.
    const wideLow = fig === 3 || fig === 11;
    const rLow = wideLow ? a.D : rD,
      rUp = wideLow ? rD : a.D;
    const hcone = Math.abs(rLow - rUp) * Math.tan(rad(al));
    const hUp = a.H1 - a.H2 - hcone;
    if (!(hUp > 0)) errors.push(`Верхний цилиндр не помещается: H₁ − H₂ − высота переходного конуса = ${round(hUp)} м ≤ 0.`);
    if (a.R < rUp - 1e-9) errors.push(`Радиус сферы R = ${fmt(a.R, 4)} м меньше радиуса верхнего цилиндра ${fmt(rUp, 4)} м — крышка не получается.`);
    segs = [cyl(rLow, a.H2), coneAx(rLow, rUp, 90 - al), cyl(rUp, Math.max(hUp, 1e-6)), sph(rUp, 0, a.R)];
    support = 'ground';
    level = fig === 3 || fig === 7 ? a.H2 : a.H1;
    reading.push(`нижний цилиндр ${wideLow ? '2D' : 'D'} высотой H₂ = ${fmt(a.H2, 4)} м на основании; переходный конус, α = ${fmt(al, 4)}° между образующей и горизонталью (высота ${round(hcone)} м); верхний цилиндр ${wideLow ? 'D' : '2D'} до высоты H₁ = ${fmt(a.H1, 4)} м; крышка — сферический сегмент R = ${fmt(a.R, 4)} м`);
    reading.push(level === a.H2 ? 'жидкость — до верха нижнего цилиндра, выше — газ' : 'жидкость — до верха верхнего цилиндра, газ — под крышкой');
  } else if (fig === 12 || fig === 16) {
    // Нижний конус H₂ (половина угла α у рис. 12, полный угол 2α у рис. 16 — половина α), усечённый конус H₁, крышка.
    const rb = a.H2 * Math.tan(rad(al));
    const rTop = fig === 12 ? a.H3 / 2 : a.R;
    const halfMid = (Math.atan(Math.abs(rb - rTop) / a.H1) * 180) / Math.PI;
    if (Math.abs(rb - rTop) < 1e-9) segs = [coneAx(0, rb, al), cyl(rb, a.H1)];
    else segs = [coneAx(0, rb, al), coneAx(rb, rTop, halfMid)];
    segs.push(fig === 12 ? coneAx(rTop, 0, al) : sph(rTop, 0, a.R));
    level = a.H2 + a.H1;
    zs = a.H2;
    reading.push(`нижний конус высотой H₂ = ${fmt(a.H2, 4)} м, ${fig === 12 ? `α = ${fmt(al, 4)}° между образующей и осью` : `угол при вершине 2α = ${fmt(2 * al, 4)}°`} (радиус основания ${round(rb)} м); средний усечённый конус высотой H₁ = ${fmt(a.H1, 4)} м до радиуса ${round(rTop)} м`);
    reading.push(fig === 12 ? `крышка — конус с углом при вершине 2α = ${fmt(2 * al, 4)}° и диаметром основания H₃ = ${fmt(a.H3, 4)} м` : `крышка — полусфера R = ${fmt(a.R, 4)} м`);
    reading.push('жидкость — до верха среднего конуса, газ — под крышкой; лапы — на стыке нижнего и среднего конусов');
  } else if (fig === 14) {
    segs = [sph(0, rD, a.R), cyl(rD, a.H1), coneAx(rD, 0, al)];
    const hb = segs.length ? Math.abs(a.R * (1 - Math.cos(Math.asin(Math.min(1, rD / a.R))))) : 0;
    if (a.R < rD - 1e-9) errors.push(`Радиус днища R = ${fmt(a.R, 4)} м меньше D/2 = ${fmt(rD, 4)} м.`);
    level = hb + a.H1;
    zs = hb + a.H1;
    reading.push(`днище — сферический сегмент R = ${fmt(a.R, 4)} м${Math.abs(a.R - rD) < 1e-9 ? ' (полусфера)' : ''}; цилиндр D = ${fmt(a.D, 4)} м, H₁ = ${fmt(a.H1, 4)} м; крышка — конус, α = ${fmt(al, 4)}° между образующей и осью`);
    reading.push('жидкость — до верха цилиндра, газ — под крышкой; лапы — на стыке цилиндра и крышки');
  }
  return { problem: { segs, pg, rho: a.rho3 * 1000, level, support, zs, sigma: a.sigma, g: 9.81, tube }, errors, reading };
}

const LABEL: Record<AntKey, string> = { alpha: 'угол α', H1: 'H₁', H2: 'H₂', H3: 'H₃', D: 'D', R: 'R', Rb: 'R_b', p: 'давление p' };
const round = (x: number) => fmt(x, 4);
const blank = (a: AntData): VesselProblem => ({ segs: [], pg: 0, rho: a.rho3 * 1000, level: 0, support: 'ground', zs: 0, sigma: a.sigma, g: 9.81, tube: 0 });
