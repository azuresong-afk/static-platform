/**
 * Малые колебания систем с несколькими степенями свободы (Мещерский §54; Яблонский Д.24, Д.26).
 *
 * Линейная система около устойчивого положения равновесия:
 *   A·q̈ + B·q̇ + C·q = H·sin pt + H′·cos pt   (или постоянная сила H, приложенная в момент t = 0),
 * A — матрица инерционных коэффициентов (T = ½ Σ aᵢⱼ q̇ᵢ q̇ⱼ), C — квазиупругих (Π = ½ Σ cᵢⱼ qᵢ qⱼ),
 * B — коэффициентов сопротивления (диссипативная функция Φ = ½ Σ bᵢⱼ q̇ᵢ q̇ⱼ).
 *
 * Откуда берутся матрицы:
 *   energy   — T, Π и Φ формулами, как в «Уравнениях Лагранжа»: коэффициенты — вторые производные в положении
 *              равновесия q* (в буквах и в числах); до шести координат;
 *   chain    — цепочка тел: грузы на пружинах, диски на валу, грузы на натянутой нити; концы свободны, закреплены
 *              или (левый) движутся по закону ξ₀ sin pt — кинематическое возбуждение;
 *   beam     — грузы на невесомой балке: коэффициенты влияния δᵢⱼ, C = δ⁻¹ (beam.ts);
 *   absorber — динамический гаситель: масса m₁ на пружине c₁ под силой H sin pt и гаситель m₂, c₂, подобранный так,
 *              чтобы амплитуда m₁ обратилась в нуль (54.37).
 *
 * Анализ: частоты — корни det(C − k²A) = 0 (обобщённая симметричная задача, метод Якоби); формы главных колебаний —
 * коэффициенты распределения μ (первая ненулевая амплитуда равна 1); главные координаты θₛ (q = Σ μ⁽ˢ⁾θₛ) — в них
 * T и Π распадаются на квадраты; свободное движение по начальным условиям через главные координаты; вынужденные
 * колебания — амплитуды из (C − p²A + ipB)·X = H; частоты, при которых амплитуда нагруженной координаты равна нулю
 * (гаситель, антирезонанс) — собственные частоты системы с закреплённой этой координатой; АЧХ; численное
 * интегрирование (Рунге — Кутта) для графиков.
 */
import { d, evalSym, normName, num, parseSym, sub, subst, usesTime, varsOf, type Sym, type SymContext } from '../../../shared/sym';
import type { LagParam } from '../../lagrange/model/lagrange';
import { beamModel, type BeamModel, type BeamSys } from './beam';
import { cdet, cholesky, det, eigenSym, form, inverse, matVec, maxAbs, polyRoots, solve, solveComplex, zeros, type Mat } from './linalg';

export const MAX_DOF = 6;

export type VibSrc = 'energy' | 'chain' | 'beam' | 'absorber';
export type ForceKind = 'none' | 'harm' | 'const';

export interface VibCoord {
  name: string;
  /** Положение равновесия q*. */
  eq: number;
  /** Начальное отклонение от равновесия и начальная скорость. */
  q0: number;
  v0: number;
  /** Амплитуда обобщённой возмущающей силы (формула от параметров). */
  H: string;
}
export interface EnergySys {
  coords: VibCoord[];
  params: LagParam[];
  T: string;
  P: string;
  /** Диссипативная функция Рэлея Φ (пусто — сопротивления нет). */
  D: string;
}

export type ChainKind = 'spring' | 'shaft' | 'string';
export type ChainEnd = 'free' | 'fixed' | 'moving';
export interface ChainBody {
  /** Масса (момент инерции диска). */
  m: number;
  /** Пружина, связывающая тело с неподвижной точкой. */
  cg: number;
  q0: number;
  v0: number;
  /** Амплитуда возмущающей силы (момента). */
  H: number;
}
export interface ChainLink {
  /** Жёсткость пружины (участка вала). */
  c: number;
  /** Демпфер параллельно пружине. */
  b: number;
  /** Длина участка (для вала по размерам, нити и положения узлов). */
  len: number;
  /** Диаметр участка вала (0 — жёсткость c задана). */
  d: number;
}
export interface ChainSys {
  kind: ChainKind;
  bodies: ChainBody[];
  /** n + 1 звеньев: 0 — от левого конца к первому телу, i — между телами i и i + 1, n — к правому концу. */
  links: ChainLink[];
  left: ChainEnd;
  right: 'free' | 'fixed';
  /** Модуль сдвига материала вала. */
  G: number;
  /** Натяжение нити. */
  N: number;
  /** Амплитуда (или постоянное смещение) движущегося левого конца. */
  xi0: number;
}
export interface AbsorberSys {
  m1: number;
  c1: number;
  /** c₁ = m₁p²: основная система в резонансе. */
  c1Res: boolean;
  H: number;
  /** Что задано у гасителя: наибольшая амплитуда A или масса m₂. */
  by: 'amp' | 'mass';
  A: number;
  m2: number;
}
export interface VibProblem {
  src: VibSrc;
  energy: EnergySys;
  chain: ChainSys;
  beam: BeamSys;
  absorber: AbsorberSys;
  /**
   * Возмущающая сила: cos — гармоническая H cos pt вместо H sin pt; dst — амплитуда задана статическим смещением
   * (Яблонский Д.26): столбец H — сила единичной амплитуды, F₀ = dst/(hᵀC⁻¹h) — смещение точки приложения по линии
   * действия (поворот тела под моментом) от постоянной силы F₀ равно dst; 0 — H задана прямо.
   */
  force: { kind: ForceKind; p: number; cos?: boolean; dst?: number };
  /** Время интегрирования для графиков, с (0 — без графиков движения). */
  tEnd: number;
}

export interface EnergyInfo {
  src: 'energy';
  ctx: SymContext;
  T: Sym;
  P: Sym;
  D: Sym;
  /** Коэффициенты в буквах (в положении равновесия). */
  a: Sym[][];
  c: Sym[][];
  b: Sym[][] | null;
  /** Гироскопические коэффициенты gᵢⱼ = ∂²T/∂q̇ᵢ∂qⱼ − ∂²T/∂q̇ⱼ∂qᵢ (T линейна по скоростям), null — их нет. */
  g: Sym[][] | null;
  H: Sym[];
  eq: number[];
  /** Члены T без скоростей (вращающаяся система): входят в C со знаком минус. */
  hasT0: boolean;
}
export interface ChainInfo {
  src: 'chain';
  /** Жёсткость каждого звена (NaN — звено не используется). */
  c: number[];
  used: boolean[];
}
export interface BeamInfo {
  src: 'beam';
  model: BeamModel;
}
export interface AbsorberInfo {
  src: 'absorber';
  c1: number;
  c2: number;
  m2: number;
  /** Амплитуда гасителя. */
  A2: number;
}
export interface LinSys {
  names: string[];
  angle: boolean[];
  A: Mat;
  B: Mat | null;
  C: Mat;
  /** Гироскопические силы: A·q̈ + (B + G)·q̇ + C·q = Q, G кососимметрична. */
  G?: Mat | null;
  /** Возмущающая сила: Hs·sin pt + Hc·cos pt (постоянная — Hs). */
  Hs: number[];
  Hc: number[];
  /** Сила H cos pt: Hs и Hc повёрнуты на четверть периода (Hs — бывшая часть, пропорциональная p). */
  cos?: boolean;
  /** Амплитуда по статическому смещению: h — столбец единичной силы, hᵀC⁻¹h и F₀. */
  amp?: { h: number[]; flex: number; F0: number } | null;
  q0: number[];
  v0: number[];
  force: { kind: ForceKind; p: number };
  info: EnergyInfo | ChainInfo | BeamInfo | AbsorberInfo;
}

