/**
 * Движение точки вблизи поверхности вращающейся Земли (Мещерский 33.4–33.5, 33.15–33.18, 23.52).
 *
 * Оси места: x — на восток, y — на север, z — вверх; широта φ, Ω = ω(0, cos φ, sin φ). Уравнение относительного
 * движения m·a_r = mg + Φ_c, где g — ускорение силы тяжести на месте (сила притяжения вместе с переносной силой
 * инерции −m·a_e, направлена по отвесу), Φ_c = −2mΩ × v_r — кориолисова сила инерции. Вопросы:
 *  - fall  — свободное движение с высоты h с начальной скоростью (v_E, v_N, v_h) до падения на Землю (z = 0):
 *    уравнение r̈ = −g·e_z − 2Ω × ṙ интегрируется численно (Рунге — Кутта), отклонение — от точки падения без
 *    вращения Земли; для падения из покоя приближённо x = ⅓ωgT³cos φ на восток;
 *  - line  — движение по горизонтальной прямой со скоростью v курсом k: горизонтальная кориолисова сила
 *    2mωv sin φ вправо от скорости (в северном полушарии) — давление на рельс, перекос поверхности воды
 *    tg β = 2ωv sin φ/g и, если вбок движение свободно, отклонение d = ½·2ωv sin φ·t² = ω sin φ·L²/v на пути L;
 *    вертикальная составляющая 2mωv_E cos φ уменьшает давление при движении на восток;
 *  - pend  — маятник Фуко: плоскость качаний поворачивается по часовой стрелке (если смотреть сверху, северное
 *    полушарие) с угловой скоростью ω sin φ; поворот на ψ — за t = ψ/(ω sin φ);
 *  - g     — ускорение силы тяжести на широте φ: g(φ) = |g₀ − ω²R cos φ·(к оси)|, g₀ — на полюсе;
 *    g(φ) ≈ g₀(1 − cos²φ/n), n = g₀/(ω²R); на экваторе вес исчезает при ω' = ω√n.
 */

export interface EarthDyn {
  byWeight: boolean;
  m: number;
  g: number;
  lat: number;
  omega: number;
  R: number;
  ask: 'fall' | 'line' | 'pend' | 'g';
  h: number;
  vE: number;
  vN: number;
  vh: number;
  v: number;
  k: number;
  L: number;
  b: number;
  psi: number;
}

type V3 = [number, number, number];
export interface EarthFall {
  T: number;
  /** Точка падения с вращением и без него; отклонение (восток, север). */
  land: V3;
  land0: V3;
  dev: [number, number];
  vLand: V3;
  /** Приближение: падение из покоя — ⅓ωgT³cos φ на восток. */
  approxE: number | null;
  path: V3[];
  path0: V3[];
}
export interface EarthLine {
  vE: number;
  vN: number;
  /** Горизонтальная кориолисова составляющая (модуль) и её курс; кориолисова сила инерции −m·a_c. */
  acH: number;
  acV: number;
  FH: number;
  FV: number;
  /** Курс силы инерции (вправо от скорости в северном полушарии). */
  FHk: number;
  t: number;
  dev: number;
  tanB: number;
  dh: number;
}
export interface EarthPend {
  rate: number;
  t: number;
  T: number;
  Thalf: number;
}
export interface EarthG {
  aOmega: number;
  gPhi: number;
  gApprox: number;
  n: number;
  wMul: number;
  /** Угол отвеса с направлением к центру Земли, °. */
  dev: number;
  P: number;
}
export interface EarthDynResult {
  ok: boolean;
  errors: string[];
  mass: number;
  fall?: EarthFall;
  line?: EarthLine;
  pend?: EarthPend;
  gr?: EarthG;
}

const D = Math.PI / 180;

