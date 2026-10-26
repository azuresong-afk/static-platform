/**
 * Пункт 31, «Устойчивость и нелинейные колебания»: второй экран.
 *
 *  - constr  52.7–52.9, 52.12 — равновесие при связях: множители Лагранжа, уравнения в общем виде с произвольной
 *            функцией f, положения равновесия и их устойчивость (вторая вариация Π на связях);
 *  - guide   52.13 — форма направляющей противовеса, при которой равновесие безразлично (Π = const);
 *  - tops    55.19 — стопка симметричных волчков: уравнения малых колебаний и уравнение частот в буквах;
 *  - stops   56.3, 56.4, 56.8 — упоры, сухое трение с трением покоя, вынуждающая сила: движение, период;
 *  - subh    56.9 — субгармоники в системе с упорами и сухим трением: баланс работ за период;
 *  - pmap    56.13 — точечное преобразование на сечении ẋ = 0, неподвижная точка и её устойчивость.
 */
import { ansB, bold, eqB, fail, parB, sg, stepB, stepEx, type AskDef, type ExtraOut, type ExtraPlot, type Ln, type PlotSeries } from '../../../shared/extra';
import { normName, parseSym as parseSym0, prettyName, setCoordNames, symText, varsOf, type Sym } from '../../../shared/sym';
import { solveConstr } from './constr';
import { fixedPoints, freePeriodic, measure, poincare, simulate, type Acc } from './impact';
import { compile, type Num } from './symfn';
import { solveTops } from './tops';

const D2R = Math.PI / 180;
/** Разбор формулы без исключений (на «√2» разборщик падает — пишите sqrt(2)). */
const parseSym: typeof parseSym0 = (src, ctx) => {
  try {
    return parseSym0(src, ctx);
  } catch {
    return { ok: false, error: 'не удалось разобрать формулу (корень — sqrt(…))' };
  }
};
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });
const fin = (...x: number[]) => x.every(Number.isFinite);
const txt = (s: Sym, coords: string[] = []) => {
  setCoordNames(coords);
  return symText(s);
};

