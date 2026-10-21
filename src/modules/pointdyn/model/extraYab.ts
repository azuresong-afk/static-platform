/**
 * Пункт 28, «Динамика точки»: задания Яблонского Д.1 и Д.6 целиком.
 *
 *  - stages2 Д.1 — тело движется по прямой AB (с трением, может действовать постоянная сила), затем летит до точки C.
 *              Данные — «имя = значение» через «;»; все не заданные величины — неизвестные, их число должно равняться
 *              числу уравнений. Система решается методом Ньютона (из нескольких начальных приближений).
 *              Уравнения: v_B = v_A + aτ, l = v_Aτ + aτ²/2, a = g(± sin α − f cos α) + P/m;
 *              d = v_B cos θ·T, h = ±v_B sin θ·T + gT²/2, v_C² = v_B² + 2gh; приземление: на плоскость через B под углом β
 *              (h = d·tg β) или на полку ниже откоса β (b = d − h·ctg β).
 *  - tube    Д.6 — шарик в трубке: участки прямые (с трением, по длине или по времени) и дуги окружностей (гладкие), в
 *              конце — пружина (наибольшее сжатие) или прямая до остановки. Скорости в узлах — по теореме о кинетической
 *              энергии и теореме об изменении количества движения; давление на стенку на дуге N = mv²/R ± mg cos θ.
 */
import { parseNum } from '../../../shared/format';
import { ansB, bold, eqB, fail, parB, sg, stepB, stepEx, type AskDef, type ExtraOut, type Ln } from '../../../shared/extra';

const G = 9.81;
const D2R = Math.PI / 180;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- Д.1 ---------- */
export const STAGE_VARS: Record<string, string> = {
  vA: 'v_A, м/с',
  vB: 'v_B, м/с',
  tau: 'τ, с',
  l: 'l, м',
  f: 'f',
  alpha: 'α, °',
  d: 'd, м',
  h: 'h, м',
  T: 'T, с',
  vC: 'v_C, м/с',
  b: 'b, м',
};
const ALIAS: Record<string, string> = { va: 'vA', vb: 'vB', vc: 'vC', τ: 'tau', t: 'T', α: 'alpha', a: 'alpha', β: 'beta', p: 'P', m: 'm' };
export function parseData(src: string): Record<string, number> | string {
  const out: Record<string, number> = {};
  for (const part of src
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const [k0, v0] = part.split('=').map((x) => x.trim());
    if (v0 == null) return `данные: «имя = значение», не разобрано «${part}»`;
    const key = k0 in STAGE_VARS || ['beta', 'P', 'm'].includes(k0) ? k0 : (ALIAS[k0.toLowerCase()] ?? (k0 === 'T' ? 'T' : ''));
    if (!key) return `данные: неизвестное имя «${k0}» (допустимы ${[...Object.keys(STAGE_VARS), 'beta', 'P', 'm'].join(', ')})`;
    const v = parseNum(v0);
    if (!Number.isFinite(v)) return `данные: не число «${v0}»`;
    out[key] = v;
  }
  return out;
}

