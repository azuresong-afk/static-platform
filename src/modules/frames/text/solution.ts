/**
 * Пошаговое решение в стиле решебника (перенос renderSolution() прототипа).
 * При explain = false текст совпадает с прототипом символ в символ (проверяется golden-тестами).
 * При explain = true добавляются пояснения к ходу решения (абзацы с классом explain);
 * числа, уравнения и правила знаков при этом не меняются.
 */
import { REFS, SIDES, TYPES } from '../model/constants';
import { acuteExpr, fmt, trigFactor, trigText } from '../../../shared/format';
import type { ForceItem } from '../model/types';
import { checkPasses } from '../solver/check';
import type { Eq, Term } from '../solver/equations';
import { eqCount, oneSidedLinks, type Action, type Model, type Unknown } from '../solver/model';
import type { Solution } from '../solver/solve';
import { b, join, sub, sup, sym, v, type AnswerRow, type Block, type Doc, type Inline } from '../../../shared/doc';
import { roman } from '../model/geometry';
import { STATUS, STATUS_TONE, forceDirText, loadDirText } from './labels';
import { frictionDoc } from './friction';
import { badLinkText, linkNote, linkText, manyBodies } from './links';

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
  if (t.trig) r.push('·' + trigText(t.trig));
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

  if (sol.friction) return frictionDoc(m, sol, opts);
  if (sol.status === 'unsupported') {
    step('Трение в шарнире', [
      {
        k: 'p',
        c: [
          sol.unsupported === 'load'
            ? 'С трением в шарнире тело проворачивается (предельное равновесие или равномерное вращение), и уравнений на одно больше, чем неизвестных реакций: такое возможно лишь при определённой нагрузке. Отметьте искомую нагрузку («модуль ищем») — она и найдётся.'
            : 'Трение в шарнире вместе с трением на опорах или в касаниях (или с односторонними связями) не рассчитывается: момент трения M_тр = ρR нелинейно зависит от реакции шарнира и в расчёт с неравенствами не входит. Уберите трение в шарнире или трение (одностороннюю связь) на других связях.',
        ],
      },
    ]);
    return { steps };
  }
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
        ` по нормали к поверхности, угол ${it.side === 'tilt' && it.angleName ? it.angleName + ' = ' : ''}${fmt(it.angle as number, 2)}° к оси `,
        v('x'),
      ];
    if (it.type === 'rod')
      return [`${TYPES.rod.name} `, P(s.P), ' → усилие ', ...u, ` вдоль стержня, угол ${it.angleName ? it.angleName + ' = ' : ''}${fmt(it.angle, 2)}° к оси `, v('x')];
    if (it.type === 'slide')
      return [
        `${TYPES.slide.name} `,
        P(s.P),
        it.side === 'tilt' ? ', наклонная направляющая' : `, направляющая ${it.side === 'below' || it.side === 'above' ? 'горизонтальна' : 'вертикальна'}`,
        ' → реакция ',
        sym(s.list[0]),
        ` по нормали к направляющей (угол ${it.side === 'tilt' && it.angleName ? it.angleName + ' = ' : ''}${fmt(it.angle as number, 2)}° к оси `,
        v('x'),
        ') и реактивный момент ',
        sym(s.list[1]),
      ];
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
  // Углы, обозначенные буквами: значения, которые подставляем в уравнения.
  const named = new Map<string, number>();
  for (const a of [...m.unknowns, ...m.knowns]) if (a.angleName && !named.has(a.angleName)) named.set(a.angleName, a.userAngle ?? 0);
  if (named.size)
    s1.push({ k: 'p', c: ['Углы: ' + [...named].map(([n, val]) => `${n} = ${fmt(val, 2)}°`).join(', ') + '.'] });
  if (ex) {
    const types = new Set(m.supports.map((s) => s.it.type));
    const why: string[] = [];
    if (types.has('fixed')) why.push('жёсткая заделка не даёт сечению ни смещаться, ни поворачиваться — две составляющие реакции и реактивный момент');
    if (types.has('slide'))
      why.push('скользящая заделка позволяет сечению смещаться только вдоль направляющей и не даёт ему поворачиваться — реакция по нормали к направляющей и реактивный момент');
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
    NP = m.parts.count,
    bodies = manyBodies(m);
  if (comp && bodies) step('Расчленяем систему на тела', bodiesBlocks(m, ex));
  // Связь не учтена, а тело одно: причину показываем в первом шаге.
  else if (m.badLinks.length) steps[steps.length - 1].blocks.push(...badLinkText(m).map((c): Block => ({ k: 'p', cls: 's-bad', c })));
  if (comp && !bodies) {
    const hn = m.parts.hinges.filter((h) => m.parts.slides[h] == null).map((h) => m.g.name[h]),
      sn = m.parts.hinges.filter((h) => m.parts.slides[h] != null).map((h) => m.g.name[h]);
    const joints: Inline[] = [
      ...(hn.length ? [`Внутренн${hn.length > 1 ? 'ие шарниры' : 'ий шарнир'} `, ...join(hn.map((n) => [v(n)]), ', ')] : []),
      ...(hn.length && sn.length ? [' и '] : []),
      ...(sn.length ? [`${hn.length ? 'с' : 'С'}кользящ${sn.length > 1 ? 'ие заделки' : 'ая заделка'} `, ...join(sn.map((n) => [v(n)]), ', ')] : []),
    ];
    const many = hn.length + sn.length > 1;
    const blocks: Block[] = [
      {
        k: 'p',
        c: [...joints, ` дел${many ? 'ят' : 'ит'} конструкцию на ${NP} ${NP < 5 ? 'части' : 'частей'}, каждая — отдельное твёрдое тело:`],
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
        const sl = m.parts.slides[h];
        blocks.push({
          k: 'p',
          c:
            sl != null
              ? [
                  'В скользящей заделке ',
                  v(m.g.name[h]),
                  ` на часть ${roman(on)} действуют сила `,
                  sym(pair[0]),
                  ` по нормали к направляющей (угол ${fmt(sl, 2)}° к оси `,
                  v('x'),
                  ') и пара сил с моментом ',
                  sym(pair[1]),
                  `, на часть ${roman(from)} — такие же сила и момент в обратную сторону (действие равно противодействию).`,
                ]
              : ['В шарнире ', v(m.g.name[h]), ` на часть ${roman(on)} действуют силы `, ...symList(pair), `, на часть ${roman(from)} — такие же силы в обратную сторону (действие равно противодействию).`],
        });
      }
      if (Object.values(m.labels).some((l) => l.P === m.g.name[h]))
        blocks.push({ k: 'p', c: [`Опоры и нагрузки, приложенные в самом ${m.parts.slides[h] != null ? 'соединении' : 'шарнире'} `, v(m.g.name[h]), `, отнесены к части ${roman(from)}.`] });
    }
    if (ex)
      blocks.push(
        explain(
          (hn.length ? 'Шарнир передаёт силу, но не момент: части могут поворачиваться друг относительно друга. Поэтому в шарнире две неизвестные составляющие силы и нет реактивного момента. ' : '') +
            (sn.length ? 'Скользящая заделка (гладкая втулка) не даёт частям поворачиваться друг относительно друга и смещаться поперёк направляющей, но позволяет скользить вдоль неё: она передаёт силу по нормали к направляющей и момент. ' : ''),
          'Для каждой части составляем свои уравнения равновесия; уравнения для всей конструкции — их сумма, в них внутренние силы в шарнирах взаимно уничтожаются.',
        ),
      );
    step(sn.length ? (hn.length ? 'Расчленяем конструкцию по соединениям частей' : 'Расчленяем конструкцию по скользящим заделкам') : 'Расчленяем конструкцию по шарнирам', blocks);
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
    if (ex && m.dists.some((d) => d.axis === 'a'))
      rows.push(
        explain(
          'На наклонном участке интенсивность q отнесена к его длине: Q = q·l, где l — длина участка по его оси, а не проекция. ',
          'Если нагрузка задана на единицу горизонтальной проекции (например, снеговая), то на единицу длины участка приходится q·cos α, где α — угол участка с горизонтом. ',
          'Равнодействующую, как и любую наклонную силу, в уравнениях раскладываем на составляющие по осям.',
        ),
      );
    for (const d of m.dists) {
      const q = sym({ L: 'q', S: d.piece ? (m.labels[d.it.id]?.S ?? '') : d.S }),
        Q = sym(d.o),
        A = m.g.name[d.from],
        B = m.g.name[d.to];
      const where: Inline[] = [`на расстоянии ${fmt(d.d)} м от точки `, v(A), `, направлена ${loadDirText(d.it.dir, d.o.angle)}`];
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
              c: [v(lname), ` = ${fmt(p.l)} м; на трети длины треугольника от большего края: на расстоянии ${fmt(p.d)} м от точки `, v(A), `, направлена ${loadDirText(p.dir, p.o.angle)}`],
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
  const st = STATUS[sol.slack || sol.cases ? 'ok' : sol.status];
  const nEq = eqCount(m),
    nHinge = m.unknowns.filter((u) => u.hinge).length;
  const nOff = m.offLinks.length;
  // Трение в шарнире: момент трения — ещё одна неизвестная, к уравнениям равновесия добавляется M_тр = ρR.
  const nFr = m.pinFr.length;
  const frEq = (all: number) => (nFr ? [`, и ${nFr === 1 ? 'ещё одно уравнение даёт' : `ещё ${nFr} уравнения дают`} трение в шарнире (M_тр = ρR, ниже) — всего `, b(String(all + nFr))] : []);
  const det: Block[] = [
    comp && bodies
      ? {
          k: 'p',
          c: [
            'Неизвестных: ',
            b(String(sol.n + nOff)),
            ` (из них сил в связях между телами и частями: ${nHinge + m.links.reduce((a, l) => a + l.list.length, 0) + nOff}). Для каждого из ${NP} тел можно составить три независимых уравнения равновесия${Object.keys(m.parts.points).length ? ', для тела-точки — два' : ''}, всего `,
            b(String(nEq)),
            ...frEq(nEq),
            '.',
          ],
        }
      : comp
      ? {
          k: 'p',
          c: [
            'Неизвестных: ',
            b(String(sol.n)),
            ` (из них взаимных ${m.parts.hinges.some((h) => m.parts.slides[h] != null) ? 'сил и моментов в соединениях частей' : 'сил в шарнирах'}: ${nHinge}). Для каждой из ${NP} частей можно составить три независимых уравнения равновесия, всего `,
            b(String(nEq)),
            ...frEq(nEq),
            '.',
          ],
        }
      : { k: 'p', c: ['Неизвестных: ', b(String(sol.n)), '. Для плоской произвольной системы сил можно составить три независимых уравнения равновесия', ...frEq(3), '.'] },
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
          ? `Число неизвестных равно числу независимых уравнений (${nEq}), и система уравнений имеет единственное решение (её ранг равен ${nEq}). Значит, все неизвестные, включая ${bodies ? 'силы взаимодействия тел' : 'силы в шарнирах'}, находятся из уравнений статики.`
          : 'Число неизвестных равно числу независимых уравнений равновесия, и связи расположены так, что система уравнений имеет единственное решение (ранг системы равен трём). Значит, все неизвестные находятся из уравнений статики.',
      ),
    );
  if (ex && (sol.status === 'ok' || sol.status === 'noequilibrium') && sol.n < nEq)
    det.push(
      explain(
        `Из ${comp ? nEq : 'трёх'} уравнений ${sol.n} уйдут на поиск неизвестных, остальные должны выполняться сами собой — это и есть условие, что нагрузка допускает равновесие.`,
      ),
    );
  if (sol.cases) det.splice(1, 1, { k: 'badge', tone: 'warn', text: `Неизвестных больше на ${nOff || sol.cases[0].off.length}, но связи односторонние` });
  step('Проверяем статическую определимость', det);
  if (sol.cases) {
    step('Какие односторонние связи работают', casesBlocks(m, sol, ex));
    if (!sol.cases.some((c) => c.ok)) return { steps };
  }
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
    if (ex) {
      eqs.push(explain(...whyEquation(m, s.e, s.key, s.before)));
      const arms = armExplain(m, s.e);
      if (arms) eqs.push(arms);
    }
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
          `Ни в одном из неиспользованных уравнений не осталось ровно одного неизвестного, поэтому берём ${J.eqs.length} независимых уравнения${m.pinFr.length ? ` и ${m.pinFr.length === 1 ? 'уравнение' : 'уравнения'} трения в шарнире (выше)` : ''} и решаем систему относительно `,
          ...symList(J.keys.map((k) => m.byKey[k])),
          '.',
        ),
      );
    if (ex)
      for (const e of J.eqs) {
        const arms = armExplain(m, e);
        if (arms) eqs.push({ k: 'p', cls: 'explain', c: [...eqName(e), ':'] }, arms);
      }
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
  if (sol.status === 'noequilibrium' && !sol.slack) {
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

  // 5а. Односторонние связи между телами: давления и натяжения не отрицательны.
  if (oneSidedLinks(m).length) {
    const blocks: Block[] = [{ k: 'ul', items: oneSidedLinks(m).map((l) => signLine(m, l.list[0], sol.vals[l.list[0].key])) }];
    if (sol.slack) {
      blocks.push(
        { k: 'badge', tone: 'bad', text: 'Равновесие невозможно' },
        {
          k: 'p',
          c: [
            'Уравнения равновесия выполняются только при ',
            ...join(sol.slack.map((k) => [sym(m.byKey[k]), ' < 0']), ', '),
            ', а такая связь не может тянуть (касание) или сжиматься (нить): тела разойдутся, нить провиснет. Равновесие при этой нагрузке невозможно.',
          ],
        },
      );
      step('Проверяем односторонние связи', blocks);
      return { steps };
    }
    if (ex) blocks.push(explain('Касание может только давить, а нить — только тянуть. Все давления и натяжения получились не отрицательными — связи работают так, как предполагалось на схеме.'));
    step('Проверяем односторонние связи', blocks);
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
    if (u.hinge) {
      const w = bodies ? 'тело' : 'часть';
      note =
        (u.hinge.slide
          ? `скользящая заделка ${u.hinge.name}: ${u.kind === 'm' ? 'момент' : 'сила'} на ${w} ${roman(u.hinge.on)}, на ${w} ${roman(u.hinge.from)} — в обратную сторону`
          : `шарнир ${u.hinge.name}: сила на ${w} ${roman(u.hinge.on)}, на ${w} ${roman(u.hinge.from)} — в обратную сторону`) + (note ? '; ' + note : '');
    }
    if (u.link) {
      // Знак давления и натяжения поясняет сама подпись связи; у силы трения и сил в шарнире — обычное «противоположно».
      const own = u.link.kind === 'hinge' || u.key !== m.links[u.link.index].list[0].key;
      note = linkNote(m, m.links[u.link.index], u.key, val) + (own && note ? '; ' + note : '');
    }
    if (m.pinFr.some((q) => q.M === u.key)) note = 'момент трения в шарнире' + (note ? '; ' + note : '');
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
  for (const l of m.offLinks)
    rows.push({ kind: 'main', val: [l.type === 'contact' ? 'касание ' : 'нить ', v(m.g.name[l.a]), '–', v(m.g.name[l.b]), ': сила равна 0'], note: 'связь не работает' });
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
  const actsOn = (u: Unknown, p: number) => (u.link ? m.links[u.link.index].parts.includes(p) : u.hinge ? u.hinge.on === p || u.hinge.from === p : u.part === p);
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
    if (comp && e.part == null && (u.hinge || u.link)) {
      internal.push(u);
      continue;
    }
    // В уравнении этого неизвестного нет (иначе оно не было бы единственным).
    if (e.type === 'm') through.push(u);
    else if (u.kind === 'm') couples.push(u);
    else perp.push(u);
  }
  const r: Inline[] = [];
  const bodies = manyBodies(m);
  const whom = !comp ? '' : e.part != null ? ` для ${bodies ? 'тела' : 'части'} ${roman(e.part)}` : bodies ? ' для всей системы' : ' для всей конструкции';
  if (e.type === 'm') r.push(`Уравнение моментов${whom} относительно точки `, v(e.P || ''), '. ');
  else r.push(`Уравнение проекций${whom} на ось `, v(e.type), '. ');
  const plural = (us: Unknown[], one: string, many: string) => (us.length > 1 ? many : one);
  if (other.length && bodies)
    r.push(...symList(other), plural(other, ' действует на другое тело и сюда не входит. ', ' действуют на другие тела и сюда не входят. '));
  else if (other.length)
    r.push(
      ...symList(other),
      m.parts.count === 2
        ? plural(other, ' действует на другую часть и сюда не входит. ', ' действуют на другую часть и сюда не входят. ')
        : plural(other, ' действует на другую часть и сюда не входит. ', ' действуют на другие части и сюда не входят. '),
    );
  if (internal.length)
    r.push(...symList(internal), bodies ? ' — силы взаимодействия тел: для всей системы они взаимно уничтожаются. ' : ' — внутренние силы в шарнирах: для всей конструкции они взаимно уничтожаются. ');
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
  const nm = it.angleName;
  const alpha = +it.alpha || 0;
  const named = (t: ReturnType<typeof trigFactor>) => (t && nm ? { ...t, name: acuteExpr(alpha, nm) } : t);
  const tx = named(trigFactor(a.angle, 'x', a.refAxis)),
    ty = named(trigFactor(a.angle, 'y', a.refAxis));
  if (!tx || !ty) return null; // сила параллельна одной из осей — проекция либо полная, либо нулевая
  const ref = REFS[it.ref] || REFS.down;
  const axis = ref.axis === 'v' ? 'y' : 'x';
  const acuteDeg = axis === 'x' ? tx.deg : ty.deg;
  const r: Inline[] = ['Сила ', sym(a), ` задана углом ${nm ? nm + ' = ' : ''}${fmt(alpha, 2)}° к направлению «${ref.short}», то есть угол отсчитан от оси `, v(axis), '. '];
  if (Math.abs(acuteDeg - alpha) > 1e-9)
    r.push('Для проекций берём острый угол между линией действия силы и осью ', v(axis), `: ${nm ? acuteExpr(alpha, nm) + ' = ' : ''}${fmt(acuteDeg, 2)}°. `);
  r.push(
    'Проекция на ось ',
    v(axis),
    ' — через cos этого угла, на другую ось — через sin: на ',
    v('x'),
    ' — ',
    sym(a),
    '·' + trigText(tx) + ', на ',
    v('y'),
    ' — ',
    sym(a),
    '·' + trigText(ty) + '; знак берём по направлению составляющей.',
  );
  return r;
}