/* ---------- 52.7–52.12: равновесие при связях ---------- */
const CN = ['x1', 'y1', 'x2', 'y2'];
const A_CONSTR: AskDef = {
  id: 'constr',
  title: '52.7–52.12: равновесие при связях — множители Лагранжа, произвольная кривая f(x, y) = 0',
  hint: 'Две точки (x₁, y₁), (x₂, y₂), ось y вверх. Π — потенциальная энергия, связи φₖ = 0. Точку на кривой задают как f(x1, y1); формула f — ниже (пусто — только общий вид). Отбор — формулы через «;», каждая > 0.',
  n: { P: 1, l: 4, a: 1, b: 1, R: 1, box: 4 },
  s: { Pi: 'P (y1 + y2)/2', c1: 'f(x1, y1)', c2: 'f(x2, y2)', c3: '(x2 − x1)^2 + (y2 − y1)^2 − l^2', f: 'y − a x^2', keep: 'x2 − x1' },
  fields: [
    { k: 'Pi', label: 'Π(x₁, y₁, x₂, y₂) — потенциальная энергия', text: true },
    { k: 'c1', label: 'связь 1: φ₁ = 0', text: true },
    { k: 'c2', label: 'связь 2: φ₂ = 0 (пусто — нет)', text: true },
    { k: 'c3', label: 'связь 3: φ₃ = 0 (пусто — нет)', text: true },
    { k: 'f', label: 'f(x, y) — кривая для численного решения (пусто — только общий вид)', text: true },
    { k: 'keep', label: 'отбор положений: формулы > 0 через «;» (пусто — все)', text: true },
    { k: 'P', label: 'параметр P (вес)', zero: true },
    { k: 'l', label: 'параметр l', neg: true },
    { k: 'a', label: 'параметр a', neg: true },
    { k: 'b', label: 'параметр b', neg: true },
    { k: 'R', label: 'параметр R', neg: true },
    { k: 'box', label: 'область поиска: |x|, |y| ≤' },
  ],
  solve: (q, ex) => {
    const params = { P: q.n.P, l: q.n.l, a: q.n.a, b: q.n.b, R: q.n.R };
    const r = solveConstr({ coords: CN, params, Pi: q.s.Pi, cons: [q.s.c1, q.s.c2, q.s.c3], fdef: q.s.f, keep: q.s.keep, box: q.n.box });
    if (!r.ok) return fail([r.error]);
    const m = r.general.grads.length;
    const lamNames = r.general.grads.map((_, k) => `λ${'₁₂₃'[k]}`);
    const steps = [
      stepEx(
        ex,
        'Условия равновесия',
        'Принцип возможных перемещений для системы со связями φₖ(q) = 0: δΠ = 0 при Σ(∂φₖ/∂qⱼ)δqⱼ = 0. По правилу множителей Лагранжа это равносильно ∂Π/∂qⱼ + Σλₖ ∂φₖ/∂qⱼ = 0 для всех координат вместе с уравнениями связей. Если в связь входит f(x₁, y₁), её производные остаются буквами ∂f/∂x₁, ∂f/∂y₁.',
        eqB(...r.general.eqs.map((e, j): Ln => `∂Π/∂${prettyName(CN[j])} + Σλₖ∂φₖ/∂${prettyName(CN[j])}:  ${txt(e, CN)} = 0`)),
        parB(
          `Неизвестные: ${CN.map(prettyName).join(', ')}, ${lamNames.join(', ') || '—'}; уравнений ${4 + m} (${4} условия и ${m} связи). Число степеней свободы ${r.dof}.`,
        ),
      ),
    ];
    if (r.general.det)
      steps.push(
        stepEx(
          ex,
          'Исключение множителей',
          'Координат на одну больше, чем связей: градиент Π должен лежать в линейной оболочке градиентов связей, то есть определитель, составленный из ∇Π и ∇φₖ, равен нулю. Это уравнение вместе со связями определяет положения равновесия (ответ 52.7).',
          eqB(`det[∇Π; ∇φ₁; …; ∇φ${'₁₂₃'[m - 1] ?? ''}] = ${txt(r.general.det, CN)} = 0`),
        ),
      );
    if (!r.concrete) {
      steps.push(stepB('Численно', parB('Чтобы найти положения, задайте конкретную функцию f(x, y).')));
      return done({ vals: { count: 0 }, steps });
    }
    if (r.usesF && r.fSym)
      steps.push(
        stepB('С конкретной кривой', eqB(`f(x, y) = ${txt(r.fSym, ['x', 'y'])}`, ...(r.concrete.det ? [`определитель: ${txt(r.concrete.det, CN)} = 0`] : []))),
      );
    const rows = r.sols.map((s, i) => {
      const [x1, y1, x2, y2] = s.q;
      const ang = Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) / D2R;
      return `${i + 1}) x₁ = ${sg(x1, 5)}, y₁ = ${sg(y1, 5)}, x₂ = ${sg(x2, 5)}, y₂ = ${sg(y2, 5)}; наклон отрезка 1–2 к горизонтали ${sg(ang, 5)}°; ${s.lam.map((l, k) => `${lamNames[k]} = ${sg(l)}`).join(', ')}; Π = ${sg(s.Pi, 5)} — ${s.kind === 'stable' ? 'устойчиво (минимум Π)' : s.kind === 'unstable' ? 'неустойчиво (не минимум Π)' : 'вторая вариация вырождена — нужны высшие члены'}`;
    });
    steps.push(
      stepEx(
        ex,
        'Положения равновесия',
        'Система ∇Π + Σλₖ∇φₖ = 0, φₖ = 0 решается методом Ньютона из многих начальных точек области поиска. Устойчивость — по второй вариации Π на связях: матрица ∇²Π + Σλₖ∇²φₖ на касательном подпространстве связей. Положительно определена — минимум Π, равновесие устойчиво (теорема Лагранжа — Дирихле).',
        rows.length ? { k: 'ul', items: rows.map((t) => [t]) } : parB('В области поиска положений равновесия нет — расширьте область или проверьте связи.'),
        ...(r.dropped ? [parB(`Отброшено условием отбора: ${r.dropped}.`)] : []),
        ...r.sols
          .slice(0, 3)
          .map((s, i) => parB(`Положение ${i + 1}: собственные числа второй вариации на связях ${s.eig.map((e) => sg(e, 4)).join('; ') || '—'}.`)),
      ),
    );
    const first = r.sols.find((s) => s.kind === 'stable') ?? r.sols[0];
    const vals: Record<string, number> = { count: r.sols.length, stable: r.sols.filter((s) => s.kind === 'stable').length };
    if (first) {
      const [x1, y1, x2, y2] = first.q;
      Object.assign(vals, {
        x1,
        y1,
        x2,
        y2,
        phi: Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)),
        cosphi: Math.abs(x2 - x1) / Math.hypot(x2 - x1, y2 - y1),
        ymin: Math.min(y1, y2),
        ymax: Math.max(y1, y2),
        xspan: Math.abs(x2 - x1),
      });
    }
    steps.push(
      stepB(
        'Ответ',
        first
          ? ansB(
              [bold(`${r.sols.length} ${r.sols.length === 1 ? 'положение' : 'положения'} равновесия`), `устойчивых — ${vals.stable}`],
              [
                `x₁ = ${sg(first.q[0], 5)}, y₁ = ${sg(first.q[1], 5)}, x₂ = ${sg(first.q[2], 5)}, y₂ = ${sg(first.q[3], 5)}`,
                first.kind === 'stable' ? 'первое устойчивое' : 'первое найденное',
                'aux',
              ],
              [`cos φ = ${sg(vals.cosphi, 6)}`, 'наклон отрезка 1–2 к горизонтали', 'aux'],
            )
          : parB('Положений равновесия не найдено.'),
      ),
    );
    // Чертёж: линии связей с одной точкой и найденные положения.
    const series: PlotSeries[] = [];
    const B = q.n.box;
    const pv = { ...params };
    [q.s.c1, q.s.c2, q.s.c3].forEach((c, k) => {
      const cs = r.concrete!.cons[k];
      if (!c.trim() || !cs) return;
      const pair = [...varsOf(cs).values()].map((x) => x.name).filter((x) => CN.includes(x));
      if (pair.length < 1 || pair.length > 2 || (pair.length === 2 && pair[0].slice(1) !== pair[1].slice(1))) return;
      const idx = pair[0].slice(1);
      const pk = Object.keys(pv);
      const f = compile(cs, (name) => (name === 'x' + idx ? 0 : name === 'y' + idx ? 1 : pk.includes(name) ? pk.indexOf(name) + 2 : -1));
      const pvv = Object.values(pv);
      for (const [j, ch] of contour((x, y) => f([x, y, ...pvv], 0), -B, B, -B, B).entries())
        series.push({ name: j ? '' : `связь ${k + 1}`, pts: ch, cls: 'sb-axis' });
    });
    r.sols.slice(0, 4).forEach((s, i) =>
      series.push({
        name: `положение ${i + 1}${s.kind === 'stable' ? ' (устойчиво)' : ''}`,
        pts: [
          [s.q[0], s.q[1]],
          [s.q[2], s.q[3]],
        ],
      }),
    );
    const plot: ExtraPlot = {
      xl: 'x',
      yl: 'y',
      equal: true,
      series: series.filter((s) => s.name || s.pts.length > 1),
      marks: r.sols.slice(0, 4).flatMap((s, i) => [
        { x: s.q[0], y: s.q[1], label: `1${i ? `(${i + 1})` : ''}` },
        { x: s.q[2], y: s.q[3], label: `2${i ? `(${i + 1})` : ''}` },
      ]),
    };
    return done({ vals, steps, plot });
  },
};

