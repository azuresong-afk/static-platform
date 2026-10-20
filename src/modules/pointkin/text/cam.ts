/** Решение: кулачки (Мещерский §14.15–14.19) — контур и закон движения толкателя. */
import { b, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { fmtPi } from '../../../shared/integ';
import type { CamRot, CamTrans } from '../model/cam';
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

export function camRotDoc(_pr: KinProblem, r: CamRot, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  const law = r.input === 'law';
  {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          `Кулак вращается равномерно: ${law ? `один оборот за T = ${f(r.T)} с` : `${f(r.rpm)} об/мин, T = 60/n = ${f(r.T)} с`}, ω = 2π/T = ${f(r.omega)} рад/с, φ = ωt. Ось толкателя проходит через ось вращения O; конец толкателя лежит на контуре, поэтому его расстояние от оси x = r(φ).`,
        ],
      },
      { k: 'eq', lines: (law ? r.lawText : r.profText).map((t) => ({ c: [t] })) },
    ];
    ex(
      opts,
      bl,
      'Закон движения толкателя x(t) и уравнение контура r(φ) — одна функция в разных переменных: x(t) = r(ωt). Движение повторяется каждые T секунд.',
    );
    steps.push({ title: law ? 'Закон движения толкателя' : 'Уравнение контура', blocks: bl });
  }
  steps.push({
    title: law ? 'Уравнение контура' : 'Закон движения толкателя',
    blocks: [
      { k: 'eq', lines: (law ? r.profText : r.lawText).map((t) => ({ c: [t] })) },
      { k: 'p', c: [law ? 'Подстановка t = φ/ω = Tφ/(2π).' : 'Подстановка φ = ωt.'] },
    ],
  });
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [`наименьшее r = ${f(r.rMin)}, наибольшее r = ${f(r.rMax)};  ход толкателя h = ${f(r.stroke)}`] },
          { c: [`в момент t = ${f(r.at.t)} с (φ = ${f((r.at.phi * 180) / Math.PI)}°):  x = ${f(r.at.x)},  v = ẋ = ${f(r.at.v)},  w = ẍ = ${f(r.at.a)}`] },
        ],
      },
    ];
    for (const j of r.jumps)
      bl.push({
        k: 'p',
        c: [
          `При φ = ${fmtPi(j.phi)} контур имеет скачок: r меняется с ${f(j.from)} на ${f(j.to)} — толкатель при этом возвращается (или перескакивает) мгновенно, скорость в этот момент не определена.`,
        ],
      });
    steps.push({ title: 'Ход и состояние толкателя', blocks: bl });
  }
  const rows: AnswerRow[] = (law ? r.profText : r.lawText).map((t, i) => ({
    kind: 'main' as const,
    val: [t],
    note: law ? `контур, участок ${i + 1}` : `закон, участок ${i + 1}`,
  }));
  rows.push({ kind: 'aux', val: [`h = ${f(r.stroke)}`], note: 'ход толкателя' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function camTransDoc(_pr: KinProblem, r: CamTrans, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const steps: Step[] = [];
  const bl: Block[] = [
    {
      k: 'p',
      c: [
        `Кулак — круг радиуса r = ${f(r.r)}, движется поступательно: сдвиг центра u(t) = u₀ + vt + wt²/2. Толкатель вертикален, проходит через начальное положение центра и касается круга сверху. По теореме Пифагора расстояние от центра круга до точки касания по вертикали равно √(r² − u²), поэтому опускание`,
      ],
    },
    { k: 'eq', lines: [{ c: ['h = r − √(r² − u²)'] }] },
  ];
  ex(opts, bl, 'В наивысшем положении центр круга лежит на оси толкателя (u = 0, h = 0). Когда u = r, толкатель сходит с круга: h = r.');
  steps.push({ title: 'Опускание толкателя', blocks: bl });
  if (r.find === 'w') {
    steps.push({
      title: 'Ускорение кулака',
      blocks: [
        {
          k: 'eq',
          lines: [
            { c: [`h = ${f(r.hGiven!)} за t = ${f(r.t)} с  ⇒  u = √(r² − (r − h)²) = ${f(r.u)}`] },
            { c: [`u = u₀ + vt + wt²/2  ⇒  w = 2(u − u₀ − vt)/t² = `, b(f(r.w))] },
          ],
        },
      ],
    });
  } else
    steps.push({
      title: `Состояние при t = ${f(r.t)} с`,
      blocks: [
        {
          k: 'eq',
          lines: [
            { c: [`u = ${f(r.u0)} + ${f(r.v)}·${f(r.t)} + ${f(r.w)}·${f(r.t)}²/2 = ${f(r.u)}`] },
            { c: ['h = ', f(r.r), ' − √(', f(r.r), '² − ', f(r.u), '²) = ', b(f(r.h))] },
            {
              c: [
                `скорость толкателя ḣ = uu̇/√(r² − u²) = ${Number.isFinite(r.hv) ? f(r.hv) : '∞ (u = r)'};  ускорение ḧ = (u̇² + uü)/√(r² − u²) + u²u̇²/(r² − u²)^{3/2} = ${Number.isFinite(r.ha) ? f(r.ha) : '∞'}`,
              ],
            },
          ],
        },
      ],
    });
  const rows: AnswerRow[] =
    r.find === 'w'
      ? [{ kind: 'main', val: [v('w'), ` = ${f(r.w)}`], note: 'ускорение кулака' }]
      : [
          { kind: 'main', val: [v('h'), ` = ${f(r.h)}`], note: `опускание толкателя за t = ${f(r.t)} с` },
          {
            kind: 'aux',
            val: [`ḣ = ${Number.isFinite(r.hv) ? f(r.hv) : '∞'}, ḧ = ${Number.isFinite(r.ha) ? f(r.ha) : '∞'}`],
            note: 'скорость и ускорение толкателя',
          },
        ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
