/**
 * Тонкостенный осесимметричный сосуд по безмоментной теории (Антонов, задача 4).
 *
 * Сосуд — участки снизу вверх: цилиндр, конус, сферический сегмент (купол или днище), эллипсоидальное днище.
 * Нагрузка: давление газа p_г над жидкостью и гидростатика ρg(z_ж − z) ниже уровня жидкости z_ж (уровень может быть
 * выше крышки — пьезометр). Собственный вес стенок не учитываем. Опора — на дне (z = 0) или на лапах на высоте z_оп.
 *
 * Меридиональное напряжение — из равновесия нижней части, отсечённой горизонтальной плоскостью z:
 *   σ_m·δ·2πr·sin β = p(z)·πr² + G_ниже(z) − R_ниже(z),
 * β — угол нормали к оси (sin β = |dz/ds|), G — вес жидкости ниже z, R — реакция опор, лежащих ниже z
 * (вся реакция равна весу жидкости: давление газа уравновешено внутри сосуда).
 * Окружное — из уравнения Лапласа: σ_m/ρ_m + σ_t/ρ_t = p/δ, ρ_t = r/sin β.
 * Эквивалентное по III гипотезе (σ_r ≈ 0): σ_экв = max(σ₁) − min(σ₃) по σ_t, σ_m, 0; δ = max(σ_экв·δ)/[σ].
 */
export type SegKind = 'cyl' | 'cone' | 'sph' | 'ell';
export interface Segment {
  kind: SegKind;
  /** Радиусы внизу и вверху участка, м (у цилиндра — один радиус r1, высота h). */
  r1: number;
  r2: number;
  /** Цилиндр: высота; конус: половина угла при вершине, градусы; сфера: радиус сферы; эллипсоид: высота днища. */
  p: number;
  h: number;
}
export interface VesselProblem {
  segs: Segment[];
  /** Давление газа, МПа. */
  pg: number;
  /** Плотность жидкости, кг/м³ (0 — жидкости нет). */
  rho: number;
  /** Уровень жидкости от низа сосуда, м. */
  level: number;
  support: 'ground' | 'lugs';
  /** Высота лап от низа, м. */
  zs: number;
  /** Допускаемое напряжение, МПа. */
  sigma: number;
  g: number;
}

export interface MeridianPt {
  seg: number;
  z: number;
  r: number;
  /** sin β = |dz/ds|, ρ_m (Infinity — прямая образующая). */
  sb: number;
  rm: number;
  p: number;
  /** Усилия на единицу длины: N_m = σ_m·δ, N_t = σ_t·δ, Н/м (МПа·м = МН/м). */
  Nm: number;
  Nt: number;
  Neq: number;
}
export interface SegInfo {
  z0: number;
  z1: number;
  rb: number;
  rt: number;
}
export interface VesselResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  segs: SegInfo[];
  pts: MeridianPt[];
  height: number;
  volume: number;
  /** Вес жидкости, МН. */
  G: number;
  /** Толщина стенки, м, и точка, где достигается максимум σ_экв. */
  delta: number;
  crit: MeridianPt | null;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Точки меридиана участка: u ∈ [0, 1] → (r, z от низа участка, sin β, ρ_m). */
