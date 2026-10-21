/**
 * Стержневые системы при растяжении-сжатии (Антонов, гл. 3, п. 4.5): узел или абсолютно жёсткий брус на упругих
 * стержнях с шарнирами на концах; брус может опираться на шарнирно-неподвижную опору или катки.
 *
 * Метод перемещений, малые перемещения. Обобщённые координаты: у узла — перемещения (u, v), у бруса — перемещения
 * (u, v) его левого конца и угол поворота θ (против часовой стрелки). Точка бруса с координатой X смещается на
 * (u, v + θX). Стержень i присоединён к точке P_i, идёт к неподвижному шарниру под углом φ_i (от оси x против часовой
 * стрелки), длина l_i. Орт e_i — от неподвижного шарнира к телу; удлинение стержня Δl_i = d(P_i)·e_i.
 * Закон Гука с нагревом и неточностью изготовления:
 *   Δl_i = N_i l_i/(E_i A_i) + α_i ΔT_i l_i + δ_i,  δ_i > 0 — стержень изготовлен длиннее проектной длины.
 * Стержень тянет тело к неподвижному шарниру: сила на тело −N_i e_i. Опоры бруса — связи на перемещения точки.
 *
 * Единицы: силы — кН, длины — м, площади — см², E и напряжения — МПа, α — 1/К, ΔT — К, δ и перемещения — мм.
 * Внутри — Н и мм: k = EA/l (Н/мм), σ = N/A (МПа).
 */
import { linprog } from '../../../shared/lp';
import { rankOf } from '../../../shared/rank';

export type BodyKind = 'node' | 'bar';
export type Ask = 'check' | 'design' | 'allow' | 'limit';

export interface Rod {
  /** Точка крепления на брусе, м от левого конца (у узла не используется). */
  x: number;
  /** Направление от тела к неподвижному шарниру, градусы от оси x против часовой стрелки. */
  ang: number;
  /** Длина, м. */
  l: number;
  /** Площадь в долях A: A_i = c·A. */
  c: number;
  /** Модуль упругости, МПа. */
  E: number;
  /** Коэффициент линейного расширения, 1/К. */
  alpha: number;
  /** Нагрев, К (охлаждение — «−»). */
  dT: number;
  /** Неточность изготовления, мм: «+» — стержень длиннее проектной длины, «−» — короче. */
  delta: number;
}

export interface Support {
  /** pin — шарнирно-неподвижная опора; roller — каток (реакция по направлению ang). */
  kind: 'pin' | 'roller';
  x: number;
  ang: number;
}

export interface Load {
  /** F — сила в точке x под углом ang; M — пара (кН·м, «+» — против часовой); q — равномерная нагрузка вниз на [x, x2], кН/м. */
  kind: 'F' | 'M' | 'q';
  x: number;
  x2: number;
  F: number;
  ang: number;
}

export interface RodProblem {
  body: BodyKind;
  /** Длина бруса, м. */
  L: number;
  supports: Support[];
  rods: Rod[];
  loads: Load[];
  /** Площадь A, см² (для подбора — не используется). */
  A: number;
  ask: Ask;
  /** Допускаемое напряжение, МПа. */
  sAllow: number;
  /** Предел текучести, МПа. */
  sT: number;
  /** Коэффициент запаса по предельной нагрузке. */
  n: number;
}

export interface RodState {
  /** Продольная сила, кН (растяжение «+»). */
  N: number;
  /** Удлинение, мм, и его части: от силы, от нагрева, неточность. */
  dl: number;
  dlN: number;
  dlT: number;
  delta: number;
  /** Площадь, см²; напряжение, МПа. */
  A: number;
  sigma: number;
  /** Жёсткость EA/l, кН/мм. */
  k: number;
  /** Строка совместности: Δl_i = Σ g_j·r_j по свободным координатам. */
  g: number[];
}

