/** Решение: ω и ε тела по ускорениям двух точек (метод полюса), ускорения остальных точек, мгновенный центр ускорений. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { Acc2Problem, Acc2Result } from '../model/acc2';

const f = (x: number) => fmt(x, 4);
const vec = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;

export function acc2Doc(pr: Acc2Problem, r: Acc2Result, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const A = r.pts[0],
    B = r.pts[1];
  const steps: Step[] = [];
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          ...r.pts.map((p) => ({ c: [`${p.name} ${vec(p.pos)}`, p.given ? `;  a${p.name} = ${f(p.mag)} под углом ${f(p.ang)}° к оси x: ${vec(p.acc)}` : ''] as Inline[] })),
        ],
      },
    ];
    steps.push({ title: 'Данные', blocks: bl });
  }
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [v('a'), sub(B.name), ' = ', v('a'), sub(A.name), ' + ε × ', `${A.name}${B.name} − ω²·${A.name}${B.name}`] },
          { c: [`${A.name}${B.name} = ${vec(r.ab)},  L = ${f(r.L)};  a${B.name} − a${A.name} = ${vec(r.d)}`] },
          { c: ['вдоль ', `${A.name}${B.name}`, `:  −ω²L = ${f(r.dAlong)}  ⇒  ω² = `, b(f(r.w2)), ',  ω = ', b(f(r.w)), ' с⁻¹'] },
          { c: ['поперёк ', `${A.name}${B.name}`, `:  εL = ${f(r.dPerp)}  ⇒  ε = `, b(f(r.eps)), r.eps === 0 ? '' : ` с⁻² (${r.eps > 0 ? 'против' : 'по'} часовой стрелки)`] },
        ],
      },
    ];
    ex(bl, 'Ускорение точки B относительно полюса A складывается из вращательного ε×AB (перпендикулярно AB) и осестремительного −ω²·AB (вдоль BA). Поэтому проекция разности ускорений на AB даёт ω², а на перпендикуляр — ε. Знак ω по ускорениям не определяется (ω входит в квадрате).');
    steps.push({ title: 'Угловая скорость и угловое ускорение', blocks: bl });
  }
  if (r.pts.length > 2) {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: r.pts.slice(2).map((p) => ({ c: [v('a'), sub(p.name), ` = a${A.name} + ε × ${A.name}${p.name} − ω²·${A.name}${p.name} = ${vec(p.acc)},  |a${p.name}| = `, b(f(p.mag)), `,  угол с осью x ${f(p.ang)}°`] as Inline[] })),
      },
    ];
    steps.push({ title: 'Ускорения остальных точек', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (r.ica) {
      bl.push({
        k: 'eq',
        lines: [
          { c: ['мгновенный центр ускорений Q: a', sub('Q'), ` = 0  ⇒  Q = ${vec(r.ica)}`] },
          { c: [`ускорение каждой точки составляет с направлением на Q угол μ: tg μ = |ε|/ω² = ${f(Math.abs(r.eps))}/${f(r.w2)},  μ = `, b(`${f(r.mu!)}°`), ';  a = AQ·√(ε² + ω⁴)'] },
        ],
      });
      ex(bl, 'В мгновенном центре ускорений ускорение точки равно нулю; ускорения остальных точек пропорциональны расстояниям до него и одинаково наклонены (на угол μ) к отрезкам, соединяющим точки с Q.');
    } else bl.push({ k: 'p', c: ['ω = ε = 0: тело движется мгновенно-поступательно, ускорения всех точек равны, мгновенного центра ускорений нет.'] });
    steps.push({ title: 'Мгновенный центр ускорений', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`ω = ${f(r.w)} с⁻¹`, `,  ε = ${f(Math.abs(r.eps))} с⁻²`], note: r.eps === 0 ? 'ε = 0' : `ε направлено ${r.eps > 0 ? 'против' : 'по'} часовой стрелки` },
    ...r.pts.slice(2).map((p) => ({ kind: 'main' as const, val: [v('a'), sub(p.name), ` = ${f(p.mag)}`], note: `под углом ${f(p.ang)}° к оси x` })),
  ];
  if (r.ica) rows.push({ kind: 'aux', val: [`Q = ${vec(r.ica)}`], note: 'мгновенный центр ускорений' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  void pr;
  return { steps };
}