/**
 * Разбор слагаемых уравнения моментов: какая составляющая, где приложена, почему плечо такое и откуда знак.
 */
function armExplain(m: Model, e: Eq): Block | null {
  if (e.type !== 'm' || !e.P) return null;
  const Pid = m.pts.find((p) => p.name === e.P)!;
  const nodeAt = (x: number, y: number) => m.pts.find((p) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
  const items: Inline[][] = [];
  for (const t of e.terms) {
    const head: Inline[] = [sym(t.sym)];
    if (t.trig) head.push('·' + trigText(t.trig));
    const sign: Inline[] = ['поворачивает тело вокруг точки ', v(e.P), t.c > 0 ? ' против часовой стрелки — знак «+»' : ' по часовой стрелке — знак «−»'];
    if (t.comp === 'm') {
      items.push([...head, ' — пара сил: её момент одинаков относительно любой точки, плечо не нужно; ', t.c > 0 ? 'против часовой стрелки — «+».' : 'по часовой стрелке — «−».']);
      continue;
    }
    const vert = t.comp === 'y';
    const what = t.trig ? `${vert ? 'вертикальная' : 'горизонтальная'} составляющая силы` : `сила направлена ${vert ? 'вертикально' : 'горизонтально'}`;
    const node = nodeAt(t.at[0], t.at[1]);
    // Равнодействующая распределённой нагрузки — в центре тяжести эпюры.
    const d = !node ? m.dists.find((x) => [x.o, ...(x.split?.parts.map((p) => p.o) ?? [])].some((o) => o.L === t.sym.L && o.S === t.sym.S)) : undefined;
    const dd = d ? ([d, ...(d.split?.parts ?? [])] as { o: { L: string; S: string }; d: number }[]).find((x) => x.o.L === t.sym.L && x.o.S === t.sym.S) : undefined;
    const where: Inline[] = node
      ? [', приложена в точке ', v(node.name)]
      : d && dd
        ? [`, приложена в центре тяжести эпюры — на ${fmt(dd.d)} м от точки `, v(m.g.name[d.from])]
        : [`, приложена в точке (${fmt(t.at[0], 2)}; ${fmt(t.at[1], 2)})`];
    const dist: Inline[] = [
      `; плечо — расстояние по ${vert ? 'горизонтали' : 'вертикали'} от точки `,
      v(Pid.name),
      node ? ' до точки ' : ' до точки приложения',
      ...(node ? [v(node.name)] : []),
      `: ${fmt(t.arm as number)} м; `,
    ];
    items.push([...head, ' — ', what, ...where, ...dist, ...sign, '.']);
  }
  return items.length ? { k: 'ul', cls: 'explain', items } : null;
}

/** Заголовок статуса для штампа и подсказок. */
export const statusText = (s: Solution['status']): string => STATUS[s][0];

/** Шаг «Расчленяем систему на тела»: тела, шарниры между частями, касания и нити. */
function bodiesBlocks(m: Model, ex: boolean): Block[] {
  const explain = (...c: Inline[]): Block => ({ k: 'p', cls: 'explain', c });
  const blocks: Block[] = [
    { k: 'p', c: ['Рассматриваем каждое тело отдельно, а действие других тел заменяем силами:'] },
    {
      k: 'ul',
      items: m.partNames.map((names, p) => [`Тело ${roman(p)}: `, ...(p in m.parts.points ? ['точка ', v(names[0]), ' (тело-точка)'] : ['точки ', ...join(names.map((n) => [v(n)]), ', ')])]),
    },
  ];
  for (const h of m.parts.hinges) {
    const us = m.unknowns.filter((u) => u.hinge?.node === h);
    const ons = [...new Set(us.map((u) => u.hinge!.on))];
    const from = us[0]?.hinge?.from ?? 0;
    const sl = m.parts.slides[h];
    for (const on of ons) {
      const pair = us.filter((u) => u.hinge!.on === on);
      blocks.push({
        k: 'p',
        c:
          sl != null
            ? ['В скользящей заделке ', v(m.g.name[h]), ` на тело ${roman(on)} действуют сила `, sym(pair[0]), ' и пара сил с моментом ', sym(pair[1]), `, на тело ${roman(from)} — такие же в обратную сторону.`]
            : ['В шарнире ', v(m.g.name[h]), ` на тело ${roman(on)} действуют силы `, ...symList(pair), `, на тело ${roman(from)} — такие же силы в обратную сторону.`],
      });
    }
  }
  for (const l of m.links) blocks.push({ k: 'p', c: linkText(m, l) });
  for (const c of badLinkText(m)) blocks.push({ k: 'p', cls: 's-bad', c });
  if (Object.keys(m.parts.points).length)
    blocks.push({ k: 'p', c: ['Тело-точка: все силы приложены в одной точке, поэтому для него два уравнения — проекции на оси ', v('x'), ' и ', v('y'), '.'] });
  if (ex)
    blocks.push(
      explain(
        'Касание передаёт только давление по общей нормали к поверхностям (и силу трения вдоль касательной, если поверхность шероховатая); нить — только натяжение вдоль себя, одинаковое по обе стороны идеального блока. ',
        'Для каждого тела составляем свои уравнения равновесия; уравнения для всей системы — их сумма, в них силы взаимодействия тел взаимно уничтожаются.',
      ),
    );
  return blocks;
}

/** Давление или натяжение связи и его знак. */
function signLine(m: Model, u: Unknown, val: number): Inline[] {
  const l = m.links[u.link!.index];
  const ok = val >= -1e-9 * Math.max(1, Math.abs(val));
  const zero = Math.abs(val) < 1e-9;
  const what =
    l.link.type === 'thread'
      ? zero
        ? 'нить не натянута'
        : ok
          ? 'нить натянута'
          : 'нить должна была бы сжиматься — так не бывает'
      : zero
        ? 'тела касаются без давления'
        : ok
          ? 'тела прижаты друг к другу, касание работает'
          : 'касание должно было бы тянуть — тела разойдутся';
  return [sym(u), ` = ${fmt(val)} кН ${zero ? '= 0' : ok ? '> 0' : '< 0'} — ${what}`];
}

/** Шаг перебора предположений: какие односторонние связи работают. */
function casesBlocks(m: Model, sol: Solution, ex: boolean): Block[] {
  const explain = (...c: Inline[]): Block => ({ k: 'p', cls: 'explain', c });
  const cases = sol.cases!;
  const name = (id: string): Inline[] => {
    const l = [...m.links.map((x) => x.link), ...m.offLinks].find((x) => x.id === id)!;
    return [l.type === 'contact' ? 'касание ' : 'нить ', v(m.g.name[l.a]), '–', v(m.g.name[l.b])];
  };
  const k = cases[0].off.length;
  const blocks: Block[] = [
    {
      k: 'p',
      c: [
        `Неизвестных больше, чем уравнений, на ${k}, но связи между телами односторонние: касание может только давить, нить — только тянуть. `,
        `При заданной нагрузке работают не все такие связи. Предполагаем, какие из них работают (сила остальных равна нулю), решаем уравнения и проверяем знаки:`,
      ],
    },
  ];
  const items: Inline[][] = cases.map((c, i) => {
    const r: Inline[] = [`Случай ${i + 1}: работа${c.work.length > 1 ? 'ют' : 'ет'} `, ...join(c.work.map(name), ', '), '; не работа', c.off.length > 1 ? 'ют ' : 'ет ', ...join(c.off.map(name), ', '), '. '];
    if (c.ok) r.push('Все давления и натяжения не отрицательны — предположение верно.');
    else if (c.neg) r.push('Получается ', sym(m.byKey[c.neg.key] ?? { L: c.neg.key, S: '' }), ` = ${fmt(c.neg.val)} < 0 — предположение неверно.`);
    else r.push(`Система ${STATUS[c.status][0]} — предположение не подходит.`);
    return r;
  });
  blocks.push({ k: 'ul', items });
  if (!cases.some((c) => c.ok)) blocks.push({ k: 'badge', tone: 'bad', text: 'Равновесие невозможно' }, { k: 'p', c: ['Ни одно предположение не даёт допустимых сил: при такой нагрузке тела не остаются в покое.'] });
  else if (ex) blocks.push(explain('Дальше решаем уравнения равновесия для подходящего случая; силы неработающих связей в них не входят.'));
  return blocks;
}
