/** Решения: сохранение количества движения, давление струи, работа и мощность. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { loadFactor, type JetProblem, type JetResult, type MomentumProblem, type MomentumResult, type PowerProblem, type PowerResult } from '../model/dynamics';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
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
const exf =
  (opts: { explain?: boolean }) =>
  (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };

/* ---------- количество движения ---------- */

export function momentumDoc(pr: MomentumProblem, r: MomentumResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const { i: ui, when } = pr.unknown;
  const nm = (i: number) => `${i + 1}${pr.bodies[i].name ? ` (${pr.bodies[i].name})` : ''}`;
  const desc = (i: number, st: 0 | 1): string => {
    const bd = pr.bodies[i];
    const ref = st ? bd.ref1 : bd.ref0;
    const val = ui === i && when === st ? 'X' : f(st ? bd.v1 : bd.v0);
    const absV = f((st ? r.abs1 : r.abs0)[i]);
    return ref < 0
      ? `${val} (абсолютная)`
      : `${val} относительно тела ${ref + 1}, абсолютная ${f((st ? r.abs1 : r.abs0)[ref])} + ${ui === i && when === st ? 'X' : fp(st ? bd.v1 : bd.v0)} = ${absV}`;
  };
  {
    const items = pr.bodies.map((bd, i): Inline[] => [
      `${nm(i)}: m = ${pr.byWeight ? `${f(bd.m)}/g = ` : ''}${f(r.masses[i])}; до: v = ${desc(i, 0)}; после: u = ${desc(i, 1)}`,
    ]);
    const bl: Block[] = [
      { k: 'p', c: ['Скорости — проекции на ось x; неизвестная ', v('X'), ` — скорость тела ${ui + 1} ${when ? 'после' : 'до'}.`] },
      { k: 'ul', items },
    ];
    ex(
      bl,
      'Абсолютная скорость тела, заданная относительно другого, — сумма относительной и скорости того тела (переносной). Относительная скорость 0 — тела движутся вместе.',
    );
    steps.push({ title: 'Тела и скорости', blocks: bl });
  }
  {
    const lhs = pr.bodies.map((_, i) => `${f(r.masses[i])}·${fp(r.abs0[i])}`).join(' + '),
      rhs = pr.bodies.map((_, i) => `${f(r.masses[i])}·${fp(r.abs1[i])}`).join(' + ');
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['Σm', sub('i'), v('v'), sub('i'), ' = Σm', sub('i'), v('u'), sub('i'), ' (', v('Q'), sub('x'), ' = const)'] },
          { num: true, c: [lhs, ' = ', rhs, ' = ', f(r.Q)] },
          { c: [v('X'), ' = ', b(f(r.answer))] },
        ],
      },
    ];
    ex(
      bl,
      'Теорема об изменении количества движения: dQ/dt = ΣF^e. Если проекция внешних сил на x равна нулю (или их импульс за короткое время взаимодействия пренебрежимо мал — выстрел, разрыв, рывок каната), Q_x сохраняется; внутренние силы его не меняют.',
    );
    steps.push({ title: 'Сохранение количества движения', blocks: bl });
  }
  const abs = pr.bodies[ui][when ? 'ref1' : 'ref0'] < 0 ? r.answer : (when ? r.abs1 : r.abs0)[ui];
  {
    const dT = r.T1 - r.T0;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [{ c: [v('T'), sub('0'), ' = Σm', v('v'), '²/2 = ', f(r.T0), ';  ', v('T'), sub('1'), ' = ', f(r.T1), ';  Δ', v('T'), ' = ', b(f(dT))] }],
      },
    ];
    if (r.brake)
      bl.push({
        k: 'eq',
        lines: [
          { c: ['путь тела 2 по телу 1: ', v('s'), ' = |Δ', v('T'), '|/', v('F'), ` = ${f(r.T0 - r.T1)}/${f(pr.F)} = `, b(f(r.brake.s))] },
          { c: ['время: ', v('τ'), ' = |Δ(m', sub('2'), v('v'), sub('2'), ')|/', v('F'), ' = ', b(f(r.brake.tau))] },
        ],
      });
    ex(
      bl,
      dT < 0
        ? 'Кинетическая энергия не сохраняется: её убыль — работа внутренних сил (трение, неупругий удар). Пара сил трения F совершает работу −F·s, где s — путь одного тела по другому; время торможения — из теоремы об импульсе для одного тела.'
        : dT > 0
          ? 'Прирост кинетической энергии — работа внутренних сил (давление газов, взрыв).'
          : 'Кинетическая энергия сохранилась.',
    );
    steps.push({ title: 'Кинетическая энергия', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`${when ? 'u' : 'v'}${ui + 1} = ${f(r.answer)}`], note: abs < 0 ? 'против оси x' : abs > 0 ? 'вдоль оси x' : 'покой' },
  ];
  if (abs !== r.answer) rows.push({ kind: 'aux', val: [`абсолютная ${f(abs)}`], note: '' });
  if (r.brake) rows.push({ kind: 'aux', val: [`s = ${f(r.brake.s)}; τ = ${f(r.brake.tau)}`], note: 'путь и время торможения' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- давление струи ---------- */

export function jetDoc(pr: JetProblem, r: JetResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const FU = pr.byWeight ? 'кГ' : 'Н';
  const rho = pr.byWeight ? pr.rho / pr.g : pr.rho;
  {
    const items = pr.streams.map((s, i): Inline[] => [
      `${i + 1}. ${s.name || (s.out ? 'выход' : 'вход')} (${s.out ? 'выход' : 'вход'}): v = ${f(s.v)} м/с под ${f(s.ang)}°; `,
      i === r.cont ? `ṁ — по неразрывности = ${f(r.mdot[i])}` : `ṁ = ρAv = ${f(rho)}·${f(s.A)}·${f(s.v)} = ${f(r.mdot[i])}`,
    ]);
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          pr.byWeight ? `ρ = γ/g = ${f(pr.rho)}/${f(pr.g)} = ${f(rho)}.` : `ρ = ${f(rho)} кг/м³.`,
          ' Ось x — вправо, y — вверх; угол скорости — от оси x против часовой стрелки.',
        ],
      },
      { k: 'ul', items },
    ];
    if (r.min > 0 && r.mout > 0 && Math.abs(r.min - r.mout) > 0.01 * Math.max(r.min, r.mout))
      bl.push({ k: 'badge', tone: 'warn', text: `приток ${f(r.min)} ≠ отток ${f(r.mout)}: расход не сохраняется` });
    ex(bl, 'Секундная масса ṁ = ρ·A·v. В установившемся потоке через неподвижный контур сколько жидкости вошло, столько и вышло.');
    steps.push({ title: 'Сечения и расходы', blocks: bl });
  }
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          {
            c: [
              v('R'),
              ' = Σ',
              sub('вх'),
              'ṁ',
              v('v'),
              ' − Σ',
              sub('вых'),
              'ṁ',
              v('v'),
              ':  ',
              v('R'),
              sub('x'),
              ' = ',
              b(f(r.R[0])),
              ',  ',
              v('R'),
              sub('y'),
              ' = ',
              b(f(r.R[1])),
              ` ${FU}`,
            ],
          },
          { c: ['|', v('R'), '| = ', b(f(Math.hypot(...r.R))), ` ${FU}`] },
        ],
      },
    ];
    ex(
      bl,
      'Теорема об изменении количества движения для жидкости в контуре: за 1 с количество движения меняется на Σṁv_вых − Σṁv_вх; это импульс сил со стороны стенок. Жидкость давит на стенки с противоположной силой R (динамическая составляющая, без давления в сечениях и веса жидкости).',
    );
    steps.push({ title: 'Давление струи на стенки', blocks: bl });
  }
  if (r.N) {
    const N = r.N;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          {
            c: [
              v('N'),
              sub('y'),
              ' = ',
              v('W'),
              ' − ',
              v('R'),
              sub('y'),
              ` = ${f(pr.W)} − ${fp(r.R[1])} = `,
              b(f(N[1])),
              N[0] ? `;  N_x = −R_x = ${f(N[0])}` : '',
            ],
          },
        ],
      },
    ];
    if (N[1] < 0) bl.push({ k: 'badge', tone: 'warn', text: 'N_y < 0: опоры не могут тянуть вниз — давление на опоры равно нулю, сосуд стремится оторваться' });
    steps.push({ title: 'Реакция опор', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('R'), ` = (${f(r.R[0])}; ${f(r.R[1])}) ${FU}`], note: 'давление на стенки' },
    { kind: 'aux', val: [`|R| = ${f(Math.hypot(...r.R))} ${FU}`], note: '' },
  ];
  if (r.N) rows.push({ kind: 'main', val: [`давление на опоры ${f(Math.max(0, r.N[1]))} ${FU}`], note: '' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- работа и мощность ---------- */

export function powerUnitNames(pr: Pick<PowerProblem, 'units'>) {
  return pr.units === 'tech' ? { F: 'кГ', A: 'кГм', N: 'кГм/с' } : { F: 'Н', A: 'Дж', N: 'Вт' };
}

export function powerDoc(pr: PowerProblem, r: PowerResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const U = powerUnitNames(pr);
  const u = pr.unknown;
  const conv = (x: number) => `${f(x)} ${U.N} = ${f(x / r.hp)} л. с. = ${f(x / r.kW)} кВт`;
  {
    const items = pr.loads.map((l, i): Inline[] => {
      const o = r.loads[i];
      const Fv = u === i ? `${l.kind === 'weight' ? 'P' : 'F'} = X` : `${l.kind === 'weight' ? 'P' : 'F'} = ${f(l.F)}`;
      const force = l.kind === 'weight' ? `${Fv}, F = P(sin ${f(l.alpha)}° + ${f(l.f)}·cos ${f(l.alpha)}°) = ${u === i ? `${f(loadFactor(l))}X` : f(o.F)}` : Fv;
      const sp =
        l.speed === 'v'
          ? `v = ${f(l.v)} м/с`
          : l.speed === 'rot'
            ? `v = πdn/60 = π·${f(l.d)}·${f(l.n)}/60 = ${f(o.v as number)} м/с`
            : `k = ${f(l.k)}, s = ${f(l.s)} м${o.v != null ? `, v = ks/t = ${f(o.v)} м/с` : ''}`;
      return [`${i + 1}. ${l.name || 'нагрузка'}: ${force} ${U.F}; ${sp}`];
    });
    const bl: Block[] = [{ k: 'ul', items }];
    ex(
      bl,
      'Движение равномерное: сила вдоль движения уравновешивает сопротивления. Вес на наклоне α с трением f требует силы P(sin α + f cos α); при α = 90° — подъём, при α = 0 — преодоление трения fP. Окружная скорость шкива диаметром d при n об/мин — πdn/60.',
    );
    steps.push({ title: pr.driving ? 'Движущие силы' : 'Нагрузки (полезные сопротивления)', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    const nl = pr.driving ? 'движ' : 'пол';
    if (u === 't') {
      lines.push({
        c: [
          v('N'),
          sub(nl),
          ` = ${pr.driving ? 'N/η' : 'ηN'} = ${f(r.Nl as number)};  `,
          v('t'),
          ' = ΣkFs/(',
          v('N'),
          sub(nl),
          ' − ΣFv) = ',
          b(f(r.t)),
          ' с',
          r.t >= 60 ? ` = ${hms(r.t)}` : '',
        ],
      });
    } else if (typeof u === 'number') {
      lines.push({ c: [v('N'), ' = ', conv(r.N as number), ';  ', v('N'), sub(nl), ` = ${pr.driving ? 'N/η' : 'ηN'} = ΣFv = ${f(r.Nl as number)}`] });
      lines.push({ c: [`X = ${pr.loads[u].kind === 'weight' ? 'P' : 'F'}${u + 1} = `, b(f(r.answer)), ` ${U.F}`] });
    } else if (r.Nl != null) {
      lines.push({ c: [v('N'), sub(nl), ' = ΣF', sub('i'), v('v'), sub('i'), ` = ${f(r.Nl)} ${U.N}`] });
      lines.push({ c: [v('N'), ` = ${pr.driving ? 'η·N_движ' : 'N_пол/η'} = `, b(conv(r.N as number))] });
    }
    if (r.Al != null)
      lines.push({
        c: [
          v('A'),
          sub(nl),
          ' = ',
          b(f(r.Al)),
          ` ${U.A}`,
          pr.eta !== 1 && r.A != null ? `;  ${pr.driving ? 'полезная' : 'двигателя'} A = ${f(r.A)} ${U.A}` : '',
        ],
      });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.Nl == null) bl.push({ k: 'p', c: ['Время не задано — мощность не считаем, только работу.'] });
    ex(
      bl,
      `Мощность силы — F·v (у пары сил — M·ω), работа за время t — N·t. КПД η — отношение полезной работы к работе движущих сил${pr.driving ? '; здесь заданы движущие силы, полезная мощность N = η·N_движ' : '; двигатель развивает N = N_пол/η'}. 1 л. с. = 75 кГм/с = ${pr.units === 'tech' ? '75g' : f(r.hp)} Вт.`,
    );
    steps.push({ title: 'Мощность и работа', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  if (u === 't') rows.push({ kind: 'main', val: [`t = ${f(r.t)} с`], note: r.t >= 60 ? hms(r.t) : '' });
  else if (typeof u === 'number')
    rows.push({ kind: 'main', val: [`${pr.loads[u].kind === 'weight' ? 'P' : 'F'}${u + 1} = ${f(r.answer)} ${U.F}`], note: pr.loads[u].name });
  else if (r.N != null) rows.push({ kind: 'main', val: [`N = ${f(r.N)} ${U.N}`], note: `${f(r.N / r.hp)} л. с. = ${f(r.N / r.kW)} кВт` });
  if (r.Al != null)
    rows.push({
      kind: u === 'N' && r.N == null ? 'main' : 'aux',
      val: [`A = ${f(r.Al)} ${U.A}`],
      note: pr.driving ? 'работа движущих сил' : 'полезная работа',
    });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function hms(t: number) {
  const s = Math.round(t);
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return `${h ? `${h} ч ` : ''}${m} мин ${s % 60} с`;
}
