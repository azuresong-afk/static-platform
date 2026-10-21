/** Решение: тела до удара, условия удара, ударный импульс, скорости после удара, импульсы осей, теорема Карно, движение после удара. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { stuckAt, type AfterRes, type BodyState, type ImpBody, type ImpProblem, type ImpResult } from '../model/impact';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const vec = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;
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
const KIND: Record<ImpBody['kind'], string> = { free: 'свободное тело', axis: 'тело на неподвижной оси', wall: 'неподвижная преграда' };
const INERTIA: Record<ImpBody['inertia'], string> = {
  point: 'материальная точка (поступательное движение)',
  JC: 'J_C задан',
  rhoC: 'J_C = mρ²',
  JO: 'J_O задан',
  rhoO: 'J_O = mρ_O²',
  rod: 'стержень: J_C = mL²/12',
  disk: 'диск: J_C = mR²/2',
  ring: 'кольцо: J_C = mR²',
  rect: 'пластина: J_C = m(a² + b²)/12',
  sphere: 'шар: J_C = 2mR²/5',
};
const nm = (bd: ImpBody, i: number) => `тело ${i + 1}${bd.name.trim() ? ` (${bd.name.trim()})` : ''}`;

function afterItems(pr: ImpProblem, a: AfterRes, who: string, LU: string): Inline[][] {
  const items: Inline[][] = [];
  const merged = a.M != null && who.startsWith('тело 2') && pr.stick;
  if (merged) items.push([`Тела движутся вместе: масса ${f(a.M!)}, скорость общего центра масс ${f(a.v ?? 0)} м/с.`]);
  if (a.rise != null) items.push([`${who}: центр масс поднимется на h = v`, sub('y'), '²/(2g) = ', b(`${f(a.rise)} ${LU}`), '.']);
  if (a.bounce)
    items.push([
      `Повторные отскоки от плиты: высоты h, k²h, k⁴h, …; путь до остановки s = h + 2k²h + 2k⁴h + … = h(1 + k²)/(1 − k²) = `,
      b(`${f(a.bounce.total)} ${LU}`),
      '.',
    ]);
  if (a.thread) {
    const th = a.thread;
    items.push(
      th.full
        ? [`${who}: v² ≥ 5gl — груз на нити делает полный оборот.`]
        : th.slack
          ? [`${who}: v² > 2gl — груз поднимется выше горизонтали оси нити, и нить ослабнет до верхней точки.`]
          : [
              `${who}: груз на нити отклонится на угол α: 1 − cos α = v²/(2gl), α = `,
              b(`${f(th.alpha)}°`),
              ` (sin(α/2) = ${f(Math.sin((th.alpha * Math.PI) / 360))}).`,
            ],
    );
  }
  if (a.slide != null) items.push([`${who} скользит по шероховатой плоскости: путь s = v²/(2fg) = `, b(`${f(a.slide)} ${LU}`), '.']);
  if (a.swing) {
    const s = a.swing;
    const head: Inline[] = [
      `${who} вращается под действием тяжести: J = ${f(s.J)}, ω = ${f(s.w)} рад/с, энергия Jω²/2 = ${f(s.E)}; чтобы центр масс прошёл над осью поворота, нужно ${f(s.Etop)} (M·g·(|QC| − y_C)). `,
    ];
    items.push(
      s.over
        ? [...head, b('Энергии хватает: центр масс проходит над точкой поворота — тело опрокидывается через ребро (или делает полный оборот).')]
        : [...head, 'Наибольший угол поворота φ = ', b(`${f(s.phi)}°`), '.'],
    );
  }
  if (a.spring != null)
    items.push([
      `Пружина под телом 2 дополнительно сожмётся на s (от положения равновесия): c·s²/2 − (M − m₂)g·s − Mv²/2 = 0, s = `,
      b(`${f(a.spring)} ${LU}`),
      '.',
    ]);
  if (a.pile)
    items.push([
      `Свая: по теореме об энергии T′ + Mgδ = Rδ, T′ = ${f(a.pile.T)}; T′/δ = ${f(a.pile.T / pr.b2.delta)}; среднее сопротивление R = Mg + T′/δ = `,
      b(f(a.pile.R)),
      '.',
    ]);
  if (a.note) items.push([`${who}: ${a.note}.`]);
  return items;
}

export function impactDoc(pr: ImpProblem, r: ImpResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const steps: Step[] = [];
  const SU = pr.byWeight ? 'кГ·с' : 'Н·с';
  const EU = pr.byWeight ? 'кГ·м' : 'Дж';
  const LU = 'м';
  const bodies: [ImpBody, BodyState, string | null][] = [
    [pr.b1, r.b1, r.pre1],
    [pr.b2, r.b2, r.pre2],
  ];
  // 1. Тела до удара.
  {
    const bl: Block[] = [{ k: 'p', c: ['Оси: x вправо, y вверх; углы — от оси x против часовой стрелки, ω > 0 — против часовой.'] }];
    bodies.forEach(([bd, st, pre], i) => {
      if (bd.kind === 'wall') {
        bl.push({ k: 'p', c: [b(nm(bd, i)), ' — неподвижная преграда (скорость равна нулю до и после удара).'] });
        return;
      }
      const lines: { num?: boolean; c: Inline[] }[] = [];
      lines.push({
        c: [
          v('m'),
          ` = ${pr.byWeight ? `${f(bd.m)}/${f(pr.g)} = ` : ''}${f(st.m)}; ${INERTIA[bd.inertia]}${bd.inertia === 'point' ? '' : `: J_C = ${f(st.JC)}`}${bd.kind === 'axis' ? `; J_O = J_C + m·OC² = ${f(st.JO)}` : ''}`,
        ],
      });
      lines.push({ c: [`центр масс C ${vec([bd.cx, bd.cy])}${bd.kind === 'axis' ? `, ось O ${vec([bd.ox, bd.oy])}` : ''}`] });
      lines.push({
        c:
          bd.kind === 'axis'
            ? ['до удара ω = ', b(`${f(st.w)} рад/с`), `, v_C = ω·k×OC = ${vec(st.v)} м/с`]
            : ['до удара v', sub('C'), ' = ', b(`${vec(st.v)} м/с`), bd.inertia === 'point' ? '' : `, ω = ${f(st.w)} рад/с`],
      });
      if (pre) lines.push({ c: [`(${pre})`] });
      bl.push({ k: 'p', c: [b(nm(bd, i)), ` — ${KIND[bd.kind]}:`] }, { k: 'eq', lines });
    });
    ex(
      bl,
      'Во время удара перемещения тел ничтожно малы, а скорости меняются конечно: обычные силы (тяжесть, пружины) за время удара импульса не дают — учитываются только ударные импульсы в точке контакта и в осях.',
    );
    steps.push({ title: 'Тела до удара', blocks: bl });
  }
  // 2. Условия удара.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['точка удара P ', vec(r.P), '; нормаль n = ', vec(r.n), ' (от тела 1 к телу 2), касательная t = ', vec(r.t)] },
      {
        c: [
          v('v'),
          sub('P'),
          ` тела 1 = ${vec(r.b1.vP)}, тела 2 = ${vec(r.b2.vP)}; сближение (v₂ − v₁)·n = `,
          b(f(r.rel0[0] * r.n[0] + r.rel0[1] * r.n[1])),
          ' м/с',
        ],
      },
    ];
    const eqs: Inline[][] = [];
    bodies.forEach(([bd], i) => {
      const S = i === 0 ? '−S' : 'S',
        Sx = i === 0 ? '(−S)' : 'S';
      if (bd.kind === 'free')
        eqs.push(
          bd.inertia === 'point'
            ? [`тело ${i + 1}: m(u`, sub('C'), ' − v', sub('C'), `) = ${S}`]
            : [`тело ${i + 1}: m(u`, sub('C'), ' − v', sub('C'), `) = ${S};  J`, sub('C'), `(ω′ − ω) = (P − C) × ${Sx}`],
        );
      if (bd.kind === 'axis') eqs.push([`тело ${i + 1}: J`, sub('O'), `(ω′ − ω) = (P − O) × ${Sx}  (импульс оси момента относительно O не даёт)`]);
    });
    const conds: Inline[] = pr.stick
      ? ['тело 1 остаётся в теле 2: скорости точки P после удара совпадают, u', sub('P2'), ' = u', sub('P1')]
      : pr.contact === 'rough'
        ? ['(u₂ − u₁)·n = −k(v₂ − v₁)·n и (u₂ − u₁)·t = 0 — контакт абсолютно шероховатый, проскальзывания нет']
        : ['(u₂ − u₁)·n = −k(v₂ − v₁)·n, S ∥ n — контакт гладкий'];
    const bl: Block[] = [
      { k: 'eq', lines },
      { k: 'p', c: ['Теоремы об изменении количества движения и кинетического момента при ударе:'] },
      { k: 'ul', items: eqs },
      { k: 'p', c: ['Условие удара (k = ', f(r.k), '): ', ...conds, '.'] },
    ];
    ex(
      bl,
      'Коэффициент восстановления k — отношение относительной нормальной скорости после удара к скорости до удара: k = 0 — неупругий удар, k = 1 — абсолютно упругий. Гладкий контакт не передаёт касательного импульса.',
    );
    steps.push({ title: 'Условия удара', blocks: bl });
  }
  // 3. Импульс и скорости после удара.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      {
        c: [
          'ударный импульс на тело 2: ',
          v('S'),
          ' = ',
          b(`${vec(r.S)} ${SU}`),
          `, |S| = ${f(Math.hypot(...r.S))}; S`,
          sub('n'),
          ` = ${f(r.Sn)}, S`,
          sub('t'),
          ` = ${f(r.St)}`,
        ],
      },
    ];
    bodies.forEach(([bd, st], i) => {
      if (bd.kind === 'wall') return;
      lines.push({
        c:
          bd.kind === 'axis'
            ? [
                `тело ${i + 1}: ω′ = ω + (P − O)×S/J`,
                sub('O'),
                ` = ${f(st.w)} + ${fp(st.w1 - st.w)} = `,
                b(`${f(st.w1)} рад/с`),
                `; u_C = ${vec(st.u)}, u_P = ${vec(st.uP)} м/с`,
              ]
            : [
                `тело ${i + 1}: u`,
                sub('C'),
                ' = v',
                sub('C'),
                ` ${i === 0 ? '−' : '+'} S/m = `,
                b(`${vec(st.u)} м/с`),
                ` (|u_C| = ${f(Math.hypot(...st.u))})`,
                bd.inertia === 'point' ? '' : `; ω′ = ${f(st.w1)} рад/с; u_P = ${vec(st.uP)}`,
              ],
      });
    });
    const rn = r.rel1[0] * r.n[0] + r.rel1[1] * r.n[1],
      r0 = r.rel0[0] * r.n[0] + r.rel0[1] * r.n[1];
    lines.push({
      c: [
        `проверка: (u₂ − u₁)·n = ${f(rn)} = −k·(${f(r0)})`,
        pr.contact === 'rough' || pr.stick ? `; (u₂ − u₁)·t = ${f(r.rel1[0] * r.t[0] + r.rel1[1] * r.t[1])}` : '',
      ],
    });
    const bl: Block[] = [{ k: 'eq', lines }];
    for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
    steps.push({ title: 'Ударный импульс и скорости после удара', blocks: bl });
  }
  // 4. Импульсы осей и центр удара.
  if (pr.b1.kind === 'axis' || pr.b2.kind === 'axis') {
    const items: Inline[][] = [];
    bodies.forEach(([bd, st], i) => {
      if (bd.kind !== 'axis' || !st.SO) return;
      items.push([
        `тело ${i + 1}: импульс оси S`,
        sub('O'),
        ' = m(u',
        sub('C'),
        ' − v',
        sub('C'),
        `) ${i === 0 ? '+' : '−'} S = `,
        b(`${vec(st.SO)} ${SU}`),
        `, |S_O| = ${f(Math.hypot(...st.SO))}`,
      ]);
      if (st.perc != null)
        items.push([
          `центр удара тела ${i + 1}: на прямой OC на расстоянии a = J`,
          sub('O'),
          '/(m·OC) = ',
          b(`${f(st.perc)} ${LU}`),
          ' от оси — удар, перпендикулярный OC и приложенный там, не передаётся на ось.',
        ]);
    });
    const bl: Block[] = [{ k: 'ul', items }];
    ex(bl, 'Импульс оси находим из теоремы об изменении количества движения тела: внешние ударные импульсы — импульс в точке удара и импульс оси.');
    steps.push({ title: 'Ударные импульсы в осях', blocks: bl });
  }
  // 5. Теорема Карно.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      {
        c: [
          'T',
          sub('0'),
          ` = ${f(r.T0)}, T`,
          sub('1'),
          ` = ${f(r.T1)} ${EU}; потеря ΔT = T₀ − T₁ = `,
          b(`${f(r.dT)} ${EU}`),
          ` (${f((100 * r.dT) / r.T0)} % энергии до удара)`,
        ],
      },
      { c: [`энергия потерянных скоростей T* = Σm(v − u)²/2 + ΣJ(ω − ω′)²/2 = ${f(r.Tlost)} ${EU}`] },
    ];
    if (r.k === 0)
      lines.push({ c: ['теорема Карно (неупругий удар): ΔT = T* — ', Math.abs(r.dT - r.Tlost) <= 1e-9 * (1 + r.T0) ? 'выполняется' : 'не выполняется'] });
    else if (pr.contact === 'smooth') lines.push({ c: [`при k = ${f(r.k)}: ΔT = (1 − k)/(1 + k)·T* = ${f(((1 - r.k) / (1 + r.k)) * r.Tlost)}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Теорема Карно: при неупругом ударе потерянная кинетическая энергия равна энергии, которую имела бы система, двигаясь с потерянными скоростями. Доля ΔT/T₀ при ковке — коэффициент полезного действия молота, а при забивке сваи она должна быть мала.',
    );
    steps.push({ title: 'Потеря кинетической энергии (теорема Карно)', blocks: bl });
  }
  // 6. После удара.
  {
    const items: Inline[][] = [];
    if (r.after1) items.push(...afterItems(pr, r.after1, 'тело 1', LU));
    if (r.after2) items.push(...afterItems(pr, r.after2, pr.stick ? 'тело 2 с телом 1' : 'тело 2', LU));
    if (items.length) {
      const bl: Block[] = [{ k: 'ul', items }];
      if (pr.stick) bl.push({ k: 'p', c: [`Тело 1 после удара — в точке ${vec(stuckAt(pr, r))}.`] });
      ex(bl, 'После удара снова действуют обычные силы; движение находим по теореме об изменении кинетической энергии.');
      steps.push({ title: 'Движение после удара', blocks: bl });
    }
  }
  // 7. Обратные задачи.
  if (r.v1 != null) {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          'Угловая скорость после удара линейно зависит от скорости тела 1: ω′ = a + b·v₁. По теореме об энергии находим ω′, при которой ',
          pr.target === 'tip' ? 'центр масс только доходит до положения над осью поворота (тело на грани опрокидывания)' : `тело отклоняется на ${f(pr.tVal)}°`,
          ', и отсюда v₁ = ',
          b(`${f(r.v1)} м/с`),
          pr.target === 'tip' ? ' — наименьшая скорость для опрокидывания.' : '.',
        ],
      },
    ];
    steps.push({ title: 'Скорость тела 1 до удара', blocks: bl });
  }
  if (r.kFound != null) {
    const c: Inline[] =
      pr.target === 'height'
        ? ['Скорость падения √(2gh₁), отскока √(2gh₂): k = u/v = √(h₂/h₁) = √(', f(pr.tVal), '/', f(pr.b1.h), ') = ', b(f(r.kFound))]
        : ['Гладкая плита не меняет касательную составляющую: u_t = v_t, u_n = k·v_n; tg β = u_t/u_n = tg α/k, k = tg α/tg β = ', b(f(r.kFound))];
    steps.push({ title: 'Коэффициент восстановления', blocks: [{ k: 'p', c }] });
  }
  // Ответ.
  const rows: AnswerRow[] = [];
  if (r.v1 != null)
    rows.push({
      kind: 'main',
      val: [v('v'), sub('1'), ` = ${f(r.v1)} м/с`],
      note: pr.target === 'tip' ? 'наименьшая для опрокидывания' : 'скорость тела 1 до удара',
    });
  if (r.kFound != null) rows.push({ kind: 'main', val: [`k = ${f(r.kFound)}`], note: 'коэффициент восстановления' });
  bodies.forEach(([bd, st], i) => {
    if (bd.kind === 'wall') return;
    if (bd.kind === 'axis') rows.push({ kind: 'main', val: [`ω′${i + 1} = ${f(st.w1)} рад/с`], note: `${nm(bd, i)} после удара` });
    else
      rows.push({
        kind: 'main',
        val: [v('u'), sub(String(i + 1)), ` = ${vec(st.u)} м/с`],
        note: `${nm(bd, i)}: |u| = ${f(Math.hypot(...st.u))}${bd.inertia === 'point' ? '' : `, ω′ = ${f(st.w1)}`}`,
      });
    if (st.SO) rows.push({ kind: 'aux', val: [v('S'), sub(`O${i + 1}`), ` = ${vec(st.SO)} ${SU}`], note: 'ударный импульс оси' });
  });
  rows.push({ kind: 'main', val: [v('S'), ` = ${vec(r.S)} ${SU}`], note: `ударный импульс на тело 2, |S| = ${f(Math.hypot(...r.S))}` });
  rows.push({ kind: 'aux', val: [`ΔT = ${f(r.dT)} ${EU}`], note: 'потеря энергии' });
  for (const [a, who] of [
    [r.after1, 'тело 1'],
    [r.after2, 'тело 2'],
  ] as const) {
    if (!a) continue;
    if (a.rise != null) rows.push({ kind: 'aux', val: [`h = ${f(a.rise)} м`], note: `${who}: подъём` });
    if (a.bounce) rows.push({ kind: 'aux', val: [`s = ${f(a.bounce.total)} м`], note: 'путь до остановки' });
    if (a.thread && !a.thread.full && !a.thread.slack) rows.push({ kind: 'aux', val: [`α = ${f(a.thread.alpha)}°`], note: `${who}: отклонение нити` });
    if (a.slide != null) rows.push({ kind: 'aux', val: [`s = ${f(a.slide)} м`], note: `${who}: путь скольжения` });
    if (a.swing) rows.push({ kind: 'aux', val: [a.swing.over ? 'опрокидывается' : `φ = ${f(a.swing.phi)}°`], note: `${who}: поворот после удара` });
    if (a.spring != null) rows.push({ kind: 'aux', val: [`s = ${f(a.spring)} м`], note: 'сжатие пружины' });
    if (a.pile) rows.push({ kind: 'aux', val: [`R = ${f(a.pile.R)}`], note: 'среднее сопротивление грунта' });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
