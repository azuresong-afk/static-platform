/**
 * Решение фермы по шагам: определимость, реакции опор из равновесия всей фермы, нулевые стержни,
 * метод вырезания узлов, проверка методом сечений (Риттера), ответ.
 * Усилия считаем растягивающими (сила на узел — от узла вдоль стержня); знак «−» — стержень сжат.
 */
import { b, join, sub, sym, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { barDir, barsAt, jointOrder, nodeName, ritterCut, ritterForce, unitOf, zeroBars, type Reaction, type Truss, type TrussResult } from '../model/truss';

const f = (x: number) => fmt(x, 3);
const Nsym = (k: number): Inline => sym({ L: 'N', S: String(k + 1) });
const Rsym = (r: Reaction): Inline => sym({ L: r.L, S: r.S });
const kind = (N: number) => (Math.abs(N) < 1e-9 ? 'не нагружен' : N > 0 ? 'растянут' : 'сжат');

/** Острый угол линии действия с осью x, град. */
const acute = (ux: number, uy: number) => (Math.atan2(Math.abs(uy), Math.abs(ux)) * 180) / Math.PI;

/** Слагаемое проекции: «+ N₁·cos 30°», «− R_B», «+ 2·sin 45°». Пусто, если проекция нулевая. */
function proj(name: Inline[] | string, ux: number, uy: number, axis: 'x' | 'y'): Inline[] {
  const c = axis === 'x' ? ux : uy;
  if (Math.abs(c) < 1e-12) return [];
  const sign = c > 0 ? ' + ' : ' − ';
  const nm = typeof name === 'string' ? [name] : name;
  if (Math.abs(Math.abs(c) - 1) < 1e-12) return [sign, ...nm];
  return [sign, ...nm, `·${axis === 'x' ? 'cos' : 'sin'} ${fmt(acute(ux, uy), 2)}°`];
}
/** Сумма слагаемых как уравнение «… = 0» (ведущий плюс убирается). */
function eq(lead: Inline[], terms: Inline[][]): Inline[] {
  const flat = terms.flat();
  if (!flat.length) return [...lead, ' = 0'];
  if (flat[0] === ' + ') flat.shift();
  else if (flat[0] === ' − ') flat[0] = '−';
  return [...lead, ' = ', ...flat, ' = 0'];
}

export interface TrussDocOptions {
  explain?: boolean;
  /** Стержень для проверки методом Риттера. */
  ritter?: number | null;
}

export function trussDoc(t: Truss, res: TrussResult, opts: TrussDocOptions = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const nm = nodeName;

  // 1. Определимость.
  {
    const bl: Block[] = [];
    if (res.status === 'invalid') {
      bl.push({ k: 'badge', tone: 'bad', text: 'ферма задана с ошибками' }, { k: 'ul', items: res.errors.map((e) => [e]) });
      steps.push({ title: 'Проверяем данные', blocks: bl });
      return { steps };
    }
    bl.push({
      k: 'p',
      c: [`Узлов `, v('n'), ` = ${res.n}, стержней `, v('m'), ` = ${res.m}, опорных реакций `, v('r'), ` = ${res.r}. `, 'Для каждого узла — два уравнения равновесия (ΣF', sub('x'), ' = 0, ΣF', sub('y'), ` = 0): всего 2`, v('n'), ` = ${2 * res.n}.`],
    });
    const cmp = res.m + res.r === 2 * res.n ? '=' : res.m + res.r > 2 * res.n ? '>' : '<';
    bl.push({ k: 'eq', lines: [{ c: [v('m'), ' + ', v('r'), ` = ${res.m} + ${res.r} = ${res.m + res.r} ${cmp} 2`, v('n'), ` = ${2 * res.n}`] }] });
    const badge: Record<string, [Block & { k: 'badge' }, string]> = {
      ok: [{ k: 'badge', tone: 'ok', text: 'ферма статически определима' }, 'Неизвестных столько же, сколько уравнений, и уравнения независимы — все усилия находятся из статики.'],
      indeterminate: [{ k: 'badge', tone: 'warn', text: 'ферма статически неопределима' }, `Неизвестных больше, чем уравнений, на ${res.m + res.r - 2 * res.n}: лишние стержни или опоры — нужны условия деформаций (сопротивление материалов).`],
      mechanism: [
        { k: 'badge', tone: 'bad', text: 'ферма геометрически изменяема' },
        res.m + res.r < 2 * res.n
          ? `Стержней и опор не хватает (на ${2 * res.n - res.m - res.r}): узлы могут смещаться — это механизм, а не ферма.`
          : 'Число связей достаточно, но они расположены неудачно (например, три шарнира на одной прямой или все опоры пересекаются в одной точке): ферма мгновенно изменяема, уравнения зависимы.',
      ],
    };
    const [bd, why] = badge[res.status];
    bl.push(bd, { k: 'p', c: [why] });
    ex(bl, 'Стержни фермы соединены в узлах шарнирами, нагрузка приложена только в узлах, поэтому каждый стержень лишь растянут или сжат: его усилие направлено вдоль стержня.');
    steps.push({ title: 'Проверяем статическую определимость', blocks: bl });
    if (res.status !== 'ok') return { steps };
  }

  const R = res.R;
  const reacVal = (key: string) => R[res.reactions.findIndex((r) => r.key === key)];

  // 2. Реакции опор.
  {
    const bl: Block[] = [];
    const pins = t.supports.filter((s) => s.kind === 'pin');
    const rollers = res.reactions.filter((r) => r.L === 'R');
    if (res.r === 3 && pins.length === 1 && rollers.length === 1) {
      const P = t.nodes[pins[0].node],
        pn = nm(pins[0].node);
      const ro = rollers[0],
        Q = t.nodes[ro.node];
      const arm = (x: number, y: number, ux: number, uy: number) => (x - P.x) * uy - (y - P.y) * ux;
      const terms: Inline[][] = [];
      const cR = arm(Q.x, Q.y, ro.ux, ro.uy);
      terms.push([cR > 0 ? ' + ' : ' − ', Rsym(ro), `·${f(Math.abs(cR))}`]);
      let known = 0;
      for (const l of t.loads) {
        const [ux, uy] = unitOf(l.angle),
          c = arm(t.nodes[l.node].x, t.nodes[l.node].y, ux, uy);
        if (Math.abs(c) < 1e-12 || Math.abs(l.F) < 1e-12) continue;
        known += l.F * c;
        terms.push([l.F * c > 0 ? ' + ' : ' − ', `${f(Math.abs(l.F))}·${f(Math.abs(c))}`]);
      }
      const rv = -known / cR;
      const px = (axis: 'x' | 'y') => {
        const tt: Inline[][] = [proj([Rsym(ro)], ro.ux, ro.uy, axis)];
        for (const l of t.loads) {
          const [ux, uy] = unitOf(l.angle);
          tt.push(proj(f(Math.abs(l.F)), Math.sign(l.F) * ux, Math.sign(l.F) * uy, axis));
        }
        return tt;
      };
      bl.push({
        k: 'p',
        c: ['Рассматриваем ферму целиком. Моменты берём относительно шарнира ', v(pn), ': реакции ', sym({ L: 'X', S: pn }), ', ', sym({ L: 'Y', S: pn }), ' в уравнение не входят, остаётся одно неизвестное ', Rsym(ro), '.'],
      });
      bl.push({
        k: 'eq',
        lines: [
          { c: eq(['Σ', v('M'), sub(pn)], terms) },
          { num: true, c: [Rsym(ro), ' = ', b(`${f(rv)} кН`)] },
          { c: eq(['Σ', v('F'), sub('x')], [[' + ', sym({ L: 'X', S: pn })], ...px('x')]) },
          { num: true, c: [sym({ L: 'X', S: pn }), ' = ', b(`${f(reacVal('X_' + pn))} кН`)] },
          { c: eq(['Σ', v('F'), sub('y')], [[' + ', sym({ L: 'Y', S: pn })], ...px('y')]) },
          { num: true, c: [sym({ L: 'Y', S: pn }), ' = ', b(`${f(reacVal('Y_' + pn))} кН`)] },
        ],
      });
      ex(
        bl,
        'Момент силы равен её модулю, умноженному на плечо — расстояние от точки до линии действия силы; «+» — поворот против часовой стрелки. Реакции катка направлены по нормали к опорной поверхности.',
      );
    } else {
      bl.push({ k: 'p', c: ['Опоры не сводятся к шарниру и катку, поэтому реакции находим вместе с усилиями из совместного решения уравнений равновесия всех узлов:'] });
      bl.push({ k: 'ul', items: res.reactions.map((r, j) => [Rsym(r), ` = ${f(R[j])} кН`]) });
    }
    steps.push({ title: 'Находим реакции опор', blocks: bl });
  }

  // 3. Нулевые стержни.
  const zeros = zeroBars(t);
  if (zeros.length) {
    const bl: Block[] = [
      {
        k: 'ul',
        items: zeros.map((z) => [
          'стержень ',
          v(String(z.bar + 1)),
          ` (узел ${nm(z.node)}): `,
          z.rule === 'two' ? 'в ненагруженном узле сходятся два стержня не на одной прямой' : 'в ненагруженном узле три стержня, два из них на одной прямой — третий не нагружен',
        ]),
      },
    ];
    ex(
      bl,
      'Признаки нулевых стержней следуют из равновесия узла. Если в узле без нагрузки сходятся два стержня не на одной прямой, проекция на ось, перпендикулярную одному из них, даёт нуль для другого. ',
      'Если сходятся три стержня и два лежат на одной прямой, проекция на перпендикуляр к этой прямой содержит только третий стержень. Найденные нулевые стержни можно мысленно убрать и применить признаки снова.',
    );
    steps.push({ title: 'Нулевые стержни', blocks: bl });
  }

  // 4. Вырезание узлов.
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: ['Вырезаем узлы по очереди, начиная с узла, где не больше двух неизвестных усилий. Все усилия считаем растягивающими — направленными от узла вдоль стержня; знак «−» в ответе означает, что стержень сжат.'],
    });
    const known = new Set(zeros.map((z) => z.bar));
    const { steps: js, rest } = jointOrder(t, known);
    for (const s of js) {
      const i = s.node;
      const at = barsAt(t, i);
      const kn = at.filter((k) => !s.bars.includes(k));
      const terms = (axis: 'x' | 'y'): Inline[][] => {
        const tt: Inline[][] = [];
        for (const k of at) {
          const [ux, uy] = barDir(t, k, i);
          tt.push(proj([Nsym(k)], ux, uy, axis));
        }
        res.reactions.forEach((r) => r.node === i && tt.push(proj([Rsym(r)], r.ux, r.uy, axis)));
        for (const l of t.loads)
          if (l.node === i && Math.abs(l.F) > 1e-12) {
            const [ux, uy] = unitOf(l.angle);
            tt.push(proj(f(Math.abs(l.F)), Math.sign(l.F) * ux, Math.sign(l.F) * uy, axis));
          }
        return tt;
      };
      const head: Inline[] = ['Узел ', v(nm(i)), ': неизвестн', s.bars.length > 1 ? 'ы ' : 'о ', ...join(s.bars.map((k) => [Nsym(k)]), ', ')];
      if (kn.length) head.push('; известны ', ...join(kn.map((k) => [Nsym(k), ` = ${f(res.N[k])}`]), ', '));
      const rs = res.reactions.filter((r) => r.node === i);
      if (rs.length) head.push(kn.length ? ', ' : '; известны ', ...join(rs.map((r) => [Rsym(r), ` = ${f(reacVal(r.key))}`]), ', '));
      head.push('.');
      bl.push({ k: 'p', c: head });
      bl.push({
        k: 'eq',
        lines: [
          { c: eq(['Σ', v('F'), sub('x')], terms('x')) },
          { c: eq(['Σ', v('F'), sub('y')], terms('y')) },
          { num: true, c: join(s.bars.map((k) => [Nsym(k), ' = ', b(`${f(res.N[k])} кН`), ` (${kind(res.N[k])})`]), '; ') },
        ],
      });
    }
    if (rest.length) {
      bl.push({
        k: 'p',
        c: ['Дальше в каждом узле больше двух неизвестных — оставшиеся усилия находим совместным решением уравнений равновесия узлов: ', ...join(rest.map((k) => [Nsym(k), ` = ${f(res.N[k])} кН`]), '; '), '.'],
      });
    }
    ex(
      bl,
      'Каждый вырезанный узел — система сходящихся сил: два уравнения проекций позволяют найти не больше двух неизвестных. Известные усилия подставляем со своим знаком, поэтому направление на рисунке узла всегда одно и то же — от узла.',
    );
    steps.push({ title: 'Метод вырезания узлов', blocks: bl });
  }

  // 5. Метод Риттера.
  if (opts.ritter != null && opts.ritter >= 0 && opts.ritter < t.bars.length) {
    const k = opts.ritter;
    const c = ritterCut(t, k);
    const bl: Block[] = [];
    if (!c) bl.push({ k: 'p', c: ['Для стержня ', v(String(k + 1)), ' нет сечения через три стержня, которое делило бы ферму на две части, — его усилие находим только вырезанием узлов.'] });
    else {
      const [j, l] = c.others;
      const N = ritterForce(t, res, c);
      bl.push({
        k: 'p',
        c: [
          'Рассекаем ферму по стержням ',
          v(String(k + 1)),
          ', ',
          v(String(j + 1)),
          ', ',
          v(String(l + 1)),
          ' и рассматриваем часть с узл',
          c.side.length > 1 ? 'ами ' : 'ом ',
          ...join(c.side.map((i) => [v(nm(i))]), ', '),
          '. На неё действуют внешние силы части и три усилия в рассечённых стержнях.',
        ],
      });
      const inSide = new Set(c.side);
      const forces: { name: Inline[]; x: number; y: number; ux: number; uy: number; val: number }[] = [];
      for (const ld of t.loads) if (inSide.has(ld.node) && Math.abs(ld.F) > 1e-12) {
          const [ux, uy] = unitOf(ld.angle);
          forces.push({ name: [f(Math.abs(ld.F))], x: t.nodes[ld.node].x, y: t.nodes[ld.node].y, ux: Math.sign(ld.F) * ux, uy: Math.sign(ld.F) * uy, val: Math.abs(ld.F) });
        }
      res.reactions.forEach((r, jj) => inSide.has(r.node) && Math.abs(R[jj]) > 1e-12 && forces.push({ name: [f(Math.abs(R[jj]))], x: t.nodes[r.node].x, y: t.nodes[r.node].y, ux: Math.sign(R[jj]) * r.ux, uy: Math.sign(R[jj]) * r.uy, val: Math.abs(R[jj]) }));
      const A = t.nodes[c.at],
        [ux, uy] = barDir(t, k, c.at);
      if (c.point) {
        const [px, py] = c.point;
        const arm = (x: number, y: number, a: number, bb: number) => (x - px) * bb - (y - py) * a;
        const terms: Inline[][] = [];
        const cN = arm(A.x, A.y, ux, uy);
        terms.push([cN > 0 ? ' + ' : ' − ', Nsym(k), `·${f(Math.abs(cN))}`]);
        for (const fo of forces) {
          const cc = arm(fo.x, fo.y, fo.ux, fo.uy);
          if (Math.abs(cc) > 1e-12) terms.push([cc > 0 ? ' + ' : ' − ', ...fo.name, `·${f(Math.abs(cc))}`]);
        }
        bl.push({
          k: 'p',
          c: ['Точка Риттера ', sym({ L: 'K', S: 'р' }), ` (${f(px)}; ${f(py)}) — пересечение линий стержней `, v(String(j + 1)), ' и ', v(String(l + 1)), ': их усилия в уравнение моментов относительно неё не входят. Реакции опор взяты найденные выше, по модулю и направлению.'],
        });
        bl.push({ k: 'eq', lines: [{ c: eq(['Σ', v('M'), sub('Kр')], terms) }, { num: true, c: [Nsym(k), ' = ', b(`${f(N)} кН`), ` — совпадает с вырезанием узлов (${kind(N)})`] }] });
      } else {
        const [nx, ny] = c.axis!;
        const terms: Inline[][] = [];
        const dot = (a: number, bb: number) => a * nx + bb * ny;
        const cN = dot(ux, uy);
        terms.push([cN > 0 ? ' + ' : ' − ', Nsym(k), Math.abs(Math.abs(cN) - 1) < 1e-12 ? '' : `·${f(Math.abs(cN))}`]);
        for (const fo of forces) {
          const cc = dot(fo.ux, fo.uy);
          if (Math.abs(cc) > 1e-12) terms.push([cc > 0 ? ' + ' : ' − ', ...fo.name, Math.abs(Math.abs(cc) - 1) < 1e-12 ? '' : `·${f(Math.abs(cc))}`]);
        }
        bl.push({
          k: 'p',
          c: ['Стержни ', v(String(j + 1)), ' и ', v(String(l + 1)), ' параллельны — точки Риттера нет. Проецируем силы на ось ', v('n'), ', перпендикулярную им: их усилия в проекцию не входят.'],
        });
        bl.push({ k: 'eq', lines: [{ c: eq(['Σ', v('F'), sub('n')], terms) }, { num: true, c: [Nsym(k), ' = ', b(`${f(N)} кН`), ` — совпадает с вырезанием узлов (${kind(N)})`] }] });
      }
      ex(bl, 'Метод сечений (Риттера) позволяет найти усилие в стержне сразу, не проходя все узлы подряд: сечение проводят через три стержня, а уравнение составляют так, чтобы два других усилия в него не вошли.');
    }
    steps.push({ title: `Проверка методом сечений (Риттера): стержень ${k + 1}`, blocks: bl });
  }

  // 6. Ответ.
  const rows: AnswerRow[] = [
    ...res.reactions.map((r, j): AnswerRow => ({ kind: 'main', val: [Rsym(r), ` = ${f(R[j])} кН`], note: 'реакция опоры' })),
    ...t.bars.map((q, k): AnswerRow => ({ kind: 'main', val: [Nsym(k), ` = ${f(res.N[k])} кН`], note: `стержень ${nm(q.a)}–${nm(q.b)} ${kind(res.N[k])}` })),
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
