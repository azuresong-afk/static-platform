/**
 * Движение точки относительно вращающейся Земли (Мещерский 22.24, 23.39–23.40, 23.52–23.57, 23.62–23.66).
 *
 * Земля — шар радиуса R, вращается с угловой скоростью ω вокруг оси с юга на север. Оси x, y, z связаны с местом,
 * где сейчас точка: x — на восток, y — на север, z — по вертикали вверх; широта φ, высота над поверхностью h,
 * r = R + h. Вектор угловой скорости Земли Ω = ω(0, cos φ, sin φ).
 *
 * Относительная скорость — восточная, северная и вертикальная составляющие v_E, v_N, v_h (или модуль, курс k от
 * севера к востоку и v_h). Их изменение в осях места v̇_E, v̇_N, v̇_h — относительное касательное ускорение
 * (при постоянных составляющих — нуль). Тогда:
 *   v_e = Ω × r = (rω cos φ, 0, 0),  v = v_e + v_r;
 *   a_e = Ω × (Ω × r) = rω² cos φ·(0, sin φ, −cos φ)  (к оси Земли);
 *   a_r = (v̇_E + (v_E v_h − v_E v_N tg φ)/r,  v̇_N + (v_N v_h + v_E² tg φ)/r,  v̇_h − (v_E² + v_N²)/r);
 *   a_c = 2Ω × v_r = 2ω(v_h cos φ − v_N sin φ,  v_E sin φ,  −v_E cos φ);
 *   a = a_e + a_r + a_c.
 * Члены с 1/r в a_r — от кривизны поверхности: оси места поворачиваются, когда точка движется по Земле.
 */

export type V3 = [number, number, number];
export interface EarthKin {
  /** Широта, ° (южная — со знаком «−»). */
  lat: number;
  h: number;
  R: number;
  omega: number;
  /** Как задана относительная скорость: составляющими или модулем и курсом. */
  vin: 'enu' | 'course';
  vE: number;
  vN: number;
  vh: number;
  /** Модуль горизонтальной скорости и курс (угол от севера к востоку), °. */
  v: number;
  k: number;
  /** Изменение составляющих скорости в осях места (относительное касательное ускорение). */
  dE: number;
  dN: number;
  dh: number;
}

export interface EarthKinResult {
  ok: boolean;
  errors: string[];
  r: number;
  Om: V3;
  vr: V3;
  ve: V3;
  v: V3;
  ae: V3;
  ar: V3;
  /** Часть a_r от кривизны поверхности (без v̇). */
  arCurv: V3;
  ac: V3;
  a: V3;
  /** Горизонтальная составляющая кориолисова ускорения: модуль и направление (курс, °). */
  acH: number;
  acHk: number;
}

export const norm = (v: V3) => Math.hypot(v[0], v[1], v[2]);
const Z: V3 = [0, 0, 0];

/** Относительная скорость в осях места. */
export function relVel(p: EarthKin): V3 {
  if (p.vin === 'course') {
    const k = (p.k * Math.PI) / 180;
    return [p.v * Math.sin(k), p.v * Math.cos(k), p.vh];
  }
  return [p.vE, p.vN, p.vh];
}

export function solveEarthKin(p: EarthKin): EarthKinResult {
  const errors: string[] = [];
  const nums = [p.lat, p.h, p.R, p.omega, p.vE, p.vN, p.vh, p.v, p.k, p.dE, p.dN, p.dh];
  if (!nums.every(Number.isFinite)) errors.push('Все данные — числа.');
  if (!(p.R > 0)) errors.push('Радиус Земли R — положительное число.');
  if (!(Math.abs(p.lat) < 90)) errors.push('Широта — от −90° до 90° (на полюсе оси «восток» и «север» не определены).');
  if (!(p.R + p.h > 0)) errors.push('R + h — положительное число.');
  const base: EarthKinResult = { ok: false, errors, r: 0, Om: Z, vr: Z, ve: Z, v: Z, ae: Z, ar: Z, arCurv: Z, ac: Z, a: Z, acH: 0, acHk: 0 };
  if (errors.length) return base;
  const f = (p.lat * Math.PI) / 180,
    c = Math.cos(f),
    s = Math.sin(f),
    tg = Math.tan(f);
  const r = p.R + p.h,
    w = p.omega;
  const Om: V3 = [0, w * c, w * s];
  const vr = relVel(p);
  const [E, N, U] = vr;
  const ve: V3 = [r * w * c, 0, 0];
  const v: V3 = [ve[0] + E, N, U];
  const ae: V3 = [0, r * w * w * c * s, -r * w * w * c * c];
  const arCurv: V3 = [(E * U - E * N * tg) / r, (N * U + E * E * tg) / r, -(E * E + N * N) / r];
  const ar: V3 = [p.dE + arCurv[0], p.dN + arCurv[1], p.dh + arCurv[2]];
  const ac: V3 = [2 * w * (U * c - N * s), 2 * w * E * s, -2 * w * E * c];
  const a: V3 = [ae[0] + ar[0] + ac[0], ae[1] + ar[1] + ac[1], ae[2] + ar[2] + ac[2]];
  const acH = Math.hypot(ac[0], ac[1]);
  const acHk = acH > 0 ? ((Math.atan2(ac[0], ac[1]) * 180) / Math.PI + 360) % 360 : 0;
  return { ok: true, errors: [], r, Om, vr, ve, v, ae, ar, arCurv, ac, a, acH, acHk };
}

/** Название направления по курсу (угол от севера к востоку): «север», «северо-восток»… */
export function courseName(k: number): string {
  const names = ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад'];
  const x = ((k % 360) + 360) % 360;
  const i = Math.round(x / 45) % 8;
  return Math.abs(x - Math.round(x / 45) * 45) < 0.5 ? names[i] : `${names[i]} (курс ${Math.round(x * 10) / 10}°)`;
}

/** Сутки 24 ч: ω = 2π/86 400 с⁻¹ — с этим значением решены задачи книги; звёздные сутки — 2π/86 164. */
export const OMEGA_SOLAR = (2 * Math.PI) / 86400;
export const OMEGA_SIDEREAL = (2 * Math.PI) / 86164;
