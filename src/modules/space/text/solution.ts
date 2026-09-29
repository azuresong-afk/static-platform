/**
 * Решение задачи 3 Антонова: пространственный брус-консоль. Реакции заделки, усилия по участкам (от свободного
 * конца), опасное сечение по гипотезе прочности, диаметр круга или кольца, ответ.
 */
import { join, sub, v, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { polyDegree, polyEval, polyReflect, type Poly } from '../../../shared/poly';
import { roman } from '../../frames/model/geometry';
import { ptName } from '../draw/axo';
import type { Axis, Frame3, Solution3 } from '../model/frame3d';

const f = (x: number, d = 3) => fmt(x, d);
const axName = (a: Axis, sign: number) => (sign < 0 ? '−' : '+') + a;

/** Многочлен от s: «25·s − 5·s²». */
function polyText(p: Poly, scale: number): Inline[] {
  const deg = polyDegree(p, scale);
  const r: Inline[] = [];
  for (let i = 0; i <= deg; i++) {
    const c = p[i] ?? 0;
    if (Math.abs(c) < 1e-9 * Math.max(1, scale)) continue;
    r.push(r.length ? (c < 0 ? ' − ' : ' + ') : c < 0 ? '−' : '');
    const a = Math.abs(c);
    if (i === 0) r.push(f(a));
    else {
      if (Math.abs(a - 1) > 1e-12) r.push(f(a), '·');
      r.push(v('s'));
      if (i > 1) r.push({ t: 'sup', text: String(i) });
    }
  }
  return r.length ? r : ['0'];
}

/** Где сечение: в точке или внутри участка. */
function whereText(sol: Solution3, seg: number, s: number): string {
  if (s < 1e-12) return `в точке ${ptName(seg)}`;
  if (Math.abs(s - sol.segs[seg].L) < 1e-12) return `в точке ${ptName(seg + 1)}`;
  return `на участке ${roman(seg)}, ${f(s)} м от ${ptName(seg)}`;
}

export function spaceDoc(fr: Frame3, sol: Solution3, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const n = fr.segs.length;
  const scale = Math.max(1, sol.danger.Meq, ...sol.R.map(Math.abs));

  // 1. Дано.
  {
    const items: Inline[][] = fr.segs.map((s, i) => [`участок ${roman(i)} (${ptName(i)}–${ptName(i + 1)}): вдоль ${axName(s.axis, s.sign)}, `, v('l'), ` = ${f(s.l)} м`]);
    for (const ld of fr.loads) {
      if (ld.kind === 'P') items.push([v('P'), ` = ${f(Math.abs(ld.v))} кН в точке ${ptName(ld.node)}, вдоль ${axName(ld.axis, ld.v)}`]);
      if (ld.kind === 'M') items.push([v('M'), ` = ${f(Math.abs(ld.v))} кН·м в точке ${ptName(ld.node)}, вектор момента вдоль ${axName(ld.axis, ld.v)}`]);
      if (ld.kind === 'q') items.push([v('q'), ` = ${f(Math.abs(ld.v))} кН/м на участке ${roman(ld.seg)}, вдоль ${axName(ld.axis, ld.v)}`]);
    }
    items.push([
      `заделка в точке ${ptName(0)}; сечение — ${fr.section === 'circle' ? 'круг' : `кольцо, d/D = ${f(fr.c, 2)}`}; [σ] = ${f(fr.sigma, 1)} МПа; расчёт по ${fr.hyp === 3 ? 'третьей' : 'четвёртой'} гипотезе прочности`,
    ]);
    const bl: Block[] = [{ k: 'ul', items }];
    ex(bl, 'Оси: x — вправо, y — вглубь рисунка, z — вверх. Момент пары изображён вектором (двойная стрелка): пара вращает против часовой стрелки, если смотреть с конца вектора.');
    steps.push({ title: 'Дано', blocks: bl });
  }

  // 2. Реакции (для проверки).
  steps.push({
    title: 'Реакции заделки',
    blocks: [
      {
        k: 'p',
        c: [
          'Брус — консоль: усилия удобно считать от свободного конца, реакции для этого не нужны. Для проверки: ',
          ...join(
            (['x', 'y', 'z'] as Axis[]).map((a, k) => [v('R'), sub(a), ' = ', f(sol.R[k])]),
            '; ',
          ),
          ' кН; ',
          ...join(
            (['x', 'y', 'z'] as Axis[]).map((a, k) => [v('M'), sub(a), ' = ', f(sol.MR[k])]),
            '; ',
          ),
          ' кН·м.',
        ],
      },
    ],
  });

  // 3. Усилия по участкам.
  {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          'В сечении участка рассматриваем свободную часть бруса (от сечения до конца ',
          ptName(n),
          '). Координата ',
          v('s'),
          ' отсчитывается от конца участка, ближнего к свободному концу. ',
          v('N'),
          ' — проекция сил на ось участка, ',
          v('Q'),
          ' — на поперечные оси; ',
          v('M'),
          sub('к'),
          ' — момент сил относительно оси участка (кручение), ',
          v('M'),
          ' с индексом оси — изгибающие моменты.',
        ],
      },
    ];
    ex(bl, 'Момент силы относительно оси равен произведению проекции силы на плоскость, перпендикулярную оси, на плечо до этой оси. Сила, параллельная оси или пересекающая её, момента относительно неё не создаёт.');
    steps.push({ title: 'Внутренние усилия: метод сечений', blocks: bl });
  }
  for (const sg of sol.segs) {
    const L = sg.L;
    const fromPt = ptName(sg.index + 1),
      toPt = ptName(sg.index);
    const rows: [Inline[], Poly][] = [
      [[v('N')], sg.N],
      ...sg.Q.map((c) => [[v('Q'), sub(c.axis)], c.poly] as [Inline[], Poly]),
      [[v('M'), sub('к')], sg.Mk],
      ...sg.Mb.map((c) => [[v('M'), sub(c.axis)], c.poly] as [Inline[], Poly]),
    ];
    const lines = rows.map(([name, p]) => {
      const q = polyReflect(p, L);
      return { c: [...name, '(', v('s'), ') = ', ...polyText(q, scale), `;   в ${fromPt}: ${f(polyEval(q, 0))},  в ${toPt}: ${f(polyEval(q, L))}`] as Inline[] };
    });
    const bl: Block[] = [
      { k: 'p', c: [`Ось участка — ${axName(sg.axis, sg.sign)}; `, v('s'), ` от ${fromPt} к ${toPt}, 0 ≤ `, v('s'), ` ≤ ${f(L)} м. Силы — кН, моменты — кН·м.`] },
      { k: 'eq', lines },
    ];
    ex(bl, `Кручение на этом участке создают моменты относительно оси ${sg.axis}, изгиб — моменты относительно осей ${sg.Mb.map((c) => c.axis).join(' и ')}.`);
    steps.push({ title: `Участок ${roman(sg.index)}: ${toPt}–${fromPt}`, blocks: bl });
  }

  // 4. Опасное сечение.
  {
    const items: Inline[][] = [];
    const seen = new Set<string>();
    for (const sg of sol.segs)
      for (const e of sg.eq) {
        const [m1, m2] = sg.Mb.map((c) => polyEval(c.poly, e.s));
        const mk = polyEval(sg.Mk, e.s);
        // Общая точка соседних участков с теми же значениями — одной строкой.
        const key = `${whereText(sol, sg.index, e.s)}|${f(e.v)}|${f(Math.abs(mk))}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push([`${whereText(sol, sg.index, e.s)}: `, v('M'), sub(sg.Mb[0].axis), ` = ${f(m1)}, `, v('M'), sub(sg.Mb[1].axis), ` = ${f(m2)}, `, v('M'), sub('к'), ` = ${f(mk)} → `, v('M'), sub('экв'), ` = ${f(e.v)}`]);
      }
    const d = sol.danger;
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          fr.hyp === 3 ? 'По третьей гипотезе прочности (наибольших касательных напряжений) ' : 'По четвёртой (энергетической) гипотезе прочности ',
          v('M'),
          sub('экв'),
          fr.hyp === 3 ? ' = √(M₁² + M₂² + M_к²)' : ' = √(M₁² + M₂² + 0,75·M_к²)',
          ', где M₁, M₂ — изгибающие моменты в сечении. Сравниваем характерные сечения:',
        ],
      },
      { k: 'ul', items },
      { k: 'p', c: ['Опасное сечение — ', whereText(sol, d.seg, d.s), ': ', v('M'), sub('экв'), ` = ${f(d.Meq)} кН·м.`] },
    ];
    ex(
      bl,
      'Для круглого сечения σ = M_изг/W и τ = M_к/W_p, где W_p = 2W. Третья гипотеза: σ_экв = √(σ² + 4τ²) = √(M_изг² + M_к²)/W. Суммарный изгибающий момент — геометрическая сумма M₁ и M₂: у круга любая ось — главная. Продольной и поперечными силами при подборе пренебрегаем, их вклад мал.',
    );
    steps.push({ title: 'Опасное сечение', blocks: bl });
  }

  // 5. Размер сечения.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [v('σ'), sub('экв'), ' = ', v('M'), sub('экв'), '/', v('W'), ' ≤ [σ]  ⇒  ', v('W'), ' ≥ ', v('M'), sub('экв'), '/[σ] = ', f(sol.danger.Meq), '·10³/', f(fr.sigma, 1), ' = ', f(sol.Wreq, 2), ' см³'] },
    ];
    if (fr.section === 'circle') lines.push({ c: [v('W'), ' = π·', v('d'), { t: 'sup', text: '3' }, '/32  ⇒  ', v('d'), ' ≥ ∛(32·', v('W'), '/π) = ', f(sol.size.calc), ' см'] });
    else
      lines.push({
        c: [v('W'), ' = π·', v('D'), { t: 'sup', text: '3' }, '·(1 − ', v('c'), { t: 'sup', text: '4' }, ')/32  ⇒  ', v('D'), ' ≥ ∛(32·', v('W'), '/(π·(1 − ', f(fr.c, 2), '⁴))) = ', f(sol.size.calc), ' см'],
      });
    const okText = sol.sigmaEq <= fr.sigma + 1e-9 ? ' ≤ [σ].' : ' > [σ] — увеличьте размер.';
    const bl: Block[] = [
      { k: 'eq', lines },
      {
        k: 'p',
        c:
          fr.section === 'circle'
            ? ['Принимаем ', v('d'), ` = ${fmt(sol.size.D * 10, 1)} мм. `, v('W'), ` = ${f(sol.W, 2)} см³, σ`, sub('экв'), ` = ${f(sol.sigmaEq, 2)} МПа${okText}`]
            : ['Принимаем ', v('D'), ` = ${fmt(sol.size.D * 10, 1)} мм, `, v('d'), ` = ${fmt(sol.size.d * 10, 1)} мм. `, v('W'), ` = π·(D⁴ − d⁴)/(32·D) = ${f(sol.W, 2)} см³, σ`, sub('экв'), ` = ${f(sol.sigmaEq, 2)} МПа${okText}`],
      },
    ];
    ex(bl, 'Диаметр округляем вверх до целого миллиметра; внутренний диаметр кольца — вниз, чтобы стенка не стала тоньше расчётной.');
    steps.push({ title: 'Размер сечения', blocks: bl });
  }

  steps.push({
    title: 'Ответ',
    blocks: [
      {
        k: 'answer',
        rows: [
          { kind: 'main', val: [v('M'), sub('экв'), ` = ${f(sol.danger.Meq)} кН·м`], note: 'в опасном сечении' },
          fr.section === 'circle'
            ? { kind: 'main', val: [v('d'), ` = ${fmt(sol.size.D * 10, 1)} мм`], note: 'круглое сечение' }
            : { kind: 'main', val: [v('D'), ` = ${fmt(sol.size.D * 10, 1)} мм, `, v('d'), ` = ${fmt(sol.size.d * 10, 1)} мм`], note: 'кольцевое сечение' },
        ],
      },
    ],
  });
  return { steps };
}
