/**
 * Решение по шагам: система и коэффициенты (энергия, цепочка, балка — коэффициенты влияния, гаситель), уравнения
 * малых колебаний, уравнение частот, частоты, формы главных колебаний, главные координаты, свободное движение,
 * вынужденные колебания и гашение, ответ.
 */
import { b, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { prettyName, setCoordNames, symText, varName } from '../../../shared/sym';
import { num } from '../../orbit/text/solution';
import { det } from '../model/linalg';
import { freeCoefs, type ChainSys, type VibOut, type VibProblem } from '../model/vibration';

const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const sb = (i: number) => String(i).replace(/\d/g, (x) => SUBD[+x]);
const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sp = (i: number) => String(i).replace(/\d/g, (x) => SUPD[+x]);
/** Число в произведении: в скобках, если отрицательное или с множителем 10ⁿ. */
const nm = (x: number, d = 5) => {
  const t = num(x, d);
  return /^−|·/.test(t) ? `(${t})` : t;
};
/** Член суммы «± |x|·тело» (первый — без плюса). */
function sumText(terms: [number, string][], d = 5): string {
  const t = terms.filter(([x]) => x !== 0);
  if (!t.length) return '0';
  return t
    .map(([x, body], i) => {
      const a = num(Math.abs(x), d);
      const coef = body && a === '1' ? '' : a + (body ? '·' : '');
      return (i === 0 ? (x < 0 ? '−' : '') : x < 0 ? ' − ' : ' + ') + coef + body;
    })
    .join('');
}
/** Простая дробь, если число ей равно (знаменатель до 5000): 4/243. */
export function ratio(x: number): string | null {
  if (!Number.isFinite(x) || x === 0) return null;
  const a = Math.abs(x);
  let h0 = 0,
    h1 = 1,
    k0 = 1,
    k1 = 0,
    y = a;
  for (let i = 0; i < 20; i++) {
    const n = Math.floor(y);
    [h0, h1] = [h1, n * h1 + h0];
    [k0, k1] = [k1, n * k1 + k0];
    if (k1 > 5000) return null;
    if (Math.abs(h1 / k1 - a) <= 1e-9 * a) return (x < 0 ? '−' : '') + (k1 === 1 ? String(h1) : `${h1}/${k1}`);
    const f = y - n;
    if (f < 1e-12) return null;
    y = 1 / f;
  }
  return null;
}

const CHAIN_T: Record<ChainSys['kind'], { body: string; m: string; link: string }> = {
  spring: { body: 'груз', m: 'm', link: 'пружина' },
  shaft: { body: 'диск', m: 'J', link: 'участок вала' },
  string: { body: 'груз', m: 'm', link: 'участок нити' },
};

export function vibDoc(pr: VibProblem, r: VibOut, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok)
    return {
      steps: [
        {
          title: 'Данные',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'p', c: [r.error] },
          ],
        },
      ],
    };
  const sys = r.sys;
  const n = r.n;
  setCoordNames(sys.names);
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const q = (j: number, ord = 0) => varName(prettyName(sys.names[j]), ord);
  /** Главные координаты — θ (как у Мещерского), если θ не занята координатами системы. */
  const TH = sys.names.some((x) => x.startsWith('θ')) ? 'ξ' : 'θ';
  const unit = (j: number) => (sys.angle[j] ? 'рад' : 'м');
  const force = sys.force;
  const hasH = sys.Hs.some((x) => x !== 0) || sys.Hc.some((x) => x !== 0);
  const info = sys.info;
  const ans: AnswerRow[] = [];

  /* 1. Система. */
  {
    const bl: Block[] = [];
    const mat = (name: string, M: number[][]) => ({
      k: 'eq' as const,
      lines: M.map((row, i) => ({ c: [i === 0 ? `${name} = ` : '    ', '[ ', row.map((x) => num(x)).join('   '), ' ]'] as Inline[] })),
    });
    if (info.src === 'energy') {
      bl.push({
        k: 'p',
        c: [
          'Обобщённые координаты: ',
          b(sys.names.map((_, j) => q(j)).join(', ')),
          n > 1 ? ` — система с ${n} степенями свободы.` : ' — одна степень свободы.',
        ],
      });
      const lines: { c: Inline[] }[] = [{ c: ['T = ', symText(info.T)] }, { c: ['Π = ', symText(info.P)] }];
      if (info.D.length) lines.push({ c: ['Φ = ', symText(info.D)] });
      bl.push({ k: 'eq', lines });
      const eqTxt = sys.names.map((_, j) => `${q(j)}* = ${num(info.eq[j])}`).join(', ');
      bl.push({
        k: 'p',
        c: [
          'Положение равновесия ',
          eqTxt,
          `: ∂${info.hasT0 ? '(Π − T₀)' : 'Π'}/∂qⱼ = 0. Около него `,
          b('T ≈ ½ Σ aᵢⱼ q̇ᵢ q̇ⱼ, Π ≈ ½ Σ cᵢⱼ qᵢ qⱼ'),
          info.b ? ', Φ ≈ ½ Σ bᵢⱼ q̇ᵢ q̇ⱼ' : '',
          ', где qⱼ отсчитаны от равновесия, ',
          `aᵢⱼ = ∂²T/∂q̇ᵢ∂q̇ⱼ, cᵢⱼ = ∂²${info.hasT0 ? '(Π − T₀)' : 'Π'}/∂qᵢ∂qⱼ${info.b ? ', bᵢⱼ = ∂²Φ/∂q̇ᵢ∂q̇ⱼ' : ''} при q = q*:`,
        ],
      });
      const coef = (name: string, S: typeof info.a, M: number[][]) =>
        S.flatMap((row, i) =>
          row
            .map((s, j) => ({ s, j }))
            .filter(({ j }) => j >= i)
            .filter(({ s, j }) => s.length || i === j)
            .map(({ s, j }) => {
              const t = symText(s);
              const v = num(M[i][j]);
              return { c: [`${name}${sb(i + 1)}${sb(j + 1)} = `, t === v ? t : `${t} = ${v}`] as Inline[] };
            }),
        );
      bl.push({ k: 'eq', lines: [...coef('a', info.a, sys.A), ...coef('c', info.c, sys.C), ...(info.b ? coef('b', info.b, sys.B!) : [])] });
      const zeroOff = (M: number[][]) => M.every((row, i) => row.every((x, j) => i === j || x === 0));
      if (n > 1)
        bl.push({
          k: 'p',
          c: [
            'Остальные коэффициенты (не выписаны) равны нулю; aᵢⱼ = aⱼᵢ, cᵢⱼ = cⱼᵢ.',
            zeroOff(sys.A) && zeroOff(sys.C) ? ' Координаты не связаны: каждая колеблется независимо.' : '',
          ],
        });
      ex(
        bl,
        'Малые колебания: в разложении T и Π около равновесия оставляем квадратичные члены — коэффициенты берутся при q = q* (cos q* вместо cos q и т. п.). ',
        info.hasT0 ? 'Часть T без скоростей (T₀ — во вращающейся системе) действует как потенциальная энергия −T₀ центробежных сил инерции. ' : '',
        'Положение q* проверено: обобщённые силы в нём равны нулю.',
      );
    } else if (info.src === 'chain') {
      const ch = pr.chain;
      const W = CHAIN_T[ch.kind];
      const bodies = ch.bodies.map((bd, i) => `${W.m}${sb(i + 1)} = ${num(bd.m)}`).join(', ');
      bl.push({
        k: 'p',
        c: [
          `Цепочка из ${n} тел (${W.body === 'диск' ? 'диски на валу' : ch.kind === 'string' ? 'грузы на натянутой нити, поперечные колебания' : 'грузы на пружинах'}): `,
          bodies,
          '. Координаты ',
          b(sys.names.map((_, j) => q(j)).join(', ')),
          ' — от положения равновесия.',
        ],
      });
      const lines: { c: Inline[] }[] = [];
      let k = 0;
      ch.links.forEach((l, i) => {
        if (!info.used[i]) return;
        k++;
        const cn = `c${sb(k)}`;
        const who = i === 0 ? `левый конец — ${W.body} 1` : i === n ? `${W.body} ${n} — правый конец` : `${W.body} ${i} — ${W.body} ${i + 1}`;
        const c = info.c[i];
        const how =
          ch.kind === 'string'
            ? `${cn} = N/l${sb(k)} = ${num(ch.N)}/${num(l.len)} = ${num(c)}`
            : ch.kind === 'shaft' && l.d > 0
              ? `${cn} = Gπd${sb(k)}⁴/(32l${sb(k)}) = ${num(ch.G)}·π·${nm(l.d)}⁴/(32·${nm(l.len)}) = ${num(c)}`
              : `${cn} = ${num(c)}`;
        lines.push({ c: [`${W.link} ${who}: `, how, l.b > 0 ? `; демпфер b${sb(k)} = ${num(l.b)}` : ''] });
      });
      ch.bodies.forEach((bd, i) => {
        if (bd.cg > 0) lines.push({ c: [`пружина ${W.body} ${i + 1} — неподвижная точка: c = ${num(bd.cg)}`] });
      });
      bl.push({ k: 'eq', lines });
      const ends = [
        ch.left === 'free'
          ? 'левый конец свободен'
          : ch.left === 'fixed'
            ? 'левый конец закреплён'
            : `левый конец движется по закону ξ = ${num(ch.xi0)}${force.kind === 'harm' ? ' sin pt' : force.kind === 'const' ? ' (сдвинут в момент t = 0)' : ''}`,
        ch.right === 'free' ? 'правый свободен' : 'правый закреплён',
      ];
      bl.push({ k: 'p', c: ['Концы: ', ends.join(', '), '. T = ½ Σ ', W.m, 'ᵢ q̇ᵢ², Π = ½ Σ c (разность смещений концов звена)² — матрицы коэффициентов:'] });
      bl.push(mat('A', sys.A), mat('C', sys.C));
      if (sys.B) bl.push(mat('B', sys.B));
      if (ch.kind === 'string')
        ex(
          bl,
          'При малых поперечных смещениях натяжение нити N не меняется; участок длиной l, концы которого смещены на Δ, даёт возвращающую силу NΔ/l — как пружина жёсткости N/l.',
        );
      else if (ch.kind === 'shaft')
        ex(
          bl,
          'Участок вала — крутильная пружина: момент cΔφ, где Δφ — угол закручивания участка; жёсткость сплошного круглого вала c = GI_p/l, I_p = πd⁴/32.',
        );
      else ex(bl, 'Пружина между телами i и j даёт в Π член ½c(xⱼ − xᵢ)²: в cᵢᵢ и cⱼⱼ входит +c, в cᵢⱼ — −c.');
    } else if (info.src === 'beam') {
      const bm = pr.beam;
      const m = info.model;
      const sup = bm.supports.map((s) => `${s.kind === 'pin' ? 'шарнир' : 'заделка'} в x = ${num(s.x)}`).join(', ');
      bl.push({
        k: 'p',
        c: [
          `Невесомая балка длиной L = ${num(bm.L)}, EJ = ${num(bm.EJ)}; опоры: ${sup}. Грузы: `,
          bm.masses
            .map(
              (ms, i) =>
                `${i + 1}) m = ${num(ms.m)} в x = ${num(ms.x)}${ms.J > 0 || ms.e ? `, J = ${num(ms.J)}${ms.e ? `, центр масс в ${num(ms.e)} от точки крепления` : ''}` : ''}`,
            )
            .join('; '),
          '.',
        ],
      });
      bl.push({
        k: 'p',
        c: [
          'Координаты: ',
          b(sys.names.map((_, j) => q(j)).join(', ')),
          ' — прогибы',
          m.dofs.some((d) => d.kind === 'th') ? ' и углы поворота сечений' : '',
          ' в точках грузов.',
        ],
      });
      const scale = (i: number, j: number) => 3 - (m.dofs[i].kind === 'th' ? 1 : 0) - (m.dofs[j].kind === 'th' ? 1 : 0);
      const lines: { c: Inline[] }[] = [];
      for (let i = 0; i < n; i++)
        for (let j = i; j < n; j++) {
          const p = scale(i, j);
          const unitL = p === 3 ? 'L³/(EJ)' : p === 2 ? 'L²/(EJ)' : 'L/(EJ)';
          const k = (m.delta[i][j] * bm.EJ) / bm.L ** p;
          const fr = ratio(k);
          lines.push({ c: [`δ${sb(i + 1)}${sb(j + 1)} = `, fr ? `${fr}·${unitL}` : `${num(k)}·${unitL}`, ` = ${num(m.delta[i][j])}`] });
        }
      bl.push({ k: 'p', c: ['Коэффициенты влияния δᵢⱼ — перемещение по координате i от единичной силы (момента) по координате j:'] }, { k: 'eq', lines });
      bl.push({ k: 'p', c: ['Перемещения от сил инерции: ', b('qᵢ = −Σ δᵢⱼ (Σ aⱼₖ q̈ₖ)'), '; матрица инерции A и обратная к δ матрица жёсткости C = δ⁻¹:'] });
      bl.push(mat('A', sys.A), mat('C', sys.C));
      ex(
        bl,
        'δᵢⱼ находят способом Мора (перемножением эпюр от единичных сил); по теореме Максвелла δᵢⱼ = δⱼᵢ. Здесь перемещения найдены методом перемещений — для сосредоточенных сил это то же самое, годится и для статически неопределимых балок. Груз с моментом инерции даёт две координаты: прогиб и поворот.',
      );
    } else {
      const a = pr.absorber;
      const p = force.p;
      bl.push({
        k: 'p',
        c: [
          `Основная система: масса m₁ = ${num(a.m1)} на пружине c₁`,
          a.c1Res ? ` = m₁p² = ${num(info.c1)} (резонанс при p = ${num(p)})` : ` = ${num(info.c1)}`,
          `, сила H sin pt, H = ${num(a.H)}. К массе m₁ присоединён гаситель: масса m₂ на пружине c₂.`,
        ],
      });
      bl.push({
        k: 'p',
        c: [
          'Амплитуда основной массы X₁ = H(c₂ − m₂p²)/Δ обращается в нуль при ',
          b('c₂/m₂ = p²'),
          ' — собственная частота гасителя равна частоте силы. Тогда гаситель колеблется с амплитудой ',
          b('X₂ = −H/c₂'),
          ': его пружина передаёт на m₁ силу, равную и противоположную возмущающей.',
        ],
      });
      const lines: { c: Inline[] }[] =
        a.by === 'amp'
          ? [{ c: [`c₂ = H/A = ${num(Math.abs(a.H))}/${nm(a.A)} = `, b(num(info.c2))] }, { c: [`m₂ = c₂/p² = ${num(info.c2)}/${nm(p)}² = `, b(num(info.m2))] }]
          : [{ c: [`c₂ = m₂p² = ${num(info.m2)}·${nm(p)}² = `, b(num(info.c2))] }, { c: [`X₂ = −H/c₂ = `, b(num(info.A2 * -1))] }];
      bl.push({ k: 'eq', lines });
      ex(
        bl,
        'Если гаситель задан наибольшей амплитудой A, жёсткость его пружины c₂ = H/A, масса m₂ = c₂/p²; вес гасителя P₂ = m₂g. Систему «основная масса + гаситель» дальше исследуем как систему с двумя степенями свободы.',
      );
      bl.push(mat('A', sys.A), mat('C', sys.C));
      ans.push(
        { kind: 'main', val: [`m₂ = ${num(info.m2)}`], note: 'масса гасителя (вес P₂ = m₂g)' },
        { kind: 'main', val: [`c₂ = ${num(info.c2)}`], note: 'жёсткость пружины гасителя' },
      );
    }
    steps.push({ title: 'Система', blocks: bl });
  }

  /* 2. Уравнения. */
  const Ft = (j: number): string => {
    if (force.kind === 'none' || (!sys.Hs[j] && !sys.Hc[j])) return '0';
    if (force.kind === 'const') return num(sys.Hs[j]);
    const parts: string[] = [];
    if (sys.Hs[j]) parts.push(`${num(sys.Hs[j])} sin ${nm(force.p)}t`);
    if (sys.Hc[j]) parts.push(`${num(sys.Hc[j])} cos ${nm(force.p)}t`);
    return parts.join(' + ').replace('+ −', '− ');
  };
  {
    const bl: Block[] = [];
    const lines = sys.A.map((row, i) => {
      const terms: [number, string][] = [
        ...row.map((a, j) => [a, q(j, 2)] as [number, string]),
        ...(sys.B ? sys.B[i].map((x, j) => [x, q(j, 1)] as [number, string]) : []),
        ...sys.C[i].map((c, j) => [c, q(j)] as [number, string]),
      ];
      return { c: [sumText(terms), ' = ', Ft(i)] as Inline[] };
    });
    bl.push(
      { k: 'p', c: ['Уравнения Лагранжа для квадратичных T и Π: ', b('Σ aᵢⱼ q̈ⱼ' + (sys.B ? ' + Σ bᵢⱼ q̇ⱼ' : '') + ' + Σ cᵢⱼ qⱼ = Qᵢ(t)'), ':'] },
      { k: 'eq', lines },
    );
    if (info.src === 'chain' && pr.chain.left === 'moving' && pr.chain.xi0 && force.kind !== 'none')
      bl.push({ k: 'p', c: ['Движение левого конца действует на первое тело как сила c₀ξ', sys.Hc[0] ? ' + b₀ξ̇' : '', ' (кинематическое возбуждение).'] });
    ex(
      bl,
      'Система линейных уравнений с постоянными коэффициентами; d/dt(∂T/∂q̇ᵢ) = Σ aᵢⱼ q̈ⱼ, −∂Π/∂qᵢ = −Σ cᵢⱼ qⱼ',
      sys.B ? ', сила сопротивления −∂Φ/∂q̇ᵢ = −Σ bᵢⱼ q̇ⱼ.' : '.',
    );
    steps.push({ title: 'Уравнения малых колебаний', blocks: bl });
  }

  /* 3. Уравнение частот. */
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Главные колебания qⱼ = Aⱼ sin(kt + β) без сопротивления: Σ (cᵢⱼ − k²aᵢⱼ)Aⱼ = 0. Ненулевые амплитуды — при ',
        b('det(C − k²A) = 0'),
        ' (уравнение частот).',
      ],
    });
    const A = sys.A,
      C = sys.C;
    if (n === 1) bl.push({ k: 'eq', lines: [{ c: [`k² = c₁₁/a₁₁ = ${num(C[0][0])}/${nm(A[0][0])} = ${num(r.modes[0].lam)}`] }] });
    else if (n === 2) {
      const c4 = A[0][0] * A[1][1] - A[0][1] ** 2,
        c2 = -(A[0][0] * C[1][1] + A[1][1] * C[0][0] - 2 * A[0][1] * C[0][1]),
        c0 = C[0][0] * C[1][1] - C[0][1] ** 2;
      bl.push({
        k: 'eq',
        lines: [
          { c: ['(a₁₁a₂₂ − a₁₂²)k⁴ − (a₁₁c₂₂ + a₂₂c₁₁ − 2a₁₂c₁₂)k² + (c₁₁c₂₂ − c₁₂²) = 0'] },
          {
            c: [
              sumText([
                [c4, 'k⁴'],
                [c2, 'k²'],
                [c0, ''],
              ]),
              ' = 0',
            ],
            num: true,
          },
        ],
      });
    } else {
      bl.push({ k: 'p', c: [`Уравнение ${n}-й степени относительно k²; корни найдены численно (метод вращений Якоби для det(C − λA) = 0, λ = k²).`] });
      if (info.src === 'beam') bl.push({ k: 'p', c: ['В форме податливости: det(δ·A − E/k²) = 0.'] });
    }
    if (n <= 3) {
      const resid = Math.max(...r.modes.map((m) => Math.abs(det(C.map((row, i) => row.map((c, j) => c - m.lam * A[i][j]))))));
      const sc = Math.abs(det(C)) + Math.abs(det(A)) * Math.max(...r.modes.map((m) => Math.abs(m.lam))) ** n;
      if (sc > 0 && resid > 1e-6 * sc) bl.push({ k: 'badge', tone: 'warn', text: 'точность корней понижена' });
    }
    ex(
      bl,
      'Квадраты частот — обобщённые собственные значения пары матриц C и A; все они положительны, если положение равновесия устойчиво (C положительно определена). Нулевой корень — система может смещаться без деформации (свободные концы, циклическая координата).',
    );
    steps.push({ title: 'Уравнение частот', blocks: bl });
  }

  /* 4. Частоты. */
  {
    const bl: Block[] = [];
    const items: Inline[][] = r.modes.map((m, s) => {
      const k = `k${sb(s + 1)}`;
      if (m.kind === 'zero')
        return [`${k} = 0 — перемещение без деформации: главная координата меняется равномерно (или под постоянной силой — равноускоренно)`];
      if (m.kind === 'unstable') return [`${k}² = ${num(m.lam)} < 0 — положение равновесия неустойчиво`];
      const row: Inline[] = [`${k}² = ${num(m.lam)};  `, b(`${k} = ${num(m.k)} рад/с`), `;  период T${sb(s + 1)} = 2π/${k} = ${num((2 * Math.PI) / m.k)} с`];
      if (m.h != null && m.h > 0)
        row.push(
          `;  затухание h${sb(s + 1)} = ${num(m.h)} с⁻¹`,
          m.kd != null ? `, k*${sb(s + 1)} = √(k² − h²) = ${num(m.kd)} рад/с` : ' ≥ k — движение апериодическое',
        );
      return row;
    });
    bl.push({ k: 'ul', items });
    if (r.repeated)
      bl.push(
        { k: 'badge', tone: 'warn', text: 'кратные частоты' },
        {
          k: 'p',
          c: ['Есть равные частоты: соответствующие формы определены неоднозначно — любая их комбинация тоже главное колебание; показан один из вариантов.'],
        },
      );
    if (r.modes.some((m) => m.kind === 'unstable')) bl.push({ k: 'badge', tone: 'bad', text: 'равновесие неустойчиво' });
    if (r.damping === 'coupled')
      bl.push({
        k: 'p',
        c: [
          'Сопротивление связывает главные координаты (матрица B не приводится к диагональной вместе с A и C) — частоты показаны без сопротивления, движение с сопротивлением найдено численно.',
        ],
      });
    if (r.damping === 'prop')
      ex(bl, 'Матрица сопротивления в главных координатах диагональна: каждая главная координата затухает независимо, θₛ = e^(−hₛt)(…), hₛ = b̃ₛₛ/(2Mₛ).');
    r.modes.forEach((m, s) => {
      if (m.kind === 'osc')
        ans.push({
          kind: 'main',
          val: [`k${sb(s + 1)} = ${num(m.k)} рад/с`],
          note: `частота ${s + 1}-го главного колебания, T = ${num((2 * Math.PI) / m.k)} с`,
        });
      else if (m.kind === 'zero') ans.push({ kind: 'aux', val: [`k${sb(s + 1)} = 0`], note: 'перемещение системы как целого' });
    });
    steps.push({ title: 'Частоты главных колебаний', blocks: bl });
  }

  /* 5. Формы. */
  if (n > 1) {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Амплитуды главного колебания пропорциональны: из системы (C − k²ₛA)A⁽ˢ⁾ = 0 находим ',
        b('коэффициенты распределения'),
        ' — амплитуды при первой ненулевой, равной 1.',
      ],
    });
    const lines: { c: Inline[] }[] = [];
    r.modes.forEach((m, s) => {
      const cells = m.shape.map((x, j) => `A${sb(j + 1)} = ${num(x, 4)}`).join(';  ');
      lines.push({ c: [`форма ${s + 1} (k${sb(s + 1)} = ${num(m.k)}):  `, b(cells)] });
    });
    bl.push({ k: 'eq', lines });
    if (n === 2) {
      const A = sys.A,
        C = sys.C;
      const ln: { c: Inline[] }[] = r.modes.map((m, s) => {
        const p1 = C[0][1] - m.lam * A[0][1],
          p0 = C[0][0] - m.lam * A[0][0];
        const mu = m.shape[1] / m.shape[0];
        const head = `μ${sb(s + 1)} = A${sb(2)}⁽${sp(s + 1)}⁾/A${sb(1)}⁽${sp(s + 1)}⁾`;
        if (m.shape[0] === 0 || m.shape[1] === 0) return { c: [`форма ${s + 1}: колеблется только ${q(m.shape[0] === 0 ? 1 : 0)}`] };
        if (Math.abs(p1) > 1e-12 * (Math.abs(p0) + 1e-300) && m.shape[0] !== 0)
          return {
            c: [`${head} = −(c₁₁ − k${sb(s + 1)}²a₁₁)/(c₁₂ − k${sb(s + 1)}²a₁₂) = −${nm(p0)}/${nm(p1)} = `, b(num(mu, 4)), `;  A₁/A₂ = ${num(1 / mu, 4)}`],
          };
        return { c: [`${head} = ${Number.isFinite(mu) ? num(mu, 4) : '∞'}`] };
      });
      bl.push({ k: 'eq', lines: ln });
    }
    // Узлы цепочки.
    if (info.src === 'chain') {
      const ch = pr.chain;
      const items: Inline[][] = [];
      r.modes.forEach((m, s) => {
        if (m.kind !== 'osc' || !m.nodes.length) return;
        const txt = m.nodes.map((nd) => {
          if (nd.at === 'body') return `${CHAIN_T[ch.kind].body} ${nd.i + 1} неподвижен`;
          const l = ch.links[nd.i].len;
          const hasLen = l > 0 && (ch.kind === 'string' || (ch.kind === 'shaft' && ch.links[nd.i].d > 0));
          return `между телами ${nd.i} и ${nd.i + 1}: ${num(nd.t, 4)} длины звена от тела ${nd.i}${hasLen ? ` (${num(nd.t * l, 4)} от тела ${nd.i}, ${num((1 - nd.t) * l, 4)} от тела ${nd.i + 1})` : ''}`;
        });
        items.push([`форма ${s + 1}: `, txt.join('; ')]);
      });
      if (items.length) {
        bl.push(
          { k: 'p', c: ['Узлы (точки, остающиеся неподвижными; положение на звене — по линейному распределению смещения вдоль него):'] },
          { k: 'ul', items },
        );
        r.modes.forEach((m, s) => {
          const nd = m.nodes.find((x) => x.at === 'link');
          if (m.kind === 'osc' && nd && nd.at === 'link' && ch.kind === 'shaft')
            ans.push({
              kind: 'aux',
              val: [
                ch.links[nd.i].d > 0
                  ? `узел формы ${s + 1}: ${num(nd.t * ch.links[nd.i].len, 4)} от диска ${nd.i}`
                  : `узел формы ${s + 1}: ${num(nd.t, 4)} длины участка от диска ${nd.i}`,
              ],
              note: 'узловое сечение вала',
            });
        });
      }
    }
    // Центры поворота грузов с моментом инерции (балка).
    if (info.src === 'beam') {
      const items: Inline[][] = [];
      info.model.dofs.forEach((d, j) => {
        if (d.kind !== 'th') return;
        r.modes.forEach((m, s) => {
          const y = m.shape[j - 1],
            th = m.shape[j];
          if (th === 0) return;
          const x = -y / th;
          items.push([
            `груз ${d.mass + 1}, форма ${s + 1}: поворот вокруг точки оси на расстоянии ${num(Math.abs(x), 4)} ${x < 0 ? 'левее' : 'правее'} точки крепления (y/φ = ${num(y / th, 4)})`,
          ]);
        });
      });
      if (items.length)
        bl.push(
          { k: 'p', c: ['Сечение с грузом смещается на y и поворачивается на φ — как бы поворачивается вокруг точки оси балки на расстоянии −y/φ:'] },
          { k: 'ul', items },
        );
    }
    if (n > 1) bl.push({ k: 'p', c: [`Проверка ортогональности форм: Σ aᵢⱼ Aᵢ⁽ʳ⁾ Aⱼ⁽ˢ⁾ = 0 при r ≠ s (наибольшее отклонение ${num(r.ortho, 2)}).`] });
    ex(
      bl,
      'В главном колебании все координаты меняются синфазно (или в противофазе — отрицательный коэффициент) с одной частотой; форма показывает отношения амплитуд. Число перемен знака в форме растёт с номером частоты.',
    );
    r.modes.forEach((m, s) => {
      if (m.kind === 'osc')
        ans.push({ kind: 'aux', val: [`A⁽${sp(s + 1)}⁾ = (${m.shape.map((x) => num(x, 4)).join('; ')})`], note: `форма ${s + 1}-го главного колебания` });
    });
    steps.push({ title: 'Формы главных колебаний', blocks: bl });

    /* 6. Главные координаты. */
    const b6: Block[] = [];
    const sub = sys.names.map((_, j) => ({
      c: [
        `${q(j)} = `,
        sumText(
          r.modes.map((m, s) => [m.shape[j], `${TH}${sb(s + 1)}`] as [number, string]),
          4,
        ),
      ] as Inline[],
    }));
    b6.push({ k: 'p', c: ['Замена q = Σ A⁽ˢ⁾θₛ:'] }, { k: 'eq', lines: sub });
    b6.push({
      k: 'eq',
      lines: [
        { c: ['T = ½(', r.modes.map((m, s) => `${num(m.M)}·${varName(TH, 1)}${sb(s + 1)}²`).join(' + '), ')'] },
        { c: ['Π = ½(', r.modes.map((m, s) => `${num(m.C)}·${TH}${sb(s + 1)}²`).join(' + '), ')'] },
      ],
    });
    b6.push({
      k: 'p',
      c: ['Главные координаты независимы: θ̈ₛ + kₛ²θₛ = Qₛ/Mₛ, kₛ² = Cₛ/Mₛ, где Mₛ = Σ aᵢⱼAᵢ⁽ˢ⁾Aⱼ⁽ˢ⁾, Cₛ = Σ cᵢⱼAᵢ⁽ˢ⁾Aⱼ⁽ˢ⁾, обобщённая сила Qₛ = Σ Qⱼ Aⱼ⁽ˢ⁾.'],
    });
    ex(b6, 'Благодаря ортогональности форм в главных координатах T и Π — суммы квадратов: система распадается на независимые осцилляторы.');
    steps.push({ title: 'Главные координаты', blocks: b6 });
  }

  /* 7. Свободное движение. */
  const moving0 = sys.q0.some((x) => x !== 0) || sys.v0.some((x) => x !== 0);
  if (moving0 || (force.kind === 'const' && hasH)) {
    const bl: Block[] = [];
    const ic = sys.names.map((_, j) => `${q(j)}(0) = ${num(sys.q0[j])}, ${q(j, 1)}(0) = ${num(sys.v0[j])}`).join('; ');
    bl.push({ k: 'p', c: ['Начальные условия: ', ic, '.'] });
    const cst = force.kind === 'const' && hasH;
    const exact = r.damping === 'none' || (r.damping === 'prop' && !cst);
    if (n > 1)
      bl.push({
        k: 'p',
        c: [
          'Начальные значения главных координат (по ортогональности форм): θₛ(0) = Σ aᵢⱼAᵢ⁽ˢ⁾qⱼ(0)/Mₛ, θ̇ₛ(0) = Σ aᵢⱼAᵢ⁽ˢ⁾q̇ⱼ(0)/Mₛ',
          cst ? '; постоянная сила в главных координатах Qₛ = Σ Hⱼ Aⱼ⁽ˢ⁾' : '',
          ':',
        ],
      });
    bl.push({
      k: 'eq',
      lines: r.modes.map((_, s) => ({
        c: [
          `${TH}${sb(s + 1)}(0) = ${num(r.modal.th0[s])},  ${varName(TH, 1)}${sb(s + 1)}(0) = ${num(r.modal.dth0[s])}`,
          cst ? `,  Q${sb(s + 1)} = ${num(r.modal.F[s])}` : '',
        ] as Inline[],
      })),
    });
    if (exact && r.modes.every((m) => m.kind !== 'unstable')) {
      if (r.damping === 'none') {
        const { D, E } = freeCoefs(r);
        const lines = sys.names.map((_, j) => {
          let c0 = 0,
            c1 = 0,
            c2 = 0;
          const terms: [number, string][] = [];
          r.modes.forEach((m, s) => {
            const mu = m.shape[j];
            const F = cst ? r.modal.F[s] : 0;
            if (m.kind === 'zero') {
              c0 += D[j][s];
              c1 += E[j][s];
              c2 += (mu * F) / (2 * m.M);
            } else {
              const st = (mu * F) / m.C;
              c0 += st;
              terms.push([D[j][s] - st, `cos ${nm(m.k)}t`], [E[j][s], `sin ${nm(m.k)}t`]);
            }
          });
          const scale = Math.max(1e-300, ...terms.map(([x]) => Math.abs(x)), Math.abs(c0), Math.abs(c1), Math.abs(c2));
          const all = ([[c0, ''], [c1, 't'], [c2, 't²'], ...terms] as [number, string][]).map(([x, body]): [number, string] => [
            Math.abs(x) < 1e-10 * scale ? 0 : x,
            body,
          ]);
          return { c: [`${q(j)} = `, b(sumText(all))] as Inline[] };
        });
        bl.push({ k: 'eq', lines });
        ex(
          bl,
          'Каждая главная координата: θₛ = θₛ(0) cos kₛt + θ̇ₛ(0)/kₛ·sin kₛt',
          cst ? ' + Qₛ/Cₛ·(1 − cos kₛt)' : '',
          '; при kₛ = 0 — θₛ = θₛ(0) + θ̇ₛ(0)t',
          cst ? ' + Qₛt²/(2Mₛ)' : '',
          '. Координаты qⱼ — суммы главных колебаний с весами Aⱼ⁽ˢ⁾.',
        );
        lines.forEach((l, j) => ans.push({ kind: 'main', val: l.c, note: `закон движения, ${unit(j)}` }));
      } else {
        const lines = r.modes.map((m, s) => {
          const th0 = r.modal.th0[s],
            dth = r.modal.dth0[s],
            h = m.h ?? 0;
          const nameS = `${TH}${sb(s + 1)}`;
          if (m.kind === 'zero' || m.kd == null) return { c: [`${nameS}: апериодическое движение (h ≥ k)`] as Inline[] };
          const osc = sumText([
            [th0, `cos ${nm(m.kd)}t`],
            [(dth + h * th0) / m.kd, `sin ${nm(m.kd)}t`],
          ]);
          return { c: [`${nameS} = `, b(h > 0 ? `e^(−${num(h)}t)·(${osc})` : osc)] as Inline[] };
        });
        bl.push({ k: 'eq', lines });
        lines.forEach((l, s) => ans.push({ kind: 'aux', val: l.c, note: `главная координата ${s + 1}` }));
        ex(bl, 'При сопротивлении θₛ = e^(−hₛt)(θₛ(0) cos k*ₛt + (θ̇ₛ(0) + hₛθₛ(0))/k*ₛ·sin k*ₛt), k*ₛ = √(kₛ² − hₛ²).');
      }
    } else bl.push({ k: 'p', c: ['Движение найдено численно (метод Рунге — Кутта) — см. графики.'] });
    steps.push({ title: cst ? 'Движение под постоянной силой' : 'Свободные колебания', blocks: bl });
  }

  /* 8. Вынужденные колебания. */
  if (force.kind === 'harm' && hasH) {
    const bl: Block[] = [];
    const p = force.p;
    const damped = r.damping !== 'none';
    if (r.resonance != null) {
      bl.push(
        { k: 'badge', tone: 'bad', text: 'резонанс' },
        {
          k: 'p',
          c: [
            `Частота силы p = ${num(p)} совпадает с k${sb(r.resonance + 1)}: без сопротивления амплитуда растёт неограниченно, частного решения вида X sin pt нет.`,
          ],
        },
      );
      ans.push({ kind: 'main', val: [`p = k${sb(r.resonance + 1)} = ${num(p)} рад/с`], note: 'резонанс' });
    } else if (r.forced) {
      const f = r.forced;
      if (!damped && sys.Hc.every((x) => x === 0)) {
        bl.push({ k: 'p', c: ['Частное решение qⱼ = Xⱼ sin pt: ', b('(C − p²A)·X = H'), `, p = ${num(p)} рад/с:`] });
        const R = sys.C.map((row, i) => row.map((c, j) => c - p * p * sys.A[i][j]));
        bl.push({
          k: 'eq',
          lines: R.map((row, i) => ({ c: [sumText(row.map((x, j) => [x, `X${sb(j + 1)}`] as [number, string])), ' = ', num(sys.Hs[i])] as Inline[] })),
        });
        if (f.dets && f.det != null)
          bl.push({
            k: 'eq',
            lines: [
              { c: [`Δ = det(C − p²A) = ${num(f.det)}`] },
              ...f.dets.map((dj, j) => ({ c: [`X${sb(j + 1)} = Δ${sb(j + 1)}/Δ = ${num(dj)}/${nm(f.det!)} = `, b(num(f.re[j]))] as Inline[] })),
            ],
          });
        else bl.push({ k: 'eq', lines: f.re.map((x, j) => ({ c: [`X${sb(j + 1)} = `, b(num(x))] as Inline[] })) });
        const big = Math.max(...f.re.map(Math.abs));
        f.re.forEach((x, j) =>
          ans.push({
            kind: 'main',
            val: [Math.abs(x) <= 1e-12 * big ? `${q(j)} = 0` : `${q(j)} = ${num(x)}·sin ${nm(p)}t`],
            note: Math.abs(x) <= 1e-12 * big ? 'координата неподвижна' : `вынужденные колебания, ${unit(j)}`,
          }),
        );
        ex(
          bl,
          'Знак Xⱼ < 0 — координата колеблется в противофазе с силой. Δ = det(A)·Π(p² − kₛ²): при p, близкой к одной из частот, амплитуды велики (резонанс).',
        );
      } else {
        bl.push({
          k: 'p',
          c: [
            'Частное решение qⱼ = Xⱼ sin(pt + εⱼ) — через комплексные амплитуды: ',
            b('(C − p²A + ipB)·X̂ = H + iH′'),
            ` (H′ — амплитуда слагаемого с cos pt), p = ${num(p)} рад/с:`,
          ],
        });
        bl.push({
          k: 'eq',
          lines: f.amp.map((a, j) => ({
            c: [`X${sb(j + 1)} = |X̂${sb(j + 1)}| = `, b(num(a)), `,  ε${sb(j + 1)} = ${num((f.phase[j] * 180) / Math.PI, 4)}°`] as Inline[],
          })),
        });
        f.amp.forEach((a, j) =>
          ans.push({
            kind: 'main',
            val: [`${q(j)} = ${num(a)}·sin(${nm(p)}t ${f.phase[j] < 0 ? '−' : '+'} ${num(Math.abs(f.phase[j]), 4)})`],
            note: `установившиеся вынужденные колебания, ${unit(j)}`,
          }),
        );
        ex(bl, 'С сопротивлением амплитуды конечны и при резонансе, а координаты сдвинуты по фазе относительно силы.');
      }
    }
    if (r.zeroAt) {
      const k = r.zeroAt.k;
      const ps = r.zeroAt.p;
      const hit = ps.findIndex((x) => Math.abs(x - p) <= 1e-6 * p);
      bl.push({
        k: 'p',
        c: [
          `Амплитуда нагруженной координаты ${q(k)} равна нулю, когда p — собственная частота системы, в которой ${q(k)} закреплена: `,
          b(ps.length ? ps.map((x) => `p = ${num(x)} рад/с`).join(', ') : 'таких частот нет'),
          '.',
        ],
      });
      if (hit >= 0) {
        bl.push(
          { k: 'badge', tone: 'ok', text: 'гашение колебаний' },
          { k: 'p', c: [`При заданной p = ${num(p)} координата ${q(k)} неподвижна — остальная система работает как динамический гаситель.`] },
        );
        if (info.src !== 'absorber') ans.push({ kind: 'aux', val: [`X${sb(k + 1)} = 0 при p = ${num(p)}`], note: 'гашение колебаний' });
      }
      ex(
        bl,
        'Xₖ = Δₖ/Δ, а Δₖ (определитель с k-м столбцом, заменённым на H) при силе только по qₖ — определитель системы без координаты qₖ: его нули — частоты этой «закреплённой» системы (антирезонанс).',
      );
    }
    if (r.sim)
      ex(
        bl,
        'Графики показывают полное движение из заданных начальных условий: вынужденные колебания плюс свободные (без сопротивления свободные не затухают, отсюда биения).',
      );
    steps.push({ title: 'Вынужденные колебания', blocks: bl });
  }

  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}
