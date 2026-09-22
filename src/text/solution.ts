/**
 * Пошаговое решение в стиле решебника (перенос renderSolution() прототипа).
 * При explain = false текст совпадает с прототипом символ в символ (проверяется golden-тестами).
 * При explain = true добавляются пояснения к ходу решения (абзацы с классом explain);
 * числа, уравнения и правила знаков при этом не меняются.
 */
import { LOADDIR, SIDES, TYPES } from '../model/constants';
import { fmt } from '../model/format';
import type { ForceItem } from '../model/types';
import { checkPasses } from '../solver/check';
import type { Eq, Term } from '../solver/equations';
import type { Model, Unknown } from '../solver/model';
import type { Solution } from '../solver/solve';
import { b, join, sub, sym, v, type AnswerRow, type Block, type Doc, type Inline } from './doc';
import { STATUS, STATUS_TONE, forceDirText } from './labels';

export interface SolutionOptions {
  /** Искомые, отмеченные как промежуточные («что найти» снято). */
  notTarget?: ReadonlySet<string>;
  /** Подробные пояснения к ходу решения. */
  explain?: boolean;
}

const unitOf = (o: { kind: string }) => (o.kind === 'm' ? 'кН·м' : 'кН');

/** Обозначение уравнения: ΣFkx, ΣFky, ΣMA. */
export function eqName(e: Pick<Eq, 'type' | 'P'>): Inline[] {
  if (e.type === 'x') return ['Σ', v('F'), sub('kx')];
  if (e.type === 'y') return ['Σ', v('F'), sub('ky')];
  return ['Σ', v('M'), sub(e.P || '')];
}

/** Слагаемое в буквенной записи: F·sin 60°·2. */
export function termInline(t: Term): Inline[] {
  const r: Inline[] = [sym(t.sym)];
  if (t.trig) r.push(`·${t.trig.fn} ${fmt(t.trig.deg, 2)}°`);
  if (t.arm != null) r.push('·' + fmt(t.arm));
  return r;
}

/** Буквенная запись уравнения: ΣMA = −F·sin 60°·2 + … = 0. */
export function eqSym(e: Eq): Inline[] {
  if (!e.terms.length) return [...eqName(e), ' = 0'];
  const r: Inline[] = [...eqName(e), ' = '];
  e.terms.forEach((t, i) => {
    r.push(i === 0 ? (t.c < 0 ? '−' : '') : t.c < 0 ? ' − ' : ' + ');
    r.push(...termInline(t));
  });
  r.push(' = 0');
  return r;
}

/** Численная подстановка левой части: известные слагаемые — числами, неизвестные — с коэффициентом. */
export function lhsNum(e: Eq, vals: Record<string, number>, m: Model): Inline[] {
  const parts: { neg: boolean; s: Inline[] }[] = [];
  for (const t of e.terms) {
    if (t.key && !(t.key in vals)) {
      const a = Math.abs(t.c);
      parts.push({ neg: t.c < 0, s: [Math.abs(a - 1) < 1e-9 ? '' : fmt(a) + '·', sym(m.byKey[t.key])] });
    } else {
      const val = t.key ? t.c * vals[t.key] : t.c * (t.val as number);
      if (Math.abs(val) < 1e-12) continue;
      parts.push({ neg: val < 0, s: [fmt(Math.abs(val))] });
    }
  }
  if (!parts.length) return ['0'];
  const r: Inline[] = [];
  parts.forEach((p, i) => {
    r.push(i === 0 ? (p.neg ? '−' : '') : p.neg ? ' − ' : ' + ');
    r.push(...p.s);
  });
  return r;
}

const symList = (us: Unknown[]): Inline[] => join(us.map((u) => [sym(u)]), ', ');