/** Линии уровня g = 0 (квадраты по сетке), склеенные в ломаные; не больше трёх самых длинных. */
function contour(g: (x: number, y: number) => number, x0: number, x1: number, y0: number, y1: number, N = 120): [number, number][][] {
  const hx = (x1 - x0) / N,
    hy = (y1 - y0) / N;
  const val: number[][] = Array.from({ length: N + 1 }, (_, i) => Array.from({ length: N + 1 }, (_, j) => g(x0 + i * hx, y0 + j * hy)));
  const segs: [[number, number], [number, number]][] = [];
  const P = (i: number, j: number, i2: number, j2: number): [number, number] => {
    const a = val[i][j],
      b = val[i2][j2];
    const t = a / (a - b);
    return [x0 + (i + t * (i2 - i)) * hx, y0 + (j + t * (j2 - j)) * hy];
  };
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const c = [val[i][j], val[i + 1][j], val[i + 1][j + 1], val[i][j + 1]];
      if (!c.every(Number.isFinite)) continue;
      const pts: [number, number][] = [];
      const edges: [number, number, number, number][] = [
        [i, j, i + 1, j],
        [i + 1, j, i + 1, j + 1],
        [i + 1, j + 1, i, j + 1],
        [i, j + 1, i, j],
      ];
      for (const [a, b2, c2, d2] of edges) if (val[a][b2] < 0 !== val[c2][d2] < 0) pts.push(P(a, b2, c2, d2));
      if (pts.length === 2) segs.push([pts[0], pts[1]]);
      else if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
    }
  const key = (p: [number, number]) => `${Math.round((p[0] / hx) * 1e3)},${Math.round((p[1] / hy) * 1e3)}`;
  const used = new Array(segs.length).fill(false);
  const byKey = new Map<string, number[]>();
  segs.forEach((s, k) => [key(s[0]), key(s[1])].forEach((kk) => byKey.set(kk, [...(byKey.get(kk) ?? []), k])));
  const chains: [number, number][][] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const ch: [number, number][] = [segs[s][0], segs[s][1]];
    for (const end of [1, 0]) {
      for (;;) {
        const tip = end ? ch[ch.length - 1] : ch[0];
        const next = (byKey.get(key(tip)) ?? []).find((k) => !used[k]);
        if (next == null) break;
        used[next] = true;
        const [a, b2] = segs[next];
        const other = key(a) === key(tip) ? b2 : a;
        if (end) ch.push(other);
        else ch.unshift(other);
      }
    }
    chains.push(ch);
  }
  return chains.sort((a, b) => b.length - a.length).slice(0, 3);
}

