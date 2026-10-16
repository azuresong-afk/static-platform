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
import { det, eigenSym, form, inverse, matVec, maxAbs, solve, solveComplex, zeros, type Mat } from './linalg';

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
  force: { kind: ForceKind; p: number };
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
  /** Возмущающая сила: Hs·sin pt + Hc·cos pt (постоянная — Hs). */
  Hs: number[];
  Hc: number[];
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
  /** Статическое отклонение от постоянной силы. */
  stat: number[] | null;
  /** Резонанс: номер главного колебания с k = p (без сопротивления). */
  resonance: number | null;
  forced: Forced | null;
  /** Частоты, при которых амплитуда нагруженной координаты k равна нулю. */
  zeroAt: { k: number; p: number[] } | null;
  sim: { t: number[]; q: number[][] } | null;
  afc: { p: number[]; amp: number[][] } | null;
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
  // Гироскопические члены (T линейна по скоростям при q = q*): G = ∂²T/∂q̇ᵢ∂qⱼ − ∂²T/∂q̇ⱼ∂qᵢ.
  const Gm = coords.map((_, i) => coords.map((__, j) => ev(at(d(d(T, vel(i)), pos(j))))));
  const gyro = Math.max(0, ...Gm.flatMap((r, i) => r.map((x, j) => Math.abs(x - Gm[j][i]))));
  if (gyro > 1e-9 * Math.sqrt(Math.max(1e-300, maxAbs(A) * maxAbs(C))))
    return fail('T', 'В T есть члены, линейные по скоростям (гироскопические силы) — такие системы раздел не решает.');
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
    force: { kind: 'none', p: 0 },
    info: { src: 'energy', ctx, T, P, D, a: aS, c: cS, b: bS, H: Hs, eq, hasT0: T0.length > 0 },
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
  const names = m.dofs.map((d) => (d.kind === 'y' ? 'y' : 'φ') + (d.mass + 1));
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
  switch (pr.src) {
    case 'energy': {
      const s = buildEnergy(pr.energy);
      return 'ok' in s ? s : { ...s, force: pr.force };
    }
    case 'chain':
      return buildChain(pr.chain, pr.force);
    case 'beam':
      return buildBeam(pr.beam, pr.force);
    case 'absorber':
      return buildAbsorber(pr.absorber, pr.force.p);
  }
}

/* ───────────── Анализ ───────────── */

/** Нормировка формы: первая заметная амплитуда равна 1. */
function normalize(v: number[]): { shape: number[]; ref: number } {
  const mx = Math.max(...v.map(Math.abs));
  const ref = v.findIndex((x) => Math.abs(x) > 1e-6 * mx);
  const s = v.map((x) => x / v[ref]);
  return { shape: s.map((x) => (Math.abs(x) < 1e-12 * Math.max(1, ...s.map(Math.abs)) ? 0 : x)), ref };
}

const N_AFC = 600;

export function analyze(sys: LinSys, tEnd: number): VibOut {
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
  const stat = kind === 'const' && hasH && modes.every((m) => m.kind === 'osc') ? solve(sys.C, sys.Hs) : null;
  const undamped = damping === 'none';
  let resonance: number | null = null;
  let forced: Forced | null = null;
  let zeroAt: VibResult['zeroAt'] = null;
  const dynRe = (pp: number) => sys.C.map((r, i) => r.map((c, j) => c - pp * pp * sys.A[i][j]));
  const dynIm = (pp: number) => (sys.B ? sys.B.map((r) => r.map((b) => pp * b)) : zeros(n));
  if (kind === 'harm' && hasH) {
    if (undamped) {
      const s = modes.findIndex((m) => Math.abs(m.lam - p * p) <= 1e-9 * Math.max(lamMax, p * p));
      if (s >= 0 && Math.abs(modal.F[s]) > 1e-12 * Math.max(...sys.Hs.map(Math.abs), ...sys.Hc.map(Math.abs))) resonance = s;
    }
    if (resonance == null) {
      const X = solveComplex(dynRe(p), dynIm(p), sys.Hs, sys.Hc);
      if (X) {
        const amp = X.re.map((x, j) => Math.hypot(x, X.im[j]));
        const phase = X.re.map((x, j) => Math.atan2(X.im[j], x));
        let dt: number | null = null,
          dts: number[] | null = null;
        if (undamped && sys.Hc.every((x) => x === 0)) {
          const R = dynRe(p);
          dt = det(R);
          if (n <= 3) dts = R.map((_, j) => det(R.map((row, i) => row.map((x, k) => (k === j ? sys.Hs[i] : x)))));
        }
        forced = { p, re: X.re, im: X.im, amp, phase, det: dt, dets: dts };
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
  // Численное интегрирование для графиков.
  let sim: VibResult['sim'] = null;
  const moving = sys.q0.some((x) => x !== 0) || sys.v0.some((x) => x !== 0) || (kind !== 'none' && hasH);
  const Ainv = inverse(sys.A);
  if (tEnd > 0 && moving && Ainv) {
    const kMax = Math.max(Math.sqrt(Math.max(0, lamMax)), kind === 'harm' ? p : 0);
    const steps = Math.min(200000, Math.max(2000, Math.ceil(((tEnd * kMax) / (2 * Math.PI)) * 60)));
    const h = tEnd / steps;
    const F = (t: number) =>
      kind === 'none' ? sys.Hs.map(() => 0) : kind === 'const' ? sys.Hs : sys.Hs.map((x, j) => x * Math.sin(p * t) + sys.Hc[j] * Math.cos(p * t));
    const acc = (q: number[], v: number[], t: number) => {
      const f = F(t);
      const Cq = matVec(sys.C, q),
        Bv = sys.B ? matVec(sys.B, v) : q.map(() => 0);
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
    sim = { t: ts, q: qs };
  }
  // Амплитудно-частотная характеристика.
  let afc: VibResult['afc'] = null;
  if (kind === 'harm' && hasH) {
    const kTop = Math.max(...modes.map((m) => m.k));
    const pMax = 1.5 * Math.max(kTop, p);
    const ps: number[] = [],
      amp: number[][] = sys.names.map(() => []);
    for (let i = 1; i <= N_AFC; i++) {
      const pp = (pMax * i) / N_AFC;
      const X = solveComplex(
        dynRe(pp),
        dynIm(pp),
        sys.Hs,
        sys.Hc.map((x) => (x * pp) / (p || 1)),
      );
      ps.push(pp);
      sys.names.forEach((_, j) => amp[j].push(X ? Math.hypot(X.re[j], X.im[j]) : Infinity));
    }
    afc = { p: ps, amp };
  }
  return { ok: true, sys, n, modes, repeated, damping, ortho, modal, stat, resonance, forced, zeroAt, sim, afc };
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