export function solutionDoc(m: Model, sol: Solution, opts: SolutionOptions = {}): Doc {
  const notTarget = opts.notTarget ?? new Set<string>(),
    ex = !!opts.explain;
  const steps: Doc['steps'] = [];
  const step = (title: string, blocks: Block[]) => steps.push({ title, blocks });
  const P = (name: string) => v(name);
  const explain = (...c: Inline[]): Block => ({ k: 'p', cls: 'explain', c });

  if (sol.status === 'nosupport') {
    step('Опоры', [
      { k: 'p', c: ['Добавьте хотя бы одну опору или отметьте искомую нагрузку — без связей конструкция ничем не удерживается.'] },
    ]);
    return { steps };
  }

  // 1. Освобождаемся от связей
  const li: Inline[][] = m.supports.map((s) => {
    const u = symList(s.list),
      it = s.it;
    const side = 'side' in it ? it.side : undefined;
    const surf = side && side !== 'tilt' && SIDES[side] ? `, опорная поверхность ${SIDES[side].name}` : '';
    if (it.type === 'roller')
      return [
        `${TYPES.roller.name} `,
        P(s.P),
        `${surf} → реакция `,
        ...u,
        ` по нормали к поверхности, угол ${fmt(it.angle as number, 2)}° к оси `,
        v('x'),
      ];
    if (it.type === 'rod')
      return [`${TYPES.rod.name} `, P(s.P), ' → усилие ', ...u, ` вдоль стержня, угол ${fmt(it.angle, 2)}° к оси `, v('x')];
    return [`${TYPES[it.type].name} `, P(s.P), `${surf} → реакции `, ...u];
  });
  m.unkLoads.forEach((u) =>
    li.push(
      u.kind === 'f'
        ? ['Сила ', sym(u), `: ${forceDirText(u.item as ForceItem)}; модуль ищем`]
        : ['Момент ', sym(u), `: ищем величину, направление принято ${u.s > 0 ? 'против' : 'по'} часовой стрелке`],
    ),
  );
  const s1: Block[] = [
    { k: 'p', c: ['Отбрасываем опоры и заменяем их действие реакциями:'] },
    { k: 'ul', items: li.length ? li : [['опор нет']] },
    {
      k: 'p',
      c: [
        'Положительные направления: ',
        v('X'),
        ' — вправо, ',
        v('Y'),
        ' — вверх, моменты — против часовой стрелки.' +
          (m.h > 1e-9 ? ' Плечо силы относительно точки — сумма вкладов горизонтальной и вертикальной составляющих.' : ''),
      ],
    },
  ];
  if (ex) {
    const types = new Set(m.supports.map((s) => s.it.type));
    const why: string[] = [];
    if (types.has('fixed')) why.push('жёсткая заделка не даёт сечению ни смещаться, ни поворачиваться — две составляющие реакции и реактивный момент');
    if (types.has('pin')) why.push('шарнирно-неподвижная опора не даёт точке смещаться ни по горизонтали, ни по вертикали, но позволяет поворот — две составляющие реакции');
    if (types.has('roller')) why.push('каток мешает смещению только по нормали к опорной поверхности — одна реакция по нормали');
    if (types.has('rod'))
      why.push('опорный стержень с шарнирами на концах передаёт усилие только вдоль себя — одна реакция вдоль стержня; положительное направление принято от опоры к конструкции, то есть «+» означает, что стержень сжат');
    const r: Inline[] = [];
    if (why.length) r.push(why.map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join('; ') + '. ');
    r.push('Направления реакций на схеме выбираем произвольно: если в ответе получится знак «−», реакция направлена в противоположную сторону.');
    if (m.unkLoads.length) r.push(' Для искомой нагрузки направление тоже принимаем, а знак ответа покажет, угадано ли оно.');
    s1.push(explain(...r));
    s1.push(
      explain(
        'Момент силы относительно точки считаем со знаком «+», если сила стремится повернуть тело вокруг этой точки против часовой стрелки. ',
        'Наклонную силу раскладываем на горизонтальную и вертикальную составляющие и складываем их моменты (теорема Вариньона): ',
        'вертикальная составляющая умножается на горизонтальное расстояние до точки, горизонтальная — на вертикальное.',
      ),
    );
  }
  step('Освобождаемся от связей', s1);

  // 2. Распределённая нагрузка
  if (m.dists.length || m.badDists.length) {
    const rows: Block[] = [];
    if (ex)
      rows.push(
        explain(
          'Распределённую нагрузку заменяем сосредоточенной силой: её модуль равен площади эпюры нагрузки, ',
          'а приложена она в центре тяжести эпюры (для прямоугольника — в середине, для треугольника — на трети длины от большего края).',
        ),
      );
    for (const d of m.dists) {
      const q = sym({ L: 'q', S: d.S }),
        Q = sym(d.o),
        A = m.g.name[d.it.from],
        B = m.g.name[d.it.to];
      const where: Inline[] = [`на расстоянии ${fmt(d.d)} м от точки `, v(A), `, направлена ${LOADDIR[d.it.dir].name}`];
      const lq: Inline[] = [v('l'), ` = ${fmt(d.l)} м (участок `, v(A), '–', v(B), ')'];
      if (Math.abs(d.q1 - d.q2) < 1e-12)
        rows.push({
          k: 'eq',
          lines: [
            { c: [Q, ' = ', q, '·', v('l'), ` = ${fmt(d.q1)}·${fmt(d.l)} = `, b(`${fmt(d.Q)} кН`)] },
            { num: true, c: [...lq, '; в середине: ', ...where] },
          ],
        });
      else if (Math.abs(d.q1) < 1e-12 || Math.abs(d.q2) < 1e-12) {
        const qm = Math.abs(d.q1) > 1e-12 ? d.q1 : d.q2;
        rows.push({
          k: 'eq',
          lines: [
            { c: [Q, ' = ½·', q, '·', v('l'), ` = ½·${fmt(qm)}·${fmt(d.l)} = `, b(`${fmt(d.Q)} кН`)] },
            { num: true, c: [...lq, '; ', v('l'), '/3 от большего края: ', ...where] },
          ],
        });
      } else
        rows.push({
          k: 'eq',
          lines: [
            {
              c: [
                Q,
                ' = (',
                v('q'),
                sub('нач'),
                ' + ',
                v('q'),
                sub('кон'),
                ')/2·',
                v('l'),
                ` = (${fmt(d.q1)} + ${fmt(d.q2)})/2·${fmt(d.l)} = `,
                b(`${fmt(d.Q)} кН`),
              ],
            },
            { num: true, c: [...lq, '; центр тяжести трапеции: ', ...where] },
          ],
        });
    }
    m.badDists.forEach((bd) =>
      rows.push({
        k: 'p',
        cls: 's-bad',
        c: [
          'Нагрузка ',
          sym({ L: 'q', S: bd.S }),
          ` не учтена: ${bd.why === 'zero' ? 'начало и конец совпадают' : 'её точки не лежат на одном прямом участке'}.`,
        ],
      }),
    );
    step('Заменяем распределённую нагрузку равнодействующей', rows);
  }

  // 3. Определимость
  const st = STATUS[sol.status];
  const det: Block[] = [
    { k: 'p', c: ['Неизвестных: ', b(String(sol.n)), '. Для плоской произвольной системы сил можно составить три независимых уравнения равновесия.'] },
    { k: 'badge', tone: STATUS_TONE[sol.status], text: `Система ${st[0]}` },
  ];
  if (sol.status === 'indeterminate')
    det.push({
      k: 'p',
      c: [
        `Степень статической неопределимости: ${sol.n - 3}. Одних уравнений статики не хватает — нужны уравнения совместности деформаций (метод сил, сопротивление материалов). Уберите лишнюю связь, чтобы решить задачу статикой.`,
      ],
    });
  if (sol.status === 'mechanism')
    det.push({
      k: 'p',
      c: [
        `Ранг системы уравнений (${sol.rank}) меньше числа неизвестных: связи не закрепляют балку. Так бывает, когда все реакции параллельны или их линии действия пересекаются в одной точке. Добавьте или переставьте опору.`,
      ],
    });
  if (sol.status !== 'indeterminate' && sol.status !== 'mechanism' && sol.n < 3)
    det.push({ k: 'p', c: ['Неизвестных меньше трёх: равновесие возможно, только если нагрузка это допускает.'] });
  if (ex && (sol.status === 'ok' || sol.status === 'noequilibrium') && sol.n === 3)
    det.push(explain('Число неизвестных равно числу независимых уравнений равновесия, и связи расположены так, что система уравнений имеет единственное решение (ранг системы равен трём). Значит, все неизвестные находятся из уравнений статики.'));
  if (ex && (sol.status === 'ok' || sol.status === 'noequilibrium') && sol.n < 3)
    det.push(explain(`Из трёх уравнений ${sol.n} уйдут на поиск неизвестных, остальные должны выполняться сами собой — это и есть условие, что нагрузка допускает равновесие.`));
  step('Проверяем статическую определимость', det);
  if (sol.status === 'indeterminate' || sol.status === 'mechanism') return { steps };

  // 4. Уравнения
  const eqs: Block[] = [
    {
      k: 'p',
      c: ['Выбираем уравнения так, чтобы в каждом было одно неизвестное. Моменты берём относительно точек, через которые проходят другие реакции.'],
    },
  ];
  for (const s of sol.steps) {
    const u = m.byKey[s.key];
    if (ex) eqs.push(explain(...whyEquation(m, s.e, s.key, s.before)));
    eqs.push({
      k: 'eq',
      lines: [
        { c: eqSym(s.e) },
        { num: true, c: [...lhsNum(s.e, s.before, m), ' = 0  ⇒  ', b(sym(u), ` = ${fmt(sol.vals[s.key])} ${unitOf(u)}`)] },
      ],
    });
  }
  if (sol.joint) {
    const J = sol.joint;
    eqs.push({ k: 'p', c: ['Оставшиеся неизвестные находим совместно:'] });
    if (ex)
      eqs.push(
        explain(
          `Ни в одном из неиспользованных уравнений не осталось ровно одного неизвестного, поэтому берём ${J.eqs.length} независимых уравнения и решаем систему относительно `,
          ...symList(J.keys.map((k) => m.byKey[k])),
          '.',
        ),
      );
    eqs.push({
      k: 'eq',
      lines: [
        ...J.eqs.flatMap((e) => [{ c: eqSym(e) }, { num: true, c: [...lhsNum(e, J.before, m), ' = 0'] }]),
        {
          c: [
            '⇒ ',
            ...join(
              J.keys.map((k) => [b(sym(m.byKey[k]), ` = ${fmt(sol.vals[k])} ${unitOf(m.byKey[k])}`)]),
              ', ',
            ),
          ],
        },
      ],
    });
  }
  step('Составляем и решаем уравнения равновесия', eqs);

  // 5. Проверка
  if (sol.status === 'noequilibrium') {
    const be = sol.badEq as Eq;
    const blocks: Block[] = [
      { k: 'eq', lines: [{ c: eqSym(be) }, { num: true, c: [...lhsNum(be, sol.vals, m), ` = ${fmt(sol.badR as number)} ≠ 0`] }] },
      { k: 'badge', tone: 'bad', text: 'Равновесие невозможно' },
      {
        k: 'p',
        c: ['Связей недостаточно, чтобы уравновесить такую нагрузку: балка будет двигаться. Добавьте опору, воспринимающую эту составляющую.'],
      },
    ];
    if (ex)
      blocks.splice(
        0,
        0,
        explain(
          'Все неизвестные уже найдены, но это уравнение не выполняется: сумма в нём не равна нулю. Связи не могут создать реакцию, которая уравновесила бы эту составляющую нагрузки.',
        ),
      );
    step('Проверка', blocks);
    return { steps };
  }
  if (sol.check) {
    const ok = checkPasses(sol.check.r, sol.vals);
    const blocks: Block[] = [
      { k: 'p', c: ['Подставляем найденные значения в уравнение, которое не использовали при решении:'] },
      { k: 'eq', lines: [{ c: eqSym(sol.check.e) }, { num: true, c: [...lhsNum(sol.check.e, sol.vals, m), ` = ${fmt(sol.check.r, 4)}`] }] },
      { k: 'badge', tone: ok ? 'ok' : 'bad', text: ok ? 'Верно: сумма равна нулю' : 'Ошибка: сумма не равна нулю' },
    ];
    if (ex)
      blocks.splice(
        1,
        0,
        explain(
          'Для проверки выбираем неиспользованное уравнение, в которое входит как можно больше найденных величин: ошибка в любой из них нарушила бы равенство.',
        ),
      );
    step('Проверка', blocks);
  }

  // 6. Ответ
  const anyT = m.unknowns.some((u) => !notTarget.has(u.key));
  const rows: AnswerRow[] = [];
  let anyNeg = false;
  for (const u of m.unknowns) {
    const val = sol.vals[u.key],
      aux = anyT && notTarget.has(u.key);
    let note = '';
    if (val < -1e-9) {
      anyNeg = true;
      note = u.kind === 'm' ? (u.s > 0 ? 'направлен по часовой стрелке' : 'направлен против часовой стрелки') : 'направлена противоположно принятой на схеме';
    }
    if (aux) note = (note ? note + '; ' : '') + 'промежуточная';
    rows.push({ kind: aux ? 'aux' : 'main', val: [sym(u), ` = ${fmt(val)} ${unitOf(u)}`], note });
    if (u.L === 'Y' && (u.support === 'pin' || u.support === 'fixed')) {
      const X = m.unknowns.find((w) => w.L === 'X' && w.S === u.S);
      if (X && !(anyT && notTarget.has(X.key) && notTarget.has(u.key))) {
        const Rv = Math.hypot(sol.vals[X.key], val);
        rows.push({
          kind: 'total',
          val: [v('R'), sub(u.S), ' = √(', v('X'), sub(u.S), '² + ', v('Y'), sub(u.S), `²) = ${fmt(Rv)} кН`],
          note: 'полная реакция',
        });
      }
    }
  }
  const ans: Block[] = [{ k: 'answer', rows }];
  if (ex && anyNeg)
    ans.push(explain('Знак «−» означает, что величина направлена противоположно направлению, принятому на расчётной схеме; модуль при этом тот же.'));
  step('Ответ', ans);
  return { steps };
}

