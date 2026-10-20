/** Решение: путь и закон движения по траектории, интегрирование ускорения, гармонические колебания, бросок. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { fmtPi } from '../../../shared/integ';
import { printPi, wrapPhase, type HarmResult, type IntegResult, type PathResult, type ShotResult } from '../model/ext';
import type { KinProblem } from '../model/kin';

const f = (x: number) => fmt(x, 4);
const deg = (x: number) => fmt(x, 3);
const bad = (errors: string[]): Doc => ({
  steps: [
    {
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: errors.map((x) => [x]) },
      ],
    },
  ],
});
const ex = (opts: { explain?: boolean }, bl: Block[], ...c: Inline[]) => {
  if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
};

/* ---------- путь и закон движения по траектории ---------- */

export function pathDoc(pr: KinProblem, r: PathResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  const s = r.src === 's';
  steps.push({
    title: 'Закон движения',
    blocks: [
      {
        k: 'p',
        c: [
          s
            ? 'Закон движения по траектории задан дугой s(t) (расстояние от начала отсчёта по траектории).'
            : 'Движение задано уравнениями в декартовых координатах.',
          ` Промежуток времени: от t₁ = ${f(r.t1)} до t₂ = ${f(r.t2)}.`,
        ],
      },
      { k: 'eq', lines: r.f.map((q) => ({ c: [v(q.name), `(t) = ${printPi(q.e)}`] as Inline[] })) },
    ],
  });
  {
    const bl: Block[] = [];
    if (s) {
      bl.push({ k: 'eq', lines: [{ c: [v('v'), ' = ṡ = ', printPi(r.f[0].d1)] }] });
      if (r.turns.length)
        bl.push({
          k: 'p',
          c: ['Точка меняет направление движения там, где ṡ = 0 и меняет знак: ', r.turns.map((t) => `t = ${f(t.t)} с (s = ${f(t.s)})`).join('; '), '.'],
        });
      else bl.push({ k: 'p', c: ['Скорость ṡ внутри промежутка знака не меняет — точка идёт в одну сторону, путь равен модулю изменения s.'] });
      ex(
        opts,
        bl,
        'Путь σ — длина пройденной дуги: он складывается из участков между остановками. Расстояние s — координата точки на траектории, она может быть меньше пути и даже отрицательной.',
      );
    } else {
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('v'), ` = √(${r.f.map((q) => `(d${q.name}/dt)²`).join(' + ')})`] },
          ...r.f.map((q) => ({ c: [`d${q.name}/dt = ${printPi(q.d1)}`] as Inline[] })),
        ],
      });
      if (r.vConst != null) bl.push({ k: 'p', c: ['Модуль скорости постоянен: v = ', b(f(r.vConst)), ' — движение по траектории равномерное.'] });
      ex(
        opts,
        bl,
        'Закон движения по траектории — длина дуги от начального положения: s = ∫ v dt; если скорость не меняет направления вдоль траектории, это и есть путь.',
      );
    }
    steps.push({ title: s ? 'Скорость и остановки' : 'Скорость', blocks: bl });
  }
  if (!s) {
    const bl: Block[] = [];
    if (r.closed) bl.push({ k: 'eq', lines: [{ c: [b(r.closed)] }] });
    else
      bl.push({
        k: 'p',
        c: ['Интеграл ∫v dt в элементарных функциях не берётся (или не распознан) — длина дуги найдена численно (формула Симпсона, 2000 интервалов).'],
      });
    steps.push({ title: 'Закон движения по траектории', blocks: bl });
  }
  steps.push({
    title: `${r.rows.length} положений через равные промежутки времени`,
    blocks: [
      {
        k: 'eq',
        lines: r.rows.map((q) => ({
          c: [
            `t = ${f(q.t)}:  s = ${f(q.s)}`,
            q.pos
              ? `,  точка (${q.pos
                  .filter((_, i) => i < 2 || pr.z.trim())
                  .map(f)
                  .join('; ')})`
              : '',
          ],
        })),
      },
    ],
  });
  const rows: AnswerRow[] = [];
  if (s) {
    rows.push({ kind: 'main', val: [v('s'), ` = ${f(r.s2)}`], note: `расстояние от начала отсчёта до конечного положения (t = ${f(r.t2)})` });
    rows.push({ kind: 'main', val: ['σ = ', f(r.path)], note: 'путь, пройденный за промежуток' });
  } else {
    rows.push({ kind: 'main', val: ['σ = s = ', f(r.path)], note: 'длина дуги за промежуток' });
    if (r.closed) rows.push({ kind: 'main', val: [r.closed], note: 'закон движения по траектории' });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- интегрирование ускорения ---------- */

export function integDoc(_pr: KinProblem, r: IntegResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  const ic = [`при t = ${f(r.t0)}:  `, r.given === 'a' ? `x = ${f(r.x0)}, v = ${f(r.v0)}` : `x = ${f(r.x0)}`];
  steps.push({
    title: 'Дано',
    blocks: [{ k: 'eq', lines: [{ c: [r.given === 'a' ? 'a(t) = ' : 'v(t) = ', printPi(r.given === 'a' ? r.a! : r.v!)] }, { c: ic }] }],
  });
  const bl: Block[] = [];
  const lines: { c: Inline[] }[] = [];
  if (r.given === 'a') {
    lines.push({ c: ['v(t) = ∫ a dt = ', r.v ? printPi(r.v) : '— (в элементарных функциях не берётся)'] });
    lines.push({ c: ['x(t) = ∫ v dt = ', r.x ? printPi(r.x) : '— (в элементарных функциях не берётся)'] });
  } else {
    lines.push({ c: ['a(t) = dv/dt = ', printPi(r.a!)] });
    lines.push({ c: ['x(t) = ∫ v dt = ', r.x ? printPi(r.x) : '— (в элементарных функциях не берётся)'] });
  }
  bl.push({ k: 'eq', lines });
  if (r.numeric) bl.push({ k: 'p', c: ['Формулой найти не удалось — значения ниже получены численным интегрированием (формула Симпсона).'] });
  else if (r.given === 'a') bl.push({ k: 'p', c: ['Постоянные интегрирования найдены из начальных условий: v(t₀) = v₀, x(t₀) = x₀.'] });
  ex(opts, bl, 'Скорость — первообразная ускорения, координата — первообразная скорости; каждая постоянная интегрирования определяется начальным условием.');
  steps.push({ title: r.given === 'a' ? 'Интегрирование' : 'Дифференцирование и интегрирование', blocks: bl });
  steps.push({
    title: `Значения при t = ${f(r.at.t)}`,
    blocks: [{ k: 'eq', lines: [{ c: [`x = ${f(r.at.x)};  v = ${f(r.at.v)};  a = ${f(r.at.a)}`] }] }],
  });
  const rows: AnswerRow[] = [];
  if (r.x) rows.push({ kind: 'main', val: ['x(t) = ', printPi(r.x)], note: 'закон движения' });
  if (r.v && r.given === 'a') rows.push({ kind: 'main', val: ['v(t) = ', printPi(r.v)], note: 'скорость' });
  rows.push({ kind: 'aux', val: [`x = ${f(r.at.x)}, v = ${f(r.at.v)}, a = ${f(r.at.a)}`], note: `при t = ${f(r.at.t)}` });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- гармонические колебания ---------- */

const phase = (e: number) => {
  const m = (e / Math.PI) * 1;
  const nice = [
    [0, '0'],
    [1, 'π'],
    [-1, '−π'],
    [0.5, 'π/2'],
    [-0.5, '−π/2'],
    [0.25, 'π/4'],
    [-0.25, '−π/4'],
  ].find(([x]) => Math.abs((x as number) - m) < 1e-9);
  return `${f(e)} рад${nice ? ` = ${nice[1]}` : ` = ${deg(m)}π = ${deg((e * 180) / Math.PI)}°`}`;
};

export function harmDoc(_pr: KinProblem, r: HarmResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  steps.push({
    title: 'Закон колебаний',
    blocks: [
      {
        k: 'eq',
        lines: [
          { c: ['x = a', sub('0'), ' + a·sin(kt + ε)   (a > 0, k > 0, −π < ε ≤ π)'] },
          ...(r.law ? [{ c: [`по условию: x(t) = ${printPi(r.law)}`] as Inline[] }] : []),
        ],
      },
    ],
  });
  const bl: Block[] = [];
  if (r.mode === 'law') {
    bl.push({
      k: 'eq',
      lines: [
        { c: ['ẍ = −k²(x − a', sub('0'), '),  d³x/dt³ = −k²ẋ  ⇒  k² = −x‴/ẋ'] },
        { c: ['a', sub('0'), ' = x + ẍ/k²;  a = √((x − a', sub('0'), ')² + (ẋ/k)²);  sin ε = (x − a', sub('0'), ')/a,  cos ε = ẋ/(ak) при t = 0'] },
      ],
    });
    ex(
      opts,
      bl,
      'Центр колебаний a₀ — среднее значение x; амплитуда a — наибольшее отклонение от центра; сумма синусоид одной частоты тоже есть гармоническое колебание той же частоты (21.1). Параметры находятся по значениям x и её производных; затем результат проверяется в других точках.',
    );
  } else
    bl.push({
      k: 'eq',
      lines: [{ c: [`k = 2π/T = ${f(r.k)} с⁻¹`] }, { c: ['x₀ = a₀ + a·sin ε  ⇒  a = (x₀ − a₀)/sin ε = ', f(r.a)] }],
    });
  steps.push({ title: r.mode === 'law' ? 'Параметры колебания' : 'Амплитуда и частота', blocks: bl });
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('a'), sub('0'), ` = ${f(r.a0)}`], note: 'центр колебаний' },
    { kind: 'main', val: [v('a'), ` = ${f(r.a)}`], note: 'амплитуда' },
    { kind: 'main', val: [v('k'), ` = ${fmtPi(r.k)} = ${f(r.k)} с⁻¹`], note: 'круговая частота' },
    { kind: 'main', val: [v('T'), ` = 2π/k = ${fmtPi(r.T)} = ${f(r.T)} с`], note: 'период' },
    { kind: 'main', val: [v('f'), ` = 1/T = ${f(r.f)} Гц`], note: 'частота' },
    { kind: 'main', val: ['ε = ', phase(r.eps)], note: 'начальная фаза' },
  ];
  steps.push({
    title: 'Следствия',
    blocks: [
      {
        k: 'eq',
        lines: [
          { c: [`x(0) = ${f(r.x0)};  ẋ(0) = ${f(r.v0)};  наибольшие |ẋ| = ak = ${f(r.vMax)}, |ẍ| = ak² = ${f(r.aMax)}`] },
          { c: [`то же через косинус: x = a₀ + a·cos(kt + α), α = ε − π/2 = ${phase(wrapPhase(r.eps - Math.PI / 2))}`] },
        ],
      },
    ],
  });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- бросок ---------- */

