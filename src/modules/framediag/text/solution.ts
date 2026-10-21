/**
 * Решение «эпюры N, Q, M для рамы»: реакции, правила знаков, участки, формулы N(z), Q(z), M(z) с обходом
 * от своей части, значения на концах и экстремумы, равновесие узлов, ответ.
 */
import { forceNames, type Conventions } from '../../../shared/conventions';
import { b, join, sub, sym, v, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { polyDegree, polyEval } from '../../../shared/poly';
import { roman } from '../../frames/model/geometry';
import { armText, polyText, signedSum } from '../../bending/text/solution';
import { frameMaxima, type Bar, type FrameDiag, type FTerm } from '../model/frame';
import type { Pt } from '../../frames/model/geometry';

export interface FrameTextOptions {
  explain?: boolean;
}

const EPS = 1e-9;
const f3 = (x: number) => fmt(x, 3);
const num = (x: number) => f3(Math.abs(x));
const dot = (a: Pt, c: Pt) => a[0] * c[0] + a[1] * c[1];
const qSym = (S: string): Inline => sym({ L: 'q', S });
const OPP: Record<Bar['plusSide'], Bar['plusSide']> = { снизу: 'сверху', сверху: 'снизу', слева: 'справа', справа: 'слева' };

type Parts = { n: [number, Inline[]][]; q: [number, Inline[]][]; m: [number, Inline[]][] };

/** Множитель проекции: «» (по оси или поперёк), «·cos 30°», «·sin 30°»; φ — острый угол между линией силы и осью участка. */
function factor(pu: number, which: 'cos' | 'sin'): Inline[] {
  const c = Math.min(1, Math.abs(pu));
  const p = which === 'cos' ? c : Math.sqrt(Math.max(0, 1 - c * c));
  if (Math.abs(p - 1) < 1e-9) return [];
  const phi = (Math.acos(c) * 180) / Math.PI;
  return [`·${which} ${fmt(phi, 2)}°`];
}

/** Плечо до сечения вдоль оси участка: «(a + z)», «z» или «(z − a)». */
function arm(a: number, z: Inline[]): Inline[] {
  return a >= -EPS ? armText(Math.max(0, a), z) : ['(', ...z, ' − ', f3(-a), ')'];
}

/**
 * Слагаемые от силы (или равнодействующей) head в точке r по направлению dir (знак sg — направление относительно dir).
 * N = −F·u, Q = F·n, M = F_n·(z − a_u) + F_u·a_n, где a = r − P0 в осях участка.
 */
function forceLike(bar: Bar, head: Inline[], sg: number, dir: Pt, r: Pt, z: Inline[]): Parts {
  const pu = dot(dir, bar.u),
    pn = dot(dir, bar.n);
  const d: Pt = [r[0] - bar.P0[0], r[1] - bar.P0[1]];
  const au = dot(d, bar.u),
    an = dot(d, bar.n);
  const out: Parts = { n: [], q: [], m: [] };
  if (Math.abs(pu) > EPS) out.n.push([-sg * Math.sign(pu), [...head, ...factor(pu, 'cos')]]);
  if (Math.abs(pn) > EPS) {
    out.q.push([sg * Math.sign(pn), [...head, ...factor(pu, 'sin')]]);
    out.m.push([sg * Math.sign(pn), [...head, ...factor(pu, 'sin'), '·', ...arm(-au, z)]]);
  }
  if (Math.abs(pu) > EPS && Math.abs(an) > EPS) out.m.push([sg * Math.sign(pu) * Math.sign(an), [...head, ...factor(pu, 'cos'), '·', f3(Math.abs(an))]]);
  return out;
}

function termParts(bar: Bar, t: FTerm, z: Inline[]): Parts {
  const s = t.src;
  switch (s.kind) {
    case 'force':
      return forceLike(bar, [sym(s.act)], 1, [s.act.dx, s.act.dy], s.r, z);
    case 'couple':
      return { n: [], q: [], m: [[-s.act.s, [sym(s.act)]]] };
    case 'distBehind': {
      const l = Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]);
      const at = (k: number): Pt => [s.A[0] + (s.B[0] - s.A[0]) * k, s.A[1] + (s.B[1] - s.A[1]) * k];
      const acc: Parts = { n: [], q: [], m: [] };
      const add = (p: Parts) => (acc.n.push(...p.n), acc.q.push(...p.q), acc.m.push(...p.m));
      if (Math.abs(+s.item.q1 - +s.item.q2) < EPS) add(forceLike(bar, [qSym(s.S), '·', f3(l)], 1, s.d, at(0.5), z));
      else {
        if (Math.abs(s.qa) > EPS) add(forceLike(bar, [num(s.qa), '·', f3(l)], Math.sign(s.qa), s.d, at(0.5), z));
        const dq = s.qb - s.qa;
        if (Math.abs(dq) > EPS) add(forceLike(bar, ['½·', num(dq), '·', f3(l)], Math.sign(dq), s.d, at(2 / 3), z));
      }
      return acc;
    }
    case 'distOwn': {
      const pu = dot(s.d, bar.u),
        pn = dot(s.d, bar.n);
      const z2: Inline[] = [...z, { t: 'sup', text: '2' }],
        z3: Inline[] = [...z, { t: 'sup', text: '3' }];
      let R: Inline[], Mm: Inline[];
      if (Math.abs(s.k) < EPS && Math.abs(+s.item.q1 - +s.item.q2) < EPS) {
        R = [qSym(s.S), '·', ...z];
        Mm = [qSym(s.S), '·', ...z2, '/2'];
      } else {
        const qb = s.qa + s.k * bar.L;
        const par = (x: number) => (x < 0 ? '(' + f3(x) + ')' : f3(x));
        R = ['(', f3(s.qa), '·', ...z, ' + (', f3(qb), ' − ', par(s.qa), ')·', ...z2, '/(2·', f3(bar.L), '))'];
        Mm = ['(', f3(s.qa), '·', ...z2, '/2 + (', f3(qb), ' − ', par(s.qa), ')·', ...z3, '/(6·', f3(bar.L), '))'];
      }
      const out: Parts = { n: [], q: [], m: [] };
      if (Math.abs(pu) > EPS) out.n.push([-Math.sign(pu), [...R, ...factor(pu, 'cos')]]);
      if (Math.abs(pn) > EPS) {
        out.q.push([Math.sign(pn), [...R, ...factor(pu, 'sin')]]);
        out.m.push([Math.sign(pn), [...Mm, ...factor(pu, 'sin')]]);
      }
      return out;
    }
  }
}

