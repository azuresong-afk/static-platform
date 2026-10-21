/**
 * Решение по шагам для задач в общем виде: равновесие и устойчивость в буквах, обратные задачи (§52, 55, 49.12, Д.23);
 * катящийся диск — неголономная связь (55.12–55.14); уравнение Якоби — Гамильтона, струна и нить (49.15–49.22).
 */
import { b, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { neg, prettyName, setCoordNames, subst, symText, termText, variable, varName, type Sym } from '../../../shared/sym';
import type { LagProblem } from '../../lagrange/model/lagrange';
import type { HJSolution, StringProblem, StringSolution } from '../model/jacobi';
import type { LetCond, LetProblem, LetSolution } from '../model/letters';
import type { RollProblem, RollSolution } from '../model/roll';
import { cx, exOf, g4, polyText, VERDICT } from './solution';

type Row = { kind: 'main' | 'aux'; val: Inline[]; note: string };
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const powText = (p: string, k: number) => (k === 1 ? p : p + String(k).replace(/\d/g, (x) => SUP[+x]));
const isOne = (s: Sym) => s.length === 1 && !s[0].f.length && s[0].c === 1;
const nz = (X: Sym[][]) => X.some((r) => r.some((s) => s.length > 0));
const matText = (X: Sym[][]) => (X.length === 1 ? symText(X[0][0]) || '0' : '[' + X.map((r) => r.map((s) => symText(s) || '0').join('  ')).join(';  ') + ']');

/** Условие в буквах: сокращённое и, если удалось, решённое относительно параметра. */
/** Решённое условие показываем, если оно не длиннее исходного (громоздкое — только перебором). */
const solvedOf = (c: LetCond) => (c.solved && symText(c.solved.rhs).length <= Math.max(60, symText(c.rest).length) ? c.solved : null);
function condText(c: LetCond): string {
  const sv = solvedOf(c);
  if (sv) return `${powText(prettyName(sv.p), sv.pow)} ${sv.rel} ${symText(sv.rhs)}`;
  return `${symText(c.rest)} > 0`;
}
function condItems(conds: LetCond[]): Inline[][] {
  return conds.map((c) => {
    const red = (c.factor.f.length > 0 || Math.abs(c.factor.c) !== 1) && c.rest.length > 0;
    const ok = c.value > 1e-12 * Math.max(1, Math.abs(c.value));
    const head = !c.D.length
      ? `${c.label} = 0`
      : `${c.label} = ${symText(c.D)}${red ? `;  сокращаем на ${termText(c.factor, true)} > 0:  ${symText(c.rest)} > 0` : ' > 0'}`;
    const items: Inline[] = [head];
    const sv = solvedOf(c);
    if (sv) {
      items.push('  ⇔  ', b(condText(c)));
      if (Number.isFinite(sv.value) && sv.rhs.some((t) => t.f.length)) items.push(` (= ${g4(sv.value)})`);
    }
    items.push(' — ', b(!c.D.length ? 'не выполнено' : ok ? `выполнено (${g4(c.value)})` : `не выполнено (${g4(c.value)})`));
    return items;
  });
}
function scanStep(s0: { param: string; from: number; to: number; stable: [number, number][]; bounds: number[] }): Step {
  const s = { ...s0, param: prettyName(s0.param) };
  const bl: Block[] = [
    { k: 'p', c: [`Перебор параметра ${s.param} от ${g4(s.from)} до ${g4(s.to)} при остальных заданных значениях (границы уточнены делением пополам):`] },
    {
      k: 'ul',
      items: s.stable.length ? s.stable.map(([lo, hi]) => ['устойчиво при ', b(`${g4(lo)} < ${s.param} < ${g4(hi)}`)]) : [['на всём отрезке неустойчиво']],
    },
  ];
  if (s.bounds.length) bl.push({ k: 'p', c: ['Границы устойчивости: ', b(s.bounds.map((x) => `${s.param} = ${g4(x)}`).join('; ')), '.'] });
  return { title: `Область устойчивости по ${s.param}`, blocks: bl };
}
/** Множитель в скобках, если это сумма или дробь. */
const wrap = (c: Sym) => {
  const s = symText(c);
  return c.length > 1 || s.includes('/') ? `(${s})` : s;
};
/** Величина: обозначение = формула = число (формулу не повторяем, если она совпадает с обозначением). */
const eqv = (name: string, s: Sym, v: number) => (symText(s) === name ? `${name} = ${g4(v)}` : `${name} = ${symText(s)} = ${g4(v)}`);
/** Линейная комбинация Σ cₖ·xₖ (коэффициенты в буквах). */
function combo(cs: Sym[], xs: string[]): string {
  const parts = cs
    .map((c, k) => {
      if (!c.length) return '';
      const s = symText(c);
      if (isOne(c)) return xs[k];
      if (s === '−1') return '−' + xs[k];
      if (c.length === 1 && c[0].c < 0) {
        const p = neg(c);
        return `−${isOne(p) ? '' : wrap(p) + '·'}${xs[k]}`;
      }
      return `${wrap(c)}·${xs[k]}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' + ').replace(/\+ −/g, '− ') : '0';
}

/* ───────────── Равновесие и устойчивость в буквах ───────────── */

const LVERDICT = (r: LetSolution): string =>
  r.neutralAll
    ? 'безразличное равновесие'
    : r.verdict === 'neutral'
      ? 'критический случай (K вырождена)'
      : r.kind === 'potential' && r.verdict === 'linear'
        ? 'устойчиво'
        : VERDICT[r.verdict];

export function lettersDoc(pr: LetProblem, r: LetSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames(r.ctx.coords);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const names = r.ctx.coords;
  const q = (n: string, o = 0) => varName(prettyName(n), o);
  const sb = (n: string): Inline => ({ t: 'sub', text: prettyName(n) });
  const one = names.length === 1;
  {
    const bl: Block[] = [{ k: 'p', c: [one ? 'Обобщённая координата ' : 'Обобщённые координаты ', b(names.map((n) => q(n)).join(', ')), '.'] }];
    const lines: { c: Inline[] }[] = [];
    if (r.T.length) lines.push({ c: ['T = ', symText(r.T)] });
    lines.push({ c: ['Π = ', symText(r.P) || '0'] });
    pr.coords.forEach((c, i) => {
      if (c.Q.trim()) lines.push({ c: ['Q', sb(names[i]), ' = ', c.Q.trim()] });
    });
    bl.push({ k: 'eq', lines });
    if (r.T0.length) {
      bl.push({ k: 'p', c: ['Часть T без скоростей T₀ = ', symText(r.T0), ' входит в приведённую потенциальную энергию:'] });
      bl.push({ k: 'eq', lines: [{ c: [b('W = Π − T₀ = ' + (symText(r.W) || '0'))] }] });
    } else if (!r.T.length) bl.push({ k: 'p', c: ['Кинетическая энергия не задана — исследуется только равновесие (W = Π).'] });
    bl.push({ k: 'p', c: ['Обобщённые силы в покое ', b('Fⱼ = −∂W/∂qⱼ + Qⱼ(q, 0)'), ':'] });
    bl.push({ k: 'eq', lines: names.map((n, i) => ({ c: ['F', sb(n), ' = ', symText(r.F[i]) || '0'] })) });
    ex(
      bl,
      'Принцип возможных перемещений: положение — равновесие, если все обобщённые силы равны нулю. В покое силы сопротивления и гироскопические силы пропадают; для системы, вращающейся с заданной угловой скоростью, T₀ = ω²J/2 даёт центробежные силы инерции, и W — потенциальная энергия в относительном движении.',
    );
    steps.push({ title: 'Система и обобщённые силы', blocks: bl });
  }
  {
    const bl: Block[] = [];
    const u = r.unknown;
    if (u) {
      if (u.indifferent)
        bl.push({
          k: 'p',
          c: [
            `Безразличное равновесие — Fⱼ ≡ 0 в любом положении. Сила линейна по ${u.name}: A(q)·${u.name} + B(q) = 0, и отношение −B/A не должно зависеть от q:`,
          ],
        });
      else bl.push({ k: 'p', c: [`Подставляем положение q* в условия равновесия Fⱼ(q*) = 0 — они линейны по искомому ${u.name}:`] });
      bl.push({ k: 'eq', lines: [{ c: [b(`${u.name} = ${symText(u.expr)}`), ` = ${g4(u.value)}`] }] });
    }
    if (!(u && u.indifferent)) {
      bl.push({
        k: 'p',
        c: [
          r.equil === 'no' ? 'Начальное приближение: ' : 'Положение: ',
          b(names.map((n, i) => `${q(n)}* = ${symText(r.at[i]) || '0'}`).join(', ')),
          r.at.some((a) => a.some((t) => t.f.length)) ? ` = ${r.at.map((_, i) => g4(r.q[i])).join(', ')}` : '',
          '.',
        ],
      });
      if (r.neutralAll) bl.push({ k: 'p', c: ['Fⱼ ≡ 0 тождественно — равновесие безразличное: система остаётся в покое в любом положении.'] });
      else if (r.equil === 'identity') bl.push({ k: 'p', c: ['Fⱼ(q*) ≡ 0 тождественно — положение равновесия при любых значениях параметров.'] });
      else if (r.equil === 'numeric')
        bl.push(
          { k: 'p', c: ['После подстановки q*:'] },
          { k: 'eq', lines: names.map((n, i) => ({ c: ['F', sb(n), '(q*) = ', symText(r.Fat[i]) || '0'] })) },
          { k: 'p', c: ['— это нуль при заданных значениях параметров: положение равновесия.'] },
        );
      else {
        bl.push(
          { k: 'p', c: [`q* не обращает обобщённые силы в нуль — это только начальное приближение. Уравнения равновесия в буквах:`] },
          { k: 'eq', lines: names.map((_, i) => ({ c: [b(`${symText(r.F[i]) || '0'} = 0`)] })) },
          {
            k: 'p',
            c: [
              'Корень (метод Ньютона): ',
              b(names.map((n, i) => `${q(n)} = ${g4(r.q[i])}`).join(', ')),
              r.residual > 1e-8 ? ` — невязка ${g4(r.residual)}: уточните начальное приближение.` : '.',
            ],
          },
        );
      }
    }
    steps.push({ title: u ? (u.indifferent ? 'Условие безразличного равновесия' : 'Обратная задача: искомый параметр') : 'Положение равновесия', blocks: bl });
  }
  if (!r.neutralAll) {
    const bl: Block[] = [];
    const at = r.equil === 'no' ? 'в найденном положении' : 'в q*';
    const lines: { c: Inline[] }[] = [];
    if (r.T.length) lines.push({ c: ['M = ', matText(r.M)] });
    lines.push({ c: ['K = ', matText(r.K)] });
    if (nz(r.G)) lines.push({ c: ['G = ', matText(r.G), '   (гироскопические)'] });
    if (nz(r.D)) lines.push({ c: ['D = ', matText(r.D), '   (сопротивление)'] });
    bl.push({
      k: 'p',
      c: [`Уравнения малых отклонений δq = q − q*: `, b('M·δq̈ + (D + G)·δq̇ + K·δq = 0'), `, M = ∂²T/∂q̇², K = −∂F/∂q = ∂²W/∂q² (${at}):`],
    });
    bl.push({ k: 'eq', lines });
    if (r.kind === 'potential' && r.conds.length) {
      bl.push({
        k: 'p',
        c: [
          'Сил сопротивления и гироскопических сил нет — теорема Лагранжа — Дирихле: равновесие устойчиво, если W имеет минимум, то есть K положительно определена. Критерий Сильвестра:',
        ],
      });
      bl.push({ k: 'ul', items: condItems(r.conds) });
    } else if (r.kind === 'potential')
      bl.push({
        k: 'p',
        c: ['Собственные значения K: ', b(r.kEig.map(g4).join('; ')), ' — условия в буквах для найденного численно положения не выписываются.'],
      });
    else if (r.stab) {
      bl.push({ k: 'p', c: ['Характеристическое уравнение ', b('det(Mλ² + (D + G)λ + K) = 0'), ':'] });
      bl.push({ k: 'eq', lines: [{ c: [b(polyText(r.stab.coefSym) + ' = 0')] }] });
      if (r.stab.even)
        bl.push({
          k: 'p',
          c: ['Сопротивления нет — только чётные степени λ. Подстановка μ = −λ²: устойчивость — когда все корни μ вещественны, положительны и различны:'],
        });
      else if (r.conds.length) bl.push({ k: 'p', c: ['Условия Гурвица (a₀ > 0):'] });
      if (r.conds.length) bl.push({ k: 'ul', items: condItems(r.conds) });
      bl.push({ k: 'p', c: ['Корни при заданных значениях: ', r.stab.roots.map(cx).join(';  '), '.'] });
    }
    const tone = r.verdict === 'linear' || r.verdict === 'asym' ? 'ok' : r.verdict === 'unstable' ? 'bad' : 'warn';
    bl.push({ k: 'badge', tone, text: LVERDICT(r) });
    if (r.kind === 'potential')
      bl.push({
        k: 'p',
        c: [
          r.verdict === 'linear'
            ? 'K положительно определена — W имеет минимум: равновесие устойчиво.'
            : r.verdict === 'unstable'
              ? 'K не является положительно определённой (есть отрицательное собственное значение) — по первому приближению равновесие неустойчиво.'
              : 'K вырождена (нулевое собственное значение) — квадратичных членов W недостаточно, нужны члены высших порядков.',
        ],
      });
    else if (r.kind === 'gyro')
      bl.push({
        k: 'p',
        c: [
          r.verdict === 'unstable'
            ? 'Есть корень с положительной вещественной частью — равновесие (стационарное движение) неустойчиво.'
            : r.num.K.some((row, i) => row[i] < 0)
              ? 'W не имеет минимума, но гироскопические силы стабилизируют: корни на мнимой оси, простые.'
              : 'Корни на мнимой оси, простые — устойчиво в первом приближении (не асимптотически).',
        ],
      });
    ex(
      bl,
      'Условие в буквах сокращено на множитель, положительный при заданных значениях; после «⇔» — то же условие, решённое относительно выбранного параметра. Число в скобках — значение левой части при заданных значениях.',
    );
    steps.push({ title: 'Устойчивость', blocks: bl });
  }
  if (r.freqs.length || r.k2) {
    const bl: Block[] = [];
    if (r.k2) {
      const k2v = r.num.K[0][0] / r.num.M[0][0];
      bl.push({ k: 'p', c: ['Одна координата: δq̈ + k²δq = 0,'] });
      bl.push({ k: 'eq', lines: [{ c: [b(`k² = K/M = ${symText(r.k2)}`), ` = ${g4(k2v)}`] }] });
    } else bl.push({ k: 'p', c: ['Частоты — корни уравнения det(K − ω²M) = 0 (или мнимые части корней λ):'] });
    if (r.freqs.length) bl.push({ k: 'ul', items: r.freqs.map((w) => [b(`ω = ${g4(w)} рад/с`), `, период T = ${g4((2 * Math.PI) / w)} с`]) });
    if (r.law) {
      const L = r.law;
      const c0 = pr.coords[0];
      bl.push({ k: 'p', c: [`Закон малых колебаний при δ${q(names[0])}₀ = ${g4(c0.dq0)}, δ${q(names[0], 1)}₀ = ${g4(c0.dv0)}:`] });
      bl.push({
        k: 'eq',
        lines: [
          { c: [`δ${q(names[0])} = δ${q(names[0])}₀ cos kt + (δ${q(names[0], 1)}₀/k) sin kt = A sin(kt + β)`] },
          { num: true, c: [b(`δ${q(names[0])} = ${g4(L.amp)} sin(${g4(L.k)}t + ${g4(L.phase)})`)] },
        ],
      });
    }
    steps.push({ title: 'Малые колебания', blocks: bl });
  }
  if (r.canon && r.kind !== 'potential') {
    const C = r.canon;
    const bl: Block[] = [];
    const dqN = names.map((n) => 'δ' + q(n)),
      dpN = names.map((n) => 'δp_' + prettyName(n));
    bl.push({
      k: 'p',
      c: ['Импульсы pⱼ = ∂T/∂q̇ⱼ = Σ Mⱼₖq̇ₖ + aⱼ(q); около q*: ', b('p = p* + M·δq̇ + N·δq'), ', N = ∂a/∂q. Канонические уравнения первого приближения:'],
    });
    if (C.pStar.some((s) => s.length)) bl.push({ k: 'eq', lines: names.map((n, i) => ({ c: [`p*_${prettyName(n)} = `, symText(C.pStar[i]) || '0'] })) });
    bl.push({
      k: 'eq',
      lines: names.flatMap((n, i) => [
        { c: [b(`δ${q(n, 1)} = ${combo(C.dq[i], [...dqN, ...dpN])}`)] },
        { c: [b(`δṗ_${prettyName(n)} = ${combo(C.dp[i], [...dqN, ...dpN])}`)] },
      ]),
    });
    ex(bl, 'δq̇ = M⁻¹(δp − N·δq), δṗ = NᵀM⁻¹(δp − N·δq) − K·δq — линейная часть уравнений q̇ = ∂H/∂p, ṗ = −∂H/∂q около положения равновесия.');
    steps.push({ title: 'Канонические уравнения', blocks: bl });
  }
  if (r.scan) steps.push(scanStep(r.scan));
  const rows: Row[] = [];
  if (r.unknown)
    rows.push({
      kind: 'main',
      val: [`${r.unknown.name} = ${symText(r.unknown.expr)}`],
      note: r.unknown.indifferent ? 'безразличное равновесие' : 'условие равновесия',
    });
  if (r.equil === 'no') rows.push({ kind: 'main', val: [names.map((n, i) => `${q(n)} = ${g4(r.q[i])}`).join(', ')], note: 'положение равновесия' });
  if (!(r.unknown?.indifferent && r.neutralAll)) rows.push({ kind: 'main', val: [LVERDICT(r)], note: 'при заданных значениях' });
  for (const c of r.conds)
    if (c.rest.length && !(c.rest.length === 1 && !c.rest[0].f.length)) rows.push({ kind: 'aux', val: [condText(c)], note: `условие ${c.label}` });
  if (r.k2) rows.push({ kind: 'aux', val: [`k² = ${symText(r.k2)}`], note: 'квадрат частоты' });
  for (const w of r.freqs) rows.push({ kind: 'aux', val: [`ω = ${g4(w)} рад/с`], note: `период ${g4((2 * Math.PI) / w)} с` });
  if (r.law) rows.push({ kind: 'aux', val: [`A = ${g4(r.law.amp)}, β = ${g4(r.law.phase)}`], note: 'амплитуда и начальная фаза' });
  if (r.scan?.bounds.length)
    rows.push({ kind: 'aux', val: [r.scan.bounds.map((x) => `${prettyName(r.scan!.param)} = ${g4(x)}`).join('; ')], note: 'граница устойчивости' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ───────────── Катящийся диск ───────────── */

export function rollDoc(pr: RollProblem, r: RollSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames([]);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const v = r.values;
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [eqv('m', r.m, v.m)] },
          { c: [eqv('a', r.a, v.a)] },
          { c: [eqv('A', r.A, v.A), '   (относительно диаметра)'] },
          { c: [eqv('C', r.C, v.C), '   (относительно оси симметрии)'] },
        ],
      },
      {
        k: 'p',
        c: [
          'Оси Резаля: i — горизонтальный диаметр, j — диаметр от точки касания к центру, k — ось диска; θ — наклон плоскости диска к вертикали, ψ — курс. Угловая скорость диска ω = (θ̇, ψ̇ cos θ, φ̇ − ψ̇ sin θ). Связь — качение без скольжения:',
        ],
      },
      { k: 'eq', lines: [{ c: [b('v_P = 0  ⇒  v_G = ω × (a·j)')] }, { c: [b('dK_G/dt = (−a·j) × R,   R = m·a_G + m·g·ẑ')] }] },
    ];
    ex(
      bl,
      'Связь «скорость точки касания равна нулю» не интегрируется — она неголономная: независимых скоростей меньше, чем координат, и уравнения Лагранжа в обычном виде неприменимы. Реакция R исключена из теоремы о движении центра масс, теорема об изменении кинетического момента относительно центра масс даёт три уравнения для ω̇₁, ω̇₂, ω̇₃.',
    );
    steps.push({ title: 'Тело и связь', blocks: bl });
  }
  {
    const bl: Block[] = [];
    const line = pr.motion === 'line';
    bl.push({
      k: 'p',
      c: [
        line
          ? `Стационарное движение — качение по прямой в вертикальной плоскости: θ = 0, ψ̇ = 0, ω₃ = ${eqv('Ω', r.w, v.w)} рад/с.`
          : `Стационарное движение — вращение вокруг вертикального диаметра: θ = 0, φ̇ = 0, ψ̇ = ${eqv('ω', r.w, v.w)} рад/с.`,
      ],
    });
    bl.push({ k: 'p', c: ['Уравнения в отклонениях (первое приближение):'] });
    bl.push({
      k: 'eq',
      lines: [
        { c: [b('(A + ma²)θ̈ + K·θ = 0')] },
        { c: ['A + ma² = ', symText(r.Meff)] },
        { c: ['K = ', symText(r.K)] },
        { c: [line ? 'ψ̇ = ' : 'ω₃ = ', wrap(r.side), '·θ'] },
      ],
    });
    bl.push({ k: 'p', c: ['Условие устойчивости K > 0' + (line ? ' (умножено на A > 0):' : ':')] });
    bl.push({ k: 'ul', items: condItems([r.cond]) });
    bl.push({ k: 'p', c: ['Корни линеаризованных полных уравнений (по θ, ω₁, ω₂, ω₃): ', r.roots.map(cx).join(';  '), '.'] });
    const ok = r.verdict === 'linear' || r.verdict === 'asym';
    bl.push({ k: 'badge', tone: ok ? 'ok' : r.verdict === 'unstable' ? 'bad' : 'warn', text: VERDICT[r.verdict] });
    if (r.freq) bl.push({ k: 'p', c: [`Частота колебаний наклона ${g4(r.freq)} рад/с (период ${g4((2 * Math.PI) / r.freq)} с).`] });
    ex(bl, 'Два нулевых корня — соседние стационарные движения (другая скорость, другой курс): по ним устойчивость не асимптотическая.');
    ex(
      bl,
      line
        ? 'Наклон θ вызывает поворот курса ψ̇ = (C/A)Ωθ, а гироскопический момент CΩψ̇ и сила инерции центра масс возвращают диск: при быстром качении он не падает.'
        : 'Наклон обруча при вращении вокруг диаметра раскручивает его вокруг оси (ω₃), и сила трения в точке касания возвращает обруч.',
    );
    steps.push({ title: 'Устойчивость стационарного движения', blocks: bl });
  }
  if (r.scan) steps.push(scanStep(r.scan));
  if (r.sim && r.sim.t.length > 1) {
    const s = r.sim;
    const mx = Math.max(...s.th.map(Math.abs));
    const fell = s.t[s.t.length - 1] < pr.tEnd * 0.999;
    steps.push({
      title: 'Возмущённое движение',
      blocks: [
        {
          k: 'p',
          c: [
            `Полные уравнения проинтегрированы (Рунге — Кутта) из θ₀ = ${g4(pr.th0)} рад: `,
            fell ? `за ${g4(s.t[s.t.length - 1])} с наклон превысил 1,5 рад — диск падает.` : `наибольший наклон |θ| = ${g4(mx)} рад за ${g4(pr.tEnd)} с.`,
          ],
        },
      ],
    });
  }
  const rows: Row[] = [{ kind: 'main', val: [VERDICT[r.verdict]], note: 'при заданных значениях' }];
  rows.push({ kind: 'aux', val: [condText(r.cond)], note: 'условие устойчивости' });
  if (r.scan?.bounds.length)
    rows.push({ kind: 'aux', val: [r.scan.bounds.map((x) => `${prettyName(r.scan!.param)} = ${g4(x)}`).join('; ')], note: 'граница устойчивости' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ───────────── Якоби — Гамильтон ───────────── */

export function hjDoc(pr: LagProblem, r: HJSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames(r.ctx.coords);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const names = r.ctx.coords;
  const dV = (n: string) => `∂V/∂${prettyName(n)}`;
  const withDV = (s: Sym) => subst(s, (a) => (a.ord === 0 && r.pNames.includes(a.name) ? variable(`(${dV(names[r.pNames.indexOf(a.name)])})`) : null));
  const pn = (n: string) => 'p_' + prettyName(n);
  {
    const bl: Block[] = [
      { k: 'p', c: ['Функция Гамильтона (как в режиме «Интегралы, Раус, Гамильтон»):'] },
      { k: 'eq', lines: [{ c: [b('H = ' + symText(r.H))] }] },
      { k: 'p', c: ['Уравнение Якоби — Гамильтона — подстановка pⱼ = ∂V/∂qⱼ в H:'] },
      { k: 'eq', lines: [{ c: [b(`∂V/∂t + ${symText(withDV(r.H))} = 0`)] }] },
    ];
    ex(bl, 'Полный интеграл V(t, q, α) с n независимыми постоянными даёт все движения: pⱼ = ∂V/∂qⱼ, ∂V/∂αⱼ = βⱼ (теорема Якоби).');
    steps.push({ title: 'Функция Гамильтона и уравнение', blocks: bl });
  }
  {
    const bl: Block[] = [];
    bl.push({ k: 'p', c: ['H не зависит от t: V = −h·t + V₀(q), h — постоянная энергии.'] });
    if (r.cyclic.length)
      bl.push({
        k: 'p',
        c: [
          r.cyclic.length > 1 ? 'Циклические координаты ' : 'Циклическая координата ',
          b(r.cyclic.map((c) => prettyName(names[c.i])).join(', ')),
          ': ',
          b(r.cyclic.map((c) => `${dV(names[c.i])} = ${prettyName(c.alpha)}`).join(', ')),
          '.',
        ],
      });
    if (!r.separable)
      bl.push({
        k: 'p',
        c: ['H не распадается на слагаемые, каждое от своей пары (qⱼ, pⱼ), — переменные не разделяются; полный интеграл в этой форме не строится.'],
      });
    else {
      bl.push({ k: 'p', c: ['H распадается на слагаемые от своих пар (qⱼ, pⱼ) — каждое приравниваем постоянной разделения:'] });
      bl.push({
        k: 'eq',
        lines: r.parts.flatMap((p) => [{ c: [`${symText(withDV(p.H))} = ${symText(p.E)}`] }, { c: [b(`${dV(p.q)} = ${symText(p.pq)}`)] }]),
      });
    }
    steps.push({ title: 'Разделение переменных', blocks: bl });
  }
  if (r.separable) {
    const bl: Block[] = [];
    if (r.V) bl.push({ k: 'eq', lines: [{ c: [b('V = ' + symText(r.V))] }] });
    else {
      const terms = ['−h·t', ...r.cyclic.map((c) => `${prettyName(c.alpha)}·${prettyName(names[c.i])}`)];
      for (const p of r.parts)
        terms.push(p.integral ? symText(p.integral) : `∫${symText(p.pq).includes(' ') ? `(${symText(p.pq)})` : symText(p.pq)} d${prettyName(p.q)}`);
      bl.push({ k: 'eq', lines: [{ c: [b('V = ' + terms.join(' + ').replace(/\+ −/g, '− '))] }] });
      bl.push({ k: 'p', c: ['Интеграл в элементарных функциях не берётся — оставлен квадратурой.'] });
    }
    if (r.first.length) {
      bl.push({ k: 'p', c: ['Первые интегралы (теорема Якоби) — производные V по постоянным равны новым постоянным:'] });
      bl.push({ k: 'eq', lines: r.first.map((f) => ({ c: [`∂V/∂${prettyName(f.wrt)} = `, symText(f.expr), ' = const'] })) });
    } else bl.push({ k: 'p', c: ['Первые интегралы ∂V/∂h = β₀, ∂V/∂αⱼ = βⱼ — квадратуры: t + β₀ = ∫(∂pⱼ/∂h)dqⱼ.'] });
    if (r.check)
      bl.push({
        k: 'p',
        c: [
          `Проверка по численному решению уравнений Лагранжа (${g4(pr.tEnd)} с): импульсы ∂T/∂q̇ совпадают с pⱼ(qⱼ) из полного интеграла `,
          r.check.pDev < 1e-6 ? 'с точностью лучше 10⁻⁶' : `с отличием ${g4(r.check.pDev * 100)} %`,
          r.check.firstDev.length ? `; первые интегралы постоянны с разбросом ${r.check.firstDev.map((x) => g4(x)).join('; ')}` : '',
          '.',
        ],
      });
    ex(bl, 'Знак корня pⱼ меняется в точках поворота qⱼ — там же меняет ветвь первый интеграл.');
    steps.push({ title: 'Полный интеграл', blocks: bl });
  }
  const rows: Row[] = [{ kind: 'main', val: [`∂V/∂t + ${symText(withDV(r.H))} = 0`], note: 'уравнение Якоби — Гамильтона' }];
  if (r.V) rows.push({ kind: 'main', val: ['V = ' + symText(r.V)], note: 'полный интеграл' });
  else for (const p of r.parts) rows.push({ kind: 'main', val: [`${pn(p.q)} = ${symText(p.pq)}`], note: 'импульс в полном интеграле' });
  for (const f of r.first) rows.push({ kind: 'aux', val: [`∂V/∂${prettyName(f.wrt)} = ${symText(f.expr)}`], note: 'первый интеграл' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ───────────── Струна и нить ───────────── */

export function stringDoc(pr: StringProblem, r: StringSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames(['x']);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const dTt = symText(r.dT);
  const expanded = `${wrap(r.rho)}·∂²y/∂t² = ${wrap(r.T)}·∂²y/∂x²${!r.dT.length ? '' : r.dT.length === 1 && dTt.startsWith('−') ? ` − ${dTt.slice(1)}·∂y/∂x` : ` + ${wrap(r.dT)}·∂y/∂x`}`;
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [{ c: ['ρ(x) = ', symText(r.rho)] }, { c: ['T(x) = ', symText(r.T)] }, { c: [eqv('l', r.l, r.lv)] }],
      },
      {
        k: 'p',
        c: ['Кинетическая энергия ∫ρ(∂y/∂t)²/2 dx, потенциальная — работа натяжения на удлинении ∫T(∂y/∂x)²/2 dx. Действие по Гамильтону — Остроградскому:'],
      },
      { k: 'eq', lines: [{ c: [b('S = ∫∫ [ρ(∂y/∂t)² − T(∂y/∂x)²]/2 dx dt')] }] },
    ];
    steps.push({ title: 'Действие', blocks: bl });
  }
  {
    const bl: Block[] = [{ k: 'p', c: ['δS = 0 при закреплённых в моменты t₁, t₂ значениях y; интегрируя по частям:'] }];
    if (r.a2) bl.push({ k: 'eq', lines: [{ c: [b('∂²y/∂t² = a²·∂²y/∂x²')] }, { c: [symText(r.a2) === 'T/ρ' ? 'a² = T/ρ' : `a² = T/ρ = ${symText(r.a2)}`] }] });
    else bl.push({ k: 'eq', lines: [{ c: [b('ρ·∂²y/∂t² = ∂/∂x(T·∂y/∂x)')] }, { c: [expanded] }] });
    bl.push({
      k: 'p',
      c: [
        'Граничные условия: y(0, t) = 0; ',
        pr.bc === 'fixed'
          ? 'y(l, t) = 0.'
          : r.zeroEnd
            ? 'на свободном конце натяжение равно нулю, слагаемое T·∂y/∂x·δy пропадает само — ∂y/∂x должна оставаться конечной.'
            : 'на свободном конце T·∂y/∂x = 0.',
      ],
    });
    ex(
      bl,
      'Внеинтегральные члены [T·∂y/∂x·δy] на концах дают граничные условия: на закреплённом конце δy = 0, на свободном должен обратиться в нуль сам множитель.',
    );
    steps.push({ title: 'Уравнение движения', blocks: bl });
  }
  {
    const bl: Block[] = [{ k: 'p', c: [`Собственные колебания y = Y(x)·sin ωt; разностная схема по ${r.shapes.x.length - 1} отрезкам:`] }];
    bl.push({ k: 'ul', items: r.omega.map((w, i) => [`ω${'₁₂₃₄₅₆'[i]} = `, b(`${g4(w)} рад/с`), `, период ${g4((2 * Math.PI) / w)} с`]) });
    if (r.a2)
      bl.push({
        k: 'p',
        c: [pr.bc === 'fixed' ? 'Точно: ωₖ = kπa/l, формы Yₖ = sin(kπx/l).' : 'Точно: ωₖ = (2k − 1)πa/(2l), формы Yₖ = sin((2k − 1)πx/(2l)).'],
      });
    steps.push({ title: 'Собственные частоты и формы', blocks: bl });
  }
  const rows: Row[] = [
    { kind: 'main', val: [r.a2 ? `∂²y/∂t² = ${wrap(r.a2)}·∂²y/∂x²` : expanded], note: 'уравнение колебаний' },
    ...r.omega.map((w, i): Row => ({ kind: 'aux', val: [`ω${'₁₂₃₄₅₆'[i]} = ${g4(w)} рад/с`], note: `${i + 1}-я собственная частота` })),
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