type Dir = 'down' | 'up' | 'flat';
function residuals(x: Record<string, number>, dir: Dir, land: string, beta: number, Pm: number, g: number): number[] {
  const al = x.alpha * D2R;
  const s = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
  const a = dir === 'up' ? -g * (Math.sin(al) + x.f * Math.cos(al)) + Pm : g * (s * Math.sin(al) - x.f * Math.cos(al)) + Pm;
  const th = dir === 'flat' ? 0 : al;
  const sv = dir === 'up' ? -1 : 1;
  const r = [
    x.vB - x.vA - a * x.tau,
    x.l - x.vA * x.tau - (a * x.tau * x.tau) / 2,
    x.d - x.vB * Math.cos(th) * x.T,
    x.h - (sv * x.vB * Math.sin(th) * x.T + (g * x.T * x.T) / 2),
    x.vC * x.vC - x.vB * x.vB - 2 * g * x.h,
  ];
  if (land === 'slope') r.push(x.h - x.d * Math.tan(beta * D2R));
  if (land === 'shelf') r.push(x.b - x.d + x.h / Math.tan(beta * D2R));
  return r;
}
/** Решение системы относительно неизвестных (Ньютон с численным якобианом, несколько начальных точек). */
export function solveStages(known: Record<string, number>, dir: Dir, land: string, g: number) {
  const beta = known.beta ?? NaN,
    Pm = known.P != null && known.m ? known.P / known.m : 0;
  const names = Object.keys(STAGE_VARS).filter((k) => (land === 'shelf' ? true : k !== 'b'));
  const unk = names.filter((k) => !(k in known));
  if (dir === 'flat' && !unk.includes('alpha') && known.alpha !== 0) return { error: 'на горизонтальном участке α = 0' };
  const nEq = 5 + (land === 'free' ? 0 : 1);
  const knownSet = { ...known };
  if (dir === 'flat' && unk.includes('alpha')) {
    knownSet.alpha = 0;
    unk.splice(unk.indexOf('alpha'), 1);
  }
  if (unk.length !== nEq)
    return {
      error: `неизвестных ${unk.length} (${unk.join(', ')}), а уравнений ${nEq}: задайте ровно ${names.length - nEq} величин${land !== 'free' ? ' и угол β' : ''}`,
    };
  const guess: Record<string, number[]> = {
    vA: [1, 5, 15],
    vB: [5, 10, 20],
    tau: [1, 0.3, 3],
    l: [5, 1, 20],
    f: [0.1, 0.3, 0.05],
    alpha: [30, 15, 60],
    d: [5, 2, 20],
    h: [5, 2, 20],
    T: [1, 0.5, 3],
    vC: [10, 5, 20],
    b: [1, 0.5, 5],
  };
  const ok = (x: Record<string, number>) =>
    x.tau > 0 && x.T > 0 && x.l > 0 && x.f >= -1e-9 && x.vC >= 0 && x.vB >= 0 && x.vA >= 0 && x.alpha >= -1e-9 && x.alpha < 90 && x.d >= 0;
  for (let start = 0; start < 27; start++) {
    const x: Record<string, number> = { ...knownSet };
    unk.forEach((k, i) => (x[k] = guess[k][Math.floor(start / 3 ** (i % 3)) % 3]));
    for (let it = 0; it < 100; it++) {
      const r = residuals(x, dir, land, beta, Pm, g);
      const nr = Math.hypot(...r);
      if (nr < 1e-11) break;
      const J = r.map(() => unk.map(() => 0));
      unk.forEach((k, j) => {
        const h = 1e-7 * Math.max(1, Math.abs(x[k]));
        const xp = { ...x, [k]: x[k] + h };
        const rp = residuals(xp, dir, land, beta, Pm, g);
        rp.forEach((v, i) => (J[i][j] = (v - r[i]) / h));
      });
      const dx = gaussSolve(
        J,
        r.map((v) => -v),
      );
      if (!dx) break;
      let lam = 1;
      for (let ls = 0; ls < 20; ls++) {
        const xn = { ...x };
        unk.forEach((k, j) => (xn[k] = x[k] + lam * dx[j]));
        if (Math.hypot(...residuals(xn, dir, land, beta, Pm, g)) < nr) {
          Object.assign(x, xn);
          break;
        }
        lam /= 2;
      }
    }
    if (Math.hypot(...residuals(x, dir, land, beta, Pm, g)) < 1e-8 && ok(x)) return { x, unk, Pm, beta };
  }
  return { error: 'решение с положительными временами, длинами и скоростями не найдено — проверьте данные' };
}
function gaussSolve(A0: number[][], b0: number[]): number[] | null {
  const n = b0.length;
  const A = A0.map((r, i) => [...r, b0[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-14) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}

const A_STAGES2: AskDef = {
  id: 'stages2',
  title: 'Яблонский, Д.1: тело движется по наклонной плоскости с трением, затем летит (выбор неизвестных)',
  hint: 'Данные — «имя = значение» через «;»: vA, vB, tau, l, f, alpha (°), d, h, T, vC, b, beta (°), P и m (сила на участке AB). Не заданные величины — неизвестные. d — по горизонтали от B до C, h — по вертикали вниз от B до C.',
  n: { g: G },
  s: { data: 'vA = 0; alpha = 60; l = 4; tau = 1; h = 5; beta = 75', dir: 'down', land: 'shelf' },
  selects: [
    {
      k: 'dir',
      label: 'Движение по AB',
      options: [
        ['down', 'вниз по наклонной плоскости (вылет вниз под углом α)'],
        ['up', 'вверх по наклонной плоскости (вылет вверх под углом α)'],
        ['flat', 'по горизонтали (вылет горизонтально)'],
      ],
    },
    {
      k: 'land',
      label: 'Где точка C',
      options: [
        ['free', 'задана d и h (горизонтальная плоскость, стенка)'],
        ['slope', 'на плоскости через B под углом β (h = d·tg β)'],
        ['shelf', 'на полке под откосом β: ширина полки b = d − h·ctg β'],
      ],
    },
  ],
  fields: [
    { k: 'data', label: 'данные «имя = значение» через «;»', text: true },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const g = q.n.g;
    if (!pos(g)) return fail(['g > 0.']);
    const kn = parseData(q.s.data);
    if (typeof kn === 'string') return fail([kn]);
    const dir = q.s.dir as Dir,
      land = q.s.land;
    if (land !== 'free' && !(kn.beta > 0 && kn.beta < 90)) return fail(['Задайте угол β (0 < β < 90°): beta = …']);
    const r = solveStages(kn, dir, land, g);
    if ('error' in r) return fail([r.error as string]);
    const x = r.x;
    const al = x.alpha;
    const a =
      dir === 'up'
        ? -g * (Math.sin(al * D2R) + x.f * Math.cos(al * D2R)) + r.Pm
        : g * ((dir === 'down' ? 1 : 0) * Math.sin(al * D2R) - x.f * Math.cos(al * D2R)) + r.Pm;
    const lab = (k: string) => STAGE_VARS[k].split(',')[0];
    const val = (k: string) => `${lab(k)} = ${sg(x[k])}${STAGE_VARS[k].includes(',') ? STAGE_VARS[k].split(',')[1].replace(' °', '°') : ''}`;
    const steps = [
      stepEx(
        ex,
        'Участок AB',
        `Ось x₁ — вдоль AB по движению. На тело действуют тяжесть, нормальная реакция N = mg cos α и трение fN${r.Pm ? ', движущая сила P' : ''}; ускорение постоянно.`,
        eqB(dir === 'up' ? 'a = −g(sin α + f cos α) + P/m' : 'a = g(sin α − f cos α) + P/m', 'v_B = v_A + aτ,  l = v_Aτ + aτ²/2', `a = ${sg(a)} м/с²`),
      ),
      stepEx(
        ex,
        'Полёт BC',
        'После точки B действует только тяжесть: равномерное движение по горизонтали и равноускоренное по вертикали; начальная скорость v_B направлена вдоль AB.',
        eqB(
          dir === 'flat' ? 'd = v_B T,  h = gT²/2' : dir === 'up' ? 'd = v_B cos α·T,  h = −v_B sin α·T + gT²/2' : 'd = v_B cos α·T,  h = v_B sin α·T + gT²/2',
          'v_C² = v_B² + 2gh',
          ...(land === 'slope' ? ['C на плоскости BD: h = d·tg β'] : land === 'shelf' ? ['ширина полки: b = d − h·ctg β'] : []),
        ),
      ),
      stepEx(
        ex,
        'Неизвестные',
        'Не заданные в условии величины находятся из системы уравнений совместно (метод Ньютона).',
        parB(`Неизвестные: ${r.unk.map(lab).join(', ')}.`),
      ),
      stepB('Ответ', ansB(...r.unk.map((k): [Ln, string] => [[bold(val(k))], '']))),
    ];
    const vals: Record<string, number> = { ...x, a };
    const pts: [number, number][] = [];
    const th = dir === 'flat' ? 0 : al * D2R;
    const sv = dir === 'up' ? 1 : -1;
    for (let i = 0; i <= 60; i++) {
      const t = (x.T * i) / 60;
      pts.push([x.vB * Math.cos(th) * t, sv * x.vB * Math.sin(th) * t - (g * t * t) / 2]);
    }
    return done({ vals, steps, plot: { xl: 'x (от B), м', yl: 'y (вверх), м', equal: true, series: [{ name: 'траектория BC', pts }] } });
  },
};

/* ---------- Д.6 ---------- */
interface Seg {
  kind: 'L' | 'T' | 'A' | 'S' | 'U';
  p: number[];
  name: string;
}
export function parsePath(src: string): Seg[] | string {
  const segs: Seg[] = [];
  const rows = src
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const r of rows) {
    const [body, name] = r.split('=').map((x) => x.trim());
    const parts = body.split(':').map((x) => x.trim());
    const kind = parts[0].toUpperCase() as Seg['kind'];
    const need = { L: 3, T: 3, A: 3, S: 3, U: 2 }[kind];
    if (need == null) return `участок «${r}»: тип L, T, A, S или U`;
    const p = parts.slice(1).map(parseNum);
    if (p.length !== need || !p.every(Number.isFinite)) return `участок «${r}»: нужно ${need} числа после «${kind}:»`;
    segs.push({ kind, p, name: name ?? '' });
  }
  if (!segs.length) return 'путь пуст';
  if (segs.slice(0, -1).some((s) => s.kind === 'S' || s.kind === 'U')) return 'пружина (S) или остановка (U) — только последним участком';
  return segs;
}

const A_TUBE: AskDef = {
  id: 'tube',
  title: 'Яблонский, Д.6: шарик в изогнутой трубке — скорости в точках, давление на стенку, сжатие пружины',
  hint: 'Путь — участки через «;»: L:α:l:f — прямая (α — направление движения к горизонту, + вверх), T:α:τ:f — прямая, пройденная за время τ, A:R:θ₁:θ₂ — гладкая дуга (направление касательной от θ₁ до θ₂), S:α:c:f — пружина в конце, U:α:f — прямая до остановки. «= C» после участка — имя его конечной точки.',
  n: { m: 0.5, vA: 0.8, h0: 0, c0: 0, g: G },
  s: { path: 'L:-90:0,892820:0 = C; A:0,4:-60:-30 = B; T:30:0,1:0,1 = D; S:30:1000:0,1 = E' },
  fields: [
    { k: 'path', label: 'участки пути через «;»', text: true },
    { k: 'm', label: 'масса шарика m, кг' },
    { k: 'vA', label: 'начальная скорость v_A, м/с', zero: true },
    { k: 'h0', label: 'начальное сжатие пружины h₀, м (0 — нет)', zero: true },
    { k: 'c0', label: 'жёсткость начальной пружины c₀, Н/м', zero: true },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m, vA, h0, c0, g } = q.n;
    if (!pos(m, g) || !(vA >= 0 && h0 >= 0 && c0 >= 0)) return fail(['m, g > 0; v_A, h₀, c₀ ≥ 0.']);
    const segs = parsePath(q.s.path);
    if (typeof segs === 'string') return fail([segs]);
    const lines: Ln[] = [];
    const vals: Record<string, number> = {};
    let v = vA;
    let y = 0;
    let letter = 0;
    const names = 'BCDEFGHIKLMN';
    const nodeName = (s: Seg) => s.name || names[letter++] || '?';
    if (h0 > 0) {
      const s0 = segs[0];
      if (s0.kind !== 'L' && s0.kind !== 'T') return fail(['Начальная пружина действует вдоль первого прямого участка.']);
      const al = s0.p[0] * D2R,
        f = s0.p[2];
      const v2 = vA * vA + (c0 * h0 * h0) / m - 2 * g * h0 * (Math.sin(al) + f * Math.cos(al));
      if (!(v2 >= 0)) return fail(['Начальная пружина не разгоняет шарик.']);
      v = Math.sqrt(v2);
      y += h0 * Math.sin(al);
      lines.push(`пружина: v² = v_A² + c₀h₀²/m − 2gh₀(sin α + f cos α) ⇒ v = ${sg(v)} м/с`);
    }
    const steps = [
      stepEx(
        ex,
        'Метод',
        'На гладких дугах работает только тяжесть: v² = v₀² − 2gΔy. На прямых с трением ускорение постоянно: a = −g(sin α + f cos α) (α — направление движения). Давление на стенку на дуге — из проекции на нормаль: N = mv²/R + mg cos θ при повороте влево (против часовой стрелки) и mv²/R − mg cos θ при повороте вправо; N > 0 — шарик прижат к внешней стенке.',
        parB('Скорость направлена по касательной к оси трубки; изломы оси считаются плавными (без потерь).'),
      ),
    ];
    for (const s of segs) {
      if (s.kind === 'L' || s.kind === 'T') {
        const [ad, x, f] = s.p;
        const al = ad * D2R;
        const a = -g * (Math.sin(al) + f * Math.cos(al));
        let l: number, t: number, v1: number;
        if (s.kind === 'L') {
          l = x;
          const v2 = v * v + 2 * a * l;
          if (v2 < 0) return fail([`Шарик остановится на прямом участке (α = ${ad}°) и не дойдёт до его конца.`]);
          v1 = Math.sqrt(v2);
          t = Math.abs(a) > 1e-12 ? (v1 - v) / a : l / v;
        } else {
          t = x;
          v1 = v + a * t;
          if (v1 < 0) return fail([`За время τ = ${sg(t)} с шарик остановится раньше (α = ${ad}°).`]);
          l = v * t + (a * t * t) / 2;
        }
        y += l * Math.sin(al);
        const nm = nodeName(s);
        lines.push(`прямая (α = ${sg(ad)}°, f = ${sg(f)}): a = ${sg(a)} м/с², l = ${sg(l)} м, t = ${sg(t)} с ⇒ v_${nm} = ${sg(v1)} м/с`);
        v = v1;
        vals[`v${nm}`] = v;
        vals[`t${nm}`] = t;
        vals[`l${nm}`] = l;
      } else if (s.kind === 'A') {
        const [R, t1, t2] = s.p;
        if (!pos(R) || t1 === t2) return fail(['Дуга: R > 0, θ₁ ≠ θ₂.']);
        const left = t2 > t1;
        const dy = left ? R * (Math.cos(t1 * D2R) - Math.cos(t2 * D2R)) : R * (Math.cos(t2 * D2R) - Math.cos(t1 * D2R));
        const N = (vv: number, th: number) => (m * vv * vv) / R + (left ? 1 : -1) * m * g * Math.cos(th * D2R);
        const N1 = N(v, t1);
        const v2 = v * v - 2 * g * dy;
        if (v2 < 0) return fail([`Шарик не пройдёт дугу R = ${sg(R)} м: не хватает скорости.`]);
        const v1 = Math.sqrt(v2);
        const N2 = N(v1, t2);
        const nm = nodeName(s);
        lines.push(
          `дуга R = ${sg(R)} м, ${left ? 'влево' : 'вправо'}, θ ${sg(t1)}° → ${sg(t2)}°: Δy = ${sg(dy)} м ⇒ v_${nm} = ${sg(v1)} м/с;  N в начале ${sg(N1)} Н, в конце ${sg(N2)} Н`,
        );
        y += dy;
        v = v1;
        vals[`v${nm}`] = v;
        vals[`N${nm}`] = N2;
        vals[`N0${nm}`] = N1;
      } else if (s.kind === 'S') {
        const [ad, c, f] = s.p;
        const al = ad * D2R;
        if (!pos(c)) return fail(['Пружина: c > 0.']);
        // c h²/2 + m g h (sin α + f cos α) = m v²/2
        const B = m * g * (Math.sin(al) + f * Math.cos(al));
        const h = (-B + Math.sqrt(B * B + c * m * v * v)) / c;
        lines.push(`пружина (α = ${sg(ad)}°, c = ${sg(c)} Н/м, f = ${sg(f)}): ch²/2 + mgh(sin α + f cos α) = mv²/2 ⇒ h = ${sg(h)} м`);
        vals.h = h;
      } else {
        const [ad, f] = s.p;
        const al = ad * D2R;
        const dec = g * (Math.sin(al) + f * Math.cos(al));
        if (!(dec > 0)) return fail(['На последней прямой шарик не тормозится — не остановится.']);
        const sd = (v * v) / (2 * dec);
        lines.push(`до остановки (α = ${sg(ad)}°, f = ${sg(f)}): s = v²/(2g(sin α + f cos α)) = ${sg(sd)} м, подъём H = ${sg(sd * Math.sin(al))} м`);
        vals.s = sd;
        vals.H = y + sd * Math.sin(al);
      }
    }
    vals.y = y;
    steps.push(stepB('Участки', eqB(...lines)));
    const ans: [Ln, string][] = Object.entries(vals)
      .filter(([k]) => /^(v[A-Z]|N[A-Z]|h$|s$|H$)/.test(k))
      .map(([k, x]): [Ln, string] => [
        [bold(`${k.replace(/^v/, 'v_').replace(/^N(?!0)/, 'N_')} = ${sg(x)}`)],
        k.startsWith('v') ? 'м/с' : k.startsWith('N') ? 'Н (давление на стенку в конце дуги)' : 'м',
      ]);
    steps.push(stepB('Ответ', ansB(...ans)));
    return done({ vals, steps });
  },
};

export const POINT_ASKS_YAB: AskDef[] = [A_STAGES2, A_TUBE];