/** «−12,5 (растянуты волокна снизу)». */
function mVal(bar: Bar, x: number, scale: number): string {
  if (Math.abs(x) < 1e-9 * Math.max(1, scale)) return '0';
  return `${f3(x)} (растянуты волокна ${x > 0 ? bar.plusSide : OPP[bar.plusSide]})`;
}

export function frameDoc(fr: FrameDiag, c: Conventions, opts: FrameTextOptions = {}): Doc {
  const names = forceNames(c);
  const steps: Step[] = [];
  const ex = (bl: Block[], ...inl: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c: inl });
  };
  const zOf = (i: number): Inline[] => [v(c.axis), sub(String(i + 1))];

  // 1. Реакции.
  {
    const list: Inline[][] = [...fr.forces, ...fr.couples].filter((f) => f.act.key !== undefined).map((f) => [sym(f.act), ' = ', f3(f.val)]);
    const bl: Block[] = [{ k: 'p', c: list.length ? ['Реакции найдены из уравнений равновесия (подробно — во вкладке «Балки и рамы»): ', ...join(list, '; '), '.'] : ['Неизвестных реакций нет.'] }];
    ex(bl, 'Знак «−» у реакции означает, что она направлена против стрелки на расчётной схеме. В формулах реакции входят со своими знаками.');
    steps.push({ title: 'Реакции опор', blocks: bl });
  }

  // 2. Правила знаков.
  {
    const bl: Block[] = [
      {
        k: 'ul',
        items: [
          [sym(names.N), ' — сумма проекций сил отсечённой части на ось участка; ', b('растяжение'), ' (сила направлена от сечения) — «+».'],
          [sym(names.Q), ' — сумма проекций на перпендикуляр к оси; «+», если сила вращает отсечённую часть относительно сечения ', b('по часовой стрелке'), '.'],
          [
            sym(names.M),
            ' — сумма моментов сил отсечённой части относительно сечения. У рамы «верх» и «низ» у стоек не определены, поэтому для каждого участка указано, какие волокна растянуты при ',
            sym(names.M),
            ' > 0; эпюра строится ',
            b(c.mSide === 'compressed' ? 'на сжатых волокнах' : 'на растянутых волокнах'),
            ', знаки на ней не ставятся.',
          ],
        ],
      },
    ];
    ex(
      bl,
      'Эпюры ',
      sym(names.N),
      ' и ',
      sym(names.Q),
      ' строятся с любой стороны от оси, но со знаками: здесь положительные значения отложены вверх у горизонтальных и наклонных участков и влево у вертикальных. Сторону эпюры ',
      sym(names.M),
      ' (сжатые или растянутые волокна) можно переключить в «Правилах и обозначениях».',
    );
    steps.push({ title: 'Правила знаков', blocks: bl });
  }

  // 3. Участки.
  {
    const list = fr.bars.map((br) => [roman(br.index), ' (', br.from, br.to, ', ', ...zOf(br.index), ' от ', br.from, ', 0 ≤ ', ...zOf(br.index), ' ≤ ', f3(br.L), ')'] as Inline[]);
    const bl: Block[] = [{ k: 'p', c: ['Участки — между узлами рамы, опорами и точками приложения нагрузок: ', ...join(list, '; '), '.'] }];
    ex(bl, 'На каждом участке рассматриваем ту отсечённую часть, где меньше сил (по возможности — без реакций); координата отсчитывается от конца участка со стороны этой части.');
    steps.push({ title: 'Делим раму на участки', blocks: bl });
  }

  // 4. Участки.
  for (const br of fr.bars) {
    const z = zOf(br.index);
    const P: Parts = { n: [], q: [], m: [] };
    for (const t of br.terms) {
      const p = termParts(br, t, z);
      P.n.push(...p.n);
      P.q.push(...p.q);
      P.m.push(...p.m);
    }
    const fnz = (nm: { L: string; S: string }): Inline[] => [sym(nm), '(', ...z, ')'];
    const eqs = (nm: { L: string; S: string }, parts: [number, Inline[]][], poly: number[], scale: number): Block => ({
      k: 'eq',
      lines: [{ c: [...fnz(nm), ' = ', ...signedSum(parts)] }, ...(parts.length > 1 || br.terms.some((t) => t.src.kind !== 'force') ? [{ num: true, c: ['= ', ...polyText(poly, z, scale)] }] : [])],
    });
    const vals = (nm: { L: string; S: string }, poly: number[], scale: number, txt: (x: number) => string = f3): Block => {
      const v0 = polyEval(poly, 0),
        vL = polyEval(poly, br.L);
      return {
        k: 'p',
        c: polyDegree(poly, scale) === 0 ? [sym(nm), ' постоянна: ', txt(v0), '.'] : [sym(nm), '(0) = ', txt(v0), ';  ', sym(nm), `(${f3(br.L)}) = `, txt(vL), '.'],
      };
    };
    const bl: Block[] = [
      { k: 'p', c: ['Отсечённая часть — со стороны точки ', b(br.from), '; ', ...z, ' — от ', br.from, ' к ', br.to, '. ', sym(names.M), ' > 0, если растянуты волокна ', b(br.plusSide), '.'] },
      eqs(names.N, P.n, br.N, fr.scaleN),
      vals(names.N, br.N, fr.scaleN),
      eqs(names.Q, P.q, br.Q, fr.scaleQ),
      vals(names.Q, br.Q, fr.scaleQ),
      eqs(names.M, P.m, br.M, fr.scaleM),
      vals(names.M, br.M, fr.scaleM, (x) => mVal(br, x, fr.scaleM)),
    ];
    for (const ze of br.extrema)
      bl.push({ k: 'p', c: [sym(names.Q), ' = 0 при ', ...z, ' = ', f3(ze), ' — экстремум: ', sym(names.M), ` = ${mVal(br, polyEval(br.M, ze), fr.scaleM)}.`] });
    if (opts.explain && br.terms.some((t) => t.src.kind === 'distBehind'))
      bl.push({ k: 'p', cls: 'explain', c: ['Распределённая нагрузка отсечённой части заменена равнодействующей (q·длина), приложенной в центре тяжести эпюры нагрузки.'] });
    if (opts.explain && br.terms.some((t) => t.src.kind === 'force' && Math.abs(dot([t.src.act.dx, t.src.act.dy], br.u)) > 1e-9 && Math.abs(dot([t.src.act.dx, t.src.act.dy], br.u)) < 1 - 1e-9))
      bl.push({ k: 'p', cls: 'explain', c: ['Сила под углом φ к оси участка раскладывается на составляющие: F·cos φ вдоль оси (даёт N) и F·sin φ поперёк (даёт Q и момент на плече вдоль оси); продольная составляющая даёт момент на плече поперёк оси.'] });
    steps.push({ title: `Участок ${roman(br.index)}: ${br.from}–${br.to}`, blocks: bl });
  }

  // 5. Равновесие узлов.
  {
    const items: Inline[][] = [];
    const sc = Math.max(1, fr.scaleM);
    for (const j of fr.joints) {
      const parts = [...j.ends.map((e) => e.m), ...(Math.abs(j.m) > EPS ? [j.m] : [])].filter((x) => Math.abs(x) > 1e-9 * sc);
      if (j.ends.length < 2 || !parts.length) continue;
      const s = parts.map((x, i) => (i ? (x < 0 ? ` − ${num(x)}` : ` + ${num(x)}`) : f3(x))).join('');
      items.push(['узел ', j.name, ': Σ', sym(names.M), ' = ', s, ' = ', f3(Math.abs(j.sum.m) < 1e-9 * sc ? 0 : j.sum.m), ';  ΣX = ', f3(Math.abs(j.sum.x) < 1e-9 * sc ? 0 : j.sum.x), ';  ΣY = ', f3(Math.abs(j.sum.y) < 1e-9 * sc ? 0 : j.sum.y)]);
    }
    const zeroM = fr.points.filter((p) => {
      if (fr.couples.some((q) => q.node === p.id)) return false;
      const deg = fr.bars.filter((x) => x.id0 === p.id || x.id1 === p.id).length;
      return p.hinge || deg === 1;
    });
    const hingeEnds = zeroM.filter((p) => fr.bars.every((x) => (x.id0 !== p.id || Math.abs(polyEval(x.M, 0)) < 1e-9 * sc) && (x.id1 !== p.id || Math.abs(polyEval(x.M, x.L)) < 1e-9 * sc)));
    if (hingeEnds.length) items.push([sym(names.M), ' = 0 в точках ', hingeEnds.map((p) => p.name).join(', '), ' (шарниры, шарнирные опоры и свободные концы без пар)']);
    if (!items.length) items.push(['узлов, где сходятся несколько участков, нет']);
    const bl: Block[] = [{ k: 'ul', items }];
    ex(
      bl,
      'Вырезаем узел и прикладываем к нему усилия концов участков (с обратными знаками) и внешние силы и пары в узле. Узел должен быть в равновесии: сумма моментов (против часовой — «+») и проекций равны нулю. В жёстком узле без внешней пары с двумя стержнями моменты на концах равны — эпюра ',
      sym(names.M),
      ' «переходит» через угол с тем же значением, с той же стороны рамы (внутри или снаружи).',
    );
    steps.push({ title: 'Проверка: равновесие узлов', blocks: bl });
  }

  // 6. Ответ.
  {
    const mx = frameMaxima(fr);
    const where = (r: { bar: number; z: number }) => {
      const br = fr.bars[r.bar];
      if (r.z < 1e-9) return `участок ${roman(br.index)}, точка ${br.from}`;
      if (Math.abs(r.z - br.L) < 1e-9) return `участок ${roman(br.index)}, точка ${br.to}`;
      return `участок ${roman(br.index)}, ${c.axis}${String(br.index + 1).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d])} = ${f3(r.z)} от ${br.from}`;
    };
    steps.push({
      title: 'Ответ',
      blocks: [
        {
          k: 'answer',
          rows: [
            { kind: 'main', val: ['|', sym(names.N), '|', { t: 'sub', text: 'max' }, ' = ', f3(Math.abs(mx.N.v))], note: where(mx.N) + (mx.N.v < 0 ? ', сжатие' : mx.N.v > 0 ? ', растяжение' : '') },
            { kind: 'main', val: ['|', sym(names.Q), '|', { t: 'sub', text: 'max' }, ' = ', f3(Math.abs(mx.Q.v))], note: where(mx.Q) },
            { kind: 'main', val: ['|', sym(names.M), '|', { t: 'sub', text: 'max' }, ' = ', f3(Math.abs(mx.M.v))], note: where(mx.M) + ' — опасное сечение' },
          ],
        },
      ],
    });
  }
  return { steps };
}