export interface Mode {
  lam: number;
  k: number;
  kind: 'osc' | 'zero' | 'unstable';
  /** Форма: коэффициенты распределения, амплитуда координаты ref равна 1. */
  shape: number[];
  ref: number;
  /** Обобщённые масса и жёсткость главной координаты. */
  M: number;
  C: number;
  /** Сопротивление в главной координате (при «пропорциональном» сопротивлении): h и частота затухающих колебаний. */
  h: number | null;
  kd: number | null;
  /** Узлы цепочки: тело в покое или точка на звене (доля длины от левого тела). */
  nodes: ({ at: 'body'; i: number } | { at: 'link'; i: number; t: number })[];
}
export interface Forced {
  p: number;
  re: number[];
  im: number[];
  amp: number[];
  /** Фаза: qⱼ = Xⱼ·sin(pt + εⱼ). */
  phase: number[];
  /** Определитель det(C − p²A) и определители Крамера (без сопротивления, n ≤ 3). */
  det: number | null;
  dets: number[] | null;
  /** Без сопротивления и сдвига фаз: qⱼ = Xⱼ sin pt (fn = 'sin') или Xⱼ cos pt. */
  X: number[] | null;
  fn: 'sin' | 'cos' | null;
}
/**
 * Резонанс без сопротивления: qⱼ = t·(tSinⱼ sin pt + tCosⱼ cos pt) + sinⱼ sin pt + cosⱼ cos pt;
 * th — те же коэффициенты для главных координат.
 */
export interface ResonanceMotion {
  modes: number[];
  tSin: number[];
  tCos: number[];
  sin: number[];
  cos: number[];
  th: { tSin: number; tCos: number; sin: number; cos: number }[];
}
export interface VibResult {
  ok: true;
  sys: LinSys;
  n: number;
  modes: Mode[];
  repeated: boolean;
  damping: 'none' | 'prop' | 'coupled';
  /** Ортогональность форм: наибольшее |μ⁽ʳ⁾ᵀAμ⁽ˢ⁾|/√(MᵣMₛ). */
  ortho: number;
  /** Начальные условия и постоянная сила в главных координатах. */
  modal: { th0: number[]; dth0: number[]; F: number[] };
  /** Статическое отклонение от постоянной силы (при гармонической — от её амплитуды, p = 0). */
  stat: number[] | null;
  /** Парциальные частоты √(cⱼⱼ/aⱼⱼ): колеблется одна координата, остальные закреплены (n ≥ 2). */
  partial: (number | null)[] | null;
  /** Резонанс: номер главного колебания с k = p (без сопротивления). */
  resonance: number | null;
  /** Закон движения при резонансе (частное решение с вековым членом). */
  res: ResonanceMotion | null;
  forced: Forced | null;
  /** Частоты, при которых амплитуда нагруженной координаты k равна нулю. */
  zeroAt: { k: number; p: number[] } | null;
  /** Однородная цепочка как звено бесконечного фильтра (Мещерский 54.47–54.50). */
  band: Band | null;
  /** Гироскопическая система: корни det(C − k²A + ikG) = 0 и комплексные формы (Мещерский 54.20). */
  gyro: GyroInfo | null;
  sim: { t: number[]; q: number[][] } | null;
  afc: { p: number[]; amp: number[][] } | null;
}
/**
 * Полоса пропускания однородной цепочки (одинаковые тела m, пружины к неподвижным точкам c₀, звенья между телами c):
 * Xₖ₊₁ + Xₖ₋₁ = 2 cos μ·Xₖ, cos μ = 1 − (mp² − c₀)/(2c); при |cos μ| ≤ 1 амплитуды меняются от тела к телу
 * по гармоническому закону (c₀/m ≤ p² ≤ (c₀ + 4c)/m), иначе — убывают в e^κ раз (ch κ = |cos μ|), при cos μ < −1
 * с чередованием знака.
 */
export interface Band {
  m: number;
  c: number;
  c0: number;
  lo: number;
  hi: number;
  /** Для заданной частоты силы: cos μ, μ (в полосе) или κ (вне её). */
  at: { p: number; cosMu: number; mu: number | null; kappa: number | null } | null;
}
export interface GyroMode {
  /** λ = k² — корень многочлена; комплексный или отрицательный — неустойчивость. */
  lam: { re: number; im: number };
  k: number;
  kind: Mode['kind'];
  /** Форма: Aⱼ = ampⱼ·e^(i·phaseⱼ), амплитуда координаты ref равна 1. */
  amp: number[];
  phase: number[];
  ref: number;
}
export interface GyroInfo {
  /** Коэффициенты уравнения частот по степеням λ = k²: Σ pⱼλʲ = 0. */
  poly: number[];
  modes: GyroMode[];
  /** C не положительно определена, а все частоты вещественны — гироскопическая стабилизация. */
  stabilized: boolean;
}
export type VibOut = VibResult | { ok: false; field: string; error: string };

const fail = (field: string, error: string): { ok: false; field: string; error: string } => ({ ok: false, field, error });
export const isAngleName = (n: string) => /^[α-ωΑ-Ω]/.test(n);

/* ───────────── Построение матриц ───────────── */