export interface Equilibrium {
  /** Свободная координата: u, v (мм) или θ (рад). */
  dof: 'u' | 'v' | 'theta';
  /** Коэффициенты при N_i (сила в стержне входит как −N_i·g_ij) и правая часть — обобщённая сила нагрузки. */
  rodCoef: number[];
  load: number;
  /** Столбец базиса: как меняются (u, v, θ) при изменении этой координаты на 1. */
  z: number[];
}

export interface Solved {
  /** Свободные координаты и их значения (мм или рад). */
  dofs: Equilibrium['dof'][];
  r: number[];
  /** Полные перемещения: u, v левого конца (узла), мм; θ, рад. */
  u: number;
  v: number;
  theta: number;
  rods: RodState[];
  /** Реакции опор, кН (по направлениям связей). */
  reactions: { support: number; dir: 'x' | 'y' | 'r'; ang: number; R: number }[];
  eqs: Equilibrium[];
}

export interface RodResult {
  ok: boolean;
  errors: string[];
  /** Число неизвестных усилий, независимых уравнений равновесия, степень статической неопределимости. */
  unknowns: number;
  equations: number;
  degree: number;
  /** Все стержни на одной прямой и нагрузка вдоль неё — задача одномерная. */
  collinear: boolean;
  /** Состояние при заданной нагрузке (и площади A). */
  base: Solved | null;
  /** Части: только от нагрузки и только от нагрева и неточности (при той же A). */
  loadOnly: Solved | null;
  thermal: Solved | null;
  /** Уравнения совместности: Δl_k = Σ w_kj·Δl_base_j. */
  compat: { k: number; base: number[]; w: number[] }[];
  /** Проверка прочности. */
  sigmaMax: { v: number; i: number } | null;
  check: boolean | null;
  nT: number | null;
  /** Подбор площади: наименьшая (и, если есть, наибольшая) A, см². */
  design: { Amin: number; Amax: number | null; gov: number; a: number[]; b: number[] } | null;
  /** Допускаемый множитель нагрузки по допускаемым напряжениям. */
  allow: { lam: number; lamMin: number | null; gov: number } | null;
  /** Предельное состояние: начало текучести, предельный множитель, усилия в предельном состоянии. */
  limit: { lamT: number; firstYield: number; lamU: number; Nu: number[]; atYield: boolean[]; lamAllow: number; sAllowUsed: number } | null;
  /** Невязка равновесия (контроль). */
  residual: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);

interface Geo {
  ndof: number;
  /** Строки g_i (удлинение через q) и обобщённые силы нагрузок. */
  g: number[][];
  F: number[];
  C: number[][];
  cInfo: { support: number; dir: 'x' | 'y' | 'r'; ang: number }[];
  k: number[];
  A: number[];
  d0: number[];
}

