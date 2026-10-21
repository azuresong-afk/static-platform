/**
 * Пункт 26, «Сходящиеся силы»: задачи статики Мещерского §2–4, 8, которые не собираются из узла сил.
 *
 *  - hinge    2.36–2.38, 3.30, 3.33, 4.48 — система тел на шарнирах, механизм в равновесии (model/linkage.ts);
 *  - chain    2.37, 2.39 — верёвочный многоугольник под вертикальными нагрузками: H·(tg αₖ − tg αₖ₊₁) = Qₖ;
 *  - attract  2.51 — точка притягивается центрами силами Fᵢ = kᵢrᵢ: положение равновесия по двум координатам;
 *  - bolt     2.56 — затяжка болта, поставленного с зазором: f·N·m ≥ P;
 *  - sheets   2.57 — переложенные листы двух кип: сумма сил трения по всем стыкам;
 *  - wedge    2.62 — клин: забивка (давление на щёки) и затем вытаскивание;
 *  - pull     2.63 — наивыгоднейший угол тяги: β = arctg f, Q_min = P(sin γ + f cos γ)/√(1 + f²);
 *  - vgroove  2.69 — цилиндр в клиновых направляющих: P = Qf/sin(θ/2);
 *  - crank    2.71 — кривошипный механизм с ползуном, с трением и без;
 *  - gate     3.20 — щит канала открывается, когда центр давления выше оси: H = 3h·sin α;
 *  - stack    3.22 — штабель плит: предельные выступы l, l/2, l/3…;
 *  - diffblock 3.31 — дифференциальный блок: P = Q(1 − r/R)/2;
 *  - guides   4.62–4.64 — тело в направляющих с перекосом: кронштейн на болтах, пест, втулка на стойке;
 *  - tribo    4.71 — прибор для измерения трения в подшипнике;
 *  - plates   4.74 — цилиндр между шарнирными пластинами: границы силы P;
 *  - winch    4.75 — ворот с колодочным тормозом;
 *  - prism    4.76 — два тела на гранях призмы, нить через блок: угол наклона призмы;
 *  - bifilar  8.42 — бифиляр: момент пары и натяжение нитей при повороте стержня.
 */
import { ansB, bisect, bold, eqB, fail, parB, sample, sg, stepB, stepEx, type AskDef, type ExtraOut, type ExtraPlot, type Ln } from '../../../shared/extra';
import type { Step } from '../../../shared/doc';
import { parseLinkage, solveLinkage, type Linkage, type LinkageResult } from './linkage';

const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const nn = (...x: number[]) => x.every((v) => v >= 0 && Number.isFinite(v));
const fin = (...x: number[]) => x.every((v) => Number.isFinite(v));
const rad = (a: number) => (a * Math.PI) / 180;
const deg = (a: number) => (a * 180) / Math.PI;
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });
const listNums = (s: string) =>
  s
    .split(/[;\s]+/)
    .filter(Boolean)
    .map((x) => Number(x.replace(',', '.')));

