/**
 * Пошаговое решение в стиле решебника (перенос renderSolution() прототипа).
 * При explain = false текст совпадает с прототипом символ в символ (проверяется golden-тестами).
 * При explain = true добавляются пояснения к ходу решения (абзацы с классом explain);
 * числа, уравнения и правила знаков при этом не меняются.
 */
import { LOADDIR, REFS, SIDES, TYPES } from '../model/constants';
import { fmt, trigFactor } from '../model/format';
import type { ForceItem } from '../model/types';
import { checkPasses } from '../solver/check';
import type { Eq, Term } from '../solver/equations';
import type { Action, Model, Unknown } from '../solver/model';
import type { Solution } from '../solver/solve';
import { b, join, sub, sup, sym, v, type AnswerRow, type Block, type Doc, type Inline } from './doc';
import { roman } from '../model/geometry';
import { STATUS, STATUS_TONE, forceDirText } from './labels';

export interface SolutionOptions {
  /** Искомые, отмеченные как промежуточные («что найти» снято). */
  notTarget?: ReadonlySet<string>;
  /** Подробные пояснения к ходу решения. */
  explain?: boolean;
}

const unitOf = (o: { kind: string }) => (o.kind === 'm' ? 'кН·м' : 'кН');

/** Обозначение уравнения: ΣFkx, ΣFky, ΣMA. */
export function eqName(e: Pick<Eq, 'type' | 'P' | 'part'>): Inline[] {
  const part: Inline[] = e.part != null ? [sup(roman(e.part))] : [];
  if (e.type === 'x') return ['Σ', v('F'), sub('kx'), ...part];
  if (e.type === 'y') return ['Σ', v('F'), sub('ky'), ...part];
  return ['Σ', v('M'), sub(e.P || ''), ...part];
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
    if (types.has('roller'))
      why.push(
        'каток может свободно катиться вдоль опорной поверхности и мешает только движению поперёк неё, поэтому его реакция одна и направлена перпендикулярно (под прямым углом) к поверхности — это и называют «по нормали»' +
          (m.supports.some((q) => q.it.type === 'roller' && q.it.side === 'tilt')
            ? '; у катка на наклонной поверхности реакция перпендикулярна наклонной поверхности, поэтому она тоже наклонена'
            : ''),
      );
    if (types.has('rod'))
      why.push('опорный стержень с шарнирами на концах передаёт усилие только вдоль себя — одна реакция вдоль стержня; положительное направление принято от опоры к конструкции, то есть «+» означает, что стержень сжат');
    const r: Inline[] = [];
    if (why.length) r.push(why.map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join('; ') + '. ');
    r.push('Направления реакций на схеме выбираем произвольно: если в ответе получится знак «−», реакция направлена в противоположную сторону.');
    if (m.unkLoads.length) r.push(' Для искомой нагрузки направление тоже принимаем, а знак ответа покажет, угадано ли оно.');
    s1.push(explain(...r));
    for (const a of [...m.knowns, ...m.unkLoads]) {
      if (a.kind !== 'f' || !a.item || a.item.type !== 'force') continue;
      const p = projectionText(a);
      if (p) s1.push(explain(...p));
    }
    s1.push(
      explain(
        'Момент силы относительно точки считаем со знаком «+», если сила стремится повернуть тело вокруг этой точки против часовой стрелки. ',
        'Наклонную силу раскладываем на горизонтальную и вертикальную составляющие и складываем их моменты (теорема Вариньона): ',
        'вертикальная составляющая умножается на горизонтальное расстояние до точки, горизонтальная — на вертикальное.',
      ),
    );
  }
  step('Освобождаемся от связей', s1);

  // 1а. Составная конструкция: расчленение по шарнирам
  const comp = m.parts.count > 1,
    NP = m.parts.count;
  if (comp) {
    const hn = m.parts.hinges.map((h) => m.g.name[h]);
    const blocks: Block[] = [
      {
        k: 'p',
        c: [
          `Внутренн${hn.length > 1 ? 'ие шарниры' : 'ий шарнир'} `,
          ...join(hn.map((n) => [v(n)]), ', '),
          ` дел${hn.length > 1 ? 'ят' : 'ит'} конструкцию на ${NP} ${NP < 5 ? 'части' : 'частей'}, каждая — отдельное твёрдое тело:`,
        ],
      },
      {
        k: 'ul',
        items: m.partNames.map((names, p) => [`Часть ${roman(p)}: точки `, ...join(names.map((n) => [v(n)]), ', ')]),
      },
    ];
    for (const h of m.parts.hinges) {
      const us = m.unknowns.filter((u) => u.hinge?.node === h);
      const ons = [...new Set(us.map((u) => u.hinge!.on))];
      const from = us[0]?.hinge?.from ?? 0;
      for (const on of ons) {
        const pair = us.filter((u) => u.hinge!.on === on);
        blocks.push({
          k: 'p',
          c: [
            'В шарнире ',
            v(m.g.name[h]),
            ` на часть ${roman(on)} действуют силы `,
            ...symList(pair),
            `, на часть ${roman(from)} — такие же силы в обратную сторону (действие равно противодействию).`,
          ],
        });
      }
      if (Object.values(m.labels).some((l) => l.P === m.g.name[h]))
        blocks.push({ k: 'p', c: ['Опоры и нагрузки, приложенные в самом шарнире ', v(m.g.name[h]), `, отнесены к части ${roman(from)}.`] });
    }
    if (ex)
      blocks.push(
        explain(
          'Шарнир передаёт силу, но не момент: части могут поворачиваться друг относительно друга. Поэтому в шарнире две неизвестные составляющие силы и нет реактивного момента. ',
          'Для каждой части составляем свои уравнения равновесия; уравнения для всей конструкции — их сумма, в них внутренние силы в шарнирах взаимно уничтожаются.',
        ),
      );
    step('Расчленяем конструкцию по шарнирам', blocks);
  }

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
      const q = sym({ L: 'q', S: d.piece ? (m.labels[d.it.id]?.S ?? '') : d.S }),
        Q = sym(d.o),
        A = m.g.name[d.from],
        B = m.g.name[d.to];
      const where: Inline[] = [`на расстоянии ${fmt(d.d)} м от точки `, v(A), `, направлена ${LOADDIR[d.it.dir].name}`];
      const lq: Inline[] = [v('l'), ` = ${fmt(d.l)} м (участок `, v(A), '–', v(B), ')'];
      if (d.piece && d.piece.index === 0) {
        const all = m.dists.filter((x) => x.it === d.it);
        const cutNames = all.slice(1).map((x) => m.g.name[x.from]);
        rows.push({
          k: 'p',
          c: [
            'Нагрузка ',
            sym({ L: 'q', S: m.labels[d.it.id]?.S ?? '' }),
            ' на участке ',
            v(m.g.name[d.it.from]),
            '–',
            v(m.g.name[d.it.to]),
            ` проходит через шарнир${cutNames.length > 1 ? 'ы' : ''} `,
            ...join(cutNames.map((n) => [v(n)]), ', '),
            ': делим её на куски — для каждой части своя равнодействующая.',
          ],
        });
      }
      if (d.split) {
        const [p1, p2] = d.split.parts;
        rows.push({
          k: 'p',
          c: [
            'Нагрузка ',
            q,
            ` меняет знак: `,
            v('q'),
            ` = 0 на расстоянии ${fmt(d.split.l1)} м от точки `,
            v(A),
            '. Заменяем эпюру двумя треугольниками, у каждого — своя равнодействующая.',
          ],
        });
        const tri = (p: typeof p1, edge: 'нач' | 'кон', lname: string): Block => ({
          k: 'eq',
          lines: [
            {
              c: [
                sym(p.o),
                ' = ½·|',
                v('q'),
                sub(edge),
                '|·',
                v(lname),
                ` = ½·${fmt(Math.abs(p.q))}·${fmt(p.l)} = `,
                b(`${fmt(p.Q)} кН`),
              ],
            },
            {
              num: true,
              c: [v(lname), ` = ${fmt(p.l)} м; на трети длины треугольника от большего края: на расстоянии ${fmt(p.d)} м от точки `, v(A), `, направлена ${LOADDIR[p.dir].name}`],
            },
          ],
        });
        rows.push(tri(p1, 'нач', 'l′'), tri(p2, 'кон', 'l″'));
        if (ex)
          rows.push(
            explain(
              'Части эпюры по разные стороны от нуля действуют в противоположные стороны. Одна общая сила здесь не годится: ',
              'при равных по модулю краях она равна нулю, хотя нагрузка поворачивает тело (две части образуют пару сил), ',
              'а в остальных случаях её точка приложения уходит за пределы участка. Поэтому каждый треугольник заменяем своей силой; обе входят в уравнения равновесия.',
            ),
          );
        continue;
      }
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
  const nEq = 3 * NP,
    nHinge = m.unknowns.filter((u) => u.hinge).length;
  const det: Block[] = [
    comp
      ? {
          k: 'p',
          c: [
            'Неизвестных: ',
            b(String(sol.n)),
            ` (из них взаимных сил в шарнирах: ${nHinge}). Для каждой из ${NP} частей можно составить три независимых уравнения равновесия, всего `,
            b(String(nEq)),
            '.',
          ],
        }
      : { k: 'p', c: ['Неизвестных: ', b(String(sol.n)), '. Для плоской произвольной системы сил можно составить три независимых уравнения равновесия.'] },
    { k: 'badge', tone: STATUS_TONE[sol.status], text: `Система ${st[0]}` },
  ];
  if (sol.status === 'indeterminate')
    det.push({
      k: 'p',
      c: [
        `Степень статической неопределимости: ${sol.n - nEq}. Одних уравнений статики не хватает — нужны уравнения совместности деформаций (метод сил, сопротивление материалов). Уберите лишнюю связь, чтобы решить задачу статикой.`,
      ],
    });
  if (sol.status === 'mechanism')
    det.push({
      k: 'p',
      c: [
        `Ранг системы уравнений (${sol.rank}) меньше числа неизвестных: связи не закрепляют ${comp ? 'конструкцию' : 'балку'}. Так бывает, когда все реакции параллельны или их линии действия пересекаются в одной точке. Добавьте или переставьте опору.`,
      ],
    });
  if (sol.status === 'mechanism' && sol.n > nEq)
    det.push({
      k: 'p',
      c: [
        `Неизвестных больше ${comp ? 'числа уравнений' : 'трёх'}, но система не статически неопределима, а изменяема: независимых уравнений только ${sol.rank}, часть связей дублирует друг друга, а какое-то перемещение остаётся свободным.`,
      ],
    });
  if (sol.status !== 'indeterminate' && sol.status !== 'mechanism' && sol.n < nEq)
    det.push({
      k: 'p',
      c: [comp ? `Неизвестных меньше, чем уравнений (${nEq}): равновесие возможно, только если нагрузка это допускает.` : 'Неизвестных меньше трёх: равновесие возможно, только если нагрузка это допускает.'],
    });
  if (ex && (sol.status === 'ok' || sol.status === 'noequilibrium') && sol.n === nEq)
    det.push(
      explain(
        comp
          ? `Число неизвестных равно числу независимых уравнений (${nEq}), и система уравнений имеет единственное решение (её ранг равен ${nEq}). Значит, все неизвестные, включая силы в шарнирах, находятся из уравнений статики.`
          : 'Число неизвестных равно числу независимых уравнений равновесия, и связи расположены так, что система уравнений имеет единственное решение (ранг системы равен трём). Значит, все неизвестные находятся из уравнений статики.',
      ),
    );
  if (ex && (sol.status === 'ok' || sol.status === 'noequilibrium') && sol.n < nEq)
    det.push(
      explain(
        `Из ${comp ? nEq : 'трёх'} уравнений ${sol.n} уйдут на поиск неизвестных, остальные должны выполняться сами собой — это и есть условие, что нагрузка допускает равновесие.`,
      ),
    );
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
    if (u.hinge) note = `шарнир ${u.hinge.name}: сила на часть ${roman(u.hinge.on)}, на часть ${roman(u.hinge.from)} — в обратную сторону` + (note ? '; ' + note : '');
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
    couples: Unknown[] = [],
    other: Unknown[] = [],
    internal: Unknown[] = [];
  const comp = m.parts.count > 1;
  const actsOn = (u: Unknown, p: number) => (u.hinge ? u.hinge.on === p || u.hinge.from === p : u.part === p);
  for (const u of m.unknowns) {
    if (u.key === key) continue;
    if (u.key in before) {
      found.push(u);
      continue;
    }
    if (comp && e.part != null && !actsOn(u, e.part)) {
      other.push(u);
      continue;
    }
    if (comp && e.part == null && u.hinge) {
      internal.push(u);
      continue;
    }
    // В уравнении этого неизвестного нет (иначе оно не было бы единственным).
    if (e.type === 'm') through.push(u);
    else if (u.kind === 'm') couples.push(u);
    else perp.push(u);
  }
  const r: Inline[] = [];
  const whom = !comp ? '' : e.part != null ? ` для части ${roman(e.part)}` : ' для всей конструкции';
  if (e.type === 'm') r.push(`Уравнение моментов${whom} относительно точки `, v(e.P || ''), '. ');
  else r.push(`Уравнение проекций${whom} на ось `, v(e.type), '. ');
  const plural = (us: Unknown[], one: string, many: string) => (us.length > 1 ? many : one);
  if (other.length)
    r.push(
      ...symList(other),
      m.parts.count === 2
        ? plural(other, ' действует на другую часть и сюда не входит. ', ' действуют на другую часть и сюда не входят. ')
        : plural(other, ' действует на другую часть и сюда не входит. ', ' действуют на другие части и сюда не входят. '),
    );
  if (internal.length)
    r.push(...symList(internal), ' — внутренние силы в шарнирах: для всей конструкции они взаимно уничтожаются. ');
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