/* ---------- 52.13: форма направляющей ---------- */
const A_GUIDE: AskDef = {
  id: 'guide',
  title: '52.13: форма направляющей противовеса для безразличного равновесия',
  hint: 'Тело с координатой ψ (потенциальная энергия Π₁(ψ)); противовес Q висит на канате, переброшенном через блок B, и скользит по гладкой направляющей. r(ψ) — длина каната от B до противовеса, θ — угол BC с вертикалью вниз. Ищется кривая r(θ), на которой Π₁(ψ) − Q·r·cos θ = const.',
  n: { P: 1, a: 1, l: 4, Q: Math.SQRT1_2, psi0: 0, psi1: 90, th0: 0 },
  s: { Pi1: 'P a sin ψ', r: 'l − 4a sin(π/4 − ψ/2)', check: 'r^2 − 2(l − 2 sqrt(2) a cos θ) r − 4 sqrt(2) a l + l^2 + 8a^2' },
  fields: [
    { k: 'Pi1', label: 'Π₁(ψ) — потенциальная энергия тела (без противовеса)', text: true },
    { k: 'r', label: 'r(ψ) — длина каната от блока до противовеса', text: true },
    { k: 'check', label: 'проверить кривую G(r, θ) = 0 (уравнение книги; пусто — нет)', text: true },
    { k: 'P', label: 'параметр P (вес тела)' },
    { k: 'a', label: 'параметр a' },
    { k: 'l', label: 'параметр l (длина каната)' },
    { k: 'Q', label: 'вес противовеса Q' },
    { k: 'psi0', label: 'начальное положение ψ₀, °', neg: true, zero: true },
    { k: 'psi1', label: 'конечное положение ψ₁, °', neg: true, zero: true },
    { k: 'th0', label: 'угол θ₀ при ψ₀, °', neg: true, zero: true },
  ],
  solve: (q, ex) => {
    const { P, a, l, Q } = q.n;
    if (!(Q > 0)) return fail(['Вес противовеса Q > 0.']);
    const params = { P, a, l, Q };
    const pn = Object.keys(params);
    const p1 = parseSym(q.s.Pi1, { coords: ['ψ'], params: pn }),
      pr = parseSym(q.s.r, { coords: ['ψ'], params: pn });
    if (!p1.ok) return fail([`Π₁: ${p1.error}`]);
    if (!pr.ok) return fail([`r: ${pr.error}`]);
    const slot = (name: string) => (name === 'ψ' ? 0 : pn.indexOf(name) + 1);
    const pv = Object.values(params);
    const Pi1 = compile(p1.s, slot),
      rf = compile(pr.s, slot);
    let G: Num | null = null;
    let Gs: Sym | null = null;
    if (q.s.check.trim()) {
      const g = parseSym(q.s.check, { coords: ['r', 'θ'], params: pn });
      if (!g.ok) return fail([`G(r, θ): ${g.error}`]);
      Gs = g.s;
      G = compile(g.s, (name) => (name === 'r' ? 0 : name === 'θ' ? 1 : pn.indexOf(name) + 2));
    }
    const ps0 = q.n.psi0 * D2R,
      ps1 = q.n.psi1 * D2R,
      th0 = q.n.th0 * D2R;
    const r0 = rf([ps0, ...pv], 0);
    if (!(r0 > 0)) return fail([`При ψ₀ длина каната r = ${sg(r0)} — должна быть положительной.`]);
    const C0 = Pi1([ps0, ...pv], 0) - Q * r0 * Math.cos(th0);
    const N = 200;
    const pts: { psi: number; r: number; th: number }[] = [];
    let broke: number | null = null;
    for (let i = 0; i <= N; i++) {
      const psi = ps0 + ((ps1 - ps0) * i) / N;
      const r = rf([psi, ...pv], 0);
      const c = (Pi1([psi, ...pv], 0) - C0) / (Q * r);
      if (!(r > 0) || Math.abs(c) > 1) {
        broke = psi;
        break;
      }
      pts.push({ psi, r, th: Math.acos(c) * (th0 < 0 ? -1 : 1) });
    }
    let res = NaN;
    if (G) {
      const sc = Math.max(1e-300, ...pts.map((p) => p.r * p.r), l * l);
      res = Math.max(...pts.map((p) => Math.abs(G!([p.r, p.th, ...pv], 0)))) / sc;
    }
    const steps = [
      stepEx(
        ex,
        'Условие безразличного равновесия',
        'Равновесие безразлично, если потенциальная энергия системы одна и та же во всех положениях: Π₁(ψ) + Q·y_C = const. Противовес C — на расстоянии r(ψ) от блока B по канату, угол BC с вертикалью θ, высота относительно B: y_C = −r cos θ.',
        eqB(`Π₁(ψ) = ${txt(p1.s, ['ψ'])}`, `r(ψ) = ${txt(pr.s, ['ψ'])}`, 'Π₁(ψ) − Q·r(ψ)·cos θ = Π₁(ψ₀) − Q·r₀·cos θ₀'),
      ),
      stepEx(
        ex,
        'Уравнение кривой',
        'Отсюда cos θ как функция ψ; вместе с r(ψ) это параметрическое уравнение направляющей в полярных координатах с полюсом в блоке. Если ψ выражается через r, получается уравнение r(θ) без параметра.',
        eqB(`cos θ = (Π₁(ψ) − Π₁(ψ₀))/(Q·r) + r₀·cos θ₀/r,  r₀ = ${sg(r0, 5)}`, `Π₁(ψ₀) − Q·r₀·cos θ₀ = ${sg(C0, 5)}`),
        ...(broke != null ? [parB(`При ψ = ${sg(broke / D2R, 4)}° кривая обрывается: |cos θ| > 1 или r ≤ 0 — противовес не может так висеть.`)] : []),
      ),
    ];
    if (G && Gs)
      steps.push(
        stepB('Проверка уравнения', eqB(`G(r, θ) = ${txt(Gs, ['r', 'θ'])}`, `max |G|/l² по кривой = ${sg(res, 3)}`), {
          k: 'badge',
          tone: res < 1e-9 ? 'ok' : 'bad',
          text: res < 1e-9 ? 'кривая удовлетворяет уравнению' : 'кривая уравнению не удовлетворяет',
        }),
      );
    const last = pts[pts.length - 1];
    steps.push(
      stepB(
        'Ответ',
        ansB(
          [bold(`Q = ${sg(Q, 5)}`), 'при любом Q > 0 кривая своя; книга берёт Q = P/√2'],
          [`θ = ${sg(last.th / D2R, 5)}° при ψ = ${sg(last.psi / D2R, 4)}°, r = ${sg(last.r, 5)}`, 'конец построенной кривой', 'aux'],
        ),
      ),
    );
    const plot: ExtraPlot = {
      xl: 'x (от блока)',
      yl: 'y',
      equal: true,
      series: [{ name: 'направляющая', pts: pts.map((p) => [p.r * Math.sin(p.th), -p.r * Math.cos(p.th)]) }],
      marks: [
        { x: 0, y: 0, label: 'B' },
        { x: pts[0].r * Math.sin(pts[0].th), y: -pts[0].r * Math.cos(pts[0].th), label: 'C₀' },
      ],
    };
    return done({ vals: { Q, ok: G ? (res < 1e-9 ? 1 : 0) : NaN, res, thEnd: last.th }, steps, plot });
  },
};