/** Правая часть r̈ = −g·e_z − 2Ω × ṙ; состояние [x, y, z, ẋ, ẏ, ż]. */
function rhs(s: number[], g: number, Om: V3): number[] {
  const [vx, vy, vz] = [s[3], s[4], s[5]];
  const c: V3 = [Om[1] * vz - Om[2] * vy, Om[2] * vx - Om[0] * vz, Om[0] * vy - Om[1] * vx];
  return [vx, vy, vz, -2 * c[0], -2 * c[1], -g - 2 * c[2]];
}
function rk4(s: number[], dt: number, g: number, Om: V3): number[] {
  const k1 = rhs(s, g, Om);
  const k2 = rhs(
    s.map((q, i) => q + (dt / 2) * k1[i]),
    g,
    Om,
  );
  const k3 = rhs(
    s.map((q, i) => q + (dt / 2) * k2[i]),
    g,
    Om,
  );
  const k4 = rhs(
    s.map((q, i) => q + dt * k3[i]),
    g,
    Om,
  );
  return s.map((q, i) => q + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** Интегрирование до z = 0: шаг — по оценке времени полёта, корень уточняется делением шага пополам. */
function flight(h: number, v0: V3, g: number, Om: V3): { T: number; end: number[]; path: V3[] } {
  const T0 = (v0[2] + Math.sqrt(v0[2] * v0[2] + 2 * g * h)) / g;
  const n = 4000,
    dt = T0 / n;
  let s = [0, 0, h, ...v0],
    t = 0;
  const path: V3[] = [[0, 0, h]];
  for (let i = 0; i < 4 * n; i++) {
    const nx = rk4(s, dt, g, Om);
    if (nx[2] <= 0 && t > 0) {
      // Корень на шаге: делим шаг пополам.
      let lo = 0,
        hi = dt;
      for (let j = 0; j < 60; j++) {
        const mid = (lo + hi) / 2;
        if (rk4(s, mid, g, Om)[2] > 0) lo = mid;
        else hi = mid;
      }
      const end = rk4(s, (lo + hi) / 2, g, Om);
      path.push([end[0], end[1], end[2]]);
      return { T: t + (lo + hi) / 2, end, path };
    }
    s = nx;
    t += dt;
    if (i % 40 === 39) path.push([s[0], s[1], s[2]]);
  }
  return { T: NaN, end: s, path };
}

export function solveEarthDyn(p: EarthDyn): EarthDynResult {
  const errors: string[] = [];
  const nums = [p.m, p.g, p.lat, p.omega, p.R, p.h, p.vE, p.vN, p.vh, p.v, p.k, p.L, p.b, p.psi];
  if (!nums.every(Number.isFinite)) errors.push('Все данные — числа.');
  if (!(p.g > 0)) errors.push('g — положительное число.');
  if (!(Math.abs(p.lat) <= 90)) errors.push('Широта — от −90° до 90°.');
  if (!(p.m > 0)) errors.push(p.byWeight ? 'Вес P — положительное число.' : 'Масса m — положительное число.');
  if (p.ask === 'fall' && !(p.h >= 0)) errors.push('Высота h — неотрицательное число.');
  if (p.ask === 'fall' && p.h === 0 && !(p.vh > 0)) errors.push('С высоты h = 0 точка должна подниматься: v_h > 0.');
  if (p.ask === 'g' && !(p.R > 0)) errors.push('Радиус Земли R — положительное число.');
  const mass = p.byWeight ? p.m / p.g : p.m;
  const base: EarthDynResult = { ok: false, errors, mass };
  if (errors.length) return base;
  const f = p.lat * D,
    c = Math.cos(f),
    s = Math.sin(f),
    w = p.omega;
  if (p.ask === 'fall') {
    const Om: V3 = [0, w * c, w * s];
    const v0: V3 = [p.vE, p.vN, p.vh];
    const a = flight(p.h, v0, p.g, Om),
      b = flight(p.h, v0, p.g, [0, 0, 0]);
    if (!Number.isFinite(a.T) || !Number.isFinite(b.T)) return { ...base, errors: ['Точка не падает на Землю.'] };
    const land: V3 = [a.end[0], a.end[1], 0],
      land0: V3 = [b.end[0], b.end[1], 0];
    const rest = p.vE === 0 && p.vN === 0 && p.vh === 0;
    return {
      ...base,
      ok: true,
      fall: {
        T: a.T,
        land,
        land0,
        dev: [land[0] - land0[0], land[1] - land0[1]],
        vLand: [a.end[3], a.end[4], a.end[5]],
        approxE: rest ? (w * p.g * a.T ** 3 * c) / 3 : null,
        path: a.path,
        path0: b.path,
      },
    };
  }
  if (p.ask === 'line') {
    if (!(p.v >= 0)) return { ...base, errors: ['Скорость v — неотрицательное число.'] };
    const vE = p.v * Math.sin(p.k * D),
      vN = p.v * Math.cos(p.k * D);
    const ac: V3 = [-2 * w * vN * s, 2 * w * vE * s, -2 * w * vE * c];
    const acH = Math.hypot(ac[0], ac[1]);
    // Сила инерции −m·a_c: горизонтальная — вправо от скорости при φ > 0.
    const FHk = acH > 0 ? (((Math.atan2(-ac[0], -ac[1]) / D) % 360) + 360) % 360 : 0;
    const t = p.v > 0 ? p.L / p.v : 0;
    return {
      ...base,
      ok: true,
      line: { vE, vN, acH, acV: ac[2], FH: mass * acH, FV: -mass * ac[2], FHk, t, dev: 0.5 * acH * t * t, tanB: acH / p.g, dh: (p.b * acH) / p.g },
    };
  }
  if (p.ask === 'pend') {
    const rate = w * Math.abs(s);
    if (!(rate > 0)) return { ...base, errors: ['На экваторе (или при ω = 0) плоскость качаний не поворачивается.'] };
    return { ...base, ok: true, pend: { rate, t: (p.psi * D) / rate, T: (2 * Math.PI) / rate, Thalf: Math.PI / rate } };
  }
  const aOm = w * w * p.R * c;
  // g₀ — к центру, a_e — к оси: g(φ) = g₀·(−e_r) + ω²R cos φ·e_⊥ (от оси).
  const gx = -p.g * c + aOm,
    gy = -p.g * s;
  const gPhi = Math.hypot(gx, gy);
  const n = p.g / (w * w * p.R);
  const dev = Math.abs(Math.atan2(gx * s - gy * c, -(gx * c + gy * s))) / D;
  return { ...base, ok: true, gr: { aOmega: aOm, gPhi, gApprox: p.g * (1 - (c * c) / n), n, wMul: Math.sqrt(n), dev, P: mass * gPhi } };
}