/**
 * Пояснение к выбору уравнения: почему в нём осталось одно неизвестное.
 * Для каждого неизвестного, которого нет в уравнении, объясняется причина.
 */
function whyEquation(m: Model, e: Eq, key: string, before: Record<string, number>): Inline[] {
  const found: Unknown[] = [],
    through: Unknown[] = [],
    perp: Unknown[] = [],
    couples: Unknown[] = [];
  for (const u of m.unknowns) {
    if (u.key === key) continue;
    if (u.key in before) {
      found.push(u);
      continue;
    }
    // В уравнении этого неизвестного нет (иначе оно не было бы единственным).
    if (e.type === 'm') through.push(u);
    else if (u.kind === 'm') couples.push(u);
    else perp.push(u);
  }
  const r: Inline[] = [];
  if (e.type === 'm') r.push('Уравнение моментов относительно точки ', v(e.P || ''), '. ');
  else r.push('Уравнение проекций на ось ', v(e.type), '. ');
  const plural = (us: Unknown[], one: string, many: string) => (us.length > 1 ? many : one);
  if (through.length)
    r.push(
      ...symList(through),
      plural(through, ' не входит: линия действия проходит через точку ', ' не входят: их линии действия проходят через точку '),
      v(e.P || ''),
      plural(through, ', плечо равно нулю. ', ', плечи равны нулю. '),
    );
  if (perp.length)
    r.push(
      ...symList(perp),
      plural(perp, ' не входит: сила перпендикулярна оси ', ' не входят: силы перпендикулярны оси '),
      v(e.type),
      plural(perp, ', её проекция равна нулю. ', ', их проекции равны нулю. '),
    );
  if (couples.length)
    r.push(...symList(couples), plural(couples, ' — момент, в уравнения проекций не входит. ', ' — моменты, в уравнения проекций не входят. '));
  if (found.length) r.push(plural(found, 'Значение ', 'Значения '), ...symList(found), plural(found, ' уже найдено. ', ' уже найдены. '));
  r.push('Остаётся одно неизвестное — ', sym(m.byKey[key]), '.');
  return r;
}

/** Заголовок статуса для штампа и подсказок. */
export const statusText = (s: Solution['status']): string => STATUS[s][0];
