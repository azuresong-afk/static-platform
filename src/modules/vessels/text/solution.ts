/** Решение: геометрия и нагрузка, σ_m из равновесия, σ_t из уравнения Лапласа, толщина стенки по III гипотезе. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { segHeight, type MeridianPt, type VesselProblem, type VesselResult } from '../model/vessel';

const f = (x: number) => fmt(x, 4);
const KIND: Record<string, string> = { cyl: 'цилиндр', cone: 'конус', sph: 'сферический сегмент', ell: 'эллиптическое днище' };
/** Напряжение при найденной толщине, МПа. */
const S = (N: number, d: number) => (d > 0 ? N / d : 0);

export function vesselDoc(pr: VesselProblem, r: VesselResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  const d = r.delta;
  {
    const lines: { c: Inline[] }[] = pr.segs.map((s, i) => {
      const g = r.segs[i];
      const extra = s.kind === 'cone' ? `, половина угла при вершине ${f(s.p)}°` : s.kind === 'sph' ? `, радиус сферы ${f(s.p)} м` : s.kind === 'ell' ? `, высота днища ${f(s.h)} м` : '';
      return { c: [`${i + 1}. ${KIND[s.kind]}: z от ${f(g.z0)} до ${f(g.z1)} м (высота ${f(segHeight(s))}), r от ${f(g.rb)} до ${f(g.rt)} м${extra}`] };
    });
    lines.push({ c: [`высота сосуда ${f(r.height)} м, объём ${f(r.volume)} м³`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    for (const w of r.warnings) bl.push({ k: 'badge', tone: 'warn', text: w });
    ex(bl, 'z отсчитывается от низа сосуда вверх. Толщина стенки мала по сравнению с радиусами — оболочка считается безмоментной: изгиб у стыков участков не учитывается.');
    steps.push({ title: 'Сосуд', blocks: bl });
  }
  {
    const gam = (pr.rho * pr.g) / 1e6;
    const lines: { c: Inline[] }[] = [
      { c: [v('p'), `(z) = p`, sub('г'), ` + ρg(z`, sub('ж'), ` − z) = ${f(pr.pg)} + ${f(gam)}·(${f(pr.level)} − z) МПа при z < z`, sub('ж'), `; выше уровня — ${f(pr.pg)} МПа`] },
      { c: [`вес жидкости G = ρg·V`, sub('ж'), ` = `, b(f(r.G)), ` МН; ${pr.support === 'ground' ? 'сосуд опирается на основание (z = 0)' : `опорная реакция лап на высоте ${f(pr.zs)} м: R = G`}`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Давление газа уравновешено внутри сосуда, поэтому реакция опор равна весу жидкости (собственный вес стенок не учитываем).');
    steps.push({ title: 'Нагрузка', blocks: bl });
  }
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['σ', sub('m'), '·δ·2πr·sin β = p(z)·πr² + G', sub('ниже'), ' − R', sub('ниже'), ' (равновесие части сосуда ниже сечения)'] },
          { c: ['σ', sub('m'), '/ρ', sub('m'), ' + σ', sub('t'), '/ρ', sub('t'), ' = p/δ, ρ', sub('t'), ' = r/sin β (уравнение Лапласа)'] },
        ],
      },
    ];
    ex(bl, 'β — угол между нормалью к стенке и осью сосуда (у цилиндра 90°, у конуса 90° − α). Для цилиндра и конуса ρ_m = ∞, у сферы ρ_m = ρ_t = R. Ниже — усилия на единицу длины N = σ·δ (МН/м) и напряжения при найденной толщине.');
    const rows: { c: Inline[] }[] = [];
    pr.segs.forEach((_, i) => {
      const ps = r.pts.filter((q) => q.seg === i);
      const show: MeridianPt[] = [ps[0], ps[ps.length - 1]];
      for (const key of ['Nt', 'Nm'] as const) {
        const m = ps.reduce((a, q) => (Math.abs(q[key]) > Math.abs(a[key]) ? q : a));
        if (!show.includes(m)) show.push(m);
      }
      show.sort((a, c) => a.z - c.z);
      rows.push({ c: [b(`Участок ${i + 1} (${KIND[pr.segs[i].kind]})`)] });
      for (const q of show) rows.push({ c: [`z = ${f(q.z)}: r = ${f(q.r)}, p = ${f(q.p)};  N`, sub('m'), ` = ${f(q.Nm)}, N`, sub('t'), ` = ${f(q.Nt)} МН/м;  σ`, sub('m'), ` = ${f(S(q.Nm, d))}, σ`, sub('t'), ` = ${f(S(q.Nt, d))} МПа`] });
    });
    bl.push({ k: 'eq', lines: rows });
    steps.push({ title: 'Меридиональные и окружные напряжения', blocks: bl });
  }
  {
    const c = r.crit!;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['σ', sub('экв'), ' = σ₁ − σ₃ (σ', sub('r'), ' ≈ 0): наибольшее при z = ', f(c.z), ' м: N', sub('экв'), ` = ${f(c.Neq)} МН/м`] },
          { c: ['δ = N', sub('экв'), '/[σ] = ', `${f(c.Neq)}/${f(pr.sigma)} = `, b(`${f(d * 1000)} мм`), d > 0 ? ` → принимаем ${Math.ceil(d * 1000 - 1e-9)} мм` : ''] },
        ],
      },
    ];
    ex(bl, 'По III гипотезе (наибольших касательных напряжений) σ_экв = σ₁ − σ₃ ≤ [σ]; главные напряжения — σ_t, σ_m и радиальное ≈ 0. Если σ_t и σ_m одного знака, σ_экв равно большему из них по модулю; разных знаков — их разности. Прибавка на коррозию не учитывается.');
    steps.push({ title: 'Толщина стенки по III гипотезе', blocks: bl });
  }
  const c = r.crit!;
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`δ = ${f(d * 1000)} мм`], note: `опасное сечение z = ${f(c.z)} м` },
    { kind: 'aux', val: [`σ`, sub('t max'), ` = ${f(Math.max(...r.pts.map((q) => S(q.Nt, d))))} МПа, σ`, sub('m max'), ` = ${f(Math.max(...r.pts.map((q) => S(q.Nm, d))))} МПа`], note: 'при найденной толщине' },
    { kind: 'aux', val: [`G = ${f(r.G)} МН`], note: 'вес жидкости' },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