function segPoint(s: Segment, u: number): { r: number; z: number; sb: number; rm: number } {
  if (s.kind === 'cyl') return { r: s.r1, z: u * s.h, sb: 1, rm: Infinity };
  if (s.kind === 'cone') {
    const a = rad(s.p);
    const h = Math.abs(s.r2 - s.r1) / Math.tan(a);
    return { r: s.r1 + (s.r2 - s.r1) * u, z: u * h, sb: Math.cos(a), rm: Infinity };
  }
  if (s.kind === 'sph') {
    const R = s.p;
    // Купол (радиус убывает вверх): центр ниже; днище (радиус растёт вверх): центр выше.
    const dome = s.r2 < s.r1;
    const t1 = Math.asin(Math.min(1, s.r1 / R)),
      t2 = Math.asin(Math.min(1, s.r2 / R));
    const th = t1 + (t2 - t1) * u;
    const z = dome ? R * (Math.cos(th) - Math.cos(t1)) : R * (Math.cos(t1) - Math.cos(th));
    return { r: R * Math.sin(th), z, sb: Math.sin(th), rm: R };
  }
  // Эллипсоид вращения: полуоси a (радиус основания), b = h (высота днища); u — от основания к полюсу или наоборот.
  const a = Math.max(s.r1, s.r2),
    b = s.h;
  const dome = s.r2 < s.r1;
  const v = dome ? (Math.PI / 2) * (1 - u) : (Math.PI / 2) * u; // v — угол от полюса
  const r = a * Math.sin(v),
    zz = b * Math.cos(v);
  const z = dome ? zz : b - zz;
  // Производные по v: r' = a cos v, z' = −b sin v; ρ_m = (r'² + z'²)^{3/2}/(ab).
  const rp = a * Math.cos(v),
    zp = b * Math.sin(v);
  const ds = Math.hypot(rp, zp);
  return { r, z, sb: ds > 0 ? zp / ds : 1, rm: ds ** 3 / (a * b) };
}

export function segHeight(s: Segment): number {
  if (s.kind === 'cyl') return s.h;
  if (s.kind === 'cone') return Math.abs(s.r2 - s.r1) / Math.tan(rad(s.p));
  if (s.kind === 'sph') {
    const R = s.p,
      t1 = Math.asin(Math.min(1, s.r1 / R)),
      t2 = Math.asin(Math.min(1, s.r2 / R));
    return Math.abs(R * (Math.cos(t1) - Math.cos(t2)));
  }
  return s.h;
}