function buildEnergy(s: EnergySys): LinSys | { ok: false; field: string; error: string } {
  const coords = s.coords.map((c) => ({ ...c, name: normName(c.name.trim()) }));
  const params = s.params.map((p) => ({ ...p, name: normName(p.name.trim()) }));
  const n = coords.length;
  if (!n) return fail('coords', 'Нужна хотя бы одна обобщённая координата.');
  if (n > MAX_DOF) return fail('coords', `Не больше ${MAX_DOF} координат.`);
  const names = [...coords.map((c) => c.name), ...params.map((p) => p.name)];
  for (const nm of names) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(nm)) return fail('names', `Имя «${nm}» — буква, затем буквы или цифры.`);
  const dup = names.find((x, i) => names.indexOf(x) !== i);
  if (dup) return fail('names', `Обозначение «${dup}» встречается дважды.`);
  if (names.includes('t')) return fail('names', 'Буква t занята под время.');
  const ctx: SymContext = { coords: coords.map((c) => c.name), params: params.map((p) => p.name) };
  const parse = (src: string, field: string): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, ctx);
    return r.ok ? r.s : fail(field, r.error);
  };
  const T = parse(s.T, 'T');
  if (!Array.isArray(T)) return T;
  const P = parse(s.P, 'P');
  if (!Array.isArray(P)) return P;
  const D = parse(s.D, 'D');
  if (!Array.isArray(D)) return D;
  if (!T.length) return fail('T', 'Задайте кинетическую энергию T.');
  if (usesTime(T) || usesTime(P) || usesTime(D)) return fail('T', 'T, Π и Φ не должны явно зависеть от времени.');
  if ([...varsOf(T).values()].some((v) => v.ord > 1)) return fail('T', 'В кинетическую энергию входят только координаты и скорости.');
  if ([...varsOf(P).values()].some((v) => v.ord > 0 && ctx.coords.includes(v.name))) return fail('P', 'Потенциальная энергия не зависит от скоростей.');
  if ([...varsOf(D).values()].some((v) => v.ord > 1)) return fail('D', 'Диссипативная функция зависит от координат и скоростей.');
  const Hs: Sym[] = [];
  for (const [j, c] of coords.entries()) {
    const h = parse(c.H, 'H' + j);
    if (!Array.isArray(h)) return h;
    if ([...varsOf(h).values()].some((v) => ctx.coords.includes(v.name)) || usesTime(h))
      return fail('H' + j, 'Амплитуда силы — число или формула от параметров (без координат и t).');
    Hs.push(h);
  }
  const pv = new Map(params.map((p) => [p.name, p.value]));
  const eq = coords.map((c) => c.eq);
  const at = (x: Sym): Sym =>
    subst(x, (a) => {
      const i = ctx.coords.indexOf(a.name);
      if (i < 0) return null;
      return a.ord === 0 ? num(eq[i]) : [];
    });
  const val = (name: string) => pv.get(name) ?? NaN;
  const ev = (x: Sym) => evalSym(x, val);
  const pos = (j: number) => ({ k: 'var' as const, name: ctx.coords[j], ord: 0 });
  const vel = (j: number) => ({ k: 'var' as const, name: ctx.coords[j], ord: 1 });
  const T0 = subst(T, (a) => (a.ord >= 1 && ctx.coords.includes(a.name) ? [] : null));
  const W = sub(P, T0);
  const aS = coords.map((_, i) => coords.map((__, j) => at(d(d(T, vel(i)), vel(j)))));
  const cS = coords.map((_, i) => coords.map((__, j) => at(d(d(W, pos(i)), pos(j)))));
  const bAll = coords.map((_, i) => coords.map((__, j) => at(d(d(D, vel(i)), vel(j)))));
  const bS = bAll.some((r) => r.some((x) => x.length)) ? bAll : null;
  const A = aS.map((r) => r.map(ev)),
    C = cS.map((r) => r.map(ev)),
    B = bS ? bS.map((r) => r.map(ev)) : null;
  const H = Hs.map(ev);
  if (![...A.flat(), ...C.flat(), ...(B ? B.flat() : []), ...H].every(Number.isFinite))
    return fail('P', 'Коэффициенты в положении равновесия не вычисляются — проверьте формулы, значения параметров и q*.');
  // Положение q* должно быть равновесием: ∂W/∂qⱼ = 0.
  // Допуск — по величине отдельных членов производной (ошибки округления) и по жёсткости.
  const gS = coords.map((_, j) => at(d(W, pos(j))));
  const g = gS.map(ev);
  const qScale = Math.max(1, ...eq.map(Math.abs));
  const bad = g.findIndex((x, j) => !(Math.abs(x) <= 1e-9 * (maxAbs(C) * qScale + gS[j].reduce((s, t) => s + Math.abs(ev([t])), 0)) + 1e-300));
  if (bad >= 0)
    return fail(
      'eq',
      `q* — не положение равновесия: ∂Π/∂${ctx.coords[bad]} = ${+g[bad].toPrecision(5)} ≠ 0. Задайте q* в таблице координат (Π можно записать относительно равновесия).`,
    );
  // Гироскопические члены (T линейна по скоростям при q = q*): gᵢⱼ = ∂²T/∂q̇ᵢ∂qⱼ − ∂²T/∂q̇ⱼ∂qᵢ.
  const Gd = coords.map((_, i) => coords.map((__, j) => at(d(d(T, vel(i)), pos(j)))));
  const gyS = coords.map((_, i) => coords.map((__, j) => sub(Gd[i][j], Gd[j][i])));
  const Gm = gyS.map((r) => r.map(ev));
  const gyro = maxAbs(Gm) > 1e-9 * Math.sqrt(Math.max(1e-300, maxAbs(A) * maxAbs(C)));
  if (gyro && !Gm.flat().every(Number.isFinite)) return fail('T', 'Гироскопические коэффициенты не вычисляются — проверьте T и q*.');
  return {
    names: ctx.coords,
    angle: ctx.coords.map(isAngleName),
    A,
    B,
    C,
    Hs: H,
    Hc: H.map(() => 0),
    q0: coords.map((c) => c.q0),
    v0: coords.map((c) => c.v0),
    G: gyro ? Gm : null,
    force: { kind: 'none', p: 0 },
    info: { src: 'energy', ctx, T, P, D, a: aS, c: cS, b: bS, g: gyro ? gyS : null, H: Hs, eq, hasT0: T0.length > 0 },
  };
}

/** Жёсткость звена цепочки. */
export function linkStiffness(s: ChainSys, l: { c: number; len: number; d: number }): number {
  if (s.kind === 'string') return l.len > 0 ? s.N / l.len : NaN;
  if (s.kind === 'shaft' && l.d > 0) return l.len > 0 ? (s.G * Math.PI * l.d ** 4) / (32 * l.len) : NaN;
  return l.c;
}

