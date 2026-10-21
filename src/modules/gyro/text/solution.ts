/** Решение: приближённая теория гироскопов — гироскопический момент, давления на опоры, прецессия, равновесие оси. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { unitsOf, type GyroProblem, type GyroResult } from '../model/gyro';

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** Число для текста: 4 знака после запятой, очень малые и очень большие — с порядком (3,568·10⁻⁵). */
export const f = (x: number) => {
  const a = Math.abs(x);
  if (x === 0 || (a >= 1e-3 && a < 1e7)) return fmt(x, 4);
  const e = Math.floor(Math.log10(a));
  const m = x / 10 ** e;
  return `${fmt(m, 3)}·10${String(e).replace(/./g, (c) => SUP[c] ?? c)}`;
};
const bad = (errors: string[]): Doc => ({
  steps: [
    {
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: errors.map((x) => [x]) },
      ],
    },
  ],
});
const exf =
  (opts: { explain?: boolean }) =>
  (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };

export function gyroDoc(pr: GyroProblem, r: GyroResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const U = unitsOf(pr.units);
  const steps: Step[] = [];
  // 1. Ротор.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (pr.jMode === 'H') lines.push({ c: ['кинетический момент задан: H = ', b(`${f(r.H)} ${U.H}`)] });
    else {
      if (pr.jMode !== 'J')
        lines.push({ c: [pr.units === 'tech' ? `масса m = P/g = ${f(pr.m)}/${f(pr.g)} = ${f(r.mass)} ${U.m}` : `масса m = ${f(r.mass)} ${U.m}`] });
      const jf =
        pr.jMode === 'J'
          ? `J = ${f(r.J)}`
          : pr.jMode === 'rho'
            ? `J = mρ² = ${f(r.mass)}·${f(pr.rho)}² = ${f(r.J)}`
            : pr.jMode === 'disc'
              ? `J = mR²/2 (диск) = ${f(r.mass)}·${f(pr.R)}²/2 = ${f(r.J)}`
              : `J = mR² (масса по ободу) = ${f(r.mass)}·${f(pr.R)}² = ${f(r.J)}`;
      lines.push({ c: [jf, ` ${U.J}`] });
      const sp =
        pr.spin === 'rate'
          ? `ω = ${f(r.om)} с⁻¹`
          : pr.spin === 'rpm'
            ? `ω = πn/30 = π·${f(pr.om)}/30 = ${f(r.om)} с⁻¹`
            : pr.spin === 'roll'
              ? `колесо катится: ω = v/a = ${f(pr.v)}/${f(pr.a)} = ${f(r.om)} с⁻¹`
              : `бегун катится по основанию: ω = ω₁·d/r = ${f(r.w1)}·${f(pr.d)}/${f(pr.rc)} = ${f(r.om)} с⁻¹`;
      lines.push({ c: [sp] });
      lines.push({ c: ['H = Jω = ', b(`${f(r.H)} ${U.H}`)] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Приближённая теория: ротор вращается вокруг оси симметрии очень быстро, поэтому его кинетический момент считается равным Jω и направленным по оси собственного вращения; вкладом медленного поворота оси пренебрегаем.',
    );
    steps.push({ title: 'Ротор и кинетический момент', blocks: bl });
  }
  if (pr.mode === 'forced' || (pr.mode === 'balance' && pr.bal === 'spring')) {
    const pc =
      pr.prec === 'rate'
        ? `ω₁ = ${f(r.w1)} с⁻¹`
        : pr.prec === 'rpm'
          ? `ω₁ = πn/30 = π·${f(pr.w1)}/30 = ${f(r.w1)} с⁻¹`
          : pr.prec === 'degs'
            ? `ω₁ = ${f(pr.w1)}°/с = ${f(r.w1)} с⁻¹`
            : pr.prec === 'turn'
              ? `поворот по закруглению: ω₁ = v/R = ${f(pr.vp)}/${f(pr.Rp)} = ${f(r.w1)} с⁻¹`
              : `качка θ = θ₀ sin(2πt/T): наибольшая ω₁ = 2πθ₀/T = 2π·${f((pr.amp * Math.PI) / 180)}/${f(pr.T)} = ${f(r.w1)} с⁻¹`;
    steps.push({ title: pr.mode === 'forced' ? 'Вынужденная прецессия' : 'Вращение основания', blocks: [{ k: 'eq', lines: [{ c: [pc] }] }] });
  }
  if (pr.mode === 'forced') {
    {
      const lines: { num?: boolean; c: Inline[] }[] = [
        { c: [v('M'), sub('г'), ` = Jω·ω₁·sin β = ${f(r.J)}·${f(r.om)}·${f(r.w1)}·sin ${f(pr.beta)}° = `, b(`${f(r.M)} ${U.M}`)] },
      ];
      const bl: Block[] = [{ k: 'eq', lines }];
      ex(
        bl,
        'Чтобы поворачивать ось с угловой скоростью ω₁, к ротору нужно приложить момент dH/dt = ω₁ × H. Ротор действует на опоры с равным и противоположным гироскопическим моментом M',
        sub('г'),
        ' = H × ω₁. Правило Жуковского: гироскопический момент стремится кратчайшим путём совместить ось собственного вращения с осью прецессии.',
      );
      steps.push({ title: 'Гироскопический момент', blocks: bl });
    }
    {
      const lines: { num?: boolean; c: Inline[] }[] = [];
      if (pr.sup === 'roller') {
        lines.push({
          c: [
            'ось бегуна закреплена шарниром на оси прецессии; момент передаётся давлением на основание с плечом d: ΔN = M',
            sub('г'),
            `/d = ${f(r.M)}/${f(pr.d)} = `,
            b(`${f(r.dN)} ${U.F}`),
          ],
        });
        if (pr.spin === 'runner')
          lines.push({ num: true, c: [`= Jω₁²·sin β/r = ${f(r.J)}·${f(r.w1)}²·${f(Math.sin((pr.beta * Math.PI) / 180))}/${f(pr.rc)} — от d не зависит`] });
        if (r.NA != null) lines.push({ c: ['давление на основание N = P + ΔN = ', `${f(pr.P)} + ${f(r.dN)} = `, b(`${f(r.NA)} ${U.F}`)] });
      } else {
        lines.push({
          c: [
            `опоры на оси ${pr.sup === 'rotor' ? 'ротора' : 'прецессии'}, l = ${f(pr.l)} м: ΔN = M`,
            sub('г'),
            `/l = ${f(r.M)}/${f(pr.l)} = `,
            b(`${f(r.dN)} ${U.F}`),
          ],
        });
        lines.push({ num: true, c: ['пара сил: на одной опоре давление увеличивается на ΔN, на другой — уменьшается'] });
        if (pr.stat === 'split' && r.NA != null && r.NB != null) {
          lines.push({ c: [`статические давления: N_A = P(l − c)/l = ${f(r.Nst!)}, N_B = P·c/l = ${f(pr.P - r.Nst!)} ${U.F}`] });
          lines.push({
            c: [
              `N_A = ${f(r.Nst!)} ${r.sA > 0 ? '+' : '−'} ${f(r.dN)} = `,
              b(`${f(r.NA)} ${U.F}`),
              `; N_B = ${f(pr.P - r.Nst!)} ${r.sA > 0 ? '−' : '+'} ${f(r.dN)} = `,
              b(`${f(r.NB)} ${U.F}`),
            ],
          });
        }
        if (pr.stat === 'lever' && r.Nst != null)
          lines.push({
            c: [
              `статические боковые давления от веса с плечом e: P·e/l = ${f(pr.P)}·${f(pr.e)}/${f(pr.l)} = ${f(r.Nst)} ${U.F}; отношение ΔN/N`,
              sub('ст'),
              ' = ',
              b(f(r.ratio ?? 0)),
            ],
          });
      }
      const bl: Block[] = [{ k: 'eq', lines }];
      ex(
        bl,
        pr.sup === 'roller'
          ? 'Ось бегуна стремится повернуться к оси прецессии, и бегун сильнее прижимается к основанию — давление растёт.'
          : 'Гироскопический момент уравновешивается парой сил реакций опор, перпендикулярных их линии; знак добавки на опоре A здесь — по заданным направлениям ω (от A к B) и ω₁.',
      );
      steps.push({ title: 'Давления на опоры', blocks: bl });
    }
  } else if (pr.mode === 'free') {
    const src =
      pr.src === 'weight'
        ? `вес с плечом l: M₀ = P·l = ${f(pr.units === 'tech' ? pr.m : pr.m * pr.g)}·${f(pr.l0)}`
        : pr.src === 'force'
          ? `сила F с плечом h: M₀ = F·h = ${f(pr.F)}·${f(pr.h)}`
          : 'момент M₀';
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [`${src} = ${f(r.M0)} ${U.M} (при наклоне оси на угол θ момент M₀ sin θ)`] },
      { c: ['ω', sub('п'), ' = M₀ sin θ/(H sin θ) = M₀/H = ', `${f(r.M0)}/${f(r.H)} = `, b(`${f(r.wp)} с⁻¹`)] },
      { c: ['период полного оборота оси T = 2π/ω', sub('п'), ' = ', b(`${f(r.Tp)} с`)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Теорема Резаля: скорость конца вектора H равна моменту внешних сил. Поэтому ось гироскопа под действием момента не падает, а поворачивается (прецессирует) в сторону вектора момента; угловая скорость прецессии от угла наклона не зависит. Волчок, опирающийся ниже центра тяжести, прецессирует в сторону собственного вращения.',
    );
    steps.push({ title: 'Прецессия под действием момента', blocks: bl });
  } else if (pr.bal === 'spring') {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [v('M'), sub('г'), ` = Jω·ω₁ = ${f(r.M)} ${U.M}`] },
      { c: [`момент пружин n·c·a²·α = ${f(pr.ns)}·${f(pr.cs)}·${f(pr.as)}²·α`] },
      { c: [`α = Jωω₁/(n c a²) = ${f((r.alpha * Math.PI) / 180)} рад = `, b(`${f(r.alpha)}°`)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Вращение основания заставляет ось гироскопа прецессировать; рамка поворачивается, пока момент пружин не уравновесит гироскопический момент. Угол пропорционален угловой скорости основания — так работает гиротахометр (угол мал, cos α ≈ 1).',
    );
    steps.push({ title: 'Равновесие рамки', blocks: bl });
  } else {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['Jω·Ω', sub('о'), `·sin(γ − α) = H`, sub('ст'), '·sin α, γ = ', `${f(pr.gam)}°`] },
      { c: [`Jω·Ω_о = ${f(r.H)}·${f(pr.Ob)} = ${f(r.M)} ${U.M}; H_ст = ${f(pr.Hst)} ${U.M}`] },
      { c: ['tg α = Jω·Ω', sub('о'), ' sin γ/(H', sub('ст'), ' + Jω·Ω', sub('о'), ' cos γ); α = ', b(`${f(r.alpha)}°`)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Основание (Земля) вращается с угловой скоростью Ω',
      sub('о'),
      ' вокруг оси под углом γ к вертикали в плоскости поворота рамки (γ = 90° − φ). Составляющая вращения поперёк оси ротора даёт гироскопический момент вокруг оси рамки; его уравновешивает момент веса H',
      sub('ст'),
      ' sin α.',
    );
    steps.push({ title: 'Равновесие маятникового гироскопа', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  if (pr.mode === 'forced') {
    rows.push({ kind: 'main', val: [v('M'), sub('г'), ` = ${f(r.M)} ${U.M}`], note: 'гироскопический момент' });
    rows.push({
      kind: 'main',
      val: [`ΔN = ${f(r.dN)} ${U.F}`],
      note: pr.sup === 'roller' ? 'добавочное давление на основание' : 'добавочные давления на опоры (±)',
    });
    if (r.NA != null && pr.sup === 'roller') rows.push({ kind: 'total', val: [`N = ${f(r.NA)} ${U.F}`], note: 'давление на основание' });
    if (r.NA != null && r.NB != null) rows.push({ kind: 'total', val: [`N_A = ${f(r.NA)}; N_B = ${f(r.NB)} ${U.F}`], note: 'давления на опоры' });
    if (r.ratio != null) rows.push({ kind: 'total', val: [`ΔN/N_ст = ${f(r.ratio)}`], note: 'отношение к статическим' });
  } else if (pr.mode === 'free') {
    rows.push({ kind: 'main', val: [`ω_п = ${f(r.wp)} с⁻¹`], note: 'угловая скорость прецессии' });
    rows.push({ kind: 'aux', val: [`T = ${f(r.Tp)} с`], note: 'период полного оборота оси' });
  } else rows.push({ kind: 'main', val: [`α = ${f(r.alpha)}°`], note: 'угол отклонения оси' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
