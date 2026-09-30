/** Решение для тела в пространстве: связи и реакции, определимость, уравнения по одному неизвестному, проверка, ответ. */
import { b, join, sub, sym, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { Action, Body, BodyModel, BodySolution, Candidate } from '../model/body';

const f = (x: number) => fmt(x, 3);
const S = (a: Pick<Action, 'L' | 'S'>): Inline => sym({ L: a.L, S: a.S });
const AXN = { x: 'Ox', y: 'Oy', z: 'Oz' } as const;

/** Название уравнения: ΣFx, ΣMx(A). */
function eqName(c: Candidate, body: Body): Inline[] {
  if (c.type === 'F') return ['Σ', v('F'), sub(c.axis)];
  return ['Σ', v('M'), sub(c.P == null ? c.axis : `${c.axis}${body.points[c.P].name}`)];
}
/** Левая часть: слагаемые «± символ·коэффициент». */
function lhs(c: Candidate): Inline[] {
  const out: Inline[] = [];
  c.terms.forEach((t, i) => {
    const sg = t.c < 0 ? '−' : '+';
    out.push(i ? ` ${sg} ` : sg === '−' ? '−' : '', S(t.a));
    if (Math.abs(Math.abs(t.c) - 1) > 1e-12) out.push(`·${f(Math.abs(t.c))}`);
  });
  return out;
}
const eqLine = (c: Candidate, body: Body): Inline[] => [...eqName(c, body), ' = ', ...lhs(c), ' = 0'];

function eqTitle(c: Candidate, body: Body): Inline[] {
  if (c.type === 'F') return ['Проекции на ось ', v(AXN[c.axis]), ':'];
  return ['Моменты относительно оси, параллельной ', v(AXN[c.axis]), ' и проходящей через точку ', v(body.points[c.P!].name), ':'];
}

export function bodyDoc(body: Body, m: BodyModel, sol: BodySolution, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };

  // 1. Связи.
  {
    const kindName = { ball: 'Сферический шарнир', thrust: 'Подпятник', bearing: 'Подшипник (петля)', rod: 'Стержень (нить)', normal: 'Гладкая опора' } as const;
    const items: Inline[][] = body.supports.map((s, j) => {
      const us = m.unknowns.filter((u) => u.sup === j);
      const extra =
        s.kind === 'bearing'
          ? ` с осью ${AXN[s.axis ?? 'z']}: реакции поперёк оси`
          : s.kind === 'rod'
            ? `, закреплён в точке ${body.points[s.to ?? 0].name}: усилие вдоль стержня («+» — сжатие)`
            : s.kind === 'normal'
              ? ': реакция по нормали к поверхности'
              : ': реакция любого направления — три составляющие';
      return [`${kindName[s.kind]} `, v(body.points[s.at].name), `${extra} → `, ...join(us.map((u) => [S(u)]), ', ')];
    });
    for (const u of m.unknowns.filter((x) => x.sup == null)) items.push(['Сила ', S(u), ': направление известно, модуль ищем']);
    const bl: Block[] = [{ k: 'p', c: ['Отбрасываем опоры и заменяем их реакциями:'] }, { k: 'ul', items }];
    bl.push({
      k: 'p',
      c: [
        'Известные нагрузки: ',
        ...join(
          m.knowns.map((k) => [S(k), ` = ${f(k.val)}`, k.kind === 'f' ? ` кН (направление ${k.u.map((x) => f(x)).join('; ')})` : ' кН·м']),
          ', ',
        ),
        '.',
      ],
    });
    ex(
      bl,
      'Сферический шарнир и подпятник не дают точке смещаться в любом направлении — три реакции. Подшипник (петля, цилиндрический шарнир) не мешает сдвигу вдоль своей оси — две реакции поперёк неё. Стержень с шарнирами на концах и нить дают одну реакцию вдоль себя.',
    );
    steps.push({ title: 'Освобождаемся от связей', blocks: bl });
  }

  // 2. Определимость.
  {
    const status: Record<string, [Block & { k: 'badge' }, string]> = {
      ok: [{ k: 'badge', tone: 'ok', text: 'статически определимо' }, 'Неизвестных не больше шести, и уравнения равновесия позволяют найти их все.'],
      indeterminate: [{ k: 'badge', tone: 'warn', text: 'статически неопределимо' }, `Неизвестных ${sol.n}, а независимых уравнений — шесть: лишние связи.`],
      mechanism: [{ k: 'badge', tone: 'bad', text: 'тело не закреплено' }, 'Связи расположены так, что тело может перемещаться: уравнения равновесия зависимы.'],
      noequilibrium: [{ k: 'badge', tone: 'bad', text: 'равновесие невозможно' }, 'Связей не хватает, чтобы уравновесить нагрузку: тело может двигаться, и нагрузка его сдвигает или поворачивает.'],
      nosupport: [{ k: 'badge', tone: 'bad', text: 'нет опор' }, 'Добавьте опоры.'],
    };
    const [bd, why] = status[sol.status];
    const bl: Block[] = [{ k: 'p', c: [`Неизвестных: ${sol.n}. Для пространственной системы сил — шесть уравнений: три суммы проекций и три суммы моментов относительно осей.`] }, bd, { k: 'p', c: [why] }];
    steps.push({ title: 'Проверяем статическую определимость', blocks: bl });
    if (sol.status !== 'ok') return { steps };
  }

  // 3. Уравнения.
  {
    const bl: Block[] = [];
    ex(
      bl,
      'Момент силы относительно оси равен моменту её проекции на плоскость, перпендикулярную оси, относительно точки пересечения оси с этой плоскостью: ',
      v('M'),
      sub('x'),
      ' = ',
      v('y'),
      '·',
      v('F'),
      sub('z'),
      ' − ',
      v('z'),
      '·',
      v('F'),
      sub('y'),
      ' (координаты — от точки на оси). Сила, параллельная оси или пересекающая её, момента относительно неё не создаёт — поэтому оси проводим через опоры.',
    );
    for (const st of sol.steps) {
      bl.push({ k: 'p', c: eqTitle(st.c, body) });
      bl.push({ k: 'eq', lines: [{ c: eqLine(st.c, body) }, { num: true, c: [S(m.unknowns.find((u) => u.key === st.key)!), ' = ', b(`${f(sol.vals[st.key])} кН`)] }] });
    }
    if (sol.joint) {
      bl.push({ k: 'p', c: ['Остальные неизвестные входят в уравнения по нескольку — решаем совместно:'] });
      bl.push({
        k: 'eq',
        lines: [
          ...sol.joint.cands.map((c) => ({ c: eqLine(c, body) })),
          { num: true, c: join(sol.joint.keys.map((k) => [S(m.unknowns.find((u) => u.key === k)!), ' = ', b(`${f(sol.vals[k])} кН`)]), '; ') },
        ],
      });
    }
    steps.push({ title: 'Составляем и решаем уравнения равновесия', blocks: bl });
  }

  // 4. Проверка.
  if (sol.check) {
    const c = sol.check.c;
    steps.push({
      title: 'Проверка',
      blocks: [
        { k: 'p', c: ['Неиспользованное уравнение — ', ...eqTitle(c, body)] },
        { k: 'eq', lines: [{ c: eqLine(c, body) }, { num: true, c: ['подставляем найденные значения: невязка ', b(f(sol.check.r))] }] },
      ],
    });
  }

  // 5. Ответ.
  const rows: AnswerRow[] = m.unknowns.map((u) => ({ kind: 'main', val: [S(u), ` = ${f(sol.vals[u.key])} кН`], note: sol.vals[u.key] < 0 ? 'направлена противоположно выбранной' : '' }));
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
