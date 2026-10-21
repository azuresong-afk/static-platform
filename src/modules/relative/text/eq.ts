/** Решение: уравнения сложного движения и траектория (Мещерский §21). */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { trajStep } from '../../pointkin/text/solution';
import type { EqProblem, EqResult } from '../model/eq';

const f = (x: number) => fmt(x, 4);
const AX_ABS = ['x', 'y', 'z'],
  AX_REL = ['ξ', 'η', 'ζ'];

export function eqDoc(p: EqProblem, r: EqResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok)
    return {
      steps: [
        {
          title: 'Данные',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'ul', items: r.errors.map((x) => [x]) },
          ],
        },
      ],
    };
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const A = p.dir === 'abs' ? AX_REL : AX_ABS,
    B = p.dir === 'abs' ? AX_ABS : AX_REL;
  const lines = (names: string[], q: [string, string, string]) =>
    names.map((n, i) => ({ c: [v(n), `(t) = ${q[i]}`] as Inline[] })).filter((_, i) => i < 2 || q[i] !== '0');
  {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          p.dir === 'abs'
            ? 'Задано относительное движение точки по подвижным осям ξηζ; найти абсолютное движение и траекторию.'
            : 'Задано абсолютное движение точки; найти относительное движение (по подвижным осям) и траекторию.',
        ],
      },
      { k: 'eq', lines: lines(A, r.given) },
      {
        k: 'p',
        c: [
          'Переносное движение: начало подвижных осей — ',
          b(`x = ${p.X0 || '0'}, y = ${p.Y0 || '0'}${p.Z0.trim() ? `, z = ${p.Z0}` : ''}`),
          p.phi.trim() && p.phi.trim() !== '0' ? [', оси повёрнуты на угол ', v('φ'), ` = ${p.phi}`] : ', оси не поворачиваются (поступательное движение)',
          '.',
        ].flat() as Inline[],
      },
    ];
    steps.push({ title: 'Данные', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (p.dir === 'abs')
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('x'), ' = ', v('X'), sub('0'), ' + ', v('ξ'), ' cos ', v('φ'), ' − ', v('η'), ' sin ', v('φ')] },
          { c: [v('y'), ' = ', v('Y'), sub('0'), ' + ', v('ξ'), ' sin ', v('φ'), ' + ', v('η'), ' cos ', v('φ')] },
          { c: [v('z'), ' = ', v('Z'), sub('0'), ' + ', v('ζ')] },
        ],
      });
    else
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('ξ'), ' = (', v('x'), ' − ', v('X'), sub('0'), ') cos ', v('φ'), ' + (', v('y'), ' − ', v('Y'), sub('0'), ') sin ', v('φ')] },
          { c: [v('η'), ' = −(', v('x'), ' − ', v('X'), sub('0'), ') sin ', v('φ'), ' + (', v('y'), ' − ', v('Y'), sub('0'), ') cos ', v('φ')] },
          { c: [v('ζ'), ' = ', v('z'), ' − ', v('Z'), sub('0')] },
        ],
      });
    ex(
      bl,
      p.dir === 'abs'
        ? 'Абсолютные координаты — положение начала подвижных осей плюс координаты точки, повёрнутые на угол φ.'
        : 'Относительные координаты — разность абсолютных координат точки и начала подвижных осей, спроектированная на повёрнутые оси.',
    );
    steps.push({ title: 'Формулы перехода', blocks: bl });
  }
  steps.push({ title: p.dir === 'abs' ? 'Абсолютное движение' : 'Относительное движение', blocks: [{ k: 'eq', lines: lines(B, r.found) }] });
  if (r.traj) steps.push(trajStep(r.kp, r.traj, opts));
  if (r.explicit) {
    const bl: Block[] = [{ k: 'eq', lines: [{ c: [v(B[1]), ' = ', b(r.explicit)] }] }];
    ex(bl, 'Координата ', v(B[0]), ' линейна по t — выражаем t через ', v(B[0]), ' и подставляем во вторую формулу.');
    steps.push({ title: 'Траектория явно', blocks: bl });
  }
  if (r.polar) {
    const bl: Block[] = [{ k: 'eq', lines: [{ c: [b(r.polar.text), ' — спираль Архимеда'] }] }];
    ex(bl, 'Расстояние точки от оси вращения r = ξ(t) растёт пропорционально углу поворота φ: исключаем t из ξ = c₁t + c₀ и φ = αt + β.');
    steps.push({ title: 'Траектория в полярных координатах', blocks: bl });
  }
  {
    const lns = B.slice(0, 3)
      .map((n, i) => ({ c: [v(n), ` = ${f(r.foundAt[i])}`] as Inline[] }))
      .filter((_, i) => i < 2 || r.foundAt[2] !== 0);
    steps.push({ title: `Положение при t = ${f(p.t)}`, blocks: [{ k: 'eq', lines: lns }] });
  }
  {
    const rows: AnswerRow[] = [];
    if (r.traj)
      for (const q of r.traj.rels)
        rows.push({ kind: 'main', val: [`траектория${r.traj.dims === 3 ? ` (${q.a}${q.b})` : ''}: `, b(q.explicit ?? q.text)], note: q.kind });
    if (r.explicit) rows.push({ kind: 'main', val: ['траектория: ', b(`${B[1]} = ${r.explicit}`)], note: 'подстановкой t' });
    if (r.polar) rows.push({ kind: 'main', val: ['траектория: ', b(r.polar.text)], note: 'спираль Архимеда' });
    B.forEach((n, i) => {
      if (i < 2 || r.foundAt[2] !== 0) rows.push({ kind: 'aux', val: [v(n), ` = ${f(r.foundAt[i])}`], note: `при t = ${f(p.t)}` });
    });
    steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  }
  return { steps };
}