/* ---------- 55.19: волчки ---------- */
const TOPN = [0, 1, 2];
const A_TOPS: AskDef = {
  id: 'tops',
  title: '55.19: волчок на волчке — устойчивость вертикального вращения',
  hint: 'Волчки нумеруются снизу; острие первого — в неподвижном гнезде, острие следующего — в гнезде на оси предыдущего на расстоянии h от его острия. A — момент инерции относительно горизонтальной оси через острие, C — относительно оси симметрии, c — от острия до центра тяжести.',
  n: {
    g: 9.81,
    M1: 2,
    A1: 0.08,
    C1: 0.04,
    c1: 0.15,
    h1: 0.25,
    W1: 120,
    M2: 0.5,
    A2: 0.01,
    C2: 0.006,
    c2: 0.06,
    h2: 0.1,
    W2: 200,
    M3: 0.2,
    A3: 0.002,
    C3: 0.001,
    c3: 0.03,
    h3: 0,
    W3: 300,
  },
  selects: [
    {
      k: 'cnt',
      label: 'Число волчков',
      options: [
        ['1', 'один'],
        ['2', 'два (55.19)'],
        ['3', 'три'],
      ],
    },
  ],
  s: { cnt: '2' },
  fields: [
    { k: 'g', label: 'g' },
    ...TOPN.flatMap((i) =>
      [
        { k: `M${i + 1}`, label: `M${'₁₂₃'[i]} — масса волчка ${i + 1}` },
        { k: `A${i + 1}`, label: `A${'₁₂₃'[i]} — относительно горизонтальной оси через острие` },
        { k: `C${i + 1}`, label: `C${'₁₂₃'[i]} — относительно оси симметрии` },
        { k: `c${i + 1}`, label: `c${'₁₂₃'[i]} — от острия до центра тяжести`, neg: true, zero: true },
        { k: `W${i + 1}`, label: `Ω${'₁₂₃'[i]} — угловая скорость собственного вращения`, neg: true, zero: true },
        ...(i < 2
          ? [
              {
                k: `h${i + 1}`,
                label: `h${'₁₂₃'[i]} — от острия до гнезда волчка ${i + 2}`,
                show: (p: { s: Record<string, string> }) => Number(p.s.cnt) > i + 1,
              },
            ]
          : []),
      ].map((f) => ({ ...f, show: f.show ?? ((p: { s: Record<string, string> }) => Number(p.s.cnt) > i) })),
    ),
  ],
  solve: (q, ex) => {
    const n = Number(q.s.cnt) || 2;
    const tops = Array.from({ length: n }, (_, i) => ({
      M: q.n[`M${i + 1}`],
      A: q.n[`A${i + 1}`],
      C: q.n[`C${i + 1}`],
      c: q.n[`c${i + 1}`],
      h: q.n[`h${i + 1}`] ?? 0,
      W: q.n[`W${i + 1}`],
    }));
    const r = solveTops({ g: q.n.g, tops });
    if (!r.ok) return fail([r.error]);
    const idx = (i: number) => '₁₂₃'[i];
    const deg = 2 * n;
    const powL = (k: number) => (k === 0 ? '' : k === 1 ? 'λ' : `λ${'⁰¹²³⁴⁵⁶'[k]}`);
    const eqLetters = r.coef.map((c, i) => `[${txt(c)}]${powL(deg - i)}`).join(' + ') + ' = 0';
    const steps = [
      stepEx(
        ex,
        'Малые наклоны осей',
        'Наклон оси i-го волчка — комплексная координата ζᵢ = αᵢ + iβᵢ (αᵢ, βᵢ — малые углы в двух вертикальных плоскостях). Острие j-го волчка смещено на Σ_{i<j}hᵢζᵢ, центр тяжести — ещё на cⱼζⱼ. Кинетическая энергия наклонов — квадратичная форма с матрицей M, потенциальная энергия убывает при наклоне: Π = const − ½ΣKᵢ|ζᵢ|². Собственное вращение даёт гироскопические силы −iCᵢΩᵢζ̇ᵢ.',
        eqB(...r.M.flatMap((row, i) => row.map((m, j) => (j >= i ? `M${idx(i)}${idx(j)} = ${txt(m)}` : null)).filter((x): x is string => !!x))),
        eqB(...r.G.map((g2, i) => `G${idx(i)} = ${txt(g2)}`), ...r.K.map((k, i) => `K${idx(i)} = ${txt(k)}`)),
        eqB('M·ζ̈ − i·G·ζ̇ − K·ζ = 0'),
      ),
      stepEx(
        ex,
        'Уравнение частот',
        'Решение ζ = a·e^{−iλt}: ось прецессирует с частотой λ. Подстановка даёт det(λ²M + λG + K) = 0. Если все корни λ вещественны и различны, наклоны остаются малыми — вращение устойчиво; комплексный корень даёт экспоненциально растущий наклон.',
        eqB(eqLetters),
        eqB(`числа: ${r.coefNum.map((c, i) => `${sg(c, 6)}${powL(deg - i)}`).join(' + ')} = 0`),
        parB(
          `Корни λ: ${r.roots.map(([re, im]) => (Math.abs(im) > 1e-9 * Math.max(1, Math.abs(re)) ? `${sg(re, 5)} ${im < 0 ? '−' : '+'} ${sg(Math.abs(im), 4)}i` : sg(re, 6))).join('; ')}.`,
        ),
      ),
      stepB(
        'Ответ',
        ansB(
          [
            bold(r.verdict === 'stable' ? 'вращение устойчиво' : r.verdict === 'boundary' ? 'на границе (кратный корень)' : 'вращение неустойчиво'),
            'все корни вещественны и различны — устойчиво',
          ],
          ...(Number.isFinite(r.Wcrit)
            ? [[`Ω${idx(n - 1)} > ${sg(r.Wcrit, 5)}`, 'при остальных данных — граница устойчивости по Ω верхнего волчка', 'aux'] as [Ln, string, 'aux']]
            : []),
        ),
      ),
    ];
    const plot: ExtraPlot = {
      xl: `Ω${idx(n - 1)}`,
      yl: 'max |Im λ|',
      series: [{ name: 'мера неустойчивости (0 — устойчиво)', pts: r.scan.map((s) => [s.W, s.im]) }],
      marks: [{ x: tops[n - 1].W, y: r.im, label: 'заданное' }],
    };
    const vals: Record<string, number> = { stable: r.verdict === 'stable' ? 1 : 0, Wcrit: r.Wcrit };
    r.coefNum.forEach((c, i) => (vals[`a${i}`] = c));
    return done({ vals, steps, plot });
  },
};

