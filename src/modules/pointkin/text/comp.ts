/** Решения составных задач («comp») и пересчёта координат («conv»). */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { CompResult, ConvResult } from '../model/comp';
import type { KinProblem } from '../model/kin';

const f = (x: number) => fmt(x, 4);
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

export function compDoc(_pr: KinProblem, r: CompResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const o = r.out;
  const steps: Step[] = [];
  const ans = (rows: AnswerRow[]) => steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  if (r.kind === 'drops') {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['первая капля падает ', f(o.t), ' с, вторая — на τ меньше: ', f(o.t - o.tau), ' с'] },
          { c: [v('s'), sub('1'), ' = gt²/2 = ', f(o.s1), ';  ', v('s'), sub('2'), ' = g(t − τ)²/2 = ', f(o.s2)] },
          { c: [v('d'), ' = ', v('s'), sub('1'), ' − ', v('s'), sub('2'), ' = gτ(t − τ/2) = ', b(f(o.d))] },
        ],
      },
    ];
    ex(opts, bl, 'Падение без начальной скорости: s = gt²/2. Расстояние между каплями растёт со временем линейно: d = gτ(t − τ/2).');
    steps.push({ title: 'Расстояние между каплями', blocks: bl });
    ans([
      { kind: 'main', val: [v('d'), ` = ${f(o.d)}`], note: `в момент t = ${f(o.t)} с` },
      { kind: 'aux', val: [`v₁ = ${f(o.v1)}, v₂ = ${f(o.v2)}`], note: 'скорости капель' },
    ]);
  } else if (r.kind === 'pow') {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [`s = c·t^${f(o.n)}`] },
          { c: [`c = S/t₁^n = ${f(o.c)}`] },
          { c: [v('v'), ' = ds/dt = n·c·t^(n−1);  ', v('a'), ' = dv/dt = n(n−1)·c·t^(n−2)'] },
        ],
      },
    ];
    ex(opts, bl, 'Коэффициент c находится из условия: за время t₁ пройден путь S. Скорость и ускорение — первая и вторая производные пути.');
    steps.push({ title: 'Закон движения', blocks: bl });
    steps.push({
      title: 'Скорость и ускорение',
      blocks: [
        {
          k: 'eq',
          lines: [
            { c: ['при t = 0:  v = ', f(o.v0), ',  a = ', f(o.a0)] },
            { c: [`при t = ${f(o.t)}:  `, v('v'), ' = ', b(f(o.v)), ',  ', v('a'), ' = ', b(f(o.a))] },
          ],
        },
      ],
    });
    ans([
      { kind: 'main', val: [v('v'), ` = ${f(o.v)}, `, v('a'), ` = ${f(o.a)}`], note: `при t = ${f(o.t)}` },
      { kind: 'aux', val: ['v = a = 0'], note: 'при t = 0' },
    ]);
  } else if (r.kind === 'pile') {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['падение: h = gt²/2  ⇒  ', v('t'), sub('пад'), ' = √(2h/g) = ', f(o.tf), ' с'] },
          { c: ['подъём: ', v('t'), sub('под'), ' = ', f(o.k), '·', v('t'), sub('пад'), ' = ', f(o.tu), ' с'] },
          { c: ['цикл T = ', f(o.T), ' с;  число ударов в минуту N = 60/T = ', b(f(o.perMin))] },
        ],
      },
    ];
    ex(opts, bl, 'Один удар — один цикл «подъём — падение»; число ударов в минуту — 60 секунд, делённые на длительность цикла.');
    steps.push({ title: 'Время цикла', blocks: bl });
    ans([{ kind: 'main', val: [v('N'), ` = ${f(o.perMin)} ударов в минуту`], note: `скорость в момент удара ${f(o.vEnd)}` }]);
  } else if (r.kind === 'arcs') {
    const lines: { c: Inline[] }[] = [{ c: [v('v'), ` = ${f(o.v)} ед./с`] }];
    r.arcs.forEach((q, i) => {
      lines.push({
        c: [
          `дуга ${i + 1}:  s = ρα = ${f(q.rho)}·${f((q.alpha * Math.PI) / 180)} = ${f(q.s)};  время ${f(q.t1 - q.t0)} с (от ${f(q.t0)} до ${f(q.t1)});  `,
          v('a'),
          sub('n'),
          ` = v²/ρ = `,
          b(f(q.an)),
        ],
      });
    });
    lines.push({ c: [`всего: путь ${f(o.L)}, время T = ${f(o.T)} с`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      opts,
      bl,
      'На прямолинейных участках a_n = 0, на дуге радиуса ρ при постоянной скорости a_n = v²/ρ. На стыке дуг нормальное ускорение меняется скачком; касательное равно нулю — скорость постоянна.',
    );
    steps.push({ title: 'Нормальное ускорение по дугам', blocks: bl });
    ans(
      r.arcs.map((q, i) => ({
        kind: 'main' as const,
        val: [v('a'), sub('n'), sub(String(i + 1)), ` = ${f(q.an)}`],
        note: `на дуге ${i + 1}, ρ = ${f(q.rho)}`,
      })),
    );
  } else {
    const lines: { c: Inline[] }[] = [{ c: ['f(t) = ', r.f ? printExpr(r.f) : ''] }];
    for (const q of r.roots) lines.push({ c: [`f(t) = ${f(q.c)}:  t = `, q.ts.length ? b(q.ts.map((t) => f(t)).join('; ')) : 'нет решений на промежутке'] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      opts,
      bl,
      'Моменты находятся численно: сначала по смене знака f(t) − c (деление пополам), затем отдельно ищутся точки касания, где разность равна нулю без смены знака. Повторяющиеся значения даёт периодичность функции.',
    );
    steps.push({ title: 'Моменты времени', blocks: bl });
    ans(
      r.roots.map((q) => ({
        kind: 'main' as const,
        val: [`f = ${f(q.c)}:  t = ${q.ts.slice(0, 6).map(f).join('; ')}${q.ts.length > 6 ? '; …' : ''}`],
        note: `${q.ts.length} знач. на промежутке`,
      })),
    );
  }
  return { steps };
}

const NAMES = { polar: ['r', 'φ', ''], cyl: ['r', 'φ', 'z'], sph: ['r', 'φ', 'θ'] } as const;

export function convDoc(pr: KinProblem, r: ConvResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  const nm = NAMES[r.sys];
  const rel =
    r.sys === 'polar'
      ? ['r = √(x² + y²)', 'φ = arg(x, y)  (tg φ = y/x)']
      : r.sys === 'cyl'
        ? ['r = √(x² + y²)', 'φ = arg(x, y)', 'z = z']
        : ['r = √(x² + y² + z²)', 'φ = arg(x, y) — долгота', 'θ = arcsin(z/r) — широта (угол с плоскостью xy)'];
  const bl: Block[] = [{ k: 'eq', lines: rel.map((c) => ({ c: [c] as Inline[] })) }];
  ex(
    opts,
    bl,
    'Полярный угол φ определяется по знакам x и y (функция atan2), а не по одной формуле tg φ = y/x. В таблице φ показан непрерывным — без скачков на 2π.',
  );
  steps.push({ title: 'Формулы перехода', blocks: bl });
  const rows = r.rows.map((x) => ({
    c: [`t = ${f(x.t)}:  r = ${f(x.r)},  φ = ${f(x.phi)} рад (${f((x.phi * 180) / Math.PI)}°)${nm[2] ? `,  ${nm[2]} = ${f(x.q)}` : ''}`] as Inline[],
  }));
  steps.push({
    title: 'Координаты по времени',
    blocks: [
      { k: 'p', c: [`При t = ${f(r.at!.t)}: r = ${f(r.at!.r)}, φ = ${f(r.at!.phi)} рад`, nm[2] ? `, ${nm[2]} = ${f(r.at!.q)}` : '', '.'] },
      { k: 'eq', lines: rows },
    ],
  });
  const bk: string[] = [];
  const dv = r.dev;
  const lines: { c: Inline[] }[] = [];
  const add = (label: string, d: number | null, src: string) => {
    if (d == null) return;
    lines.push({ c: [`${label}(t) = ${src}:  наибольшее отклонение от пересчёта ${d.toExponential(1)}`] });
    bk.push(label);
  };
  add('r', dv.r, pr.p?.rb ?? '');
  add('φ', dv.phi, pr.p?.pb ?? '');
  add(nm[2] || 'z', dv.q, pr.p?.zb ?? '');
  if (lines.length) {
    const bl2: Block[] = [{ k: 'eq', lines }];
    bl2.push(
      r.mismatch.length
        ? { k: 'badge', tone: 'bad', text: `не совпадает: ${r.mismatch.join(', ')}` }
        : { k: 'badge', tone: 'ok', text: 'формулы совпадают с пересчётом' },
    );
    steps.push({ title: 'Сверка с формулами', blocks: bl2 });
  }
  const ans: AnswerRow[] = [
    {
      kind: 'main',
      val: [`r = ${f(r.at!.r)}, φ = ${f(r.at!.phi)}`, nm[2] ? `, ${nm[2]} = ${f(r.at!.q)}` : ''].flat() as Inline[],
      note: `при t = ${f(r.at!.t)}`,
    },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}