function buildChain(s: ChainSys, force: VibProblem['force']): LinSys | { ok: false; field: string; error: string } {
  const n = s.bodies.length;
  if (!n || n > MAX_DOF) return fail('chain', `Тел в цепочке — от 1 до ${MAX_DOF}.`);
  if (s.links.length !== n + 1) return fail('chain', 'Звеньев должно быть на одно больше, чем тел.');
  if (s.bodies.some((b) => !(b.m > 0))) return fail('chain', 'Массы (моменты инерции) тел — положительные.');
  if (s.kind === 'string' && !(s.N > 0)) return fail('chain', 'Натяжение нити — положительное.');
  const used = s.links.map((_, i) => (i === 0 ? s.left !== 'free' : i === n ? s.right === 'fixed' : true));
  const c = s.links.map((l, i) => (used[i] ? linkStiffness(s, l) : NaN));
  for (const [i, l] of s.links.entries()) {
    if (!used[i]) continue;
    if (s.kind === 'string' && !(l.len > 0)) return fail('chain', 'Длины участков нити — положительные.');
    if (s.kind === 'shaft' && l.d > 0 && !(l.len > 0 && s.G > 0)) return fail('chain', 'Для вала по размерам нужны длина участка и модуль сдвига G.');
    if (!(c[i] >= 0) || l.b < 0) return fail('chain', 'Жёсткости и коэффициенты сопротивления — неотрицательные.');
  }
  if (s.bodies.some((b) => b.cg < 0)) return fail('chain', 'Жёсткости пружин к неподвижным точкам — неотрицательные.');
  const A = zeros(n),
    C = zeros(n),
    B = zeros(n);
  s.bodies.forEach((b, i) => {
    A[i][i] = b.m;
    C[i][i] += b.cg;
  });
  const couple = (M: Mat, i: number, k: number) => {
    // Звено i соединяет тело i − 1 и тело i (номера с нуля); концы — с неподвижной точкой.
    const L = i - 1,
      R = i;
    if (L >= 0) M[L][L] += k;
    if (R < n) M[R][R] += k;
    if (L >= 0 && R < n) {
      M[L][R] -= k;
      M[R][L] -= k;
    }
  };
  s.links.forEach((l, i) => {
    if (!used[i]) return;
    couple(C, i, c[i]);
    if (l.b > 0) couple(B, i, l.b);
  });
  const Hs = s.bodies.map((b) => b.H),
    Hc = s.bodies.map(() => 0);
  if (s.left === 'moving' && s.xi0) {
    Hs[0] += c[0] * s.xi0;
    if (force.kind === 'harm') Hc[0] += force.p * s.links[0].b * s.xi0;
  }
  const sym = s.kind === 'shaft' ? 'φ' : 'x';
  return {
    names: s.bodies.map((_, i) => sym + (i + 1)),
    angle: s.bodies.map(() => s.kind === 'shaft'),
    A,
    B: maxAbs(B) > 0 ? B : null,
    C,
    Hs,
    Hc,
    q0: s.bodies.map((b) => b.q0),
    v0: s.bodies.map((b) => b.v0),
    force,
    info: { src: 'chain', c, used },
  };
}

function buildBeam(s: BeamSys, force: VibProblem['force']): LinSys | { ok: false; field: string; error: string } {
  const m = beamModel(s);
  if (!m.ok) return fail('beam', m.error);
  if (m.dofs.length > MAX_DOF) return fail('beam', `Не больше ${MAX_DOF} координат: грузы с моментом инерции дают по две (прогиб и поворот).`);
  const C = inverse(m.delta);
  if (!C) return fail('beam', 'Матрица коэффициентов влияния вырождена.');
  for (let i = 0; i < C.length; i++) for (let j = 0; j < i; j++) C[i][j] = C[j][i] = (C[i][j] + C[j][i]) / 2;
  const names = m.dofs.map((d) => (d.kind === 'y' ? 'y' : d.kind === 'u' ? 'x' : 'φ') + (d.mass + 1));
  return {
    names,
    angle: m.dofs.map((d) => d.kind === 'th'),
    A: m.A,
    B: null,
    C,
    Hs: m.dofs.map((d) => (d.kind === 'y' ? s.masses[d.mass].H : 0)),
    Hc: m.dofs.map(() => 0),
    q0: m.dofs.map(() => 0),
    v0: m.dofs.map(() => 0),
    force,
    info: { src: 'beam', model: m },
  };
}

/** Подбор гасителя: c₂ = m₂p² (амплитуда основной массы — нуль), амплитуда гасителя A₂ = H/c₂. */
export function designAbsorber(s: AbsorberSys, p: number): AbsorberInfo {
  const c1 = s.c1Res ? s.m1 * p * p : s.c1;
  let c2: number, m2: number;
  if (s.by === 'amp') {
    c2 = Math.abs(s.H) / s.A;
    m2 = c2 / (p * p);
  } else {
    m2 = s.m2;
    c2 = m2 * p * p;
  }
  return { src: 'absorber', c1, c2, m2, A2: s.H / c2 };
}

function buildAbsorber(s: AbsorberSys, p: number): LinSys | { ok: false; field: string; error: string } {
  if (!(s.m1 > 0)) return fail('absorber', 'Масса основной системы — положительная.');
  if (!(p > 0)) return fail('force', 'Частота возмущающей силы p — положительная.');
  if (!s.c1Res && !(s.c1 > 0)) return fail('absorber', 'Жёсткость основной системы — положительная.');
  if (s.by === 'amp' && !(s.A > 0)) return fail('absorber', 'Наибольшая амплитуда гасителя — положительная.');
  if (s.by === 'mass' && !(s.m2 > 0)) return fail('absorber', 'Масса гасителя — положительная.');
  if (!s.H) return fail('absorber', 'Задайте амплитуду возмущающей силы.');
  const info = designAbsorber(s, p);
  return {
    names: ['x1', 'x2'],
    angle: [false, false],
    A: [
      [s.m1, 0],
      [0, info.m2],
    ],
    B: null,
    C: [
      [info.c1 + info.c2, -info.c2],
      [-info.c2, info.c2],
    ],
    Hs: [s.H, 0],
    Hc: [0, 0],
    q0: [0, 0],
    v0: [0, 0],
    force: { kind: 'harm', p },
    info,
  };
}

export function buildSystem(pr: VibProblem): LinSys | { ok: false; field: string; error: string } {
  if (pr.force.kind === 'harm' && !(pr.force.p > 0) && pr.src !== 'absorber') return fail('force', 'Частота возмущающей силы p — положительная.');
  if (!(pr.tEnd >= 0)) return fail('tEnd', 'Время интегрирования — неотрицательное.');
  if (pr.force.dst != null && !Number.isFinite(pr.force.dst)) return fail('force', 'Статическое смещение — число.');
  let s: LinSys | { ok: false; field: string; error: string };
  switch (pr.src) {
    case 'energy': {
      const e = buildEnergy(pr.energy);
      s = 'ok' in e ? e : { ...e, force: pr.force };
      break;
    }
    case 'chain':
      s = buildChain(pr.chain, pr.force);
      break;
    case 'beam':
      s = buildBeam(pr.beam, pr.force);
      break;
    case 'absorber':
      return buildAbsorber(pr.absorber, pr.force.p);
  }
  return 'ok' in s ? s : withForce(s, pr.force);
}

