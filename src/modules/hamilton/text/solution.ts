/**
 * Решение по шагам: интегралы движения, функция Рауса и Гамильтона, стационарные движения (§49, 55);
 * устойчивость по первому приближению (§55); нелинейные колебания — фазовая плоскость и усреднение (§56).
 */
import { b, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { prettyName, setCoordNames, symText, termText, varName, type Sym } from '../../../shared/sym';
import type { LagProblem } from '../../lagrange/model/lagrange';
import type { NonlinProblem, NonlinSolution, PointKind } from '../model/nonlin';
import type { RouthSolution } from '../model/routh';
import type { Cx, StabProblem, StabSolution, StabVerdict } from '../model/stability';

/** Четыре значащие цифры (и для малых чисел). */
export function g4(x: number): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e6) return fmt(x, Math.max(0, 3 - Math.floor(Math.log10(a))));
  const [m, e] = x.toExponential(3).split('e');
  return `${m.replace('.', ',').replace('-', '−')}·10${(+e)
    .toString()
    .replace('-', '⁻')
    .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d])}`;
}
const cx = (r: Cx) =>
  Math.abs(r[1]) < 1e-12
    ? g4(r[0])
    : `${Math.abs(r[0]) < 1e-12 ? '' : g4(r[0]) + ' '}${r[1] < 0 ? '−' : Math.abs(r[0]) < 1e-12 ? '' : '+'} ${g4(Math.abs(r[1]))}i`.trim();
const sub = (s: string) => s.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]);
const exOf =
  (opts: { explain?: boolean }) =>
  (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };

export const VERDICT: Record<StabVerdict, string> = {
  asym: 'асимптотически устойчиво',
  linear: 'устойчиво (не асимптотически)',
  unstable: 'неустойчиво',
  critical: 'критический случай',
};

/* ───────────── Интегралы, Раус, Гамильтон ───────────── */