/** Геометрия и жёсткости в Н и мм. */
function geometry(pr: RodProblem, A: number, scale: number, withThermal: boolean, withLoad: boolean): Geo {
  const bar = pr.body === 'bar';
  const ndof = bar ? 3 : 2;
  const row = (X: number, ex: number, ey: number) => (bar ? [ex, ey, ey * X] : [ex, ey]);
  const g = pr.rods.map((r) => {
    const ex = -Math.cos(rad(r.ang)),
      ey = -Math.sin(rad(r.ang));
    return row(bar ? r.x * 1000 : 0, clean(ex), clean(ey));
  });
  const Ai = pr.rods.map((r) => r.c * A * 100);
  const k = pr.rods.map((r, i) => (r.E * Ai[i]) / (r.l * 1000));
  const d0 = pr.rods.map((r) => (withThermal ? r.alpha * r.dT * r.l * 1000 + r.delta : 0));
  const F = new Array(ndof).fill(0);
  if (withLoad)
    for (const ld of pr.loads) {
      if (ld.kind === 'F') {
        const fx = clean(Math.cos(rad(ld.ang))) * ld.F * 1000 * scale,
          fy = clean(Math.sin(rad(ld.ang))) * ld.F * 1000 * scale;
        const r = row(bar ? ld.x * 1000 : 0, fx, fy);
        r.forEach((v, j) => (F[j] += v));
      } else if (ld.kind === 'M' && bar) F[2] += ld.F * 1e6 * scale;
      else if (ld.kind === 'q' && bar) {
        const Q = ld.F * (ld.x2 - ld.x) * 1000 * scale; // кН/м = Н/мм
        const xm = ((ld.x + ld.x2) / 2) * 1000;
        F[1] -= Q;
        F[2] -= Q * xm;
      }
    }
  const C: number[][] = [];
  const cInfo: Geo['cInfo'] = [];
  if (bar)
    pr.supports.forEach((s, j) => {
      const X = s.x * 1000;
      if (s.kind === 'pin') {
        C.push([1, 0, 0], [0, 1, X]);
        cInfo.push({ support: j, dir: 'x', ang: 0 }, { support: j, dir: 'y', ang: 90 });
      } else {
        const c = clean(Math.cos(rad(s.ang))),
          sn = clean(Math.sin(rad(s.ang)));
        C.push([c, sn, sn * X]);
        cInfo.push({ support: j, dir: 'r', ang: s.ang });
      }
    });
  return { ndof, g, F, C, cInfo, k, A: Ai, d0 };
}

/** Свободные координаты: исключаем ведущие переменные связей (приведённая ступенчатая форма C). */
function freeBasis(C: number[][], ndof: number): { Z: number[][]; free: number[] } | null {
  const M = C.map((r) => r.slice());
  const piv: number[] = [];
  let row = 0;
  for (let c = 0; c < ndof && row < M.length; c++) {
    let p = -1,
      best = 1e-9;
    for (let r = row; r < M.length; r++)
      if (Math.abs(M[r][c]) > best) {
        best = Math.abs(M[r][c]);
        p = r;
      }
    if (p < 0) continue;
    [M[row], M[p]] = [M[p], M[row]];
    const d = M[row][c];
    M[row] = M[row].map((v) => v / d);
    for (let r = 0; r < M.length; r++) if (r !== row && Math.abs(M[r][c]) > 0) M[r] = M[r].map((v, j) => v - M[r][c] * M[row][j]);
    piv.push(c);
    row++;
  }
  if (row < M.length) return null; // связи зависимы
  const free = [...Array(ndof).keys()].filter((c) => !piv.includes(c));
  // q = Z r: свободные переменные — сами себе, ведущие — через свободные.
  const Z = [...Array(ndof)].map(() => new Array(free.length).fill(0));
  free.forEach((f, j) => (Z[f][j] = 1));
  piv.forEach((pc, i) => free.forEach((f, j) => (Z[pc][j] = -M[i][f])));
  return { Z, free };
}

/** Собственные значения и векторы симметричной матрицы (метод Якоби, n ≤ 3). */
function eigSym(S: number[][]): { val: number[]; vec: number[][] } {
  const n = S.length;
  const A = S.map((r) => r.slice());
  const V: number[][] = [...Array(n)].map((_, i) => [...Array(n)].map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p],
            akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k],
            aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p],
            vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  return { val: A.map((r, i) => r[i]), vec: [...Array(n)].map((_, j) => V.map((r) => r[j])) };
}

const DOF_NAMES: Equilibrium['dof'][] = ['u', 'v', 'theta'];