/** Амплитуда силы по статическому смещению и сила H cos pt. */
function withForce(s: LinSys, f: VibProblem['force']): LinSys | { ok: false; field: string; error: string } {
  let Hs = s.Hs,
    Hc = s.Hc,
    amp: LinSys['amp'] = null;
  if (f.kind !== 'none' && f.dst) {
    if (Hc.some((x) => x !== 0)) return fail('force', 'Амплитуда по статическому смещению — для силы без сдвига фазы (без демпфера у движущегося конца).');
    if (!Hs.some((x) => x !== 0)) return fail('force', 'Задайте столбец H для силы единичной амплитуды — по нему находится амплитуда F₀.');
    const X = solve(s.C, Hs);
    const flex = X ? Hs.reduce((a, h, j) => a + h * X[j], 0) : NaN;
    if (!X || !(Math.abs(flex) > 1e-12 * maxAbs([X]) * maxAbs([Hs])))
      return fail('force', 'Постоянная сила не даёт определённого смещения: система может смещаться без деформации (матрица C вырождена).');
    const F0 = f.dst / flex;
    amp = { h: Hs, flex, F0 };
    Hs = Hs.map((x) => x * F0);
  }
  if (f.kind === 'harm' && f.cos) return { ...s, Hs: Hc.map((x) => (x ? -x : 0)), Hc: Hs, cos: true, amp };
  return { ...s, Hs, Hc, amp };
}

/* ───────────── Анализ ───────────── */

/** C − p²A без ошибок округления: элемент, малый по сравнению со слагаемыми, — нуль (p — парциальная частота). */
export function dynClean(sys: LinSys, p: number): Mat {
  return sys.C.map((r, i) =>
    r.map((c, j) => {
      const x = c - p * p * sys.A[i][j];
      return Math.abs(x) <= 1e-12 * (Math.abs(c) + p * p * Math.abs(sys.A[i][j])) ? 0 : x;
    }),
  );
}

/** Нормировка формы: первая заметная амплитуда равна 1. */
function normalize(v: number[]): { shape: number[]; ref: number } {
  const mx = Math.max(...v.map(Math.abs));
  const ref = v.findIndex((x) => Math.abs(x) > 1e-6 * mx);
  const s = v.map((x) => x / v[ref]);
  return { shape: s.map((x) => (Math.abs(x) < 1e-12 * Math.max(1, ...s.map(Math.abs)) ? 0 : x)), ref };
}

const N_AFC = 600;