export function routhDoc(pr: LagProblem, r: RouthSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames(r.ctx.coords);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const names = r.ctx.coords;
  const q = (n: string, ord = 0) => varName(prettyName(n), ord);
  const pn = (n: string) => 'p_' + prettyName(n);
  {
    const bl: Block[] = [
      { k: 'p', c: ['Обобщённые координаты: ', b(names.map((n) => q(n)).join(', ')), '.'] },
      {
        k: 'eq',
        lines: [
          { c: ['T = ', symText(r.T)] },
          { c: ['Π = ', symText(r.P)] },
          ...r.Q.flatMap((x, i): { c: Inline[] }[] => (x.length ? [{ c: ['Q', { t: 'sub', text: prettyName(names[i]) }, '^н = ', symText(x)] }] : [])),
        ],
      },
      { k: 'p', c: ['Обобщённые импульсы ', b('pⱼ = ∂T/∂q̇ⱼ'), ':'] },
      { k: 'eq', lines: names.map((n, i) => ({ c: [`${pn(n)} = `, symText(r.p[i])] })) },
    ];
    ex(bl, 'Функция Лагранжа L = T − Π. Импульс pⱼ — производная кинетической энергии по обобщённой скорости.');
    steps.push({ title: 'Система и обобщённые импульсы', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (r.cyclic.length) {
      bl.push({
        k: 'p',
        c: [
          r.cyclic.length > 1 ? 'Циклические координаты ' : 'Циклическая координата ',
          b(r.cyclic.map((i) => q(names[i])).join(', ')),
          ' не входит в T и Π, обобщённая сила по ней равна нулю: d/dt(∂T/∂q̇ₐ) = 0 — импульс постоянен:',
        ],
      });
      bl.push({
        k: 'eq',
        lines: r.cyclic.map((i, k) => ({
          c: [
            b(`${pn(names[i])} = ${symText(r.p[i])} = ${prettyName(r.nNames[k])}`),
            ` = const;  по начальным условиям ${prettyName(r.nNames[k])} = ${g4(r.nVal[k])}`,
          ],
        })),
      });
      ex(
        bl,
        'Циклический интеграл — обобщение закона сохранения импульса или момента количества движения: для угла поворота вокруг оси это кинетический момент относительно неё.',
      );
    } else bl.push({ k: 'p', c: ['Циклических координат нет: каждая координата входит в T или Π (или по ней действует непотенциальная сила).'] });
    if (r.energy) {
      bl.push({ k: 'eq', lines: [{ c: ['Σ q̇ⱼ·pⱼ − T + Π = ', b(symText(r.energy) + ' = h'), `;  h = ${g4(r.energyVal)}`] }] });
      ex(
        bl,
        'T и Π не зависят от времени явно и непотенциальных сил нет — сохраняется обобщённый интеграл энергии (Якоби). Если T не квадратичная форма скоростей (вращение с заданной ω), он не равен T + Π.',
      );
    } else bl.push({ k: 'p', c: ['Есть непотенциальные силы или явная зависимость от времени — интеграла энергии нет.'] });
    steps.push({ title: 'Первые интегралы', blocks: bl });
  }
  if (r.routh) {
    const R = r.routh;
    const bl: Block[] = [];
    if (r.cyclic.length) {
      bl.push({ k: 'p', c: ['Из циклических интегралов выражаем скорости циклических координат:'] });
      bl.push({ k: 'eq', lines: r.cyclic.map((i, k) => ({ c: [`${q(names[i], 1)} = `, symText(R.vel[k])] })) });
      bl.push({ k: 'p', c: ['Функция Рауса ', b('R = L − Σ nₐq̇ₐ'), ' (циклические скорости подставлены):'] });
    } else bl.push({ k: 'p', c: ['Циклических координат нет — функция Рауса совпадает с функцией Лагранжа: ', b('R = L = T − Π'), ':'] });
    bl.push({ k: 'eq', lines: [{ c: [b('R = ' + symText(R.R))] }] });
    if (R.eqs.length) {
      bl.push({ k: 'p', c: ['Уравнения для остальных координат — уравнения Лагранжа с функцией R: ', b('d/dt(∂R/∂q̇ᵢ) − ∂R/∂qᵢ = Qᵢ'), ':'] });
      bl.push({
        k: 'eq',
        lines: R.eqs.map((e) => {
          const same = e.factor.f.length === 0 && Math.abs(e.factor.c) === 1;
          return { c: [b(symText(e.Ered) + ' = 0'), same ? '' : `  (сокращено на ${termText(e.factor, true)})`] };
        }),
      });
      if (R.gyro) {
        const nc = names.filter((_, i) => !r.cyclic.includes(i));
        bl.push({
          k: 'p',
          c: ['Члены R₁ = Σ aⱼq̇ⱼ, линейные по скоростям, дают в левых частях уравнений гироскопические члены Γᵢ = Σ gᵢⱼq̇ⱼ, gᵢⱼ = ∂aᵢ/∂qⱼ − ∂aⱼ/∂qᵢ = −gⱼᵢ:'],
        });
        bl.push({
          k: 'eq',
          lines: nc.map((_, i) => ({
            c: [
              `Γ${sub(String(i + 1))} = `,
              R.gyro![i].map((g, j) => (g.length ? `(${symText(g)})·${q(nc[j], 1)}` : ''))
                .filter(Boolean)
                .join(' + ') || '0',
            ],
          })),
        });
      }
      ex(
        bl,
        'Циклические координаты «игнорируются»: число уравнений уменьшается на их число. Сами циклические координаты находятся потом квадратурой по найденным скоростям.',
      );
    }
    steps.push({ title: 'Функция Рауса', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (r.ham) {
      const h = r.ham;
      bl.push({
        k: 'p',
        c: [
          'Кинетическая энергия T = ½q̇ᵀAq̇ + bᵀq̇ + T₀. Скорости через импульсы: q̇ = A⁻¹(p − b). Функция Гамильтона ',
          b('H = Σ pⱼq̇ⱼ − L = ½(p − b)ᵀA⁻¹(p − b) − T₀ + Π'),
          ':',
        ],
      });
      bl.push({ k: 'eq', lines: [{ c: [b('H = ' + symText(h.H))] }] });
      bl.push({ k: 'p', c: ['Канонические уравнения ', b('q̇ⱼ = ∂H/∂pⱼ,  ṗⱼ = −∂H/∂qⱼ + Qⱼ^н'), ':'] });
      bl.push({
        k: 'eq',
        lines: names.flatMap((n, i) => [{ c: [`${q(n, 1)} = `, symText(h.dq[i])] }, { c: [`ṗ${'_' + prettyName(n)} = `, symText(h.dp[i])] }]),
      });
      if (r.lagDiff != null)
        bl.push({
          k: 'p',
          c: [
            `Проверка: канонические уравнения проинтегрированы (Рунге — Кутта, ${pr.tEnd} с) — координаты совпадают с решением уравнений Лагранжа ${r.lagDiff < 1e-6 ? 'с точностью лучше 10⁻⁶' : `с расхождением ${g4(r.lagDiff * 100)} %`}.`,
            r.hamDrift != null ? ` H меняется не больше чем на ${g4(r.hamDrift * 100)} %.` : '',
          ],
        });
      ex(
        bl,
        'Импульсы pⱼ и координаты qⱼ — равноправные (канонические) переменные: 2n уравнений первого порядка вместо n уравнений второго. Для натуральной системы (T — квадратичная форма скоростей) H = T + Π, выраженная через импульсы.',
      );
    } else bl.push({ k: 'p', c: [r.hamError ?? 'Функция Гамильтона не построена.'] });
    steps.push({ title: 'Функция Гамильтона', blocks: bl });
  }
  if (r.steady && r.routh) {
    const s = r.steady;
    const nc = names.map((n, i) => ({ n, i })).filter((x) => !r.cyclic.includes(x.i));
    const bl: Block[] = [];
    bl.push({ k: 'p', c: ['Приведённая потенциальная энергия — часть R без скоростей с обратным знаком: ', b('W = −R₀ = ' + symText(negS(r.routh.R0)))] });
    bl.push({
      k: 'p',
      c: [
        r.cyclic.length ? 'Стационарное движение (циклические скорости постоянны) — ' : 'Положение относительного равновесия — ',
        'точка, где ∂W/∂q = 0: ',
        b(nc.map((x) => `${q(x.n)}* = ${g4(s.q[x.i])}`).join(', ')),
        s.residual < 1e-8 ? '.' : ` — невязка ∂W/∂q = ${g4(s.residual)}: уточните приближение q* в таблице координат.`,
      ],
    });
    if (s.residual < 1e-8) {
      bl.push({
        k: 'eq',
        lines: [
          { c: ['M = [', s.M.map((row) => row.map(g4).join('  ')).join(';  '), ']   (по R₂)'] },
          { c: ['K = ∂²W/∂q² = [', s.K.map((row) => row.map(g4).join('  ')).join(';  '), ']'] },
          ...(r.routh.gyro ? [{ c: ['G = [', s.G.map((row) => row.map(g4).join('  ')).join(';  '), ']   (гироскопические)'] as Inline[] }] : []),
        ],
      });
      bl.push({ k: 'badge', tone: s.verdict === 'unstable' ? 'bad' : 'ok', text: s.verdict === 'unstable' ? 'неустойчиво' : 'устойчиво' });
      const items: Inline[][] = [['корни уравнения det(Mλ² + Gλ + K) = 0: ', s.roots.map(cx).join(';  ')]];
      if (s.freqs.length && s.verdict !== 'unstable')
        items.push(['частоты малых колебаний: ', b(s.freqs.map((w) => `ω = ${g4(w)} рад/с (T = ${g4((2 * Math.PI) / w)} с)`).join('; '))]);
      bl.push({ k: 'ul', items });
      ex(
        bl,
        'Теорема Рауса: если W в стационарном движении имеет минимум (K положительно определена), движение устойчиво по отношению к позиционным координатам и их скоростям. Гироскопические силы могут стабилизировать и при максимуме W — поэтому решаем уравнение det(Mλ² + Gλ + K) = 0.',
      );
    }
    steps.push({ title: r.cyclic.length ? 'Стационарное движение и его устойчивость' : 'Относительное равновесие и его устойчивость', blocks: bl });
  }
  const rows: { kind: 'main' | 'aux'; val: Inline[]; note: string }[] = [];
  r.cyclic.forEach((i, k) =>
    rows.push({ kind: 'main', val: [`${pn(names[i])} = ${symText(r.p[i])} = ${prettyName(r.nNames[k])}`], note: 'циклический интеграл' }),
  );
  if (r.energy) rows.push({ kind: 'main', val: [symText(r.energy) + ' = h'], note: 'интеграл энергии' });
  if (r.routh && r.cyclic.length) rows.push({ kind: 'main', val: ['R = ' + symText(r.routh.R)], note: 'функция Рауса' });
  if (r.routh) for (const e of r.routh.eqs) rows.push({ kind: 'aux', val: [symText(e.Ered) + ' = 0'], note: `уравнение по ${q(e.name)}` });
  if (r.ham) rows.push({ kind: 'main', val: ['H = ' + symText(r.ham.H)], note: 'функция Гамильтона' });
  if (r.steady && r.steady.residual < 1e-8) {
    rows.push({
      kind: 'main',
      val: [r.steady.verdict === 'unstable' ? 'неустойчиво' : 'устойчиво'],
      note: r.cyclic.length ? 'стационарное движение' : 'равновесие',
    });
    if (r.steady.freqs.length && r.steady.verdict !== 'unstable')
      rows.push({ kind: 'aux', val: [`ω = ${g4(r.steady.freqs[0])} рад/с`], note: `период малых колебаний ${g4((2 * Math.PI) / r.steady.freqs[0])} с` });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
const negS = (s: Sym): Sym => s.map((t) => ({ c: -t.c, f: t.f }));

/* ───────────── Устойчивость по первому приближению ───────────── */

export function stabDoc(pr: StabProblem, r: StabSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames([]);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const polyText = (cs: Sym[]) =>
    cs
      .map((c, i) => {
        if (!c.length) return '';
        const p = cs.length - 1 - i;
        const s = symText(c);
        const wrap = c.length > 1 ? `(${s})` : s === '1' && p ? '' : s === '−1' && p ? '−' : s;
        return `${wrap}${p ? (wrap && wrap !== '−' ? '·' : '') + 'λ' + (p > 1 ? '⁰¹²³⁴⁵⁶⁷⁸⁹'[p] : '') : ''}`;
      })
      .filter(Boolean)
      .join(' + ')
      .replace(/\+ −/g, '− ');
  {
    const bl: Block[] = [];
    if (pr.form === 'first') {
      bl.push({
        k: 'p',
        c: [
          'Уравнения возмущённого движения ẋ = A·x, A = [',
          pr.A.map((r0) => r0.join('  ')).join(';  '),
          ']. Ищем решение x = C·e^(λt): ',
          b('det(λI − A) = 0'),
          '.',
        ],
      });
    } else if (pr.form === 'second') {
      bl.push({ k: 'p', c: ['Уравнения M·q̈ + B·q̇ + C·q = 0; q = C·e^(λt): ', b('det(Mλ² + Bλ + C) = 0'), '.'] });
      bl.push({
        k: 'eq',
        lines: [
          { c: ['M = [', pr.M.map((r0) => r0.join('  ')).join(';  '), ']'] },
          { c: ['B = [', pr.B.map((r0) => r0.join('  ')).join(';  '), ']'] },
          { c: ['C = [', pr.C.map((r0) => r0.join('  ')).join(';  '), ']'] },
        ],
      });
    } else bl.push({ k: 'p', c: ['Характеристическое уравнение задано коэффициентами.'] });
    bl.push({ k: 'eq', lines: [{ c: [b(polyText(r.coefSym) + ' = 0')] }] });
    if (r.zeroRoots)
      bl.push({
        k: 'p',
        c: [
          `Свободн${r.zeroRoots > 1 ? 'ые члены' : 'ый член'} тождественно равн${r.zeroRoots > 1 ? 'ы' : 'о'} нулю — ${r.zeroRoots > 1 ? r.zeroRoots + '-кратный' : ''} нулевой корень λ = 0; дальше исследуем `,
          b(polyText(r.red) + ' = 0'),
          '.',
        ],
      });
    ex(
      bl,
      'Первое приближение (Ляпунов): если все корни имеют отрицательные вещественные части — невозмущённое движение асимптотически устойчиво; если хоть один корень с положительной вещественной частью — неустойчиво; корни на мнимой оси — критический случай.',
    );
    steps.push({ title: 'Характеристическое уравнение', blocks: bl });
  }
  {
    const bl: Block[] = [];
    const m = r.red.length - 1;
    if (m < 1) bl.push({ k: 'p', c: ['Остался только нулевой корень.'] });
    else {
      bl.push({
        k: 'p',
        c: ['Критерий Гурвица (a₀ > 0): все коэффициенты положительны и главные миноры Δₖ матрицы Гурвица положительны (Δₘ = aₘΔₘ₋₁ — по знаку aₘ).'],
      });
      const items: Inline[][] = r.conds.map((c) => {
        const lab = c.k < 0 ? `a${sub(String(c.idx))}` : `Δ${sub(String(c.k))}`;
        const red = c.factor.f.length > 0 || Math.abs(c.factor.c) !== 1;
        const restC = c.rest.length === 1 && !c.rest[0].f.length;
        const cond = !c.D.length
          ? `${lab} = 0`
          : restC
            ? `${lab} = ${symText(c.D)} > 0`
            : `${lab} = ${symText(c.D)}${red ? `;  сокращаем на ${termText(c.factor, true)} > 0:  ${symText(c.rest)} > 0` : ' > 0'}`;
        const ok = c.value > 1e-12 * Math.max(1, Math.abs(c.value));
        return [cond, ' — ', b(!c.D.length ? 'не выполнено' : ok ? `выполнено (${g4(c.value)})` : `не выполнено (${g4(c.value)})`)];
      });
      bl.push({ k: 'ul', items });
      if (r.conds.some((c) => !c.D.length))
        bl.push({
          k: 'p',
          c: [
            'Нулевые коэффициенты: асимптотической устойчивости нет. Если нет сил сопротивления (в уравнении только чётные степени λ), устойчивость возможна лишь при чисто мнимых простых корнях — смотрим корни.',
          ],
        });
      ex(
        bl,
        'Условия в буквах сокращены на общий множитель, положительный при заданных параметрах. Число в скобках — значение левой части при заданных параметрах.',
      );
    }
    steps.push({ title: 'Условия Гурвица', blocks: bl });
  }
  {
    const bl: Block[] = [
      { k: 'p', c: ['Корни при заданных значениях параметров:'] },
      { k: 'ul', items: r.roots.map((x, i) => [`λ${sub(String(i + 1))} = `, b(cx(x))]) },
    ];
    if (r.imag.length) {
      const items: Inline[][] = r.imag.map((g) => [
        `λ = ${cx(g.root)}: кратность ${g.mult}`,
        g.geo != null ? `, собственных векторов ${g.geo}` : '',
        g.geo != null && g.geo < g.mult ? ' — жорданова клетка: решение содержит t·e^(λt), отклонения растут' : '',
      ]);
      bl.push({ k: 'p', c: ['Корни на мнимой оси:'] }, { k: 'ul', items });
    }
    bl.push({ k: 'badge', tone: r.verdict === 'asym' ? 'ok' : r.verdict === 'linear' ? 'warn' : 'bad', text: VERDICT[r.verdict] });
    const why: Record<StabVerdict, string> = {
      asym: 'Все корни в левой полуплоскости — невозмущённое движение асимптотически устойчиво (и для нелинейной системы по первому приближению).',
      unstable:
        r.maxRe > 1e-7
          ? `Есть корень с положительной вещественной частью (${g4(r.maxRe)}) — движение неустойчиво.`
          : 'Кратному корню на мнимой оси не хватает собственных векторов — линейная система неустойчива.',
      linear:
        'Корней в правой полуплоскости нет, корни на мнимой оси простые (или у кратных столько собственных векторов, какова кратность) — линейная система устойчива, но не асимптотически. Для нелинейной системы это критический случай: первое приближение ответа не даёт.',
      critical: 'Кратные корни на мнимой оси, матрица системы неизвестна — нужен дальнейший анализ.',
    };
    bl.push({ k: 'p', c: [why[r.verdict]] });
    steps.push({ title: 'Корни и вывод', blocks: bl });
  }
  if (r.scan) {
    const s = r.scan;
    const bl: Block[] = [
      { k: 'p', c: [`Перебор параметра ${s.param} от ${g4(s.from)} до ${g4(s.to)} (с уточнением границ делением пополам):`] },
      {
        k: 'ul',
        items: s.stable.length ? s.stable.map(([lo, hi]) => [`устойчиво при `, b(`${g4(lo)} < ${s.param} < ${g4(hi)}`)]) : [['на всём отрезке неустойчиво']],
      },
    ];
    if (s.bounds.length) bl.push({ k: 'p', c: ['Границы устойчивости: ', b(s.bounds.map((x) => `${s.param} = ${g4(x)}`).join('; ')), '.'] });
    steps.push({ title: `Область устойчивости по ${s.param}`, blocks: bl });
  }
  const rows: { kind: 'main' | 'aux'; val: Inline[]; note: string }[] = [{ kind: 'main', val: [VERDICT[r.verdict]], note: 'при заданных параметрах' }];
  for (const c of r.conds)
    if (c.k > 0 && c.rest.length && !(c.rest.length === 1 && !c.rest[0].f.length))
      rows.push({ kind: 'aux', val: [symText(c.rest) + ' > 0'], note: `условие Гурвица Δ${sub(String(c.k))}` });
  if (r.scan?.bounds.length)
    rows.push({ kind: 'aux', val: [r.scan.bounds.map((x) => `${r.scan!.param} = ${g4(x)}`).join('; ')], note: 'граница устойчивости' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ───────────── Нелинейные колебания ───────────── */

const KIND: Record<PointKind, string> = {
  center: 'центр (по линейному приближению; нелинейные члены могут сделать фокус)',
  saddle: 'седло — неустойчиво',
  'focus-s': 'устойчивый фокус',
  'focus-u': 'неустойчивый фокус',
  'node-s': 'устойчивый узел',
  'node-u': 'неустойчивый узел',
  degenerate: 'вырожденная точка (∂f/∂x = 0) — линейного приближения недостаточно',
};

export function nonlinDoc(pr: NonlinProblem, r: NonlinSolution, opts: { explain?: boolean } = {}): Doc {
  setCoordNames(r.ctx.coords);
  const ex = exOf(opts);
  const steps: Step[] = [];
  const x = prettyName(r.ctx.coords[0]);
  const xd = varName(x, 1),
    xdd = varName(x, 2);
  {
    const bl: Block[] = [{ k: 'eq', lines: [{ c: [b(`${xdd} = ${symText(r.f)}`)] }] }];
    bl.push({
      k: 'p',
      c: [
        r.conservative
          ? `Правая часть не зависит от ${xd} — система консервативна: интеграл энергии ${xd}²/2 + V(${x}) = const, V′ = −f; фазовые траектории замкнуты вокруг минимумов V.`
          : `Правая часть зависит от ${xd} — есть силы, зависящие от скорости (сопротивление или «отрицательное сопротивление»), энергия не сохраняется.`,
      ],
    });
    steps.push({ title: 'Уравнение движения', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (!r.singular.length)
      bl.push({
        k: 'p',
        c: [
          `Особых точек (${xd} = 0, f(${x}, 0) = 0) на рассмотренном отрезке нет${r.k2 > 0 ? ' (правая часть разрывна в нуле — положение равновесия x = 0 у разрывной характеристики)' : ''}.`,
        ],
      });
    else
      bl.push(
        {
          k: 'p',
          c: [
            `Особые точки фазовой плоскости (${x}, ${xd}): ${xd} = 0, f(${x}, 0) = 0. Тип — по линеаризации δ${xdd} = f′ₓ·δ${x} + f′ᵥ·δ${xd}, λ² − f′ᵥλ − f′ₓ = 0:`,
          ],
        },
        { k: 'ul', items: r.singular.map((s) => [`${x} = ${g4(s.x)}: f′ₓ = ${g4(s.fx)}, f′ᵥ = ${g4(s.fv)} — `, b(KIND[s.kind])]) },
      );
    if (r.measured)
      bl.push({
        k: 'p',
        c: [
          `Движение из ${x}₀ = ${g4(pr.x0)}, ${xd}₀ = ${g4(pr.v0)}: на последнем полном колебании период `,
          b(`T = ${g4(r.measured.T)} с`),
          `, размах (амплитуда) ${g4(r.measured.amp)}, амплитуда первой гармоники a₁ = ${g4(r.measured.a1)}.`,
          r.measured.peaks.length > 2
            ? ` Последовательные максимумы: ${r.measured.peaks.slice(0, 6).map(g4).join('; ')}${r.measured.peaks.length > 6 ? '; …' : ''}.`
            : '',
        ],
      });
    ex(
      bl,
      'Фазовые траектории построены численным интегрированием (Рунге — Кутта) из заданного начального состояния и дополнительных начальных отклонений без начальной скорости.',
    );
    steps.push({ title: 'Фазовая плоскость', blocks: bl });
  }
  {
    const bl: Block[] = [];
    if (!r.Phi || !(r.k2 > 0))
      bl.push({
        k: 'p',
        c: [
          r.k2Sym
            ? `Линейная часть k² = ${g4(r.k2)} ≤ 0 — колебания существенно нелинейные, метод усреднения около гармонических колебаний неприменим.`
            : 'Линейную часть не удалось выделить (правая часть разрывна в нуле) — задайте k² явно.',
        ],
      });
    else {
      bl.push({
        k: 'p',
        c: [
          'Выделяем линейную часть: ',
          b(`${xdd} + k²${x} = Φ(${x}, ${xd})`),
          `, k² = ${r.k2Sym ? symText(r.k2Sym) + ' = ' : ''}${g4(r.k2)}, Φ = ${symText(r.Phi)}.`,
        ],
      });
      bl.push({
        k: 'p',
        c: [`Ищем решение x = a cos ψ, ${xd} = −ak sin ψ с медленно меняющимися a и ψ − kt; усредняя за период (метод Крылова — Боголюбова):`],
      });
      bl.push({
        k: 'eq',
        lines: [{ c: [b('ȧ = −(1/(2πk))·∫₀²ᵖ Φ(a cos ψ, −ak sin ψ)·sin ψ dψ')] }, { c: [b('ω²(a) = k² − (1/(πa))·∫₀²ᵖ Φ(a cos ψ, −ak sin ψ)·cos ψ dψ')] }],
      });
      if (r.cycles.length)
        bl.push(
          { k: 'p', c: ['Стационарные амплитуды (ȧ = 0, a > 0) — предельные циклы:'] },
          {
            k: 'ul',
            items: r.cycles.map((c) => [
              b(`a = ${g4(c.a)}`),
              ` — ${c.stable ? 'устойчивый (автоколебания)' : 'неустойчивый'} цикл, ω = ${g4(c.omega)} рад/с, T = ${g4((2 * Math.PI) / c.omega)} с`,
            ]),
          },
        );
      else
        bl.push({
          k: 'p',
          c: [
            `На отрезке 0 < a ≤ ${g4(pr.aMax)} стационарных амплитуд нет: ${r.avg && r.avg.da[0] < 0 ? 'амплитуда убывает — колебания затухают' : 'амплитуда растёт'}.`,
          ],
        });
      ex(
        bl,
        'Цикл устойчив, если ȧ меняет знак с «+» на «−» при росте a: меньшие амплитуды растут, большие убывают. ω(a) — частота гармонической линеаризации: нелинейная сила заменена эквивалентной упругой с той же работой на первой гармонике.',
      );
    }
    steps.push({ title: 'Метод усреднения', blocks: bl });
  }
  if (r.periods.length) {
    const bl: Block[] = [
      { k: 'p', c: ['Период по амплитуде (движение из x = a без начальной скорости, численно):'] },
      { k: 'ul', items: r.periods.map((p) => [`a = ${g4(p.a)}: T = `, b(`${g4(p.T)} с`)]) },
    ];
    steps.push({ title: 'Период и амплитуда', blocks: bl });
  }
  const rows: { kind: 'main' | 'aux'; val: Inline[]; note: string }[] = [];
  for (const c of r.cycles)
    rows.push({
      kind: 'main',
      val: [`a = ${g4(c.a)}`],
      note: `${c.stable ? 'устойчивый' : 'неустойчивый'} предельный цикл, T = ${g4((2 * Math.PI) / c.omega)} с`,
    });
  if (r.measured) rows.push({ kind: 'aux', val: [`T = ${g4(r.measured.T)} с`], note: `период по движению, размах ${g4(r.measured.amp)}` });
  for (const s of r.singular) rows.push({ kind: 'aux', val: [`${x} = ${g4(s.x)}`], note: KIND[s.kind] });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