export function shotDoc(_pr: KinProblem, r: ShotResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  steps.push({
    title: 'Уравнения движения',
    blocks: [
      {
        k: 'p',
        c: [
          `Снаряд брошен со скоростью v₀ = ${f(r.v0)} под углом α = ${f(r.alpha)}° к горизонту с высоты h₀ = ${f(r.h0)}; сопротивления воздуха нет, g = ${f(r.g)}.`,
        ],
      },
      {
        k: 'eq',
        lines: [{ c: ['x = v₀ cos α·t,   y = h₀ + v₀ sin α·t − gt²/2'] }, { c: ['траектория: y = h₀ + x tg α − g x²/(2v₀² cos²α) — парабола'] }],
      },
    ],
  });
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [`время подъёма  t₁ = v₀ sin α/g = ${f(r.tTop)} с;  высота  H = h₀ + v₀² sin²α/(2g) = `, b(f(r.H))] },
          { c: [`время полёта  T:  y(T) = 0  ⇒  T = (v₀ sin α + √(v₀² sin²α + 2gh₀))/g = `, b(f(r.T)), ' с'] },
          { c: [`дальность  L = v₀ cos α·T = `, b(f(r.L))] },
          { c: [`в момент падения: v = √(v₀² + 2gh₀) = ${f(r.vEnd)};  угол с горизонтом ${f(r.alphaEnd)}°`] },
        ],
      },
    ];
    ex(opts, bl, 'При h₀ = 0: H = v₀² sin²α/(2g), L = v₀² sin 2α/g, T = 2v₀ sin α/g. Высота и дальность — это значения y в вершине и x при y = 0.');
    steps.push({ title: 'Высота, время и дальность', blocks: bl });
  }
  steps.push({
    title: 'Наибольшая дальность',
    blocks: [
      {
        k: 'eq',
        lines: [
          { c: [`tg α* = v₀/√(v₀² + 2gh₀)  ⇒  α* = ${f(r.best.alpha)}°  (45°, если h₀ = 0)`] },
          { c: [`L`, sub('max'), ` = ${f(r.best.L)};  H = ${f(r.best.H)};  T = ${f(r.best.T)} с`] },
        ],
      },
    ],
  });
  if (r.target) {
    const tg = r.target;
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          `Цель — точка (x; y) = (${f(tg.x)}; ${f(tg.y)}). Подставляя её в уравнение траектории с 1/cos²α = 1 + tg²α, получаем квадратное уравнение относительно u = tg α: (gx²/2v₀²)u² − xu + (y − h₀ + gx²/2v₀²) = 0.`,
        ],
      },
    ];
    if (tg.reachable && tg.tgs.length)
      bl.push({
        k: 'eq',
        lines: tg.tgs.map((u, i) => ({
          c: [`tg α${tg.tgs.length > 1 ? (i ? '₂' : '₁') : ''} = ${f(u)}  ⇒  α = `, b(`${deg((Math.atan(u) * 180) / Math.PI)}°`)] as Inline[],
        })),
      });
    else bl.push({ k: 'badge', tone: 'warn', text: 'при этой начальной скорости точка недостижима (дискриминант отрицателен)' });
    steps.push({ title: 'Попадание в точку', blocks: bl });
  }
  {
    const bl: Block[] = [
      { k: 'eq', lines: [{ c: ['y = h₀ + v₀²/(2g) − g x²/(2v₀²)'] }] },
      { k: 'p', c: ['Все точки вне этой параболы недостижимы при данной скорости v₀ и любом угле бросания (огибающая семейства траекторий).'] },
    ];
    steps.push({ title: 'Парабола безопасности', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: ['H = ', f(r.H)], note: 'наибольшая высота' },
    { kind: 'main', val: ['L = ', f(r.L)], note: 'дальность' },
    { kind: 'main', val: ['T = ', f(r.T), ' с'], note: 'время полёта' },
    { kind: 'aux', val: [`α* = ${f(r.best.alpha)}°, L = ${f(r.best.L)}`], note: 'наибольшая дальность' },
  ];
  if (r.target?.reachable) rows.push({ kind: 'main', val: [`tg α = ${r.target.tgs.map(f).join(' или ')}`], note: 'углы бросания для попадания в цель' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