/* ---------- 56.3, 56.4, 56.8: упоры, трение покоя ---------- */
const PRM = ['k', 'F', 'ω', 'V'];
function accOf(src: string, n: Record<string, number>): { f: Acc; s: Sym } | string {
  const r = parseSym(src, { coords: ['x'], params: PRM });
  if (!r.ok) return `f: ${r.error}`;
  const pv = PRM.map((p) => n[p]);
  let c: Num;
  try {
    c = compile(r.s, (name, ord) => (name === 'x' ? ord : PRM.indexOf(normName(name)) + 2));
  } catch (e) {
    return `f: ${(e as Error).message}`;
  }
  const buf = [0, 0, ...pv];
  return {
    s: r.s,
    f: (x, v, t) => {
      buf[0] = x;
      buf[1] = v;
      return c(buf, t);
    },
  };
}
const fieldsPrm = [
  { k: 'k', label: 'параметр k', neg: true },
  { k: 'F', label: 'параметр F', neg: true },
  { k: 'ω', label: 'параметр ω', neg: true },
  { k: 'V', label: 'параметр V', neg: true },
];
const A_STOPS: AskDef = {
  id: 'stops',
  title: '56.3, 56.4, 56.8: колебания с упорами, сухим трением (трение покоя) и вынуждающей силой',
  hint: 'Ускорение ẍ = f(x, ẋ, t) без сил трения и ударов; ẋ записывается как x′. Упор: при ударе ẋ → −e·ẋ. Сухое трение — ускорение H (сила/масса) против скорости относительно поверхности, движущейся со скоростью u; прилипшее тело срывается, когда |f| > H₁.',
  n: { k: 1, F: 0, ω: 1, V: 0, lo: -0.5, hi: 0.5, e: 1, u: 0, H: 0, H1: 0, x0: 1, xd0: 0, tEnd: 40 },
  s: { f: '−k^2 x', st: 'lo', fr: 'none', plot: 't' },
  selects: [
    {
      k: 'st',
      label: 'Упоры',
      options: [
        ['none', 'нет'],
        ['lo', 'нижний x = x_н'],
        ['hi', 'верхний x = x_в'],
        ['both', 'оба'],
      ],
    },
    {
      k: 'fr',
      label: 'Сухое трение',
      options: [
        ['none', 'нет'],
        ['dry', 'есть (H при скольжении, H₁ — трение покоя)'],
      ],
    },
    {
      k: 'plot',
      label: 'График',
      options: [
        ['t', 'x(t)'],
        ['phase', 'фазовая траектория'],
      ],
    },
  ],
  fields: [
    { k: 'f', label: 'f(x, x′, t) — ускорение без трения и ударов', text: true },
    ...fieldsPrm,
    { k: 'lo', label: 'нижний упор x_н', neg: true, show: (p) => p.s.st === 'lo' || p.s.st === 'both' },
    { k: 'hi', label: 'верхний упор x_в', neg: true, show: (p) => p.s.st === 'hi' || p.s.st === 'both' },
    { k: 'e', label: 'коэффициент восстановления e', show: (p) => p.s.st !== 'none' },
    { k: 'u', label: 'скорость поверхности u', neg: true, show: (p) => p.s.fr === 'dry' },
    { k: 'H', label: 'H — трение скольжения (на единицу массы)', show: (p) => p.s.fr === 'dry' },
    { k: 'H1', label: 'H₁ — наибольшее трение покоя (на единицу массы)', show: (p) => p.s.fr === 'dry' },
    { k: 'x0', label: 'x₀', neg: true },
    { k: 'xd0', label: 'ẋ₀', neg: true },
    { k: 'tEnd', label: 'время' },
  ],
  solve: (q, ex) => {
    const a = accOf(q.s.f, q.n);
    if (typeof a === 'string') return fail([a]);
    const lo = q.s.st === 'lo' || q.s.st === 'both' ? q.n.lo : null,
      hi = q.s.st === 'hi' || q.s.st === 'both' ? q.n.hi : null;
    if (lo != null && hi != null && !(hi > lo)) return fail(['Верхний упор выше нижнего.']);
    if ((lo != null && q.n.x0 < lo) || (hi != null && q.n.x0 > hi)) return fail(['Начальное положение — между упорами.']);
    if (!(q.n.e >= 0 && q.n.e <= 1)) return fail(['Коэффициент восстановления — от 0 до 1.']);
    const fr = q.s.fr === 'dry' ? { u: q.n.u, H: q.n.H, Hs: Math.max(q.n.H1, q.n.H) } : null;
    if (!(q.n.tEnd > 0 && q.n.tEnd <= 1e4)) return fail(['Время — от 0 до 10⁴.']);
    const s = simulate({ f: a.f, lo, hi, e: q.n.e, fric: fr, x0: q.n.x0, v0: q.n.xd0, tEnd: q.n.tEnd, steps: 40000 });
    const ms = measure(s);
    const hasT = !!ms && fin(ms.T);
    const steps = [
      stepEx(
        ex,
        'Уравнение движения',
        'Между ударами и вне прилипания — уравнение ẍ = f(x, ẋ, t) − H·sign(ẋ − u). Удар об упор мгновенный: скорость меняет знак и умножается на e. При сухом трении тело прилипает к поверхности, если относительная скорость обращается в нуль, а сила, стремящаяся сдвинуть его, не больше силы трения покоя: |f(x, u, t)| ≤ H₁; срывается, когда |f| превзойдёт H₁.',
        eqB(
          `ẍ = ${txt(a.s, ['x'])}${fr ? ` − ${sg(fr.H)}·sign(ẋ − ${sg(fr.u)})` : ''}`,
          ...(lo != null ? [`x = ${sg(lo)}: ẋ → −${sg(q.n.e)}·ẋ`] : []),
          ...(hi != null ? [`x = ${sg(hi)}: ẋ → −${sg(q.n.e)}·ẋ`] : []),
          ...(fr ? [`прилипание при ẋ = ${sg(fr.u)} и |f| ≤ H₁ = ${sg(fr.Hs)}`] : []),
        ),
      ),
      stepEx(
        ex,
        'Движение',
        'Интегрирование Рунге — Кутта; моменты ударов, прилипания, срыва и максимумов x уточняются делением шага пополам. Период — по последним максимумам x (установившееся движение).',
        hasT
          ? eqB(
              `T = ${sg(ms!.T, 6)},  ω = 2π/T = ${sg((2 * Math.PI) / ms!.T, 6)}`,
              `x за период: от ${sg(ms!.xmin, 5)} до ${sg(ms!.xmax, 5)}`,
              ...(ms!.impacts ? [`ударов за период: ${ms!.impacts}`] : []),
              ...(fr ? [`покой (прилипание) за период: ${sg(ms!.stick, 5)}`] : []),
            )
          : parB('Периодического движения на заданном времени не видно (меньше трёх максимумов x).'),
      ),
      stepB(
        'Ответ',
        hasT
          ? ansB([bold(`T = ${sg(ms!.T, 6)}`), 'период установившегося движения'], [`ω = ${sg((2 * Math.PI) / ms!.T, 6)}`, 'частота', 'aux'])
          : parB('Периода нет.'),
      ),
    ];
    const plot: ExtraPlot =
      q.s.plot === 'phase'
        ? { xl: 'x', yl: 'ẋ', series: [{ name: 'фазовая траектория', pts: s.x.map((x, i) => [x, s.v[i]]) }] }
        : {
            xl: 't',
            yl: 'x',
            series: [
              { name: 'x(t)', pts: s.t.map((t, i) => [t, s.x[i]]) },
              ...(lo != null
                ? [
                    {
                      name: 'нижний упор',
                      pts: [
                        [0, lo],
                        [q.n.tEnd, lo],
                      ] as [number, number][],
                      cls: 'sb-axis',
                    },
                  ]
                : []),
              ...(hi != null
                ? [
                    {
                      name: 'верхний упор',
                      pts: [
                        [0, hi],
                        [q.n.tEnd, hi],
                      ] as [number, number][],
                      cls: 'sb-axis',
                    },
                  ]
                : []),
            ],
          };
    return done({
      vals: hasT ? { T: ms!.T, w: (2 * Math.PI) / ms!.T, xmax: ms!.xmax, xmin: ms!.xmin, stick: ms!.stick, impacts: ms!.impacts } : {},
      steps,
      plot,
    });
  },
};

