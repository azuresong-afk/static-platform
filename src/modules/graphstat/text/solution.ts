/**
 * Решение графическими построениями по шагам: диаграмма Кремоны (обозначения Боу, многоугольник внешних сил, узлы по очереди,
 * усилия), силовой и верёвочный многоугольники балки, цепь под равномерной нагрузкой. Числа — те же, что даёт аналитическое решение.
 */
import { b, sub, sym, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { nodeName, type Truss, type TrussResult } from '../../truss/model/truss';
import type { Cremona } from '../model/cremona';
import type { ChainInput, ChainResult, FunicularInput, FunicularResult } from '../model/funicular';

const f = (x: number) => fmt(x, 3);
const vec = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;
const Nsym = (k: number): Inline => sym({ L: 'N', S: String(k + 1) });
const kind = (N: number) => (Math.abs(N) < 1e-6 ? 'не нагружен' : N > 0 ? 'растянут' : 'сжат');

export interface GraphDocOptions {
  explain?: boolean;
  /** Ответ книги для сверки. */
  book?: { bars?: number[]; reactions?: Record<string, number> };
}

/* ---------- ферма: диаграмма Кремоны ---------- */

export function cremonaDoc(t: Truss, res: TrussResult, cr: Cremona, opts: GraphDocOptions = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (res.status !== 'ok') {
    steps.push({
      title: 'Ферма не определима',
      blocks: [
        { k: 'badge', tone: 'bad', text: res.status === 'invalid' ? 'ферма задана с ошибками' : 'ферма не статически определима' },
        { k: 'ul', items: (res.errors.length ? res.errors : ['Диаграмму Кремоны строят для статически определимой фермы: m + r = 2n.']).map((e) => [e]) },
      ],
    });
    return { steps };
  }
  // 1. Внешние силы.
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Реакции опор находим из равновесия всей фермы (в разделе «Фермы» то же решение — матрично; графически их даёт верёвочный многоугольник — он построен в задачах о балках этой вкладки). В каждом узле внешние нагрузка и реакция складываются в одну силу — она и войдёт в диаграмму.',
      ],
    });
    bl.push({
      k: 'ul',
      items: cr.ext.length
        ? cr.ext.map((e) => [
            sym({ L: e.hasReaction && !e.hasLoad ? 'R' : e.hasLoad && !e.hasReaction ? 'F' : 'R', S: nodeName(e.node) }),
            ` = ${vec(e.f)}, модуль ${f(Math.hypot(...e.f))}`,
          ])
        : [['Внешних сил нет.']],
    });
    steps.push({ title: 'Внешние силы в узлах', blocks: bl });
  }
  if (!cr.ok) {
    steps.push({
      title: 'Диаграмма не строится',
      blocks: [
        { k: 'badge', tone: 'warn', text: 'построение невозможно' },
        { k: 'p', c: [cr.error ?? 'Не удалось обозначить области.'] },
        { k: 'p', cls: 'explain', c: ['Усилия в стержнях такой фермы даёт раздел «Фермы» (вырезание узлов, метод сечений).'] },
      ],
    });
    return { steps };
  }
  // 2. Обозначения Боу.
  {
    const bl: Block[] = [];
    const outer = cr.faces.filter((x) => x.outer).map((x) => x.name),
      inner = cr.faces.filter((x) => !x.outer).map((x) => x.name);
    bl.push({
      k: 'p',
      c: [
        'Область вне фермы между соседними внешними силами обозначаем буквами: ',
        b(outer.join(', ')),
        '. Панели фермы (области, ограниченные стержнями) — греческими: ',
        b(inner.join(', ')),
        '. Каждому стержню и каждой внешней силе отвечает пара областей по обе стороны от него; на диаграмме это отрезок между точками с теми же обозначениями.',
      ],
    });
    if (cr.note) bl.push({ k: 'p', c: [cr.note] });
    ex(
      bl,
      'Обходя узел по часовой стрелке, переходим из одной области в другую через каждый стержень. Вектор сил, сходящихся в узле, на диаграмме замыкается: сумма всех векторов вокруг узла равна нулю — это и есть уравнения равновесия узла в графической форме.',
    );
    steps.push({ title: 'Обозначения Боу', blocks: bl });
  }
  // 3. Многоугольник внешних сил.
  {
    const bl: Block[] = [];
    const lines = cr.extVecs.map((ev, i) => {
      const a = cr.faces[ev.L],
        c = cr.faces[ev.R];
      return `${a.name}${c.name}: ${cr.ext[i].label.replace('_', '')} = ${vec(cr.ext[i].f)}`;
    });
    bl.push({
      k: 'p',
      c: [
        'Откладываем внешние силы подряд (в порядке обхода фермы по часовой стрелке) из точки ',
        b(cr.faces.find((x) => x.outer && x.step === 0)?.name ?? ''),
        ': вектор силы между областями ',
        v('X'),
        ' и ',
        v('Y'),
        ' идёт от точки ',
        v('X'),
        ' к точке ',
        v('Y'),
        '. Многоугольник внешних сил замыкается — ферма в равновесии.',
      ],
    });
    bl.push({ k: 'ul', items: lines.map((l) => [l]) });
    steps.push({ title: 'Многоугольник внешних сил', blocks: bl });
  }
  // 4. Узлы по очереди.
  {
    const bl: Block[] = [];
    if (cr.steps.length)
      bl.push({
        k: 'ul',
        items: cr.steps.map((s, i) => {
          const nm = nodeName(s.node);
          const fc = cr.faces[s.face];
          return [
            `${i + 1}. Узел ${nm}: новая область ${fc.name}. Через известную точку проводим прямую, параллельную стержню ${s.bars[0] + 1}, через другую известную — параллельную стержню ${s.bars[1] + 1}; пересечение — точка ${fc.name} = ${vec(fc.pt!)}.`,
          ];
        }),
      });
    bl.push({
      k: 'p',
      c: [
        cr.fallback
          ? 'Часть точек получена не построением, а из решения фермы (построение застопорилось: в узле больше одной неизвестной области).'
          : 'Все точки получены построением: в каждом узле (по очереди) неизвестны усилия двух стержней, и многоугольник сил узла замыкается пересечением двух параллелей.',
      ],
    });
    ex(
      bl,
      'Начинают с узла, где неизвестны два стержня, — обычно у опоры. После него известны точки вокруг соседних узлов, и снова остаётся по одной новой точке. Если при построении получается, что точки совпали, усилие в стержне равно нулю.',
    );
    steps.push({ title: 'Построение по узлам', blocks: bl });
  }
  // 5. Усилия.
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Усилие в стержне — длина его отрезка на диаграмме со знаком: растяжение, если вектор, действующий на узел, направлен от узла (по часовой стрелке из точки слева в точку справа).',
      ],
    });
    bl.push({
      k: 'ul',
      items: cr.bars.map((bv) => {
        const bk = opts.book?.bars?.[bv.bar];
        return [
          Nsym(bv.bar),
          ` (${nodeName(t.bars[bv.bar].a)}–${nodeName(t.bars[bv.bar].b)}) = ${fmt(bv.N, 3)} — ${kind(bv.N)}; точки ${cr.faces[bv.L].name}, ${cr.faces[bv.R].name}${bk != null ? `; книга: ${fmt(bk, 3)}` : ''}`,
        ];
      }),
    });
    bl.push({
      k: 'badge',
      tone: cr.maxErr < 1e-8 ? 'ok' : 'warn',
      text: `проверка: усилия по диаграмме совпадают с решением фермы (расхождение ${cr.maxErr < 1e-9 ? '< 10⁻⁹' : fmt(cr.maxErr, 3)})`,
    });
    steps.push({ title: 'Усилия в стержнях', blocks: bl });
    const rows: AnswerRow[] = cr.bars.map((bv) => ({ kind: 'main', val: [Nsym(bv.bar), ' = ', fmt(bv.N, 3)], note: kind(bv.N) }));
    steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  }
  return { steps };
}

