/** Решение: уравнение Мещерского для тела переменной массы; многоступенчатая ракета (Циолковский, Фертрегт). */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { diff, printExpr, simplify, usesVar } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { LineResult, StagesProblem, StagesResult, VarLine } from '../model/varmass';

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
const exf =
  (opts: { explain?: boolean }) =>
  (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
const REASON: Record<LineResult['reason'], string> = {
  time: 'наступил заданный момент t₁',
  mass: 'масса уменьшилась до m₁ (топливо сгорело)',
  speed: 'скорость достигла v₁',
  dist: 'пройден путь s₁',
  rest: 'тело остановилось',
  stuck: 'трение удерживает тело на месте — движения нет',
  empty: 'масса исчерпана',
  limit: 'условие окончания не наступило',
};

export function lineDoc(pr: VarLine, r: LineResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok || !r.start || !r.end) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const s0 = r.start,
    e = r.end;
  const accel = pr.massMode === 'accel';
  // 1. Масса и частицы.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (!accel && r.mExpr) {
      lines.push({ c: [v('m'), '(t', usesVar(r.mExpr, 'x') ? ', x' : '', ') = ', b(printExpr(r.mExpr)), `; m₀ = ${f(s0.m)}`] });
      lines.push({
        c: usesVar(r.mExpr, 'x')
          ? ['dm/dt = ∂m/∂t + (∂m/∂x)·v; в начальный момент ', `dm/dt = ${f(s0.dm)}`]
          : ['dm/dt = ', printExpr(simplify(diff(r.mExpr))), `; в начальный момент ${f(s0.dm)}`],
      });
    } else lines.push({ c: ['масса неизвестна: задано постоянное ускорение ', v('w'), ` = ${f(pr.w)} м/с², m₀ = ${f(pr.m0)}`] });
    const part: Inline[] =
      pr.part === 'jet'
        ? [
            'частицы отделяются со скоростью ',
            v('v'),
            sub('e'),
            ` = ${f(pr.ve)} м/с относительно тела; реактивная сила Φ = v_e·q, q = −dm/dt`,
            pr.beta ? `; направлена под углом β = ${f(pr.beta)}° к оси (вдоль оси Φ cos β, поперёк Φ sin β)` : ' — вдоль оси x',
          ]
        : pr.part === 'zeroAbs'
          ? ['частицы присоединяются из покоя (или отделяются, останавливаясь): абсолютная скорость u = 0, сила (u − v)·dm/dt = −v·dm/dt']
          : ['частицы отделяются с нулевой относительной скоростью (u = v) — реактивной силы нет'];
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          `Ось x направлена под углом α = ${f(pr.alpha)}° к горизонту${pr.alpha === 90 ? ' (вертикально вверх)' : pr.alpha === -90 ? ' (вертикально вниз)' : ''}; x₀ = ${f(pr.x0)} м, v₀ = ${f(pr.v0)} м/с.`,
        ],
      },
      { k: 'eq', lines },
      { k: 'p', c: part },
    ];
    ex(
      bl,
      'Тело переменной массы: за время dt масса меняется на dm, и отделившиеся (присоединившиеся) частицы уносят (приносят) количество движения. Отсюда в уравнении движения появляется добавочная — реактивная — сила.',
    );
    steps.push({ title: 'Тело переменной массы', blocks: bl });
  }
  // 2. Уравнение Мещерского.
  {
    const terms: Inline[] = [];
    if (pr.grav !== 'none' && Math.abs(Math.sin((pr.alpha * Math.PI) / 180)) > 1e-12) terms.push(' − m·g·sin α');
    if (pr.f > 0) terms.push(' − f·N·sign v');
    if (pr.k1 > 0) terms.push(` − ${f(pr.k1)}·v`);
    if (pr.k2 > 0) terms.push(` − ${f(pr.k2)}·v|v|`);
    if (pr.force.trim()) terms.push(` + F(t, x, v)`);
    const react = pr.part === 'jet' ? ` + v_e·q${pr.beta ? '·cos β' : ''}` : pr.part === 'zeroAbs' ? ' − v·dm/dt' : '';
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['общий вид: ', v('m'), '·dv/dt = ΣF + (u − v)·dm/dt'] },
      { c: [v('m'), '·dv/dt = ', ...(terms.length ? terms : ['0']), react] },
    ];
    if (pr.f > 0) lines.push({ c: ['N = m·g·cos α', pr.part === 'jet' && pr.beta ? ' − Φ·sin β' : '', ' — давление на направляющие'] });
    if (pr.grav === 'inverse') lines.push({ c: [`g(h) = g·R²/(R + h)², R = ${f(pr.Rg)} м, h = x·sin α`] });
    if (pr.force.trim()) lines.push({ c: [`F(t, x, v) = ${pr.force.trim()}`] });
    lines.push({
      c: [`в начальный момент: ${pr.part === 'jet' ? `Φ = ${f(s0.Phi)}, ` : ''}реактивная сила вдоль оси ${f(s0.R)}, ускорение `, b(`${f(s0.a)} м/с²`)],
    });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      pr.part === 'zeroAbs'
        ? 'При u = 0 уравнение можно записать как d(mv)/dt = ΣF: количество движения тела меняется только от внешних сил.'
        : 'Уравнение Мещерского: к обычным силам добавляется реактивная сила (u − v)·dm/dt; у ракеты u − v = −v_e и dm/dt < 0, поэтому сила направлена вперёд.',
    );
    steps.push({ title: 'Уравнение движения (Мещерского)', blocks: bl });
  }
  // 3. Закон массы при заданном ускорении.
  if (accel) {
    const lines: { num?: boolean; c: Inline[] }[] = [
      {
        c:
          pr.part === 'jet'
            ? [
                'при dv/dt = w: ',
                v('m'),
                'w = −m·g·sin α − f·N − … − v_e·cos β·dm/dt → dm/dt = −[m(w + g sin α + fg cos α) + k₁v + k₂v|v| − F]/(v_e(cos β + f sin β))',
              ]
            : ['при dv/dt = w: ', v('m'), 'w = ΣF − v·dm/dt → dm/dt = (ΣF − mw)/v'],
      },
    ];
    if (r.expRate != null) lines.push({ c: ['силы пропорциональны массе: ', v('m'), ` = m₀·e^(−λt), λ = ${f(r.expRate)} 1/с`] });
    lines.push({ c: [`в конце: m = `, b(f(e.m)), ` (m₀/m = ${f(s0.m / e.m)})`] });
    steps.push({ title: 'Закон изменения массы', blocks: [{ k: 'eq', lines }] });
  }
  // 4. Интегрирование.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      {
        c: [
          `t = `,
          b(`${f(e.t)} с`),
          `; x = `,
          b(`${f(e.x)} м`),
          ` (путь ${f(Math.abs(e.x - pr.x0))}); v = `,
          b(`${f(e.v)} м/с`),
          `; m = ${f(e.m)}; ускорение ${f(e.a)} м/с²`,
        ],
      },
    ];
    if (pr.part === 'jet') lines.push({ c: [`работа реактивной силы A = ∫Φ·v dt = ${f(r.A)}; кинетическая энергия mv²/2 = ${f((e.m * e.v * e.v) / 2)}`] });
    const bl: Block[] = [
      { k: 'p', c: ['Уравнение интегрируется численно (Рунге — Кутта с контролем шага) до момента, когда ', REASON[r.reason], '.'] },
      { k: 'eq', lines },
    ];
    for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
    steps.push({ title: 'Движение на активном участке', blocks: bl });
  }
  // 5. Формула Циолковского.
  if (r.tsiol != null) {
    const g = pr.grav === 'none' ? 0 : pr.g * Math.sin((pr.alpha * Math.PI) / 180);
    steps.push({
      title: 'Проверка формулой Циолковского',
      blocks: [
        {
          k: 'eq',
          lines: [
            {
              c: [
                'v = v₀ + v_e·ln(m₀/m)',
                g ? ' − g·sin α·t' : '',
                ` = ${f(pr.v0)} + ${f(pr.ve)}·ln(${f(s0.m)}/${f(e.m)})${g ? ` − ${f(g)}·${f(e.t)}` : ''} = `,
                b(`${f(r.tsiol)} м/с`),
              ],
            },
          ],
        },
      ],
    });
  }
  // 6. После активного участка.
  if (r.coast) {
    steps.push({
      title: 'Движение с постоянной массой до остановки',
      blocks: [
        {
          k: 'eq',
          lines: [{ c: [`скорость обращается в нуль при t = ${f(r.coast.t)} с; x = `, b(`${f(r.coast.x)} м`), ` (за это время ещё ${f(r.coast.dx)} м)`] }],
        },
      ],
    });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`t = ${f(e.t)} с`], note: REASON[r.reason] },
    { kind: 'main', val: [`x = ${f(e.x)} м`], note: `путь ${f(Math.abs(e.x - pr.x0))} м` },
    { kind: 'main', val: [`v = ${f(e.v)} м/с`], note: 'скорость' },
    { kind: accel ? 'main' : 'aux', val: [`m = ${f(e.m)}`], note: `m₀/m = ${f(s0.m / e.m)}; израсходовано ${f(s0.m - e.m)}` },
  ];
  if (r.coast) rows.push({ kind: 'main', val: [`x_max = ${f(r.coast.x)} м`], note: 'после окончания активного участка' });
  if (pr.part === 'jet') rows.push({ kind: 'aux', val: [`A = ${f(r.A)}`], note: 'работа реактивной силы' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function stagesDoc(pr: StagesProblem, r: StagesResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const W = pr.ask === 'weights' || pr.ask === 'optimal';
  {
    const items = pr.stages.map((s, i): Inline[] => [
      `ступень ${i + 1}: v_e = ${f(s.ve)} м/с`,
      pr.ask === 'speeds' || pr.ask === 'weights' ? `, z = ${f(s.z)}` : '',
      W ? `, s = ${f(s.s)}` : '',
      pr.ask === 'z' ? `, скорость после ступени ${f(s.vt)} м/с` : '',
    ]);
    const bl: Block[] = [{ k: 'ul', items }];
    if (W) bl.push({ k: 'p', c: [`Полезный груз q = ${f(pr.q)}${pr.ask === 'optimal' ? `; требуемая скорость v = ${f(pr.v)} м/с` : ''}.`] });
    ex(
      bl,
      'Субракета — работающая ступень вместе со всеми следующими ступенями и полезным грузом; число Циолковского z — отношение её начального веса к весу после сгорания топлива ступени, s — отношение полного веса ступени к её сухому весу. Поля тяготения и сопротивления нет.',
    );
    steps.push({ title: 'Ступени ракеты', blocks: bl });
  }
  if (pr.ask === 'optimal') {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['минимум G₁ = q·Π z_i(s_i − 1)/(s_i − z_i) при Σv_e,i·ln z_i = v: условие Лагранжа s_i/(s_i − z_i) = λ·v_e,i'] },
      { c: ['z_i = s_i(1 − 1/(λv_e,i)); λ = ', b(r.lambda!.toPrecision(6)), ' — из условия на скорость'] },
    ];
    steps.push({ title: 'Наименьший стартовый вес', blocks: [{ k: 'eq', lines }] });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = r.stages.map((s, i) => ({
      c:
        pr.ask === 'z'
          ? [
              `z${i + 1} = exp((${f(pr.stages[i].vt)} − ${f(i ? pr.stages[i - 1].vt : 0)})/${f(pr.stages[i].ve)}) = `,
              b(f(s.z)),
              `; топливо субракеты — ${f((1 - 1 / s.z) * 100)} % её начального веса`,
            ]
          : [`v${i + 1} = ${i ? `${f(r.stages[i - 1].v)} + ` : ''}${f(pr.stages[i].ve)}·ln ${f(s.z)} = `, b(`${f(s.v)} м/с`)],
    }));
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Формула Циолковского: приращение скорости за работу ступени Δv = v_e·ln z — не зависит от закона сгорания топлива.');
    steps.push({ title: pr.ask === 'z' ? 'Числа Циолковского' : 'Скорости после ступеней (формула Циолковского)', blocks: bl });
  }
  if (W) {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['G_k = q·Π_{i≥k} z_i(s_i − 1)/(s_i − z_i);  P_k = G_k(z_k − 1)/z_k;  Q_k = P_k/(s_k − 1)  (формулы Фертрегта)'] },
    ];
    r.stages.forEach((s, i) =>
      lines.push({
        num: true,
        c: [`ступень ${i + 1}: G${i + 1} = `, b(f(s.G!)), `; топливо P${i + 1} = `, b(f(s.P!)), `; сухой вес Q${i + 1} = `, b(f(s.Q!))],
      }),
    );
    steps.push({ title: 'Веса субракет и ступеней', blocks: [{ k: 'eq', lines }] });
  }
  const rows: AnswerRow[] = r.stages.map((s, i) => ({
    kind: 'main' as const,
    val: [pr.ask === 'speeds' ? `v${i + 1} = ${f(s.v)} м/с` : `z${i + 1} = ${f(s.z)}`],
    note: pr.ask === 'speeds' ? `после ступени ${i + 1}` : `ступень ${i + 1}${W ? `: P = ${f(s.P!)}, Q = ${f(s.Q!)}` : ''}`,
  }));
  if (r.G1 != null) rows.push({ kind: 'main', val: [`G₁ = ${f(r.G1)}`], note: 'стартовый вес ракеты' });
  rows.push({ kind: 'aux', val: [`v = ${f(r.vEnd)} м/с`], note: 'конечная скорость' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