/* ---------- 56.9: субгармоники ---------- */
const A_SUBH: AskDef = {
  id: 'subh',
  title: '56.9: субгармоники в системе с упорами и сухим трением — при каком H они невозможны',
  hint: 'Свободная система ẍ = f₀(x) с упорами (удары с e = 1), сухое трение H, вынуждающая сила F cos ωt (силы — на единицу массы). Субгармоника частоты ω/s близка к свободному периодическому движению с периодом 2πs/ω.',
  n: { k: 1, F: 0.1, ω: 3, V: 0, D: 0.5, s: 1, H: 0.05 },
  s: { f: '−k^2 x', st: 'both' },
  selects: [
    {
      k: 'st',
      label: 'Упоры',
      options: [
        ['both', 'оба: x = ±Δ'],
        ['lo', 'нижний x = −Δ'],
        ['hi', 'верхний x = Δ'],
        ['none', 'нет'],
      ],
    },
  ],
  fields: [
    { k: 'f', label: 'f₀(x) — ускорение свободной системы (без трения и силы)', text: true },
    { k: 'k', label: 'параметр k', neg: true },
    { k: 'D', label: 'Δ — расстояние до упоров' },
    { k: 'F', label: 'F — амплитуда вынуждающей силы' },
    { k: 'ω', label: 'ω — её частота' },
    { k: 's', label: 's — порядок субгармоники (целое)' },
    { k: 'H', label: 'H — сила сухого трения (проверить)', zero: true },
  ],
  solve: (q, ex) => {
    const a = accOf(q.s.f, { ...q.n, F: 0, V: 0 });
    if (typeof a === 'string') return fail([a]);
    const s = Math.round(q.n.s);
    if (!(s >= 1 && s <= 12) || Math.abs(q.n.s - s) > 1e-9) return fail(['s — целое от 1 до 12.']);
    const { D, F, ω, H } = q.n;
    if (!(ω > 0 && D > 0)) return fail(['ω > 0, Δ > 0.']);
    const lo = q.s.st === 'both' || q.s.st === 'lo' ? -D : null,
      hi = q.s.st === 'both' || q.s.st === 'hi' ? D : null;
    const Ts = (2 * Math.PI * s) / ω;
    const k2 = -(a.f(1e-6, 0, 0) - a.f(-1e-6, 0, 0)) / 2e-6;
    const Vmax = 100 * Math.max(D, 1) * Math.max(Math.sqrt(Math.abs(k2)) || 1, ω / s);
    const pr = freePeriodic(a.f, lo, hi, Ts, ω, Vmax);
    if (!pr)
      return fail([
        `Свободного периодического движения с периодом 2πs/ω = ${sg(Ts, 5)} нет — для линейной пружины с упорами нужно ω/s > k (удары укорачивают период).`,
      ]);
    const Hc = (F * pr.I) / pr.path;
    const steps = [
      stepEx(
        ex,
        'Порождающее движение',
        'При малых F и H субгармонический режим частоты ω/s близок к свободному периодическому движению системы с упорами, период которого T = 2πs/ω. Его ищем по скорости V прохождения положения x = 0 (делением пополам по периоду).',
        eqB(
          `ẍ = ${txt(a.s, ['x'])}${lo != null ? `, упор x = ${sg(lo)}` : ''}${hi != null ? `, упор x = ${sg(hi)}` : ''}`,
          `T = 2πs/ω = ${sg(Ts, 6)};  V = ${sg(pr.V, 6)}, размах: от ${sg(pr.xmin, 5)} до ${sg(pr.amp, 5)}`,
        ),
      ),
      stepEx(
        ex,
        'Баланс работ за период',
        'Режим может существовать, только если работа вынуждающей силы за период покрывает работу сухого трения. Работа трения — H·L, L = ∮|ẋ|dt — путь за период. Работа силы F cos(ωt + ε) — F·Re(e^{iε}∫ẋe^{iωt}dt); наибольшая по сдвигу фазы ε — F·|∫ẋe^{iωt}dt|. При чётном s и симметричных упорах ∫ẋe^{iωt}dt = 0 — субгармоника невозможна при любом H > 0.',
        eqB(`L = ${sg(pr.path, 6)},  |∫ẋ e^{iωt} dt| = ${sg(pr.I, 6)}`, `H* = F·|∫ẋ e^{iωt} dt| / L = ${sg(Hc, 6)}`),
      ),
      stepB(
        'Ответ',
        ansB(
          [bold(Hc < 1e-9 * Math.max(F, 1e-300) ? 'H > 0' : `H > ${sg(Hc, 6)}`), `субгармоника частоты ω/${s} невозможна`],
          [`при H = ${sg(H)}: ${H > Hc ? 'невозможна' : 'возможна (работы силы хватает)'}`, 'проверка заданного H', 'aux'],
        ),
      ),
    ];
    const plot: ExtraPlot = {
      xl: 't',
      yl: 'x, ẋ',
      series: [
        { name: 'x(t)', pts: pr.sim.t.map((t, i) => [t, pr.sim.x[i]]) },
        { name: 'ẋ(t)', pts: pr.sim.t.map((t, i) => [t, pr.sim.v[i]]) },
      ],
    };
    return done({ vals: { Hc: Math.abs(Hc) < 1e-9 * Math.max(F, 1e-300) ? 0 : Hc, V: pr.V, T: pr.T, L: pr.path }, steps, plot });
  },
};