export function analyze(sys: LinSys, tEnd: number): VibOut {
  if (sys.G) return analyzeGyro(sys, tEnd);
  const n = sys.A.length;
  const eig = eigenSym(sys.C, sys.A);
  if (!eig)
    return fail(
      'T',
      'Матрица инерционных коэффициентов не положительно определена: каждая координата должна входить в кинетическую энергию со своей скоростью.',
    );
  const lamMax = Math.max(...eig.lam.map(Math.abs));
  const zeroTol = 1e-9 * Math.max(1e-300, lamMax);
  const modes: Mode[] = eig.lam.map((lam, s) => {
    const kind: Mode['kind'] = Math.abs(lam) <= zeroTol ? 'zero' : lam < 0 ? 'unstable' : 'osc';
    const { shape, ref } = normalize(eig.vec[s]);
    const M = form(sys.A, shape, shape),
      C = kind === 'zero' ? 0 : form(sys.C, shape, shape);
    return { lam: kind === 'zero' ? 0 : lam, k: kind === 'osc' ? Math.sqrt(lam) : 0, kind, shape, ref, M, C, h: null, kd: null, nodes: [] };
  });
  const osc = modes.filter((m) => m.kind === 'osc');
  const repeated = osc.some((a, i) => osc.some((b, j) => j > i && Math.abs(a.lam - b.lam) <= 1e-7 * Math.max(a.lam, b.lam)));
  let ortho = 0;
  for (let r = 0; r < n; r++)
    for (let s = r + 1; s < n; s++) ortho = Math.max(ortho, Math.abs(form(sys.A, modes[r].shape, modes[s].shape)) / Math.sqrt(modes[r].M * modes[s].M));
  // Сопротивление в главных координатах.
  let damping: VibResult['damping'] = 'none';
  if (sys.B && maxAbs(sys.B) > 0) {
    const Bm = modes.map((r) => modes.map((s) => form(sys.B!, r.shape, s.shape)));
    const diag = Math.max(1e-300, ...Bm.map((r, i) => Math.abs(r[i])));
    const off = Math.max(0, ...Bm.flatMap((r, i) => r.filter((_, j) => j !== i).map(Math.abs)));
    damping = off <= 1e-9 * diag ? 'prop' : 'coupled';
    if (damping === 'prop')
      modes.forEach((m, i) => {
        m.h = Bm[i][i] / (2 * m.M);
        m.kd = m.kind === 'osc' && m.k > m.h ? Math.sqrt(m.k * m.k - m.h * m.h) : null;
      });
  }
  // Узлы цепочки.
  if (sys.info.src === 'chain') {
    const used = sys.info.used;
    for (const m of modes) {
      const mx = Math.max(...m.shape.map(Math.abs));
      m.shape.forEach((x, i) => {
        if (Math.abs(x) <= 1e-9 * mx) m.nodes.push({ at: 'body', i });
      });
      for (let i = 1; i < n; i++) {
        const a = m.shape[i - 1],
          b = m.shape[i];
        if (used[i] && a * b < 0) m.nodes.push({ at: 'link', i, t: a / (a - b) });
      }
    }
  }
  const modal = {
    th0: modes.map((m) => form(sys.A, m.shape, sys.q0) / m.M),
    dth0: modes.map((m) => form(sys.A, m.shape, sys.v0) / m.M),
    F: modes.map((m) => m.shape.reduce((s, x, j) => s + x * sys.Hs[j], 0)),
  };
  const kind = sys.force.kind,
    p = sys.force.p;
  const hasH = sys.Hs.some((x) => x !== 0) || sys.Hc.some((x) => x !== 0);
  // Постоянная часть силы (при H cos pt — коэффициенты при cos pt, у Hs — часть, пропорциональная p).
  const H0 = kind === 'harm' && sys.cos ? sys.Hc : sys.Hs;
  const stat = kind !== 'none' && H0.some((x) => x !== 0) && modes.every((m) => m.kind === 'osc') ? solve(sys.C, H0) : null;
  const partial = n >= 2 ? sys.C.map((r, j) => (r[j] > 0 ? Math.sqrt(r[j] / sys.A[j][j]) : null)) : null;
  const undamped = damping === 'none';
  let resonance: number | null = null;
  let res: ResonanceMotion | null = null;
  let forced: Forced | null = null;
  let zeroAt: VibResult['zeroAt'] = null;
  const dynRe = (pp: number) => sys.C.map((r, i) => r.map((c, j) => c - pp * pp * sys.A[i][j]));
  const dynIm = (pp: number) => (sys.B ? sys.B.map((r) => r.map((b) => pp * b)) : zeros(n));
  if (kind === 'harm' && hasH) {
    if (undamped) {
      const Fs = modes.map((m) => m.shape.reduce((a, x, j) => a + x * sys.Hs[j], 0)),
        Fc = modes.map((m) => m.shape.reduce((a, x, j) => a + x * sys.Hc[j], 0));
      const hMax = Math.max(...sys.Hs.map(Math.abs), ...sys.Hc.map(Math.abs));
      const near = modes.map((m) => Math.abs(m.lam - p * p) <= 1e-9 * Math.max(lamMax, p * p));
      const hit = modes.map((m, s) => near[s] && Math.abs(Fs[s]) + Math.abs(Fc[s]) > 1e-12 * hMax * Math.max(...m.shape.map(Math.abs)));
      resonance = hit.indexOf(true);
      if (resonance < 0) resonance = null;
      else {
        // θ̈ₛ + kₛ²θₛ = (Fsₛ sin pt + Fcₛ cos pt)/Mₛ: при kₛ = p — θₛ = t(Fcₛ sin pt − Fsₛ cos pt)/(2Mₛkₛ).
        const th = modes.map((m, s) => {
          if (hit[s]) return { tSin: Fc[s] / (2 * m.M * p), tCos: -Fs[s] / (2 * m.M * p), sin: 0, cos: 0 };
          if (near[s]) return { tSin: 0, tCos: 0, sin: 0, cos: 0 };
          const den = m.C - m.M * p * p;
          return { tSin: 0, tCos: 0, sin: Fs[s] / den, cos: Fc[s] / den };
        });
        const comb = (key: 'tSin' | 'tCos' | 'sin' | 'cos') => sys.names.map((_, j) => modes.reduce((a, m, s) => a + m.shape[j] * th[s][key], 0));
        res = { modes: hit.flatMap((h, s) => (h ? [s] : [])), tSin: comb('tSin'), tCos: comb('tCos'), sin: comb('sin'), cos: comb('cos'), th };
      }
    }
    if (resonance == null) {
      const X = solveComplex(dynRe(p), dynIm(p), sys.Hs, sys.Hc);
      if (X) {
        const amp = X.re.map((x, j) => Math.hypot(x, X.im[j]));
        const phase = X.re.map((x, j) => Math.atan2(X.im[j], x));
        let dt: number | null = null,
          dts: number[] | null = null,
          Xs: number[] | null = null,
          fn: Forced['fn'] = null;
        const zs = sys.Hs.every((x) => x === 0),
          zc = sys.Hc.every((x) => x === 0);
        if (undamped && (zs || zc)) {
          fn = zc ? 'sin' : 'cos';
          const H = zc ? sys.Hs : sys.Hc;
          const R = dynClean(sys, p);
          dt = det(R);
          if (n <= 3) dts = R.map((_, j) => det(R.map((row, i) => row.map((x, k) => (k === j ? H[i] : x)))));
          Xs = dts && dt ? dts.map((x) => x / dt!) : zc ? X.re : X.im;
        }
        forced = { p, re: X.re, im: X.im, amp, phase, det: dt, dets: dts, X: Xs, fn };
      }
    }
    // Амплитуда нагруженной координаты равна нулю на собственных частотах системы с закреплённой ею.
    const loaded = sys.Hs.map((x, j) => (x !== 0 || sys.Hc[j] !== 0 ? j : -1)).filter((j) => j >= 0);
    if (undamped && n >= 2 && loaded.length === 1) {
      const k = loaded[0];
      const keep = (M: Mat) => M.filter((_, i) => i !== k).map((r) => r.filter((_, j) => j !== k));
      const e = eigenSym(keep(sys.C), keep(sys.A));
      if (e) zeroAt = { k, p: e.lam.filter((l) => l > zeroTol).map(Math.sqrt) };
    }
  }
  let band: Band | null = null;
  if (sys.info.src === 'chain' && n >= 2) {
    const ch = sys.info;
    const lk = (i: number) => (ch.used[i] ? ch.c[i] : 0);
    const ci = ch.c.slice(1, n),
      m0 = sys.A[0][0];
    // Пружина к неподвижной точке у каждого тела: cᵢᵢ без звеньев цепочки.
    const cgs = sys.A.map((_, i) => sys.C[i][i] - lk(i) - lk(i + 1));
    const g0 = cgs[0];
    const same = (a: number, b: number, sc: number) => Math.abs(a - b) <= 1e-9 * sc;
    if (
      ci[0] > 0 &&
      ci.every((x) => same(x, ci[0], ci[0])) &&
      sys.A.every((r, i) => same(r[i], m0, m0)) &&
      cgs.every((x) => same(x, g0, ci[0] + Math.abs(g0)))
    ) {
      const c = ci[0],
        c0 = Math.max(0, g0);
      let at: Band['at'] = null;
      if (kind === 'harm') {
        const cosMu = 1 - (m0 * p * p - c0) / (2 * c);
        at = Math.abs(cosMu) <= 1 ? { p, cosMu, mu: Math.acos(cosMu), kappa: null } : { p, cosMu, mu: null, kappa: Math.acosh(Math.abs(cosMu)) };
      }
      band = { m: m0, c, c0, lo: Math.sqrt(c0 / m0), hi: Math.sqrt((c0 + 4 * c) / m0), at };
    }
  }
  const kTop = Math.max(...modes.map((m) => m.k));
  const sim = simulate(sys, tEnd, Math.sqrt(Math.max(0, lamMax)), sys.B);
  const afc = kind === 'harm' && hasH ? afcOf(sys, 1.5 * Math.max(kTop, p), dynRe, dynIm) : null;
  return { ok: true, sys, n, modes, repeated, damping, ortho, modal, stat, partial, resonance, res, forced, zeroAt, band, gyro: null, sim, afc };
}