/** Решение методом перемещений; null — механизм (нагрузка совершает работу на перемещении без сопротивления). */
function solveState(geo: Geo, Zb: { Z: number[][]; free: number[] }): Solved | 'mechanism' {
  const { ndof, g, k, d0, F, C } = geo;
  const { Z, free } = Zb;
  const m = free.length;
  // Приведённые строки удлинений и силы.
  const h = g.map((gi) => [...Array(m)].map((_, j) => gi.reduce((s, v, a) => s + v * Z[a][j], 0)));
  const F0 = [...F];
  g.forEach((gi, i) => gi.forEach((v, a) => (F0[a] += k[i] * d0[i] * v)));
  const Fr = [...Array(m)].map((_, j) => F0.reduce((s, v, a) => s + v * Z[a][j], 0));
  const Kr = [...Array(m)].map((_, a) => [...Array(m)].map((__, b) => h.reduce((s, hi, i) => s + k[i] * hi[a] * hi[b], 0)));
  let r = new Array(m).fill(0);
  if (m > 0) {
    const { val, vec } = eigSym(Kr);
    const big = Math.max(1e-300, ...val.map(Math.abs));
    const fsc = Math.max(1e-300, ...Fr.map(Math.abs));
    for (let j = 0; j < m; j++) {
      const proj = vec[j].reduce((s, v, a) => s + v * Fr[a], 0);
      if (Math.abs(val[j]) < 1e-10 * big) {
        if (Math.abs(proj) > 1e-9 * fsc + 1e-6) return 'mechanism';
        continue;
      }
      r = r.map((x, a) => x + (proj / val[j]) * vec[j][a]);
    }
  }
  const q = [...Array(ndof)].map((_, a) => Z[a].reduce((s, z, j) => s + z * r[j], 0));
  const rods: RodState[] = g.map((gi, i) => {
    const dl = gi.reduce((s, v, a) => s + v * q[a], 0);
    const N = k[i] * (dl - d0[i]);
    return { N: N / 1000, dl, dlN: dl - d0[i], dlT: 0, delta: 0, A: geo.A[i] / 100, sigma: N / geo.A[i], k: k[i] / 1000, g: h[i] };
  });
  // Реакции: Cᵀ R = K q − F0 = Σ N_i g_iᵀ − F (по смыслу — равновесие).
  const resid = [...Array(ndof)].map((_, a) => rods.reduce((s, rs, i) => s + rs.N * 1000 * g[i][a], 0) - F[a]);
  let R: number[] = [];
  if (C.length) {
    const CCt = C.map((ci) => C.map((cj) => ci.reduce((s, v, a) => s + v * cj[a], 0)));
    const rhs = C.map((ci) => ci.reduce((s, v, a) => s + v * resid[a], 0));
    R = solveSmall(CCt, rhs);
  }
  const eqs: Equilibrium[] = free.map((f, j) => ({
    dof: DOF_NAMES[f],
    rodCoef: h.map((hi) => hi[j]),
    load: Fr[j] - k.reduce((s, ki, i) => s + ki * d0[i] * h[i][j], 0),
    z: Z.map((row) => row[j]),
  }));
  return {
    dofs: free.map((f) => DOF_NAMES[f]),
    r,
    u: clean(q[0]),
    v: clean(q[1]),
    theta: ndof === 3 ? q[2] : 0,
    rods,
    reactions: geo.cInfo.map((ci, j) => ({ ...ci, R: clean(R[j] / 1000) })),
    eqs,
  };
}