export function solveVessel(pr: VesselProblem): VesselResult {
  const errors: string[] = [],
    warnings: string[] = [];
  const empty: VesselResult = { ok: false, errors, warnings, segs: [], pts: [], height: 0, volume: 0, G: 0, delta: 0, crit: null };
  if (!pr.segs.length) errors.push('Добавьте хотя бы один участок.');
  pr.segs.forEach((s, i) => {
    const w = `Участок ${i + 1}`;
    if (![s.r1, s.r2, s.p, s.h].every(Number.isFinite)) errors.push(`${w}: значения — числа.`);
    if (s.kind === 'cyl' && !(s.r1 > 0 && s.h > 0)) errors.push(`${w}: радиус и высота цилиндра — положительные.`);
    if (s.kind === 'cone') {
      if (!(s.p > 0 && s.p < 90)) errors.push(`${w}: половина угла конуса — от 0 до 90°.`);
      if (!(s.r1 >= 0 && s.r2 >= 0) || s.r1 === s.r2) errors.push(`${w}: радиусы конуса неотрицательны и различны.`);
    }
    if (s.kind === 'sph') {
      if (!(s.p > 0)) errors.push(`${w}: радиус сферы — положительный.`);
      else if (s.r1 > s.p + 1e-9 || s.r2 > s.p + 1e-9) errors.push(`${w}: радиус сечения больше радиуса сферы.`);
      if (s.r1 === s.r2) errors.push(`${w}: радиусы краёв сферического участка должны различаться (один из них — 0 у полюса).`);
    }
    if (s.kind === 'ell' && (!(s.h > 0) || Math.min(s.r1, s.r2) !== 0 || Math.max(s.r1, s.r2) <= 0)) errors.push(`${w}: эллиптическое днище — от радиуса a до полюса (один из радиусов 0), высота b > 0.`);
  });
  if (!(pr.sigma > 0)) errors.push('Допускаемое напряжение — положительное.');
  if (!(pr.rho >= 0) || !(pr.pg >= 0)) errors.push('Давление газа и плотность — неотрицательные.');
  if (errors.length) return empty;
  // Стыки: радиусы соседних участков должны совпадать.
  for (let i = 1; i < pr.segs.length; i++) {
    const a = pr.segs[i - 1],
      b = pr.segs[i];
    const top = a.kind === 'cyl' ? a.r1 : a.r2,
      bot = b.r1;
    if (Math.abs(top - bot) > 1e-6 * Math.max(1, top)) warnings.push(`Стык участков ${i} и ${i + 1}: радиусы ${+top.toFixed(4)} и ${+bot.toFixed(4)} не совпадают — между ними плоское кольцо, оно не рассчитывается.`);
  }
  // Меридиан.
  const segs: SegInfo[] = [];
  const raw: { seg: number; z: number; r: number; sb: number; rm: number }[] = [];
  let z0 = 0;
  const N = 240;
  pr.segs.forEach((s, i) => {
    const h = segHeight(s);
    segs.push({ z0, z1: z0 + h, rb: s.r1, rt: s.kind === 'cyl' ? s.r1 : s.r2 });
    for (let j = 0; j <= N; j++) {
      // У полюса и вершины (r = 0) берём точку чуть в стороне.
      const u = Math.min(1 - 1e-6, Math.max(1e-6, j / N));
      const q = segPoint(s, j === 0 || j === N ? (s.kind === 'cyl' ? j / N : u) : u);
      raw.push({ seg: i, z: z0 + q.z, r: q.r, sb: q.sb, rm: q.rm });
    }
    z0 += h;
  });
  const height = z0;
  // Объём ниже z (по меридиану), трапеции по z.
  const sorted = raw.map((q) => [q.z, q.r] as [number, number]);
  const volBelow = (z: number) => {
    let v = 0;
    for (let i = 1; i < sorted.length; i++) {
      const [za, ra] = sorted[i - 1],
        [zb, rb] = sorted[i];
      if (zb <= za) continue;
      const lo = za,
        hi = Math.min(zb, z);
      if (hi <= lo) continue;
      const rr = (x: number) => ra + ((rb - ra) * (x - za)) / (zb - za);
      // Интеграл πr² по [lo, hi] (r линейна) — формулой Симпсона, она точна для квадратичной функции.
      const m = (lo + hi) / 2;
      v += (Math.PI * (hi - lo) * (rr(lo) ** 2 + 4 * rr(m) ** 2 + rr(hi) ** 2)) / 6;
    }
    return v;
  };
  const volume = volBelow(height);
  const gamma = (pr.rho * pr.g) / 1e6; // МН/м³
  const zL = pr.level;
  const G = gamma * volBelow(Math.min(zL, height));
  const zS = pr.support === 'ground' ? 0 : pr.zs;
  if (pr.support === 'lugs' && !(zS > 0 && zS <= height + 1e-9)) errors.push(`Лапы должны быть на высоте от 0 до ${+height.toFixed(4)} м.`);
  if (errors.length) return { ...empty, errors };
  const pts: MeridianPt[] = raw.map((q) => {
    const p = pr.pg + gamma * Math.max(0, zL - q.z);
    const Gb = gamma * volBelow(Math.min(zL, q.z));
    const Rb = q.z > zS + 1e-12 ? G : 0;
    const F = p * Math.PI * q.r * q.r + Gb - Rb;
    const Nm = q.r > 0 && q.sb > 1e-12 ? F / (2 * Math.PI * q.r * q.sb) : 0;
    const rt = q.r / q.sb;
    const Nt = rt * (p - (Number.isFinite(q.rm) ? Nm / q.rm : 0));
    const s1 = Math.max(Nt, Nm, 0),
      s3 = Math.min(Nt, Nm, 0);
    return { ...q, p, Nm, Nt, Neq: s1 - s3 };
  });
  let crit: MeridianPt | null = null;
  for (const q of pts) if (!crit || q.Neq > crit.Neq) crit = q;
  const delta = crit ? crit.Neq / pr.sigma : 0;
  if (pr.level > height + 1e-9 && pr.pg > 0) warnings.push('Уровень жидкости выше крышки и задано давление газа: газ над жидкостью при полном сосуде отсутствует — проверьте данные.');
  return { ok: true, errors: [], warnings, segs, pts, height, volume, G, delta, crit };
}
