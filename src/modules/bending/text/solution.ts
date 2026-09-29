/**
 * Решение «эпюры Q и M» в стиле учебника: реакции, правило знаков, участки, формулы Q(z), M(z)
 * и их значения, экстремумы, проверки по скачкам, ответ (опасные сечения).
 */
import { forceNames, type Conventions } from '../../../shared/conventions';
import { b, join, sub, sym, v, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { acuteExpr, fmt, trigFactor, trigText } from '../../../shared/format';
import { polyDegree, polyEval, type Poly } from '../../../shared/poly';
import { roman } from '../../frames/model/geometry';
import type { Action } from '../../frames/solver/model';
import { beamMaxima, type Beam, type Span, type Term } from '../model/beam';

export interface BendingTextOptions {
  explain?: boolean;
}

const EPS = 1e-9;
const f3 = (x: number) => fmt(x, 3);

/** Координата участка: z₁, z₂… */
const zOf = (c: Conventions, i: number): Inline[] => [v(c.axis), sub(String(i + 1))];

/** «Q(z₁)», «M_x(z₂)» */
function fn(name: { L: string; S: string }, z: Inline[]): Inline[] {
  return [sym(name), '(', ...z, ')'];
}

/** Символ силы с множителем проекции на вертикаль: «Y_A», «F·sin 60°», «S·sin α». */
function forceSym(a: Action): Inline[] {
  const r: Inline[] = [sym(a)];
  if (Math.abs(Math.abs(a.dy) - 1) < 1e-12) return r;
  let t = trigFactor(a.angle, 'y', a.refAxis);
  if (t && a.angleName) t = { ...t, name: acuteExpr(a.userAngle ?? 0, a.angleName) };
  if (t) r.push('·' + trigText(t));
  return r;
}

const qSym = (S: string): Inline => sym({ L: 'q', S });

/** Число без знака для записи множителя. */
const num = (x: number) => f3(Math.abs(x));

/** Сумма слагаемых со знаками: [[+1, […]], [−1, […]]] → «Y_A − F·sin 60° + …». Пустая — «0». */
function signedSum(parts: [number, Inline[]][]): Inline[] {
  const r: Inline[] = [];
  parts.forEach(([s, c], i) => {
    if (i === 0) {
      if (s < 0) r.push('−');
    } else r.push(s < 0 ? ' − ' : ' + ');
    r.push(...c);
  });
  return r.length ? r : ['0'];
}

/** Многочлен от z: «6,274 − 2·z₁ + 0,5·z₁²». */
function polyText(p: Poly, z: Inline[], scale: number): Inline[] {
  const deg = polyDegree(p, scale);
  const parts: [number, Inline[]][] = [];
  for (let i = 0; i <= deg; i++) {
    const c = p[i] ?? 0;
    if (Math.abs(c) < 1e-9 * Math.max(1, scale)) continue;
    const zz: Inline[] = i === 0 ? [] : i === 1 ? [...z] : [...z, { t: 'sup', text: String(i) }];
    parts.push([Math.sign(c), i === 0 ? [num(c)] : Math.abs(Math.abs(c) - 1) < 1e-12 ? zz : [num(c), '·', ...zz]]);
  }
  return signedSum(parts);
}

/** Плечо «(a + z₁)» или «z₁». */
function armText(a: number, z: Inline[]): Inline[] {
  return a < EPS ? [...z] : ['(', f3(a), ' + ', ...z, ')'];
}

/**
 * Слагаемые Q(z) и M(z) от одной нагрузки. Знак берётся по направлению стрелки (положительного направления),
 * а не по найденному значению: значение со своим знаком подставляется в символ (Y_A = −2 даёт «+ Y_A»).
 * Числовые записи (трапеция) — со знаком самого числа внутри.
 */
function termParts(t: Term, z: Inline[], L: number): { q: [number, Inline[]][]; m: [number, Inline[]][] } {
  const s = t.src;
  switch (s.kind) {
    case 'force': {
      if (Math.abs(s.act.dy) < EPS) return { q: [], m: [] };
      const sg = Math.sign(s.act.dy);
      const f = forceSym(s.act);
      // Вертикальная составляющая на плече a + z: знак вклада в M тот же, что в Q.
      return { q: [[sg, f]], m: [[sg, [...f, '·', ...armText(s.arm, z)]]] };
    }
    case 'couple':
      // Пара против часовой слева от сечения уменьшает M.
      return { q: [], m: [[-s.act.s, [sym(s.act)]]] };
    case 'distBehind': {
      const l = s.x1 - s.x0;
      if (Math.abs(s.dn) < EPS) return { q: [], m: [] };
      if (Math.abs(s.qa - s.qb) < EPS && Math.abs(+s.item.q1 - +s.item.q2) < EPS) {
        const head: Inline[] = [qSym(s.S), '·', f3(l)];
        return { q: [[s.dn, head]], m: [[s.dn, [...head, '·', ...armText(s.to + l / 2, z)]]] };
      }
      // Трапеция: равномерная часть и треугольник, у каждого своя равнодействующая.
      const q: [number, Inline[]][] = [],
        m: [number, Inline[]][] = [];
      if (Math.abs(s.qa) > EPS) {
        const head: Inline[] = [num(s.qa), '·', f3(l)];
        q.push([s.dn * Math.sign(s.qa), head]);
        m.push([s.dn * Math.sign(s.qa), [...head, '·', ...armText(s.to + l / 2, z)]]);
      }
      const dq = s.qb - s.qa;
      if (Math.abs(dq) > EPS) {
        const head: Inline[] = ['½·', num(dq), '·', f3(l)];
        q.push([s.dn * Math.sign(dq), head]);
        m.push([s.dn * Math.sign(dq), [...head, '·', ...armText(s.to + l / 3, z)]]);
      }
      return { q, m };
    }
    case 'distOwn': {
      if (Math.abs(s.dn) < EPS) return { q: [], m: [] };
      const z2: Inline[] = [...z, { t: 'sup', text: '2' }],
        z3: Inline[] = [...z, { t: 'sup', text: '3' }];
      if (Math.abs(s.k) < EPS && Math.abs(+s.item.q1 - +s.item.q2) < EPS)
        return { q: [[s.dn, [qSym(s.S), '·', ...z]]], m: [[s.dn, [qSym(s.S), '·', ...z2, '/2']]] };
      const qb = s.qa + s.k * L;
      const par = (x: number) => (x < 0 ? '(' + f3(x) + ')' : f3(x));
      return {
        q: [[s.dn, ['(', f3(s.qa), '·', ...z, ' + (', f3(qb), ' − ', par(s.qa), ')·', ...z2, '/(2·', f3(L), '))']]],
        m: [[s.dn, ['(', f3(s.qa), '·', ...z2, '/2 + (', f3(qb), ' − ', par(s.qa), ')·', ...z3, '/(6·', f3(L), '))']]],
      };
    }
  }
}

/** Что происходит на участке — для пояснения вида эпюр. */
function shapeNote(sp: Span, scale: number, n: ReturnType<typeof forceNames>, c: Conventions): Inline[] {
  const Q = sym(n.Q),
    M = sym(n.M);
  const deriv: Inline[] = [' (d', M, '/d', v(c.axis), ' = ', Q, ')'];
  const dq = polyDegree(sp.Q, scale);
  if (dq === 0) return ['Распределённой нагрузки на участке нет: ', Q, ' постоянна, эпюра ', M, ' — прямая линия', ...deriv, '.'];
  const ext: Inline[] = [' Экстремум ', M, ' — там, где ', Q, ' = 0.'];
  if (dq === 1) return ['На участке равномерная нагрузка q: ', Q, ' меняется линейно, эпюра ', M, ' — квадратная парабола, выпуклостью навстречу нагрузке.', ...ext];
  return ['Нагрузка на участке меняется линейно (трапеция): ', Q, ' — квадратная парабола, ', M, ' — кубическая.', ...ext];
}

export function bendingDoc(beam: Beam, c: Conventions, opts: BendingTextOptions = {}): Doc {
  const names = forceNames(c);
  const steps: Step[] = [];
  const ex = (bl: Block[], ...inl: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c: inl });
  };

  // 1. Реакции.
  {
    const reactions = beam.forces.filter((f) => f.act.support).map((f) => f.act as Action & { key: string });
    const moments = beam.couples.filter((m) => m.act.support);
    const list: Inline[][] = [...reactions.map((f) => [sym(f), ' = ', f3(beam.forces.find((x) => x.act === f)!.val)]), ...moments.map((m) => [sym(m.act), ' = ', f3(m.val)])];
    const unk = [...beam.forces, ...beam.couples].filter((f) => f.act.key && !f.act.support);
    list.push(...unk.map((f) => [sym(f.act), ' = ', f3(f.val)]));
    const bl: Block[] = [{ k: 'p', c: ['Реакции найдены из уравнений равновесия (подробно — во вкладке «Балки и рамы»): ', ...join(list, '; '), '.'] }];
    ex(bl, 'Знак «−» у реакции означает, что она направлена против стрелки на расчётной схеме. В формулах ниже реакции входят со своими знаками.');
    steps.push({ title: 'Реакции опор', blocks: bl });
  }

  // 2. Правило знаков.
  {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          sym(names.Q),
          ' в сечении равна сумме поперечных сил по одну сторону от сечения; сила ',
          b('слева вверх'),
          ' (справа вниз) — со знаком «+». ',
          sym(names.M),
          ' — сумма моментов сил по одну сторону от сечения; «+», если балка изгибается выпуклостью вниз (сжаты верхние волокна): слева — момент ',
          b('по часовой'),
          ', справа — против часовой.',
        ],
      },
      {
        k: 'p',
        c:
          c.mSide === 'compressed'
            ? ['Эпюра ', sym(names.M), ' строится на сжатых волокнах: положительные значения откладываются вверх.']
            : ['Эпюра ', sym(names.M), ' строится на растянутых волокнах: положительные значения откладываются вниз.'],
      },
    ];
    ex(
      bl,
      'Во всех участках рассматриваем левую отсечённую часть: в неё входят реакции левых опор, поэтому формулы получаются по одному образцу. Правую часть удобно брать для проверки — ответ должен совпасть.',
    );
    steps.push({ title: 'Правило знаков', blocks: bl });
  }

  // 3. Участки.
  {
    const list = beam.spans.map((sp) => [roman(sp.index), ' (', sp.from, '–', sp.to, ', ', ...zOf(c, sp.index), ' от 0 до ', f3(sp.L), ')'] as Inline[]);
    const bl: Block[] = [{ k: 'p', c: ['Границы участков — концы балки, опоры, точки приложения сил и пар, начало и конец распределённой нагрузки, шарниры. Участки: ', ...join(list, '; '), '.'] }];
    ex(bl, 'На каждом участке нагрузка не меняет вид, поэтому ', sym(names.Q), ' и ', sym(names.M), ' записываются одной формулой. Координата ', v(c.axis), ' отсчитывается от левого края участка.');
    steps.push({ title: 'Делим балку на участки', blocks: bl });
  }

  // 4. Участки: формулы и значения.
  for (const sp of beam.spans) {
    const z = zOf(c, sp.index);
    const qs: [number, Inline[]][] = [],
      ms: [number, Inline[]][] = [];
    for (const t of sp.terms) {
      const p = termParts(t, z, sp.L);
      qs.push(...p.q);
      ms.push(...p.m);
    }
    const Qz = fn(names.Q, z),
      Mz = fn(names.M, z);
    const at = (name: { L: string; S: string }, zv: number, val: number): Inline[] => [sym(name), '(', f3(zv), ') = ', f3(val)];
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [...Qz, ' = ', ...signedSum(qs)] },
          ...(qs.length > 1 || sp.terms.some((t) => t.src.kind !== 'force') ? [{ num: true, c: ['= ', ...polyText(sp.Q, z, beam.scaleQ)] }] : []),
        ],
      },
    ];
    const Q0 = polyEval(sp.Q, 0),
      QL = polyEval(sp.Q, sp.L);
    bl.push({
      k: 'p',
      c: polyDegree(sp.Q, beam.scaleQ) === 0 ? [sym(names.Q), ' постоянна: ', sym(names.Q), ' = ', f3(Q0), '.'] : [...join([at(names.Q, 0, Q0), at(names.Q, sp.L, QL)], ';  '), '.'],
    });
    bl.push({ k: 'eq', lines: [{ c: [...Mz, ' = ', ...signedSum(ms)] }, { num: true, c: ['= ', ...polyText(sp.M, z, beam.scaleM)] }] });
    const M0 = polyEval(sp.M, 0),
      ML = polyEval(sp.M, sp.L);
    bl.push({ k: 'p', c: [...join([at(names.M, 0, M0), at(names.M, sp.L, ML)], ';  '), '.'] });
    for (const ze of sp.extrema)
      bl.push({
        k: 'p',
        c: [sym(names.Q), ' = 0 при ', ...z, ' = ', f3(ze), ' — экстремум момента: ', ...at(names.M, ze, polyEval(sp.M, ze)), '.'],
      });
    if (opts.explain) {
      bl.push({ k: 'p', cls: 'explain', c: shapeNote(sp, beam.scaleQ, names, c) });
      const behind = sp.terms.filter((t) => t.src.kind === 'distBehind');
      if (behind.length)
        bl.push({
          k: 'p',
          cls: 'explain',
          c: ['Распределённая нагрузка левее участка заменена равнодействующей (q·длина), приложенной в центре тяжести эпюры нагрузки; её плечо — расстояние от этой точки до сечения.'],
        });
    }
    steps.push({ title: `Участок ${roman(sp.index)}: ${sp.from}–${sp.to}`, blocks: bl });
  }

  // 5. Проверки.
  {
    const items: Inline[][] = [];
    const scale = Math.max(beam.scaleQ, 1);
    for (const p of beam.points) {
      const fy = beam.forces.filter((f) => Math.abs(f.x - p.x) < EPS).reduce((acc, f) => acc + f.F[1], 0);
      const i = beam.spans.findIndex((sp) => Math.abs(sp.x0 - p.x) < EPS);
      const j = beam.spans.findIndex((sp) => Math.abs(sp.x1 - p.x) < EPS);
      const left = j >= 0 ? polyEval(beam.spans[j].Q, beam.spans[j].L) : 0;
      const right = i >= 0 ? polyEval(beam.spans[i].Q, 0) : 0;
      if (Math.abs(fy) > 1e-9 * scale)
        items.push(['в точке ', p.name, ' скачок ', sym(names.Q), ': ', f3(left), ' → ', f3(right), ' — на ', f3(right - left), ', это сосредоточенная сила ', f3(Math.abs(fy)), fy > 0 ? ', направленная вверх' : ', направленная вниз']);
      const mm = beam.couples.filter((q) => Math.abs(q.x - p.x) < EPS).reduce((acc, q) => acc + q.m, 0);
      if (Math.abs(mm) > 1e-9 * beam.scaleM) {
        const ml = j >= 0 ? polyEval(beam.spans[j].M, beam.spans[j].L) : 0;
        const mr = i >= 0 ? polyEval(beam.spans[i].M, 0) : 0;
        items.push(['в точке ', p.name, ' скачок ', sym(names.M), ': ', f3(ml), ' → ', f3(mr), ' — на ', f3(mr - ml), ', это пара ', f3(Math.abs(mm)), mm < 0 ? ', направленная по часовой стрелке' : ', направленная против часовой стрелки']);
      }
    }
    const zeroM = beam.points.filter((p, k) => {
      if (beam.couples.some((q) => Math.abs(q.x - p.x) < EPS)) return false;
      return p.hinge || k === 0 || k === beam.points.length - 1;
    });
    if (zeroM.length) items.push([sym(names.M), ' = 0 в точках ', zeroM.map((p) => p.name).join(', '), ' (свободные или шарнирно опёртые концы, шарниры)']);
    const bl: Block[] = [{ k: 'ul', items }];
    ex(
      bl,
      'Скачок на эпюре ',
      sym(names.Q),
      ' равен сосредоточенной силе в этой точке, скачок на эпюре ',
      sym(names.M),
      ' — сосредоточенной паре. В шарнире и на свободном конце без пары изгибающий момент равен нулю. Где ',
      sym(names.Q),
      ' > 0, момент возрастает, где ',
      sym(names.Q),
      ' < 0 — убывает.',
    );
    steps.push({ title: 'Проверки', blocks: bl });
  }

  // 6. Ответ: опасные сечения.
  {
    const { Q: qMax, M: mMax } = beamMaxima(beam);
    const where = (x: number) => {
      const p = beam.points.find((q) => Math.abs(q.x - x) < 1e-9);
      return p ? `в точке ${p.name}` : `на расстоянии ${f3(x)} от ${beam.points[0].name}`;
    };
    steps.push({
      title: 'Ответ',
      blocks: [
        {
          k: 'answer',
          rows: [
            { kind: 'main', val: ['|', sym(names.Q), '|', { t: 'sub', text: 'max' }, ' = ', f3(Math.abs(qMax.v))], note: where(qMax.x) },
            { kind: 'main', val: ['|', sym(names.M), '|', { t: 'sub', text: 'max' }, ' = ', f3(Math.abs(mMax.v))], note: where(mMax.x) + ' — опасное сечение' },
          ],
        },
        ...(beam.hasN ? [{ k: 'p' as const, c: ['Горизонтальные составляющие сил дают продольную силу ', sym(names.N), '; на эпюры ', sym(names.Q), ' и ', sym(names.M), ' она не влияет.'] as Inline[] }] : []),
      ],
    });
  }
  return { steps };
}
