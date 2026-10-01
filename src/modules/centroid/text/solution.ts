/** Решение: разбиение на части (вырезы — со знаком «−»), площади и центры частей, формулы координат центра тяжести. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { KIND_NAME, type CProblem, type CentroidResult } from '../model/centroid';

const f = (x: number) => fmt(x, 3);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const SYM = { area: 'A', line: 'L', volume: 'V', mass: 'G' } as const;
const UNIT = { area: 'площадь', line: 'длина', volume: 'объём', mass: 'вес' } as const;

export function centroidDoc(pr: CProblem, r: CentroidResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const weighted = pr.parts.some((q) => Math.abs(q.k - 1) > 1e-12);
  const L = weighted ? 'P' : SYM[pr.mode];
  const axes = r.is3d ? (['x', 'y', 'z'] as const) : (['x', 'y'] as const);

  // 1. Части.
  {
    const items: Inline[][] = pr.parts.map((q, i) => {
      const p = r.parts[i];
      const n = String(i + 1);
      const head: Inline[] = [`${n}. ${KIND_NAME[q.kind]}${q.s < 0 ? ' (вырез)' : ''}: `];
      const meas: Inline[] = [v(SYM[pr.mode]), sub(n), ` = ${q.s < 0 ? '−' : ''}${f(p.m)}`];
      const wgt: Inline[] = weighted ? ['; удельный вес ', v('k'), sub(n), ` = ${f(q.k)}, `, v('P'), sub(n), ' = ', v('k'), sub(n), v(SYM[pr.mode]), sub(n), ` = ${f(p.w)}`] : [];
      const c: Inline[] = ['; центр тяжести ', v('C'), sub(n), ` (${axes.map((_, j) => f(p.c[j])).join('; ')})`];
      return [...head, ...meas, ...wgt, ...c, ` — ${p.how}.`];
    });
    const bl: Block[] = [{ k: 'p', c: [`Разбиваем ${pr.mode === 'mass' ? 'систему' : 'фигуру'} на части, для которых ${UNIT[pr.mode]} и положение центра тяжести известны:`] }, { k: 'ul', items }];
    ex(
      bl,
      'Вырезанную часть учитываем как часть с отрицательной площадью (объёмом): так фигура с отверстием — это целая фигура минус отверстие (метод отрицательных площадей). ',
      'Если у фигуры есть ось симметрии, центр тяжести лежит на ней — соответствующую координату можно не считать.',
    );
    steps.push({ title: 'Разбиваем на части', blocks: bl });
  }

  // 2. Координаты.
  if (!r.c) {
    steps.push({ title: 'Центр тяжести', blocks: [{ k: 'badge', tone: 'bad', text: 'суммарная площадь (вес) равна нулю' }, { k: 'p', c: ['Проверьте части: вырезы не могут быть больше самой фигуры.'] }] });
    return { steps };
  }
  {
    const lines = [
      { c: [v(L), ' = Σ', v(L), sub('i'), ' = ', r.parts.map((p, i) => (i ? (p.w < 0 ? ' − ' : ' + ') : p.w < 0 ? '−' : '') + f(Math.abs(p.w))).join(''), ' = ', b(f(r.M))] },
      ...axes.map((a, j) => ({
        c: [v(a), sub('C'), ' = Σ', v(L), sub('i'), v(a), sub('i'), '/', v(L), ' = (', r.parts.map((p, i) => (i ? (p.w < 0 ? ' − ' : ' + ') : p.w < 0 ? '−' : '') + `${f(Math.abs(p.w))}·${fp(p.c[j])}`).join(''), `)/${f(r.M)} = `, b(f(r.c![j]))] as Inline[],
      })),
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Координата центра тяжести — среднее координат центров частей, взвешенное по их площадям (длинам, объёмам, весам): это следует из теоремы Вариньона о моменте равнодействующей сил тяжести.');
    steps.push({ title: 'Координаты центра тяжести', blocks: bl });
  }
  const rows: AnswerRow[] = axes.map((a, j) => ({ kind: 'main', val: [v(a), sub('C'), ` = ${f(r.c![j])}`], note: '' }));
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