/* ---------- балка: силовой и верёвочный многоугольники ---------- */

export function funicularDoc(inp: FunicularInput, r: FunicularResult, opts: GraphDocOptions & { bookR?: { RA: number; RB: number } } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const loads = inp.loads.filter((l) => Math.abs(l.F) > 1e-12);
  steps.push({
    title: 'Задача',
    blocks: [
      {
        k: 'p',
        c: [
          'Балка опирается на шарнир ',
          v('A'),
          ` (x = ${f(inp.xA)}) и каток `,
          v('B'),
          ` (x = ${f(inp.xB)}, реакция под углом ${f(inp.angleB)}° к оси x). Нагрузки:`,
        ],
      },
      { k: 'ul', items: loads.map((l, i) => [sym({ L: 'F', S: String(i + 1) }), ` = ${f(l.F)} в точке x = ${f(l.x)}, угол ${f(l.angle)}°`]) },
    ],
  });
  if (!r.ok) {
    steps.push({
      title: 'Построение невозможно',
      blocks: [
        { k: 'badge', tone: 'warn', text: 'построение невозможно' },
        { k: 'p', c: [r.error ?? ''] },
      ],
    });
    return { steps };
  }
  const n = loads.length;
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Откладываем нагрузки подряд: ',
        v('P'),
        sub('0'),
        v('P'),
        sub('1'),
        '… ',
        v('P'),
        sub(String(n)),
        ' — силовой многоугольник. Выбираем полюс ',
        v('O'),
        ` слева от него: O = ${vec(r.O)}. Лучи ${Array.from({ length: n + 1 }, (_, i) => `O–P${i}`).join(', ')}.`,
      ],
    });
    bl.push({ k: 'ul', items: r.P.map((p, i) => [`P${i} = ${vec(p)}`]) });
    ex(
      bl,
      'Полюс можно выбрать где угодно: от этого меняется форма верёвочного многоугольника, а реакции — нет. Расстояние от полюса до силового многоугольника (полюсное расстояние) — масштаб для высоты верёвочного многоугольника.',
    );
    steps.push({ title: 'Силовой многоугольник', blocks: bl });
  }
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Из точки ',
        v('A'),
        ' проводим сторону ',
        v('s'),
        sub('0'),
        ' параллельно лучу ',
        v('OP'),
        sub('0'),
        ' до линии действия ',
        sym({ L: 'F', S: '1' }),
        ', далее каждую следующую сторону — параллельно очередному лучу до следующей линии силы. Последняя сторона пересекает линию действия реакции катка в точке ',
        v('K'),
        '.',
      ],
    });
    bl.push({ k: 'ul', items: r.V.map((p, i) => [`${i === 0 ? 'A' : i === r.V.length - 1 ? 'K' : String(i)} = ${vec(p)}`]) });
    bl.push({
      k: 'p',
      c: [
        'Замыкающая ',
        v('AK'),
        '. Проводим из полюса луч, параллельный ',
        v('AK'),
        ', до пересечения с прямой через ',
        v('P'),
        sub(String(n)),
        ' в направлении реакции катка — точка ',
        v('Q'),
        ` = ${vec(r.Q)}.`,
      ],
    });
    steps.push({ title: 'Верёвочный многоугольник', blocks: bl });
  }
  {
    const bl: Block[] = [];
    bl.push({
      k: 'eq',
      lines: [
        {
          c: [
            sym({ L: 'R', S: 'B' }),
            ' = ',
            v('Q'),
            ' − ',
            v('P'),
            sub(String(n)),
            ` = ${vec(r.RB)},  `,
            sym({ L: 'R', S: 'A' }),
            ' = ',
            v('P'),
            sub('0'),
            ' − ',
            v('Q'),
            ` = ${vec(r.RA)}`,
          ],
        },
        { num: true, c: [sym({ L: 'R', S: 'A' }), ` = ${f(Math.hypot(...r.RA))},  `, sym({ L: 'R', S: 'B' }), ` = ${f(Math.hypot(...r.RB))}`] },
      ],
    });
    bl.push({
      k: 'badge',
      tone: r.maxErr < 1e-8 ? 'ok' : 'warn',
      text: `проверка уравнениями равновесия: расхождение ${r.maxErr < 1e-9 ? '< 10⁻⁹' : f(r.maxErr)}`,
    });
    if (opts.bookR) bl.push({ k: 'p', c: [`Ответ книги: R_A = ${f(opts.bookR.RA)}, R_B = ${f(opts.bookR.RB)}.`] });
    steps.push({ title: 'Реакции', blocks: bl });
    steps.push({
      title: 'Ответ',
      blocks: [
        {
          k: 'answer',
          rows: [
            { kind: 'main', val: [sym({ L: 'R', S: 'A' }), ' = ', f(Math.hypot(...r.RA))], note: `X = ${f(r.RA[0])}, Y = ${f(r.RA[1])}` },
            { kind: 'main', val: [sym({ L: 'R', S: 'B' }), ' = ', f(Math.hypot(...r.RB))], note: `X = ${f(r.RB[0])}, Y = ${f(r.RB[1])}` },
          ],
        },
      ],
    });
  }
  return { steps };
}