/**
 * Проекции наклонной силы через угол с той осью, от которой пользователь отсчитывал угол.
 * Угол больше 90° приводится к острому углу между линией действия силы и этой осью.
 */
function projectionText(a: Action): Inline[] | null {
  const it = a.item as ForceItem;
  const tx = trigFactor(a.angle, 'x', a.refAxis),
    ty = trigFactor(a.angle, 'y', a.refAxis);
  if (!tx || !ty) return null; // сила параллельна одной из осей — проекция либо полная, либо нулевая
  const ref = REFS[it.ref] || REFS.down;
  const axis = ref.axis === 'v' ? 'y' : 'x';
  const alpha = +it.alpha || 0;
  const acuteDeg = axis === 'x' ? tx.deg : ty.deg;
  const r: Inline[] = ['Сила ', sym(a), ` задана углом ${fmt(alpha, 2)}° к направлению «${ref.short}», то есть угол отсчитан от оси `, v(axis), '. '];
  if (Math.abs(acuteDeg - alpha) > 1e-9)
    r.push('Для проекций берём острый угол между линией действия силы и осью ', v(axis), `: ${fmt(acuteDeg, 2)}°. `);
  r.push(
    'Проекция на ось ',
    v(axis),
    ' — через cos этого угла, на другую ось — через sin: на ',
    v('x'),
    ' — ',
    sym(a),
    `·${tx.fn} ${fmt(tx.deg, 2)}°, на `,
    v('y'),
    ' — ',
    sym(a),
    `·${ty.fn} ${fmt(ty.deg, 2)}°; знак берём по направлению составляющей.`,
  );
  return r;
}

/** Заголовок статуса для штампа и подсказок. */
export const statusText = (s: Solution['status']): string => STATUS[s][0];