function solveSmall(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

export function validate(pr: RodProblem): string[] {
  const e: string[] = [];
  const bar = pr.body === 'bar';
  if (!pr.rods.length) e.push('Добавьте хотя бы один стержень.');
  if (bar && !(pr.L > 0)) e.push('Длина бруса — положительное число.');
  pr.rods.forEach((r, i) => {
    const w = `Стержень ${i + 1}`;
    if (!(r.l > 0)) e.push(`${w}: длина — положительное число.`);
    if (!(r.c > 0)) e.push(`${w}: доля площади — положительное число.`);
    if (!(r.E > 0)) e.push(`${w}: модуль упругости — положительное число.`);
    if (![r.ang, r.alpha, r.dT, r.delta, r.x].every(Number.isFinite)) e.push(`${w}: не все поля заполнены числами.`);
    if (bar && (r.x < 0 || r.x > pr.L)) e.push(`${w}: точка крепления — на брусе (0…${pr.L} м).`);
  });
  if (bar)
    pr.supports.forEach((s, i) => {
      if (s.x < 0 || s.x > pr.L) e.push(`Опора ${i + 1}: точка — на брусе (0…${pr.L} м).`);
    });
  if (!bar && pr.supports.length) e.push('У узла опор нет — его держат только стержни.');
  pr.loads.forEach((ld, i) => {
    const w = `Нагрузка ${i + 1}`;
    if (!Number.isFinite(ld.F)) e.push(`${w}: значение — число.`);
    if (!bar && ld.kind !== 'F') e.push(`${w}: на узел действуют только сосредоточенные силы.`);
    if (bar && (ld.x < 0 || ld.x > pr.L || (ld.kind === 'q' && !(ld.x2 > ld.x && ld.x2 <= pr.L))))
      e.push(`${w}: положение — на брусе, для распределённой нагрузки x₁ < x₂.`);
  });
  if (pr.ask !== 'design' && !(pr.A > 0)) e.push('Площадь A — положительное число.');
  if ((pr.ask === 'design' || pr.ask === 'allow') && !(pr.sAllow > 0)) e.push('Задайте допускаемое напряжение [σ].');
  if (pr.ask === 'limit' && !(pr.sT > 0 && pr.n >= 1)) e.push('Для предельного состояния задайте предел текучести σт и запас n ≥ 1.');
  if ((pr.ask === 'allow' || pr.ask === 'limit') && !pr.loads.some((l) => l.F !== 0)) e.push('Задайте нагрузку — её допускаемый множитель и ищем.');
  return e;
}

/** Интервал значений t ≥ 0, при которых |a·t + b| ≤ s для всех пар (a, b). */
function interval(ab: [number, number][], s: number): { lo: number; hi: number; gov: number } | null {
  let lo = 0,
    hi = Infinity,
    gov = -1;
  for (const [i, [a, b]] of ab.entries()) {
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > s * (1 + 1e-9)) return null;
      continue;
    }
    const t1 = (s - b) / a,
      t2 = (-s - b) / a;
    const up = Math.max(t1, t2),
      dn = Math.min(t1, t2);
    if (up < hi) {
      hi = up;
      gov = i;
    }
    lo = Math.max(lo, dn);
  }
  if (hi < lo || hi <= 0) return null;
  return { lo, hi, gov };
}