/** Многочлен det(C − k²A + ikG) по степеням λ = k²: значения на окружности в плоскости k и дискретное преобразование Фурье. */
export function gyroPoly(A: Mat, G: Mat, C: Mat): { poly: number[]; scale: number } {
  const n = A.length,
    N = 2 * n + 1;
  const tr = (M: Mat) => M.reduce((s, r, i) => s + Math.abs(r[i]), 0);
  const R = Math.sqrt(Math.max(1e-300, (tr(C) + maxAbs(G) ** 2 / Math.max(1e-300, tr(A))) / Math.max(1e-300, tr(A))));
  const f: { re: number; im: number }[] = [];
  for (let m = 0; m < N; m++) {
    const th = (2 * Math.PI * m) / N;
    // k = R·e^(iθ): k² = R²e^(2iθ), ik = −R sin θ + iR cos θ.
    const Re = C.map((r, i) => r.map((c, j) => c - R * R * Math.cos(2 * th) * A[i][j] - R * Math.sin(th) * G[i][j]));
    const Im = C.map((r, i) => r.map((_, j) => -R * R * Math.sin(2 * th) * A[i][j] + R * Math.cos(th) * G[i][j]));
    f.push(cdet(Re, Im));
  }
  // Коэффициент при k^(2j), умноженный на R^(2j): многочлен от μ = λ/R².
  const poly = Array.from(
    { length: n + 1 },
    (_, j) => f.reduce((s, z, m) => s + z.re * Math.cos((2 * Math.PI * m * 2 * j) / N) + z.im * Math.sin((2 * Math.PI * m * 2 * j) / N), 0) / N,
  );
  return { poly, scale: R * R };
}

/** Комплексная форма: решение (C − k²A + ikG)·X = 0 с Xᵣ = 1 (строка с наименьшей невязкой отброшена). */
function gyroShape(A: Mat, G: Mat, C: Mat, k: number): { amp: number[]; phase: number[]; ref: number } {
  const n = A.length;
  const Re = C.map((r, i) => r.map((c, j) => c - k * k * A[i][j]));
  const Im = G.map((r) => r.map((g) => k * g));
  if (n === 1) return { amp: [1], phase: [0], ref: 0 };
  let best: { re: number[]; im: number[]; ref: number; res: number } | null = null;
  for (let ref = 0; ref < n; ref++)
    for (let drop = 0; drop < n; drop++) {
      const rows = Array.from({ length: n }, (_, i) => i).filter((i) => i !== drop),
        cols = Array.from({ length: n }, (_, j) => j).filter((j) => j !== ref);
      const x = solveComplex(
        rows.map((i) => cols.map((j) => Re[i][j])),
        rows.map((i) => cols.map((j) => Im[i][j])),
        rows.map((i) => -Re[i][ref]),
        rows.map((i) => -Im[i][ref]),
      );
      if (!x) continue;
      const re = new Array(n).fill(0),
        im = new Array(n).fill(0);
      re[ref] = 1;
      cols.forEach((j, t) => {
        re[j] = x.re[t];
        im[j] = x.im[t];
      });
      if (Math.max(...re.map((v, j) => Math.hypot(v, im[j]))) > 1 + 1e-9) continue;
      let rr = 0,
        ri = 0;
      for (let j = 0; j < n; j++) {
        rr += Re[drop][j] * re[j] - Im[drop][j] * im[j];
        ri += Re[drop][j] * im[j] + Im[drop][j] * re[j];
      }
      const res = Math.hypot(rr, ri);
      if (!best || res < best.res) best = { re, im, ref, res };
    }
  if (!best) return { amp: new Array(n).fill(NaN), phase: new Array(n).fill(NaN), ref: 0 };
  const b = best;
  return {
    amp: b.re.map((v, j) => Math.hypot(v, b.im[j])),
    phase: b.re.map((v, j) => (Math.hypot(v, b.im[j]) < 1e-12 ? 0 : Math.atan2(b.im[j], v))),
    ref: b.ref,
  };
}

/** Гироскопическая система: частоты — корни det(C − k²A + ikG) = 0, формы комплексные, движение — численно. */
function analyzeGyro(sys: LinSys, tEnd: number): VibOut {
  const n = sys.A.length,
    G = sys.G!;
  if (!cholesky(sys.A))
    return fail(
      'T',
      'Матрица инерционных коэффициентов не положительно определена: каждая координата должна входить в кинетическую энергию со своей скоростью.',
    );
  const { poly, scale } = gyroPoly(sys.A, G, sys.C);
  const big = Math.max(...poly.map(Math.abs));
  const roots = polyRoots(poly.map((x) => (Math.abs(x) < 1e-13 * big ? 0 : x))).map((z) => ({ re: z.re * scale, im: z.im * scale }));
  while (roots.length < n) roots.unshift({ re: 0, im: 0 });
  const lamMax = Math.max(...roots.map((z) => Math.hypot(z.re, z.im)));
  const tol = 1e-7 * Math.max(1e-300, lamMax);
  const modes: GyroMode[] = roots
    .map((z) => {
      const kind: Mode['kind'] = Math.hypot(z.re, z.im) <= tol ? 'zero' : Math.abs(z.im) <= tol && z.re > 0 ? 'osc' : 'unstable';
      const lam = kind === 'zero' ? { re: 0, im: 0 } : kind === 'osc' ? { re: z.re, im: 0 } : z;
      const k = kind === 'osc' ? Math.sqrt(z.re) : 0;
      const sh = kind === 'osc' ? gyroShape(sys.A, G, sys.C, k) : { amp: [], phase: [], ref: 0 };
      return { lam, k, kind, ...sh };
    })
    .sort((a, b) => (a.kind === b.kind ? a.lam.re - b.lam.re : a.kind === 'zero' ? -1 : b.kind === 'zero' ? 1 : a.kind === 'osc' ? -1 : 1));
  const stabilized = !cholesky(sys.C) && modes.every((m) => m.kind === 'osc');
  const kind = sys.force.kind,
    p = sys.force.p;
  const hasH = sys.Hs.some((x) => x !== 0) || sys.Hc.some((x) => x !== 0);
  const D = sys.B ? sys.B.map((r, i) => r.map((b, j) => b + G[i][j])) : G;
  const dynRe = (pp: number) => sys.C.map((r, i) => r.map((c, j) => c - pp * pp * sys.A[i][j]));
  const dynIm = (pp: number) => D.map((r) => r.map((x) => pp * x));
  let forced: Forced | null = null;
  if (kind === 'harm' && hasH) {
    const X = solveComplex(dynRe(p), dynIm(p), sys.Hs, sys.Hc);
    if (X)
      forced = {
        p,
        re: X.re,
        im: X.im,
        amp: X.re.map((x, j) => Math.hypot(x, X.im[j])),
        phase: X.re.map((x, j) => Math.atan2(X.im[j], x)),
        det: null,
        dets: null,
        X: null,
        fn: null,
      };
  }
  const H0 = kind === 'harm' && sys.cos ? sys.Hc : sys.Hs;
  const stat = kind !== 'none' && H0.some((x) => x !== 0) ? solve(sys.C, H0) : null;
  const kTop = Math.max(0, ...modes.map((m) => m.k));
  const sim = simulate(sys, tEnd, Math.max(kTop, Math.sqrt(lamMax)), D);
  const afc = kind === 'harm' && hasH ? afcOf(sys, 1.5 * Math.max(kTop, p), dynRe, dynIm) : null;
  const asMode = (m: GyroMode): Mode => ({
    lam: m.lam.re,
    k: m.k,
    kind: m.kind,
    shape: m.amp,
    ref: m.ref,
    M: NaN,
    C: NaN,
    h: null,
    kd: null,
    nodes: [],
  });
  return {
    ok: true,
    sys,
    n,
    modes: modes.map(asMode),
    repeated: false,
    damping: sys.B && maxAbs(sys.B) > 0 ? 'coupled' : 'none',
    ortho: 0,
    modal: { th0: [], dth0: [], F: [] },
    stat,
    partial: null,
    resonance: null,
    res: null,
    forced,
    zeroAt: null,
    band: null,
    gyro: { poly: poly.map((x, j) => x / scale ** j), modes, stabilized },
    sim,
    afc,
  };
}