/* ---------- 56.13: точечное преобразование ---------- */
const PM = ['k', 'h', 'M', 'a'];
const A_PMAP: AskDef = {
  id: 'pmap',
  title: '56.13: точечное преобразование — неподвижная точка и предельный цикл',
  hint: 'ẍ = f(x, ẋ) (ẋ записывается как x′; разрыв по знаку скорости — через x′/abs(x′)). Сечение ẋ = 0: от одного максимума x до следующего — функция последования P(x); её неподвижная точка — предельный цикл.',
  n: { k: 2, h: 0.05, M: 0.3, a: 0, xa: 0.1, xb: 3, x0: 2.5 },
  s: { f: "−2h x' − k^2 x + M (1 + x'/abs(x'))/2", side: 'max' },
  selects: [
    {
      k: 'side',
      label: 'Сечение',
      options: [
        ['max', 'максимумы x (ẋ = 0, ẋ меняет знак с + на −)'],
        ['min', 'минимумы x'],
      ],
    },
  ],
  fields: [
    { k: 'f', label: 'f(x, x′) — ускорение', text: true },
    { k: 'k', label: 'параметр k', neg: true },
    { k: 'h', label: 'параметр h', neg: true },
    { k: 'M', label: 'параметр M (M₀)', neg: true },
    { k: 'a', label: 'параметр a', neg: true },
    { k: 'xa', label: 'отрезок для P(x): от', neg: true },
    { k: 'xb', label: 'до', neg: true },
    { k: 'x0', label: 'начальная точка лестницы Ламерея', neg: true },
  ],
  solve: (q, ex) => {
    const r = parseSym(q.s.f, { coords: ['x'], params: PM });
    if (!r.ok) return fail([`f: ${r.error}`]);
    const pv = PM.map((p) => q.n[p]);
    const c = compile(r.s, (name, ord) => (name === 'x' ? ord : PM.indexOf(normName(name)) + 2));
    const buf = [0, 0, ...pv];
    const f: Acc = (x, v, t) => {
      buf[0] = x;
      buf[1] = v;
      return c(buf, t);
    };
    const side = q.s.side === 'min' ? 'min' : 'max';
    const { xa, xb } = q.n;
    if (!(xb > xa)) return fail(['Отрезок: «до» больше «от».']);
    const k2 = Math.abs((f(1e-6, 0, 0) - f(-1e-6, 0, 0)) / 2e-6) || 1;
    const tMax = (40 * (2 * Math.PI)) / Math.sqrt(k2);
    const P = (x: number) => poincare(f, side, x, tMax, 8000);
    const fps = fixedPoints(P, xa, xb, 60);
    const curve = Array.from({ length: 81 }, (_, i) => {
      const x = xa + ((xb - xa) * i) / 80;
      return [x, P(x)] as [number, number];
    });
    const stair: [number, number][] = [];
    let x = q.n.x0;
    for (let i = 0; i < 12 && Number.isFinite(x); i++) {
      const y = P(x);
      stair.push([x, x], [x, y]);
      x = y;
    }
    const fp = fps[0];
    const steps = [
      stepEx(
        ex,
        'Функция последования',
        'Фазовая траектория, начатая в точке сечения (x, 0), снова пересекает сечение в точке (P(x), 0). Отображение x → P(x) — точечное преобразование полупрямой в себя. Неподвижная точка P(x*) = x* — замкнутая траектория (предельный цикл); он устойчив, если |P′(x*)| < 1 (последовательные точки сходятся к x* — лестница Ламерея).',
        eqB(`ẍ = ${txt(r.s, ['x'])}`, `сечение: ${side === 'max' ? 'максимумы' : 'минимумы'} x`),
      ),
      stepEx(
        ex,
        'Неподвижные точки',
        'P(x) считается интегрированием от одного пересечения сечения до следующего; корни P(x) − x на отрезке — перебором и делением пополам, P′ — разностью.',
        fps.length
          ? {
              k: 'ul',
              items: fps.map((p) => [
                `x* = ${sg(p.x, 7)},  P′(x*) = ${sg(p.mult, 5)} — ${Math.abs(p.mult) < 1 ? 'устойчивый' : 'неустойчивый'} предельный цикл`,
              ]),
            }
          : parB('На отрезке неподвижных точек нет.'),
      ),
      stepB(
        'Ответ',
        fp
          ? ansB(
              [bold(`x* = ${sg(fp.x, 7)}`), 'неподвижная точка (амплитуда предельного цикла), ẋ = 0'],
              [`P′(x*) = ${sg(fp.mult, 5)}`, Math.abs(fp.mult) < 1 ? 'цикл устойчив' : 'цикл неустойчив', 'aux'],
            )
          : parB('Неподвижной точки нет.'),
      ),
    ];
    const plot: ExtraPlot = {
      xl: 'x',
      yl: 'P(x)',
      equal: true,
      series: [
        { name: 'P(x)', pts: curve },
        {
          name: 'P = x',
          pts: [
            [xa, xa],
            [xb, xb],
          ],
          cls: 'sb-axis',
        },
        { name: 'лестница Ламерея', pts: stair },
      ],
      marks: fps.map((p) => ({ x: p.x, y: p.x, label: 'x*' })),
    };
    return done({ vals: fp ? { xs: fp.x, mult: fp.mult, count: fps.length } : { count: 0 }, steps, plot });
  },
};

export const HAM_ASKS: AskDef[] = [A_CONSTR, A_GUIDE, A_TOPS, A_STOPS, A_SUBH, A_PMAP];