export function solveRods(pr: RodProblem): RodResult {
  const errors = validate(pr);
  const empty: RodResult = {
    ok: false,
    errors,
    unknowns: 0,
    equations: 0,
    degree: 0,
    collinear: false,
    base: null,
    loadOnly: null,
    thermal: null,
    compat: [],
    sigmaMax: null,
    check: null,
    nT: null,
    design: null,
    allow: null,
    limit: null,
    residual: 0,
  };
  if (errors.length) return empty;
  const Awork = pr.ask === 'design' ? 1 : pr.A;
  const geoFull = geometry(pr, Awork, 1, true, true);
  const basis = freeBasis(geoFull.C, geoFull.ndof);
  if (!basis) return { ...empty, errors: ['Опоры бруса сами по себе статически неопределимы (связи зависимы) — уберите лишнюю опору.'] };

  // Степень неопределимости: неизвестные усилия (стержни и реакции) минус ранг уравнений равновесия.
  const B = [...Array(geoFull.ndof)].map((_, a) => [...geoFull.g.map((gi) => gi[a]), ...geoFull.C.map((ci) => ci[a])]);
  const rank = rankOf(B);
  const unknowns = pr.rods.length + geoFull.C.length;
  const collinear = rank < geoFull.ndof;

  const st = (A: number, th: boolean, ld: boolean, scale = 1) => solveState(geometry(pr, A, scale, th, ld), basis);
  const base = st(Awork, true, true);
  if (base === 'mechanism')
    return {
      ...empty,
      unknowns,
      equations: rank,
      degree: unknowns - rank,
      collinear,
      errors: ['Система — механизм: при такой нагрузке тело перемещается без сопротивления стержней. Добавьте стержень или опору.'],
    };
  const loadOnly = st(Awork, false, true) as Solved;
  const thermal = st(Awork, true, false) as Solved;
  const hasThermal = pr.rods.some((r) => r.dT !== 0 || r.delta !== 0);

  // Отметить части удлинения.
  base.rods.forEach((rs, i) => {
    const r = pr.rods[i];
    rs.dlT = r.alpha * r.dT * r.l * 1000;
    rs.delta = r.delta;
    rs.dlN = rs.dl - rs.dlT - rs.delta;
  });

  // Уравнения совместности: удлинения «лишних» стержней через удлинения базовых (базовых столько, каков ранг).
  const compat: RodResult['compat'] = [];
  const H = base.rods.map((r) => r.g);
  const rkH = H.length ? rankOf(H) : 0;
  if (rkH > 0 && pr.rods.length > rkH) {
    const baseIdx: number[] = [];
    for (let i = 0; i < H.length && baseIdx.length < rkH; i++) if (rankOf([...baseIdx.map((bi) => H[bi]), H[i]]) > baseIdx.length) baseIdx.push(i);
    const Hb = baseIdx.map((bi) => H[bi]);
    const G = Hb.map((x) => Hb.map((y) => x.reduce((t, xv, a) => t + xv * y[a], 0)));
    for (let kx = 0; kx < H.length; kx++) {
      if (baseIdx.includes(kx)) continue;
      // H_k = Σ w_j·Hb_j (H_k лежит в линейной оболочке базовых строк): (Hb·Hbᵀ) w = Hb·H_kᵀ.
      const rhs = Hb.map((x) => x.reduce((t, xv, a) => t + xv * H[kx][a], 0));
      compat.push({ k: kx, base: baseIdx, w: solveSmall(G, rhs).map(clean) });
    }
  }

  // Контроль равновесия.
  const geoChk = geometry(pr, Awork, 1, true, true);
  const resid = [...Array(geoChk.ndof)].map(
    (_, a) =>
      base.rods.reduce((s, rs, i) => s + rs.N * 1000 * geoChk.g[i][a], 0) -
      geoChk.F[a] -
      base.reactions.reduce((s, R, j) => s + R.R * 1000 * geoChk.C[j][a], 0),
  );
  const fscale = Math.max(1, ...geoChk.F.map(Math.abs), ...base.rods.map((r) => Math.abs(r.N) * 1000));
  const residual = Math.max(...resid.map(Math.abs)) / fscale;

  const sig = base.rods.map((r) => r.sigma);
  let iMax = 0;
  sig.forEach((s, i) => Math.abs(s) > Math.abs(sig[iMax]) && (iMax = i));
  const res: RodResult = {
    ok: true,
    errors: [],
    unknowns,
    equations: rank,
    degree: unknowns - rank,
    collinear,
    base,
    loadOnly,
    thermal: hasThermal ? thermal : null,
    compat,
    sigmaMax: pr.ask === 'design' ? null : { v: sig[iMax], i: iMax },
    check: pr.ask === 'check' && pr.sAllow > 0 ? Math.abs(sig[iMax]) <= pr.sAllow * (1 + 1e-9) : null,
    nT: pr.ask === 'check' && pr.sT > 0 && Math.abs(sig[iMax]) > 1e-12 ? pr.sT / Math.abs(sig[iMax]) : null,
    design: null,
    allow: null,
    limit: null,
    residual,
  };

  if (pr.ask === 'design') {
    // σ_i = a_i/A + b_i: a_i — напряжение от нагрузки при A = 1 см², b_i — от нагрева и неточности (от A не зависит).
    const ab: [number, number][] = loadOnly.rods.map((r, i) => [r.sigma, thermal.rods[i].sigma]);
    const iv = interval(ab, pr.sAllow);
    if (!iv)
      return {
        ...res,
        ok: false,
        errors: ['Подобрать площадь нельзя: напряжения от нагрева или неточности изготовления сами превышают [σ] при любой площади.'],
      };
    const Amin = 1 / iv.hi;
    res.design = { Amin, Amax: iv.lo > 0 ? 1 / iv.lo : null, gov: iv.gov, a: ab.map((x) => x[0]), b: ab.map((x) => x[1]) };
    // Состояние при найденной площади — для ответа.
    const fin = st(Amin, true, true) as Solved;
    fin.rods.forEach((rs, i) => {
      const rd = pr.rods[i];
      rs.dlT = rd.alpha * rd.dT * rd.l * 1000;
      rs.delta = rd.delta;
      rs.dlN = rs.dl - rs.dlT - rs.delta;
    });
    res.base = fin;
    let jm = 0;
    fin.rods.forEach((rs, i) => Math.abs(rs.sigma) > Math.abs(fin.rods[jm].sigma) && (jm = i));
    res.sigmaMax = { v: fin.rods[jm].sigma, i: jm };
  }
  if (pr.ask === 'allow' || pr.ask === 'limit') {
    const sA = pr.ask === 'allow' ? pr.sAllow : pr.sAllow > 0 ? pr.sAllow : pr.sT / pr.n;
    const ab: [number, number][] = loadOnly.rods.map((r, i) => [r.sigma, thermal.rods[i].sigma]);
    const iv = interval(ab, sA);
    if (pr.ask === 'allow') {
      if (!iv) return { ...res, ok: false, errors: ['Допускаемой нагрузки нет: напряжения от нагрева или неточности изготовления сами превышают [σ].'] };
      res.allow = { lam: iv.hi, lamMin: iv.lo > 0 ? iv.lo : null, gov: iv.gov };
    } else {
      // Начало текучести (упруго, с нагревом): |λ·a + b| = σт.
      const ivT = interval(ab, pr.sT);
      // Предельное равновесие: максимум λ при |N_i| ≤ σт·A_i (нагрев и неточность на предельную нагрузку не влияют).
      const geo = geometry(pr, Awork, 1, false, true);
      const nr = pr.rods.length,
        nc = geo.C.length;
      const nv = nr + nc + 1;
      const Aeq = [...Array(geo.ndof)].map((_, a) => [...geo.g.map((gi) => gi[a]), ...geo.C.map((ci) => -ci[a]), -geo.F[a]]);
      const beq = new Array(geo.ndof).fill(0);
      const G: number[][] = [],
        h: number[] = [];
      const NT = geo.A.map((Ai) => pr.sT * Ai);
      for (let i = 0; i < nr; i++) {
        const r1 = new Array(nv).fill(0);
        r1[i] = 1;
        G.push(r1);
        h.push(NT[i]);
        const r2 = new Array(nv).fill(0);
        r2[i] = -1;
        G.push(r2);
        h.push(NT[i]);
      }
      const lamRow = new Array(nv).fill(0);
      lamRow[nv - 1] = -1;
      G.push(lamRow);
      h.push(0);
      const c = new Array(nv).fill(0);
      c[nv - 1] = -1;
      const lp = linprog(c, Aeq, beq, G, h);
      if (lp.status !== 'optimal')
        return {
          ...res,
          ok: false,
          errors: [
            lp.status === 'unbounded' ? 'Предельной нагрузки нет: стержни не несут эту нагрузку (её воспринимают опоры).' : 'Предельное равновесие не найдено.',
          ],
        };
      const lamU = lp.x[nv - 1];
      const Nu = lp.x.slice(0, nr).map((N) => clean(N / 1000));
      res.limit = {
        lamT: ivT ? ivT.hi : 0,
        firstYield: ivT ? ivT.gov : -1,
        lamU,
        Nu,
        atYield: lp.x.slice(0, nr).map((N, i) => Math.abs(Math.abs(N) - NT[i]) < 1e-6 * NT[i]),
        lamAllow: iv ? iv.hi : 0,
        sAllowUsed: sA,
      };
    }
  }
  return res;
}