/* ---------- цепь ---------- */

export function chainDoc(inp: ChainInput, c: ChainResult, opts: GraphDocOptions & { bookT?: number } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...cc: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c: cc });
  };
  if (!c.ok) {
    steps.push({
      title: 'Построение невозможно',
      blocks: [
        { k: 'badge', tone: 'warn', text: 'построение невозможно' },
        { k: 'p', c: [c.error ?? ''] },
      ],
    });
    return { steps };
  }
  steps.push({
    title: 'Нагрузка на цепь',
    blocks: [
      {
        k: 'p',
        c: [
          `Пролёт L = ${f(inp.L)}, стрела f = ${f(inp.f)}, нагрузка q = ${f(inp.q)} на единицу длины; её воспринимают ${inp.chains} цеп${inp.chains === 1 ? 'ь' : 'и'} поровну: на одну цепь `,
          v('q'),
          sub('ц'),
          ` = ${f(c.qc)}.`,
        ],
      },
      {
        k: 'p',
        c: [
          `Нагрузку на цепь делим на ${c.xs.length} равных частей: сила `,
          v('w'),
          ` = qL/n = ${f(c.w)} в серединах участков (x = ${c.xs.map(f).join('; ')}). Эти силы — вертикальные, равны, поэтому силовой многоугольник — вертикальный отрезок длиной ${f(c.qc * inp.L)}.`,
        ],
      },
    ],
  });
  steps.push({
    title: 'Полюсное расстояние',
    blocks: [
      {
        k: 'p',
        c: [
          'Опоры цепи — на одном уровне, значит замыкающая горизонтальна и луч, параллельный ей, горизонтален: полюс ',
          v('O'),
          ' лежит на горизонтали через середину силового многоугольника, а полюсное расстояние ',
          v('H'),
          ' — горизонтальное усилие в цепи.',
        ],
      },
      {
        k: 'eq',
        lines: [
          { c: [v('H'), ' = ', v('M'), '(L/2)/', v('f'), ' = ', v('q'), sub('ц'), v('L'), '²/(8', v('f'), ')'] },
          { num: true, c: [v('H'), ` = ${f(c.qc)}·${f(inp.L)}²/(8·${f(inp.f)}) = ${f(c.H)}`] },
        ],
      },
    ],
  });
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Вершины верёвочного многоугольника: ордината под хордой ',
        v('y'),
        ' = ',
        v('M'),
        '(x)/',
        v('H'),
        ', где ',
        v('M'),
        '(x) — изгибающий момент от тех же сил на балке пролётом ',
        v('L'),
        '.',
      ],
    });
    bl.push({ k: 'ul', items: c.V.map(([x, y], i) => [`${i === 0 ? 'A' : i === c.V.length - 1 ? 'B' : String(i)}: x = ${f(x)}, y = ${f(y)}`]) });
    ex(bl, 'При равномерной нагрузке цепь провисает по параболе y = −4fx(L − x)/L²; ломаная из n отрезков вписана в неё, и чем больше n, тем она ближе.');
    steps.push({ title: 'Вершины многоугольника', blocks: bl });
  }
  {
    const bl: Block[] = [];
    bl.push({
      k: 'eq',
      lines: [
        { c: [v('T'), sub('C'), ' = ', v('H'), ` = ${f(c.Tmid)}`] },
        { c: [v('T'), sub('A'), ' = ', v('T'), sub('B'), ' = √(', v('H'), '² + (', v('q'), sub('ц'), v('L'), '/2)²) = ', `${f(c.Tsup)}`] },
      ],
    });
    if (opts.bookT != null) bl.push({ k: 'p', c: [`Ответ книги: натяжение цепи в средней точке C — ${f(opts.bookT)}.`] });
    steps.push({ title: 'Натяжения', blocks: bl });
    steps.push({
      title: 'Ответ',
      blocks: [
        {
          k: 'answer',
          rows: [
            { kind: 'main', val: [v('T'), sub('C'), ' = ', f(c.Tmid)], note: 'в средней точке цепи' },
            { kind: 'aux', val: [v('T'), sub('A'), ' = ', f(c.Tsup)], note: 'у опор' },
          ],
        },
      ],
    });
  }
  return { steps };
}