/** Численное интегрирование (Рунге — Кутта) A·q̈ + D·q̇ + C·q = F(t) для графиков; D — сопротивление и гироскопические силы. */
function simulate(sys: LinSys, tEnd: number, kFree: number, D: Mat | null): VibResult['sim'] {
  const kind = sys.force.kind,
    p = sys.force.p;
  const hasH = sys.Hs.some((x) => x !== 0) || sys.Hc.some((x) => x !== 0);
  const moving = sys.q0.some((x) => x !== 0) || sys.v0.some((x) => x !== 0) || (kind !== 'none' && hasH);
  const Ainv = inverse(sys.A);
  if (!(tEnd > 0 && moving && Ainv)) return null;
  const kMax = Math.max(kFree, kind === 'harm' ? p : 0);
  const steps = Math.min(200000, Math.max(2000, Math.ceil(((tEnd * kMax) / (2 * Math.PI)) * 60)));
  const h = tEnd / steps;
  const F = (t: number) =>
    kind === 'none' ? sys.Hs.map(() => 0) : kind === 'const' ? sys.Hs : sys.Hs.map((x, j) => x * Math.sin(p * t) + sys.Hc[j] * Math.cos(p * t));
  const acc = (q: number[], v: number[], t: number) => {
    const f = F(t);
    const Cq = matVec(sys.C, q),
      Bv = D ? matVec(D, v) : q.map(() => 0);
    return matVec(
      Ainv,
      f.map((x, i) => x - Cq[i] - Bv[i]),
    );
  };
  let q = sys.q0.slice(),
    v = sys.v0.slice();
  const every = Math.max(1, Math.floor(steps / 1000));
  const ts = [0],
    qs = q.map((x) => [x]);
  for (let s = 1; s <= steps; s++) {
    const t = (s - 1) * h;
    const a1 = acc(q, v, t);
    const q2 = q.map((x, i) => x + (h / 2) * v[i]),
      v2 = v.map((x, i) => x + (h / 2) * a1[i]);
    const a2 = acc(q2, v2, t + h / 2);
    const q3 = q.map((x, i) => x + (h / 2) * v2[i]),
      v3 = v.map((x, i) => x + (h / 2) * a2[i]);
    const a3 = acc(q3, v3, t + h / 2);
    const q4 = q.map((x, i) => x + h * v3[i]),
      v4 = v.map((x, i) => x + h * a3[i]);
    const a4 = acc(q4, v4, t + h);
    q = q.map((x, i) => x + (h / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]));
    v = v.map((x, i) => x + (h / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]));
    if (!q.every(Number.isFinite)) break;
    if (s % every === 0 || s === steps) {
      ts.push(s * h);
      q.forEach((x, i) => qs[i].push(x));
    }
  }
  return { t: ts, q: qs };
}

/** Амплитудно-частотная характеристика на 0 < p ≤ pMax. */
function afcOf(sys: LinSys, pMax: number, dynRe: (pp: number) => Mat, dynIm: (pp: number) => Mat): VibResult['afc'] {
  const p = sys.force.p;
  const ps: number[] = [],
    amp: number[][] = sys.names.map(() => []);
  for (let i = 1; i <= N_AFC; i++) {
    const pp = (pMax * i) / N_AFC;
    // Часть силы от демпфера движущегося конца пропорциональна частоте (при H cos pt она в Hs).
    const X = sys.cos
      ? solveComplex(
          dynRe(pp),
          dynIm(pp),
          sys.Hs.map((x) => (x * pp) / (p || 1)),
          sys.Hc,
        )
      : solveComplex(
          dynRe(pp),
          dynIm(pp),
          sys.Hs,
          sys.Hc.map((x) => (x * pp) / (p || 1)),
        );
    ps.push(pp);
    sys.names.forEach((_, j) => amp[j].push(X ? Math.hypot(X.re[j], X.im[j]) : Infinity));
  }
  return { p: ps, amp };
}

export function solveVib(pr: VibProblem): VibOut {
  const s = buildSystem(pr);
  if ('ok' in s) return s;
  return analyze(s, pr.tEnd);
}

/** Свободное движение без сопротивления в главных координатах: qⱼ(t) = Σ μⱼ⁽ˢ⁾ θₛ(t). */
export function modalMotion(r: VibResult, t: number): number[] {
  const th = r.modes.map((m, s) => {
    const a = r.modal.th0[s],
      b = r.modal.dth0[s],
      F = r.sys.force.kind === 'const' ? r.modal.F[s] : 0;
    if (m.kind === 'zero') return a + b * t + (F * t * t) / (2 * m.M);
    if (m.kind === 'unstable') return NaN;
    return a * Math.cos(m.k * t) + (b / m.k) * Math.sin(m.k * t) + (F / m.C) * (1 - Math.cos(m.k * t));
  });
  return r.sys.names.map((_, j) => r.modes.reduce((s, m, k) => s + m.shape[j] * th[k], 0));
}

/**
 * Свободное движение без сопротивления: qⱼ(t) = Σₛ (Dⱼₛ cos kₛt + Eⱼₛ sin kₛt); для нулевой частоты — Dⱼₛ + Eⱼₛ·t.
 * Dⱼₛ = μⱼ⁽ˢ⁾θₛ(0), Eⱼₛ = μⱼ⁽ˢ⁾θ̇ₛ(0)/kₛ (при kₛ = 0 — μⱼ⁽ˢ⁾θ̇ₛ(0)).
 */
export function freeCoefs(r: VibResult): { D: number[][]; E: number[][] } {
  const D = r.sys.names.map((_, j) => r.modes.map((m, s) => m.shape[j] * r.modal.th0[s]));
  const E = r.sys.names.map((_, j) => r.modes.map((m, s) => (m.shape[j] * r.modal.dth0[s]) / (m.kind === 'osc' ? m.k : 1)));
  return { D, E };
}