/* ---------- система тел на шарнирах ---------- */
function linkTerm(c: number, name: string, first: boolean): string {
  const a = Math.abs(c);
  const k = Math.abs(a - 1) < 1e-9 ? '' : `${sg(a)}·`;
  return `${c < 0 ? (first ? '−' : ' − ') : first ? '' : ' + '}${k}${name}`;
}
function eqLine(a: number[], c: number, names: string[]): string {
  let s = '';
  a.forEach((v, i) => {
    if (Math.abs(v) > 1e-9) s += linkTerm(v, names[i], !s);
  });
  if (Math.abs(c) > 1e-9) s += s ? ` ${c < 0 ? '−' : '+'} ${sg(Math.abs(c))}` : sg(c);
  return `${s || '0'} = 0`;
}
export function linkagePlot(lk: Linkage, r: LinkageResult | null): ExtraPlot {
  const P = new Map(lk.points.map((p) => [p.name, p]));
  const xs = lk.points.map((p) => p.x),
    ys = lk.points.map((p) => p.y);
  const span = Math.max(1e-9, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const series = lk.bodies.map((b) => ({ name: b.join('-'), pts: b.map((n) => [P.get(n)!.x, P.get(n)!.y] as [number, number]), cls: 'en-v' }));
  const ar = 0.12 * span;
  for (const l of lk.loads) {
    const p = P.get(l.at)!;
    const v = Number.isNaN(l.F) && r?.status === 'ok' ? r.vals[l.name] : 1;
    const sgn = v < 0 ? -1 : 1;
    const ux = sgn * Math.cos(rad(l.ang)),
      uy = sgn * Math.sin(rad(l.ang));
    series.push({
      name: `сила ${l.name}`,
      pts: [
        [p.x - ux * ar, p.y - uy * ar],
        [p.x, p.y],
      ],
      cls: 'rl-e',
    });
  }
  for (const s of lk.supports) {
    const p = P.get(s.at)!;
    const a = s.kind === 'pin' ? rad(270) : rad(s.ang + 180);
    series.push({
      name: `опора ${s.at}`,
      pts: [
        [p.x, p.y],
        [p.x + 0.07 * span * Math.cos(a - 0.5), p.y + 0.07 * span * Math.sin(a - 0.5)],
        [p.x + 0.07 * span * Math.cos(a + 0.5), p.y + 0.07 * span * Math.sin(a + 0.5)],
        [p.x, p.y],
      ],
      cls: 'rl-c',
    });
  }
  return { xl: 'x', yl: 'y', equal: true, series, marks: lk.points.map((p) => ({ x: p.x, y: p.y, label: p.name })) };
}
const A_HINGE: AskDef = {
  id: 'hinge',
  title: 'Система тел на шарнирах: многоузловая система, механизм в равновесии',
  hint: 'Точки «имя x y»; тела — точки через «-» (A-C-E); опора «A» — шарнир, «K 90» — ползун (угол нормали), «K 90 0,1» — с трением; сила «точка [имя] модуль угол», неизвестный модуль — «?».',
  n: {},
  s: { pts: 'A 0 0; B 3,464 2; C -0,776 -2,898; D 6,292 -2,898', bodies: 'A-B A-C B-D', sups: 'C; D', loads: 'A Q 100 -15; B R ? 240' },
  fields: [
    { k: 'pts', label: 'точки: «имя x y» через «;»', text: true },
    { k: 'bodies', label: 'тела: точки через «-», тела через пробел', text: true },
    { k: 'sups', label: 'опоры: «A» — шарнир, «K угол [f]» — ползун', text: true },
    { k: 'loads', label: 'силы: «точка [имя] модуль угол», «?» — неизвестный модуль', text: true },
  ],
  solve: (q, ex) => {
    const pr = parseLinkage(q.s.pts ?? '', q.s.bodies ?? '', q.s.sups ?? '', q.s.loads ?? '');
    if (!pr.ok) return fail(pr.errors.slice(0, 6));
    const lk = pr.lk;
    const r = solveLinkage(lk);
    const names = r.unknowns.map((u) => u.name);
    const nBars = r.unknowns.filter((u) => u.kind === 'bar').length;
    const steps: Step[] = [
      stepEx(
        ex,
        'Схема',
        'Тело из двух точек без сил на нём — стержень: его усилие S направлено вдоль стержня (растяжение «+»), уравнения самого стержня выполняются сами. Точка, общая для нескольких тел, — шарнир: вырезаем палец и записываем для него два уравнения, сила в этой точке действует на палец.',
        {
          k: 'ul',
          items: [
            [`точек ${lk.points.length}, тел ${lk.bodies.length} (из них стержней ${nBars}), шарниров ${r.pins.length}`],
            [
              `опоры: ${lk.supports.map((s) => (s.kind === 'pin' ? `${s.at} — шарнирно-неподвижная` : `${s.at} — ползун, нормаль под ${sg(s.ang)}°${s.f ? `, трение f = ${sg(s.f)} (линия реакции отклонена на ${sg(deg(Math.atan(Math.abs(s.f))))}°)` : ''}`)).join('; ') || 'нет'}`,
            ],
            [
              `силы: ${lk.loads.map((l) => `${l.name} в ${l.at} — ${Number.isNaN(l.F) ? 'модуль неизвестен' : sg(l.F)}, под ${sg(l.ang)}°`).join('; ') || 'нет'}`,
            ],
          ],
        },
      ),
      stepEx(
        ex,
        'Неизвестные и уравнения',
        'Для каждого тела (кроме стержней) — три уравнения равновесия, для каждого шарнира — два. Если тел-звеньев и связей столько, что система — механизм, уравнения совместны лишь при определённой силе: её модуль задаём неизвестным.',
        eqB(`неизвестных ${r.unknowns.length}: ${names.join(', ')}`, `уравнений ${r.eqs.length}, независимых ${r.rank}`),
      ),
    ];
    if (r.status !== 'ok') {
      steps.push(
        stepB(
          'Вывод',
          { k: 'badge', tone: 'bad', text: r.status === 'mechanism' ? 'равновесие невозможно' : 'неизвестные не определяются однозначно' },
          parB(
            r.status === 'mechanism'
              ? 'Уравнения несовместны: система — механизм, и заданные силы его не уравновешивают. Задайте модуль уравновешивающей силы неизвестным («?») или добавьте связь.'
              : 'Независимых уравнений меньше, чем неизвестных: система статически неопределима или неизвестных сил слишком много.',
          ),
        ),
      );
      return { ok: true, errors: [], vals: {}, steps, plot: linkagePlot(lk, null) };
    }
    if (r.eqs.length <= 40) steps.push(stepB('Уравнения равновесия', ...r.eqs.map((e) => eqB(`${e.what}:  ${eqLine(e.a, e.c, names)}`))));
    const rows: [Ln, string][] = [];
    for (const u of r.unknowns.filter((u) => u.kind === 'load'))
      rows.push([
        bold(`${u.name} = ${sg(r.vals[u.name])}`),
        r.vals[u.name] < 0 ? 'знак «−»: сила направлена противоположно заданному углу' : 'уравновешивающая сила',
      ]);
    for (const b of r.bars) rows.push([`${b.name} = ${sg(b.S)}`, b.S > 1e-9 ? 'растянут' : b.S < -1e-9 ? 'сжат' : 'не нагружен']);
    for (const s of lk.supports)
      rows.push(
        s.kind === 'pin'
          ? [`X_${s.at} = ${sg(r.vals[`X_${s.at}`])}, Y_${s.at} = ${sg(r.vals[`Y_${s.at}`])}, R_${s.at} = ${sg(r.vals[`R_${s.at}`])}`, 'реакция опоры']
          : [
              `N_${s.at} = ${sg(r.vals[`N_${s.at}`])}`,
              r.vals[`N_${s.at}`] < -1e-9
                ? 'реакция ползуна; знак «−» — против заданной нормали (для опоры с трением проверьте направление трения)'
                : 'реакция ползуна',
            ],
      );
    for (const u of r.unknowns.filter((u) => u.kind === 'pin' && u.name.startsWith('X_'))) {
      const y = u.name.replace(/^X_/, 'Y_');
      rows.push([`${u.name} = ${sg(r.vals[u.name])}, ${y} = ${sg(r.vals[y])}`, 'сила шарнира на тело']);
    }
    steps.push(stepB('Ответ', ansB(...rows.map(([v, n]) => [v, n] as [Ln, string]))));
    return done({ vals: r.vals, steps, plot: linkagePlot(lk, r) });
  },
};

/* ---------- верёвочный многоугольник ---------- */
export function chainAngles(Q: number[], a1: number, an: number) {
  const t1 = Math.tan(rad(a1)),
    tn = Math.tan(rad(an));
  const H = Q.reduce((s, v) => s + v, 0) / (tn - t1);
  const tg = [t1];
  for (const q of Q) tg.push(tg[tg.length - 1] + q / H);
  return { H, ang: tg.map((t) => deg(Math.atan(t))), T: tg.map((t) => H * Math.sqrt(1 + t * t)) };
}
const A_CHAIN: AskDef = {
  id: 'chain',
  title: '2.37, 2.39: верёвочный многоугольник — углы звеньев и усилия',
  hint: 'Нить или шарнирная цепь из стержней с вертикальными нагрузками (вниз) в узлах; углы звеньев к горизонту по ходу слева направо, «+» — вверх.',
  n: { a1: 60, an: -60 },
  s: { Q: '1; 1; 1', L: '' },
  fields: [
    { k: 'Q', label: 'нагрузки в узлах Q₁; Q₂; … (слева направо)', text: true },
    { k: 'a1', label: 'угол первого звена к горизонту, °', neg: true },
    { k: 'an', label: 'угол последнего звена, °', neg: true },
    { k: 'L', label: 'длины звеньев для чертежа (пусто — равные)', text: true },
  ],
  solve: (q, ex) => {
    const Q = listNums(q.s.Q ?? '');
    const { a1, an } = q.n;
    if (!Q.length || !Q.every((v) => Number.isFinite(v))) return fail(['Нагрузки — числа через «;».']);
    if (!(Math.abs(a1) < 90 && Math.abs(an) < 90) || Math.abs(Math.tan(rad(a1)) - Math.tan(rad(an))) < 1e-9)
      return fail(['Углы крайних звеньев — от −90° до 90° и разные (иначе горизонтальная составляющая усилий не определяется).']);
    const { H, ang, T } = chainAngles(Q, a1, an);
    const Ls = listNums(q.s.L ?? '');
    const L = Ls.length === ang.length && Ls.every((v) => v > 0) ? Ls : ang.map(() => 1);
    const pts: [number, number][] = [[0, 0]];
    ang.forEach((a, i) => pts.push([pts[i][0] + L[i] * Math.cos(rad(a)), pts[i][1] + L[i] * Math.sin(rad(a))]));
    const vals: Record<string, number> = { H };
    ang.forEach((a, i) => {
      vals[`a${i + 1}`] = a;
      vals[`T${i + 1}`] = T[i];
    });
    const kind = H > 0 ? 'растянуты (нить)' : 'сжаты (арка из стержней)';
    return done({
      vals,
      steps: [
        stepEx(
          ex,
          'Узлы',
          'Вырезаем узлы. Горизонтальные проекции усилий соседних звеньев равны — горизонтальная составляющая H одна для всей цепи; вертикальные проекции отличаются на нагрузку узла.',
          eqB('Tₖ·cos αₖ = H', 'H·(tg αₖ₊₁ − tg αₖ) = Qₖ'),
        ),
        stepB(
          'Горизонтальная составляющая',
          eqB(`Сумма по всем узлам: H·(tg αₙ − tg α₁) = ΣQ = ${sg(Q.reduce((s, v) => s + v, 0))}`, `H = ${sg(H)} — звенья ${kind}`),
        ),
        stepB('Углы и усилия', { k: 'ul', items: ang.map((a, i) => [`звено ${i + 1}: угол к горизонту ${sg(a)}°, T${i + 1} = H/cos α = ${sg(T[i])}`]) }),
        stepB(
          'Ответ',
          ansB(
            [bold(`H = ${sg(H)}`), `горизонтальная составляющая; «+» — растяжение`],
            ...ang.map((a, i): [Ln, string] => [`α${i + 1} = ${sg(a)}°, T${i + 1} = ${sg(T[i])}`, `звено ${i + 1}`]),
          ),
        ),
      ],
      plot: {
        xl: 'x',
        yl: 'y',
        equal: true,
        series: [{ name: H > 0 ? 'нить' : 'стержни', pts }],
        marks: pts.map((p, i) => ({ x: p[0], y: p[1], label: i === 0 || i === pts.length - 1 ? '' : `Q${i}` })),
      },
    });
  },
};

/* ---------- 2.51 ---------- */
const A_ATTRACT: AskDef = {
  id: 'attract',
  title: '2.51: точка между притягивающими центрами (Fᵢ = kᵢrᵢ)',
  hint: 'Центры Mᵢ(xᵢ, yᵢ) притягивают точку силами, пропорциональными расстояниям.',
  n: {},
  s: { tab: '0 0 1; 4 0 2; 1 3 3' },
  fields: [{ k: 'tab', label: 'центры «x y k» через «;»', text: true }],
  solve: (q, ex) => {
    const rows = (q.s.tab ?? '')
      .split(';')
      .map((r) => listNums(r))
      .filter((r) => r.length);
    if (!rows.length || rows.some((r) => r.length !== 3 || !fin(...r))) return fail(['Каждый центр — три числа «x y k».']);
    const K = rows.reduce((s, r) => s + r[2], 0);
    if (Math.abs(K) < 1e-12) return fail(['Сумма коэффициентов k равна нулю — положения равновесия нет.']);
    const x = rows.reduce((s, r) => s + r[2] * r[0], 0) / K,
      y = rows.reduce((s, r) => s + r[2] * r[1], 0) / K;
    return done({
      vals: { x, y },
      steps: [
        stepEx(
          ex,
          'Уравнения равновесия',
          'Сила Fᵢ = kᵢ·rᵢ направлена от M к Mᵢ, поэтому её проекции — kᵢ(xᵢ − x) и kᵢ(yᵢ − y): уравнения линейны по x и y.',
          eqB('Σkᵢ(xᵢ − x) = 0,  Σkᵢ(yᵢ − y) = 0', 'x = Σkᵢxᵢ/Σkᵢ,  y = Σkᵢyᵢ/Σkᵢ'),
        ),
        stepB('Ответ', ansB([bold(`x = ${sg(x)}`), 'Σk = ' + sg(K)], [bold(`y = ${sg(y)}`), 'точка — «центр тяжести» центров с весами k'])),
      ],
      plot: {
        xl: 'x',
        yl: 'y',
        equal: true,
        series: rows.map((r, i) => ({
          name: `F${i + 1}`,
          pts: [
            [x, y],
            [r[0], r[1]],
          ] as [number, number][],
        })),
        marks: [...rows.map((r, i) => ({ x: r[0], y: r[1], label: `M${i + 1}` })), { x, y, label: 'M' }],
      },
    });
  },
};

/* ---------- 2.56 ---------- */
const A_BOLT: AskDef = {
  id: 'bolt',
  title: '2.56: затяжка болта, поставленного с зазором',
  hint: 'Сила P стремится сдвинуть листы; болт не работает на срез — сдвиг держит трение на m поверхностях стыка.',
  n: { P: 2000, f: 0.2, m: 1 },
  fields: [
    { k: 'P', label: 'сдвигающая сила P' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'm', label: 'число поверхностей трения m' },
  ],
  solve: (q, ex) => {
    const { P, f, m } = q.n;
    if (!pos(P, f, m)) return fail(['Сила, коэффициент трения и число поверхностей — положительные.']);
    const N = P / (f * m);
    return done({
      vals: { N },
      steps: [
        stepEx(ex, 'Условие', 'Затяжка N прижимает листы; на каждой из m поверхностей стыка возникает сила трения не больше fN.', eqB('m·f·N ≥ P')),
        stepB('Ответ', ansB([bold(`N = P/(m·f) = ${sg(N)}`), 'наименьшая затяжка'])),
      ],
    });
  },
};

/* ---------- 2.57 ---------- */
const A_SHEETS: AskDef = {
  id: 'sheets',
  title: '2.57: листы двух кип, переложенные через один',
  hint: 'Листы кип A и B чередуются; каждая пара соседних листов принадлежит разным кипам. Одна кипа неподвижна, другую тянут.',
  n: { n: 200, w: 0.006, f: 0.2, f0: 0.2 },
  fields: [
    { k: 'n', label: 'число всех листов' },
    { k: 'w', label: 'вес одного листа' },
    { k: 'f', label: 'трение бумаги о бумагу f' },
    { k: 'f0', label: 'трение о стол f₀' },
  ],
  selects: [
    {
      k: 'bottom',
      label: 'нижний лист',
      options: [
        ['A', 'кипы A (тянут A — добавляется трение о стол)'],
        ['B', 'кипы B'],
      ],
    },
  ],
  s: { bottom: 'A' },
  solve: (q, ex) => {
    const { n, w, f, f0 } = q.n;
    if (!pos(n, w, f) || !nn(f0) || Math.round(n) !== n || n < 2) return fail(['Число листов — целое, не меньше 2; вес и трение — положительные.']);
    let inner = 0;
    for (let k = 1; k < n; k++) inner += f * k * w;
    const table = f0 * n * w;
    const PA = inner + (q.s.bottom === 'A' ? table : 0),
      PB = inner + (q.s.bottom === 'B' ? table : 0);
    return done({
      vals: { PA, PB },
      steps: [
        stepEx(
          ex,
          'Трение в стыках',
          'Под k-м листом (считая сверху) лежит стык, прижатый весом k листов. Соседние листы — из разных кип, поэтому при вытаскивании любой кипы скользят все n − 1 стыков.',
          eqB(`F_стыков = f·w·(1 + 2 + … + (n − 1)) = f·w·n(n − 1)/2 = ${sg(inner)}`),
        ),
        stepEx(
          ex,
          'Трение о стол',
          'Стол держит нижний лист; трение о стол мешает только той кипе, которой принадлежит нижний лист.',
          eqB(`F_стола = f₀·n·w = ${sg(table)}`),
        ),
        stepB(
          'Ответ',
          ansB(
            [bold(`тянем A: P = ${sg(PA)}`), q.s.bottom === 'A' ? 'стыки и стол' : 'только стыки'],
            [bold(`тянем B: P = ${sg(PB)}`), q.s.bottom === 'B' ? 'стыки и стол' : 'только стыки'],
          ),
        ),
      ],
    });
  },
};

/* ---------- 2.62 ---------- */
const A_WEDGE: AskDef = {
  id: 'wedge',
  title: '2.62: клин — давление на щёки при забивке, затем сила вытаскивания',
  hint: 'Симметричный клин с углом α каждой щеки к оси (уклон tg α) забит силой Q; трение на обеих щеках.',
  n: { tg: 0.05, Q: 6, f: 0.1 },
  fields: [
    { k: 'tg', label: 'уклон щеки tg α' },
    { k: 'Q', label: 'сила забивки Q' },
    { k: 'f', label: 'коэффициент трения f' },
  ],
  solve: (q, ex) => {
    const { tg, Q, f } = q.n;
    if (!pos(tg, Q) || !nn(f)) return fail(['Уклон и сила — положительные, трение — неотрицательное.']);
    const a = Math.atan(tg);
    const N = Q / (2 * (Math.sin(a) + f * Math.cos(a)));
    const P = 2 * N * (f * Math.cos(a) - Math.sin(a));
    return done({
      vals: { N, P },
      steps: [
        stepEx(
          ex,
          'Этап 1: забивка',
          'Клин движется внутрь: трение на щеках направлено наружу (против движения). Проекция на ось клина.',
          eqB('Q = 2N(sin α + f cos α)', `α = arctg ${sg(tg)} = ${sg(deg(a))}°;  N = ${sg(N)}`),
        ),
        stepEx(
          ex,
          'Этап 2: вытаскивание',
          'Давление N на щёки остаётся таким, каким его создала забивка (исходные данные второго этапа). Теперь клин движется наружу: трение направлено внутрь, нормальные силы помогают.',
          eqB('P = 2N(f cos α − sin α)', `P = ${sg(P)}`),
        ),
        stepB(
          'Ответ',
          ansB(
            [bold(`N = ${sg(N)}`), 'нормальное давление на каждую щёку'],
            [bold(P > 0 ? `P = ${sg(P)}` : 'P ≤ 0'), P > 0 ? 'сила, чтобы вытащить клин' : 'клин не самотормозящий: выскакивает сам (tg α > f)'],
          ),
        ),
      ],
    });
  },
};

/* ---------- 2.63 ---------- */
const pullQ = (P: number, f: number, g: number, b: number) => (P * (Math.sin(g) + f * Math.cos(g))) / (Math.cos(b) + f * Math.sin(b));
const A_PULL: AskDef = {
  id: 'pull',
  title: '2.63: наивыгоднейший угол тяги (наименьшая сила, чтобы сдвинуть тело)',
  hint: 'Тело весом P на шероховатой плоскости с наклоном γ; сила Q под углом β к плоскости тянет его вверх по плоскости (γ = 0 — горизонтальная).',
  n: { P: 1, f: 0.3, g: 0 },
  fields: [
    { k: 'P', label: 'вес P' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'g', label: 'наклон плоскости γ, °' },
  ],
  solve: (q, ex) => {
    const { P, f, g } = q.n;
    if (!pos(P) || !nn(f, g) || g >= 90) return fail(['Вес — положительный, трение и наклон (меньше 90°) — неотрицательные.']);
    const G = rad(g);
    const beta = Math.atan(f);
    const Qmin = (P * (Math.sin(G) + f * Math.cos(G))) / Math.sqrt(1 + f * f);
    return done({
      vals: { beta: deg(beta), Q: Qmin },
      steps: [
        stepEx(
          ex,
          'Предельное равновесие',
          'Сила Q уменьшает давление на плоскость: N = P cos γ − Q sin β; трение fN.',
          eqB('Q cos β = P sin γ + f(P cos γ − Q sin β)', 'Q(β) = P(sin γ + f cos γ)/(cos β + f sin β)'),
        ),
        stepEx(
          ex,
          'Наименьшая сила',
          'Знаменатель cos β + f sin β = √(1 + f²)·cos(β − φ), φ = arctg f — угол трения: он наибольший при β = φ.',
          eqB(`β = arctg f = ${sg(deg(beta))}°`, `Q_min = P(sin γ + f cos γ)/√(1 + f²) = ${sg(Qmin)}`),
        ),
        stepB(
          'Ответ',
          ansB([bold(`β = ${sg(deg(beta))}°`), 'угол тяги к плоскости равен углу трения'], [bold(`Q_min = ${sg(Qmin)}`), g ? '' : 'Q_min = fP/√(1 + f²)']),
        ),
      ],
      plot: {
        xl: 'β, °',
        yl: 'Q',
        series: [{ name: 'Q(β)', pts: sample((b) => pullQ(P, f, G, rad(b)), 0, 80, 160) }],
        marks: [{ x: deg(beta), y: Qmin, label: 'Q_min' }],
      },
    });
  },
};

/* ---------- 2.69 ---------- */
const A_VGROOVE: AskDef = {
  id: 'vgroove',
  title: '2.69: цилиндр в клиновых направляющих',
  hint: 'Цилиндр весом Q лежит в направляющих с углом раствора θ; сила P вдоль оси цилиндра.',
  n: { Q: 1, f: 0.2, th: 60, k: 1 },
  fields: [
    { k: 'Q', label: 'вес Q' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'th', label: 'угол раствора θ, °' },
    { k: 'k', label: 'для обратной задачи: P/Q' },
  ],
  solve: (q, ex) => {
    const { Q, f, th, k } = q.n;
    if (!pos(Q, f, th, k) || th >= 180) return fail(['Вес, трение, отношение — положительные; угол — от 0 до 180°.']);
    const s = Math.sin(rad(th / 2));
    const N = Q / (2 * s),
      P = 2 * f * N;
    const thK = f / k <= 1 ? 2 * deg(Math.asin(f / k)) : NaN;
    return done({
      vals: { P, N, th: thK },
      steps: [
        stepEx(
          ex,
          'Давление на грани',
          'Нормальные реакции граней перпендикулярны граням и наклонены к вертикали на угол 90° − θ/2; их вертикальные проекции держат вес.',
          eqB('2N·sin(θ/2) = Q', `N = ${sg(N)}`),
        ),
        stepB('Сила сдвига', eqB('P = 2fN = Qf/sin(θ/2)', `P = ${sg(P)}`)),
        stepB('Обратная задача', eqB(`P = kQ: sin(θ/2) = f/k`, Number.isFinite(thK) ? `θ = 2 arcsin(f/k) = ${sg(thK)}°` : 'f/k > 1 — такого угла нет')),
        stepB(
          'Ответ',
          ansB(
            [bold(`P = ${sg(P)}`), 'сила, при которой цилиндр начнёт двигаться'],
            [Number.isFinite(thK) ? `θ = ${sg(thK)}°` : '—', `угол, при котором P = ${sg(k)}·Q`],
          ),
        ),
      ],
      plot: {
        xl: 'θ, °',
        yl: 'P',
        series: [{ name: 'P(θ)', pts: sample((t) => (Q * f) / Math.sin(rad(t / 2)), 10, 179, 160) }],
        marks: [{ x: th, y: P, label: 'P' }],
      },
    });
  },
};

/* ---------- 2.71 ---------- */
const A_CRANK: AskDef = {
  id: 'crank',
  title: '2.71: кривошипный механизм с ползуном — сила, держащая груз',
  hint: 'Ползун A в вертикальной направляющей, шатун AB под углом φ к направляющей, кривошип OB радиуса r под углом θ к ней; груз Q на барабане радиуса a.',
  n: { Q: 1, a: 0.1, r: 0.3, phi: 20, th: 60, f: 0.1 },
  fields: [
    { k: 'Q', label: 'груз Q' },
    { k: 'a', label: 'радиус барабана a' },
    { k: 'r', label: 'радиус кривошипа r' },
    { k: 'phi', label: 'угол шатуна с направляющей φ, °', neg: true },
    { k: 'th', label: 'угол кривошипа с направляющей θ, °', neg: true },
    { k: 'f', label: 'трение ползуна f (0 — гладко)' },
  ],
  solve: (q, ex) => {
    const { Q, a, r, phi, th, f } = q.n;
    if (!pos(Q, a, r) || !nn(f) || !fin(phi, th)) return fail(['Груз и размеры — положительные, трение — неотрицательное.']);
    const sn = Math.sin(rad(phi + th));
    if (Math.abs(sn) < 1e-9) return fail(['φ + θ = 0 или 180°: шатун и кривошип на одной прямой (мёртвое положение).']);
    const S = (Q * a) / (r * sn);
    const c = Math.cos(rad(phi)),
      s = Math.sin(rad(phi));
    const P = S * c,
      Pmin = S * (c - f * s),
      Pmax = S * (c + f * s);
    return done({
      vals: { P, Pmin, Pmax, S },
      steps: [
        stepEx(
          ex,
          'Кривошип с барабаном',
          'Шатун — стержень с шарнирами на концах: его усилие S направлено вдоль AB. Момент относительно оси O: плечо силы S равно r·sin(φ + θ) — угол между шатуном и кривошипом.',
          eqB('S·r·sin(φ + θ) = Q·a', `S = ${sg(S)}`),
        ),
        stepEx(
          ex,
          'Ползун',
          'Вдоль направляющей: P и проекция S cos φ; поперёк — давление N = S sin φ. С трением в предельном равновесии fN помогает силе P или мешает ей.',
          eqB('без трения: P = S cos φ = Qa cos φ/(r sin(φ + θ))', 'P_min = Qa(cos φ − f sin φ)/(r sin(φ + θ)),  P_max = Qa(cos φ + f sin φ)/(r sin(φ + θ))'),
        ),
        stepB(
          'Ответ',
          ansB(
            [bold(`P = ${sg(P)}`), 'без трения'],
            [`P_min = ${sg(Pmin)}, P_max = ${sg(Pmax)}`, f ? 'груз неподвижен при P_min ≤ P ≤ P_max' : 'трения нет — границы совпадают'],
          ),
        ),
      ],
    });
  },
};

/* ---------- 3.20 ---------- */
const A_GATE: AskDef = {
  id: 'gate',
  title: '3.20: щит канала на оси — уровень воды, при котором щит открывается',
  hint: 'Щит AB наклонён под углом α к горизонту, нижняя кромка A — на дне; ось O — на расстоянии h = AO от кромки вдоль щита.',
  n: { h: 1, al: 60, gam: 1, b: 1, H: 0 },
  fields: [
    { k: 'h', label: 'расстояние AO вдоль щита h' },
    { k: 'al', label: 'угол щита к горизонту α, °' },
    { k: 'gam', label: 'удельный вес воды γ (для момента)' },
    { k: 'b', label: 'ширина щита b (для момента)' },
    { k: 'H', label: 'уровень H для проверки (0 — не считать)' },
  ],
  solve: (q, ex) => {
    const { h, al, gam, b, H } = q.n;
    if (!pos(h, al, gam, b) || al > 90 || !nn(H)) return fail(['Размеры и угол (до 90°) — положительные.']);
    const s = Math.sin(rad(al));
    const Hc = 3 * h * s;
    const vals: Record<string, number> = { H: Hc };
    const steps: Step[] = [
      stepEx(
        ex,
        'Давление воды',
        'Давление растёт с глубиной линейно: эпюра на смоченной длине щита L = H/sin α — треугольник. Равнодействующая R = γbHL/2 приложена на трети смоченной длины от дна.',
        eqB('L = H/sin α,  R = γ·b·H·L/2', 'центр давления — на расстоянии L/3 от кромки A'),
      ),
      stepEx(
        ex,
        'Условие открытия',
        'Пока центр давления ниже оси O, момент воды прижимает щит; щит поворачивается, когда центр давления поднимается выше оси.',
        eqB('L/3 = h  ⇒  H = 3h·sin α', `H = ${sg(Hc)}`),
      ),
    ];
    if (H > 0) {
      const L = H / s;
      const M = ((gam * b * H * L) / 2) * (h - L / 3);
      vals.M = M;
      steps.push(
        stepB(
          'Проверка уровня',
          eqB(`H = ${sg(H)}: L = ${sg(L)}, R = ${sg((gam * b * H * L) / 2)}, момент относительно O: R·(h − L/3) = ${sg(M)}`),
          parB(M >= 0 ? 'Момент прижимает щит: щит закрыт.' : 'Момент открывает щит.'),
        ),
      );
    }
    steps.push(stepB('Ответ', ansB([bold(`H = 3h·sin α = ${sg(Hc)}`), 'уровень воды, при котором щит открывается'])));
    return done({
      vals,
      steps,
      plot: {
        xl: 'H',
        yl: 'M_O / (γb)',
        series: [{ name: 'момент воды относительно O', pts: sample((x) => ((x * x) / (2 * s)) * (h - x / (3 * s)), 0, 1.5 * Hc, 120) }],
        marks: [{ x: Hc, y: 0, label: 'H' }],
      },
    });
  },
};

/* ---------- 3.22 ---------- */
const A_STACK: AskDef = {
  id: 'stack',
  title: '3.22: штабель плит — предельные выступы',
  hint: 'Одинаковые однородные плиты длиной 2l уложены уступом; выступы считаем сверху вниз.',
  n: { l: 1, n: 5 },
  fields: [
    { k: 'l', label: 'половина длины плиты l' },
    { k: 'n', label: 'число плит (выступов)' },
  ],
  solve: (q, ex) => {
    const { l, n } = q.n;
    if (!pos(l) || Math.round(n) !== n || n < 1 || n > 60) return fail(['l — положительное, число плит — целое от 1 до 60.']);
    const d = Array.from({ length: n }, (_, k) => l / (k + 1));
    const tot = d.reduce((s, v) => s + v, 0);
    const vals: Record<string, number> = { total: tot };
    d.forEach((v, k) => (vals[`d${k + 1}`] = v));
    // Верхняя плита выступает вправо над второй и т. д.: правый край k-й плиты сверху — x_k, x₁ = 0.
    const series = [] as { name: string; pts: [number, number][] }[];
    let x = 0;
    for (let k = 0; k < n; k++) {
      series.push({
        name: `плита ${k + 1}`,
        pts: [
          [x, n - k],
          [x - 2 * l, n - k],
          [x - 2 * l, n - k - 0.8],
          [x, n - k - 0.8],
          [x, n - k],
        ],
      });
      x -= d[k];
    }
    return done({
      vals,
      steps: [
        stepEx(
          ex,
          'Условие равновесия',
          'Верхние k плит не опрокидываются, пока их общий центр тяжести лежит над (k + 1)-й плитой; в предельном случае — над её краем. Складываем веса сверху: центр тяжести k плит смещён от края нижележащей плиты ровно на сумму выступов.',
          eqB('выступ k-й плиты сверху: dₖ = l/k', '(центр k верхних плит — над краем: k·P·dₖ = P·l)'),
        ),
        stepB('Выступы', { k: 'ul', items: d.map((v, k) => [`d${k + 1} = l/${k + 1} = ${sg(v)}`]) }),
        stepB('Ответ', ansB([bold(`l, l/2, l/3, …, l/${n}`), `сумма выступов ${sg(tot)} (растёт как гармонический ряд)`])),
      ],
      plot: { xl: 'x', yl: 'ряд', equal: false, series },
    });
  },
};

/* ---------- 3.31 ---------- */
const A_DIFF: AskDef = {
  id: 'diffblock',
  title: '3.31: дифференциальный блок',
  hint: 'Два скреплённых шкива радиусов R и r на неподвижной оси, бесконечная цепь, подвижный блок с грузом Q.',
  n: { Q: 500, R: 25, r: 24 },
  fields: [
    { k: 'Q', label: 'груз Q' },
    { k: 'R', label: 'радиус большого шкива R' },
    { k: 'r', label: 'радиус малого шкива r' },
  ],
  solve: (q, ex) => {
    const { Q, R, r } = q.n;
    if (!pos(Q, R, r) || r >= R) return fail(['Груз и радиусы — положительные, r < R.']);
    const P = (Q / 2) * (1 - r / R);
    return done({
      vals: { P },
      steps: [
        stepEx(ex, 'Подвижный блок', 'Обе ветви петли, на которой висит подвижный блок, натянуты одинаково.', eqB('T = Q/2')),
        stepEx(
          ex,
          'Шкивы на оси',
          'Ветвь с большого шкива тянет с плечом R, с малого — с плечом r в обратную сторону; сила P — на ветви большого шкива.',
          eqB('T·R − T·r − P·R = 0  ⇒  P = (Q/2)(1 − r/R)'),
        ),
        stepB('Ответ', ansB([bold(`P = ${sg(P)}`), `выигрыш в силе Q/P = ${sg(Q / P)}`])),
      ],
    });
  },
};

/* ---------- 4.62–4.64 ---------- */
const A_GUIDES: AskDef = {
  id: 'guides',
  title: '4.62–4.64: перекос в направляющих — кронштейн на болтах, пест, втулка на стойке',
  hint: 'Тело касается направляющих (или стены) в двух местах на расстоянии b; сила P приложена с плечом a.',
  n: { P: 600, G: 180, a: 0.15, b: 1.5, f: 0.15 },
  s: { kind: 'pest' },
  selects: [
    {
      k: 'kind',
      label: 'что ищем',
      options: [
        ['bracket', '4.62: затяжка верхнего болта кронштейна'],
        ['pest', '4.63: сила подъёма песта'],
        ['sleeve', '4.64: плечо самоторможения втулки'],
      ],
    },
  ],
  fields: [
    { k: 'P', label: 'нагрузка P (4.62, 4.64)', show: (p) => p.s.kind !== 'pest' },
    { k: 'G', label: 'вес песта G (4.63)', show: (p) => p.s.kind === 'pest' },
    { k: 'a', label: 'плечо силы a (4.62, 4.63)', show: (p) => p.s.kind !== 'sleeve' },
    { k: 'b', label: 'расстояние между опорами b' },
    { k: 'f', label: 'коэффициент трения f' },
  ],
  solve: (q, ex) => {
    const { P, G, a, b, f } = q.n;
    if (!pos(b, f)) return fail(['Расстояние и трение — положительные.']);
    if (q.s.kind === 'bracket') {
      if (!pos(P, a)) return fail(['Нагрузка и плечо — положительные.']);
      const T1 = (P * a) / b,
        T2 = P / f,
        T = Math.max(T1, T2);
      return done({
        vals: { T, T1, T2 },
        steps: [
          stepEx(
            ex,
            'Опрокидывание',
            'Кронштейн стремится повернуться вокруг нижнего края (у нижнего болта); затяжка верхнего болта T даёт момент T·b.',
            eqB('T·b ≥ P·a', `T ≥ ${sg(T1)}`),
          ),
          stepEx(
            ex,
            'Сдвиг вниз',
            'Болты поставлены с зазором и не работают на срез: вес держит трение о стену. Стена давит на кронштейн с силой, равной затяжке (сумма горизонтальных сил).',
            eqB('f·T ≥ P', `T ≥ P/f = ${sg(T2)}`),
          ),
          stepB('Ответ', ansB([bold(`T = ${sg(T)}`), b / a > f ? 'b/a > f: решает условие трения, T = P/f' : 'решает условие опрокидывания'])),
        ],
      });
    }
    if (q.s.kind === 'pest') {
      if (!pos(G, a)) return fail(['Вес и плечо — положительные.']);
      const k = (2 * f * a) / b;
      if (k >= 1) return fail(['2fa/b ≥ 1: пест заклинивает, поднять его нельзя.']);
      const Pp = G / (1 - k);
      return done({
        vals: { P: Pp, N: (Pp * a) / b },
        steps: [
          stepEx(
            ex,
            'Перекос',
            'Сила P приложена с плечом a от оси песта: её момент уравновешивает пара давлений направляющих C и D.',
            eqB('N·b = P·a  ⇒  N = Pa/b'),
          ),
          stepEx(ex, 'Подъём', 'Обе направляющие дают трение fN вниз.', eqB('P = G + 2fN = G + 2fPa/b', `P = G/(1 − 2fa/b) = ${sg(Pp)}`)),
          stepB('Ответ', ansB([bold(`P = ${sg(Pp)}`), `давление на направляющие N = ${sg((Pp * a) / b)}`])),
        ],
      });
    }
    if (!pos(P)) return fail(['Нагрузка — положительная.']);
    const amin = b / (2 * f);
    return done({
      vals: { a: amin },
      steps: [
        stepEx(ex, 'Перекос втулки', 'Груз P с плечом a перекашивает втулку длиной b: края втулки давят на стойку с силами N.', eqB('N·b = P·a')),
        stepEx(ex, 'Самоторможение', 'Стержень не соскальзывает, если трение по двум краям держит груз.', eqB('2fN ≥ P  ⇒  2f·Pa/b ≥ P  ⇒  a ≥ b/(2f)')),
        stepB('Ответ', ansB([bold(`a ≥ ${sg(amin)}`), 'не зависит от груза P'])),
      ],
    });
  },
};

/* ---------- 4.71 ---------- */
export function triboF(Q: number, q0: number, p: number, P: number, a: number, b: number, c: number, h: number, d: number, al: number) {
  const K = (2 * (p * b + P * c)) / a;
  return (Q * h * Math.tan(rad(al))) / ((K - q0 + (K + Q - q0)) * (d / 2));
}
const A_TRIBO: AskDef = {
  id: 'tribo',
  title: '4.71: прибор для измерения трения в подшипнике',
  hint: 'Половины подшипника прижаты к шипу скобой и рычагами (короткое плечо a); при вращении шипа прибор отклоняется на угол α.',
  n: { Q: 40, q: 6, p: 7, P: 8, a: 30, b: 510, c: 900, h: 120, d: 100, al: 5 },
  fields: [
    { k: 'Q', label: 'вес прибора Q' },
    { k: 'q', label: 'вес нижней половины q' },
    { k: 'p', label: 'вес рычага p' },
    { k: 'P', label: 'груз на рычаге P' },
    { k: 'a', label: 'короткое плечо рычага a' },
    { k: 'b', label: 'плечо веса рычага b' },
    { k: 'c', label: 'плечо груза c' },
    { k: 'h', label: 'центр тяжести ниже оси на h' },
    { k: 'd', label: 'диаметр шипа d' },
    { k: 'al', label: 'отклонение α, °' },
  ],
  solve: (q, ex) => {
    const n = q.n;
    if (!pos(n.Q, n.a, n.h, n.d, n.al) || !nn(n.q, n.p, n.P, n.b, n.c)) return fail(['Данные — положительные (веса и плечи — неотрицательные).']);
    const K = (2 * (n.p * n.b + n.P * n.c)) / n.a;
    const Nlow = K - n.q,
      Nup = K + n.Q - n.q;
    const f = triboF(n.Q, n.q, n.p, n.P, n.a, n.b, n.c, n.h, n.d, n.al);
    return done({
      vals: { f, Nlow, Nup },
      steps: [
        stepEx(
          ex,
          'Прижатие половин',
          'Два рычага давят на нижнюю половину коротким плечом a: момент веса рычага и груза относительно оси рычага.',
          eqB(`2(pb + Pc)/a = ${sg(K)}`),
        ),
        stepEx(
          ex,
          'Давления на шип',
          'Нижняя половина прижата силой рычагов минус её вес; верхняя — силой рычагов, которую передаёт скоба, плюс вес остальных частей прибора. Трение — по сумме давлений обеих половин, а не по полной реакции.',
          eqB(`N_ниж = 2(pb + Pc)/a − q = ${sg(Nlow)}`, `N_верх = 2(pb + Pc)/a + (Q − q) = ${sg(Nup)}`),
        ),
        stepEx(
          ex,
          'Момент трения',
          'Момент трения уравновешивает момент веса прибора, центр тяжести которого отошёл от вертикали на h·sin α; книга записывает правую часть как Qh·tg α.',
          eqB('(N_ниж + N_верх)·f·d/2 = Q·h·tg α', `f = ${sg(f)}`),
        ),
        stepB('Ответ', ansB([bold(`f = ${sg(f)}`), 'коэффициент трения шипа о подшипник'])),
      ],
    });
  },
};

/* ---------- 4.74 ---------- */
const A_PLATES: AskDef = {
  id: 'plates',
  title: '4.74: цилиндр между шарнирными пластинами — границы силы P',
  hint: 'Пластины AO и BO с шарниром O (угол AOB = 2α) сжимают цилиндр веса Q и радиуса r горизонтальными силами P в точках A, B (AB = a).',
  n: { Q: 1, r: 0.1, f: 0.2, al: 30, a: 0.5 },
  fields: [
    { k: 'Q', label: 'вес цилиндра Q' },
    { k: 'r', label: 'радиус r' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'al', label: 'половина угла раствора α, °' },
    { k: 'a', label: 'расстояние AB = a' },
  ],
  solve: (q, ex) => {
    const { Q, r, f, al, a } = q.n;
    if (!pos(Q, r, a, al) || !nn(f) || al >= 90) return fail(['Данные — положительные, α < 90°.']);
    const s = Math.sin(rad(al)),
      c = Math.cos(rad(al));
    const Pmin = (r / a) * (Q / (s + f * c));
    const lock = Math.tan(rad(al)) <= f;
    const Pmax = lock ? Infinity : (r / a) * (Q / (s - f * c));
    return done({
      vals: { Pmin, ...(lock ? {} : { Pmax }) },
      steps: [
        stepEx(
          ex,
          'Цилиндр',
          'Пластины давят на цилиндр по нормалям N, наклонённым к горизонту на угол α; трение fN по касательной в ту или другую сторону — смотря куда цилиндр стремится сдвинуться.',
          eqB('выскальзывает вниз: 2N(sin α + f cos α) = Q', 'выдавливается вверх: 2N(sin α − f cos α) = Q'),
        ),
        stepEx(
          ex,
          'Пластина',
          'Момент относительно шарнира O: сила P на высоте (a/2)/tg α, давление N на плече r/tg α (расстояние от O до точки касания).',
          eqB('P·(a/2)/tg α = N·r/tg α  ⇒  P = 2Nr/a'),
        ),
        stepB(
          'Ответ',
          lock
            ? ansB([bold(`P ≥ ${sg(Pmin)}`), 'tg α ≤ f: вверх цилиндр не выдавить — верхней границы нет'])
            : ansB([bold(`${sg(Pmin)} ≤ P ≤ ${sg(Pmax)}`), 'tg α > f: P ∈ [rQ/(a(sin α + f cos α)), rQ/(a(sin α − f cos α))]']),
        ),
      ],
      plot: {
        xl: 'α, °',
        yl: 'P',
        series: [
          { name: 'P_min', pts: sample((x) => (r / a) * (Q / (Math.sin(rad(x)) + f * Math.cos(rad(x)))), 5, 85, 120) },
          {
            name: 'P_max',
            pts: sample((x) => (Math.tan(rad(x)) > f ? (r / a) * (Q / (Math.sin(rad(x)) - f * Math.cos(rad(x)))) : NaN), 5, 85, 120).filter(
              (p) => p[1] < 20 * Pmin,
            ),
          },
        ],
      },
    });
  },
};

/* ---------- 4.75 ---------- */
const A_WINCH: AskDef = {
  id: 'winch',
  title: '4.75: ворот с колодочным тормозом',
  hint: 'Груз Q на подвижном блоке; цепь на барабане диаметра b; тормозное колесо диаметра a; тормозной рычаг ED с колодкой F, рычаг AB с тягой CD.',
  n: { Q: 800, a: 50, b: 20, f: 0.4, ED: 120, FE: 60, AB: 100, BC: 10, k: 2 },
  fields: [
    { k: 'Q', label: 'груз Q' },
    { k: 'k', label: 'число ветвей подвижного блока (1 — без блока)' },
    { k: 'b', label: 'диаметр барабана b' },
    { k: 'a', label: 'диаметр тормозного колеса a' },
    { k: 'f', label: 'коэффициент трения колодки f' },
    { k: 'ED', label: 'тормозной рычаг ED' },
    { k: 'FE', label: 'плечо колодки FE' },
    { k: 'AB', label: 'рычаг AB' },
    { k: 'BC', label: 'плечо тяги BC' },
  ],
  solve: (q, ex) => {
    const n = q.n;
    if (!pos(n.Q, n.a, n.b, n.f, n.ED, n.FE, n.AB, n.BC, n.k)) return fail(['Все данные — положительные.']);
    const T = n.Q / n.k;
    const Ftr = (T * n.b) / n.a;
    const N = Ftr / n.f;
    const S = (N * n.FE) / n.ED;
    const P = (S * n.BC) / n.AB;
    return done({
      vals: { P, N, S, T },
      steps: [
        stepB('Цепь на барабане', eqB(`T = Q/${sg(n.k)} = ${sg(T)}`)),
        stepEx(
          ex,
          'Тормоз',
          'Момент силы трения колодки о колесо уравновешивает момент натяжения цепи на барабане.',
          eqB('F_тр·a/2 = T·b/2', `F_тр = ${sg(Ftr)},  N = F_тр/f = ${sg(N)}`),
        ),
        stepEx(
          ex,
          'Тормозной рычаг ED',
          'Размерами колодки пренебрегаем: сила трения проходит через ось E рычага и момента не даёт.',
          eqB('S_CD·ED = N·FE', `S_CD = ${sg(S)}`),
        ),
        stepB('Рычаг AB', eqB('P·AB = S_CD·BC', `P = ${sg(P)}`)),
        stepB('Ответ', ansB([bold(`P = ${sg(P)}`), 'сила на конце рычага, уравновешивающая груз'])),
      ],
    });
  },
};

/* ---------- 4.76 ---------- */
export function prismAlpha(P1: number, P2: number, f: number, A: number, C: number): number {
  // Грань AB наклонена к горизонту на A + α, грань BC — на C − α (α — наклон основания AC).
  const g = (al: number) => P1 * (Math.sin(rad(A + al)) - f * Math.cos(rad(A + al))) - P2 * (Math.sin(rad(C - al)) + f * Math.cos(rad(C - al)));
  return bisect(g, -Math.min(A, 90 - C) + 1e-9, Math.min(C, 90 - A) - 1e-9);
}
const A_PRISM: AskDef = {
  id: 'prism',
  title: '4.76: два тела на гранях призмы, нить через блок — наклон призмы',
  hint: 'Призма ABC, грани AB и BC; углы при основании BAC и BCA; основание AC наклонено к горизонту на α (A ниже). Тела связаны нитью через блок B.',
  n: { P1: 1, P2: 1, f: 0.2, A: 45, C: 45 },
  fields: [
    { k: 'P1', label: 'вес тела на AB (опускается)' },
    { k: 'P2', label: 'вес тела на BC' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'A', label: 'угол BAC, °' },
    { k: 'C', label: 'угол BCA, °' },
  ],
  solve: (q, ex) => {
    const { P1, P2, f, A, C } = q.n;
    if (!pos(P1, P2, A, C) || !nn(f) || A + C >= 180) return fail(['Веса и углы — положительные, A + C < 180°.']);
    const al = prismAlpha(P1, P2, f, A, C);
    if (!Number.isFinite(al)) return fail(['В допустимых положениях призмы тело на AB не опускается.']);
    return done({
      vals: { alpha: al, tg: Math.tan(rad(al)) },
      steps: [
        stepEx(
          ex,
          'Наклоны граней',
          'Если основание AC поднять на угол α (A ниже C), грань AB станет круче, BC — положе.',
          eqB('наклон AB: A + α,  наклон BC: C − α'),
        ),
        stepEx(
          ex,
          'Начало движения',
          'Тело на AB опускается и тянет нить; трение на обеих гранях направлено против движения; натяжение нити по обе стороны блока одинаково.',
          eqB('P₁(sin(A + α) − f cos(A + α)) = P₂(sin(C − α) + f cos(C − α))'),
        ),
        stepB(
          'Ответ',
          ansB([
            bold(`α = ${sg(al)}°`),
            `tg α = ${sg(Math.tan(rad(al)))}${Math.abs(A - 45) < 1e-9 && Math.abs(C - 45) < 1e-9 && Math.abs(P1 - P2) < 1e-12 ? ' (при A = C = 45° и равных весах tg α = f)' : ''}`,
          ]),
        ),
      ],
    });
  },
};

/* ---------- 8.42 ---------- */
const A_BIFILAR: AskDef = {
  id: 'bifilar',
  title: '8.42: бифиляр — момент пары и натяжение нитей',
  hint: 'Стержень AA₁ = 2r весом P на двух вертикальных нитях длиной l (BB₁ = 2r) повёрнут вокруг вертикальной оси на угол α.',
  n: { P: 1, r: 0.2, l: 1, al: 30 },
  fields: [
    { k: 'P', label: 'вес стержня P' },
    { k: 'r', label: 'половина длины стержня r' },
    { k: 'l', label: 'длина нитей l' },
    { k: 'al', label: 'угол поворота α, °' },
  ],
  solve: (q, ex) => {
    const { P, r, l, al } = q.n;
    if (!pos(P, r, l) || !nn(al)) return fail(['Данные — положительные.']);
    const c = 2 * r * Math.sin(rad(al / 2));
    if (c >= l) return fail(['2r·sin(α/2) ≥ l: стержень поднялся бы до точек подвеса.']);
    const h = Math.sqrt(l * l - c * c);
    const T = (l * P) / (2 * h);
    const M = (P * r * r * Math.sin(rad(al))) / h;
    return done({
      vals: { M, T, h },
      steps: [
        stepEx(
          ex,
          'Геометрия закрутки',
          'Конец стержня поворачивается по окружности радиуса r: горизонтальная проекция нити — хорда 2r·sin(α/2); стержень поднимается.',
          eqB(`хорда 2r·sin(α/2) = ${sg(c)}`, `высота h = √(l² − 4r²sin²(α/2)) = ${sg(h)}`),
        ),
        stepEx(ex, 'Вертикаль', 'Вертикальные проекции натяжений двух нитей держат вес.', eqB('2T·h/l = P  ⇒  T = lP/(2h)', `T = ${sg(T)}`)),
        stepEx(
          ex,
          'Момент относительно оси',
          'Горизонтальные проекции T·c/l направлены по хордам; плечо хорды относительно оси — r·cos(α/2). Пара M уравновешивает их момент.',
          eqB('M = 2·(T·c/l)·r cos(α/2) = Pr²sin α/h', `M = ${sg(M)}`),
        ),
        stepB('Ответ', ansB([bold(`M = ${sg(M)}`), 'момент пары'], [bold(`T = ${sg(T)}`), 'натяжение каждой нити'])),
      ],
      plot: {
        xl: 'α, °',
        yl: 'M',
        series: [
          {
            name: 'M(α)',
            pts: sample(
              (x) => {
                const cc = 2 * r * Math.sin(rad(x / 2));
                return cc < l ? (P * r * r * Math.sin(rad(x))) / Math.sqrt(l * l - cc * cc) : NaN;
              },
              0,
              180,
              180,
            ),
          },
        ],
        marks: [{ x: al, y: M, label: 'M' }],
      },
    });
  },
};

export const CONV_ASKS: AskDef[] = [
  A_HINGE,
  A_CHAIN,
  A_ATTRACT,
  A_BOLT,
  A_SHEETS,
  A_WEDGE,
  A_PULL,
  A_VGROOVE,
  A_CRANK,
  A_GATE,
  A_STACK,
  A_DIFF,
  A_GUIDES,
  A_TRIBO,
  A_PLATES,
  A_WINCH,
  A_PRISM,
  A_BIFILAR,
];
