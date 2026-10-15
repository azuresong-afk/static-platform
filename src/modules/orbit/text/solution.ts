/** Решение: небесное тело (μ, космические скорости), орбита в поле тяготения, прямолинейное движение по линии центров. */
import { b, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import {
  BODIES,
  EARTH,
  LM,
  type Elements,
  type OrbitProblem,
  type OrbitResult,
  type PlanetProblem,
  type PlanetResult,
  type RadialProblem,
  type RadialResult,
  type Unit,
} from '../model/orbit';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => (n < 0 ? '⁻' : '') + String(Math.abs(n)).replace(/\d/g, (d) => SUP[+d]);
const dec = (s: string) => s.replace('.', ',').replace('-', '−');
/** Число с d значащими цифрами; очень большие и малые — с множителем 10ⁿ. */
export function num(x: number, d = 5): string {
  if (x === Infinity) return '∞';
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e7) return dec(String(+x.toPrecision(d)));
  let ex = Math.floor(Math.log10(a));
  let m = +(x / 10 ** ex).toPrecision(d);
  if (Math.abs(m) >= 10) {
    m /= 10;
    ex += 1;
  }
  return `${dec(String(+m.toPrecision(d)))}·10${sup(ex)}`;
}
/** Число в основании степени: в скобках, если записано с множителем 10ⁿ или отрицательное. */
const pw = (x: number, d = 5) => {
  const t = num(x, d);
  return /·|−/.test(t) ? `(${t})` : t;
};
/** Время: секунды и, если много, минуты, часы или сутки. */
export function dur(s: number): string {
  const base = `${num(s)} с`;
  if (!Number.isFinite(s) || s < 120) return base;
  if (s < 7200) return `${base} = ${num(s / 60, 4)} мин`;
  if (s < 2 * 86400) return `${base} = ${num(s / 3600, 4)} ч`;
  return `${base} = ${num(s / 86400, 4)} сут`;
}
export const LEN: Record<Unit, string> = { km: 'км', m: 'м', cm: 'см' };
/** Сила m·μ/r²: масса в кг (в граммах для сантиметров). */
export const FORCE: Record<Unit, string> = { km: 'кН', m: 'Н', cm: 'дин' };
const rad = (a: number) => (a * Math.PI) / 180;
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
type Line = { num?: boolean; c: Inline[] };

/* ---------- небесное тело ---------- */

export function planetDoc(pr: PlanetProblem, r: PlanetResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  {
    const lines: Line[] = [];
    if (pr.body !== 'custom') {
      const k = pr.body === 'ratio' ? { mass: pr.mRatio, radius: pr.rRatio } : BODIES[pr.body];
      if (pr.body !== 'earth') {
        lines.push({ c: [`M : M_З = ${num(k.mass)}, R : R_З = ${num(k.radius)} (Земля: R_З = ${num(EARTH.R)} км, g_З = ${num(EARTH.g)} м/с²)`] });
        lines.push({ num: true, c: [v('R'), ` = ${num(EARTH.R)}·${num(k.radius)} = ${num(r.R)} км`] });
        lines.push({ num: true, c: [v('g'), ` = g_З·(M : M_З)/(R : R_З)² = ${num(EARTH.g)}·${num(k.mass)}/${pw(k.radius)}² = `, b(`${num(r.g, 4)} м/с²`)] });
      } else lines.push({ c: [`R = ${num(r.R)} км, g = ${num(r.g)} м/с²`] });
    } else lines.push({ c: [`R = ${num(r.R)} км, g = ${num(r.g)} м/с²`] });
    lines.push({ c: ['μ = fM = gR²'] });
    lines.push({ num: true, c: [`μ = ${num(r.g / 1000)}·${pw(r.R)}² = `, b(`${num(r.mu, 4)} км³/с²`), ' (g переведено в км/с²)'] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'На поверхности сила тяготения равна весу: f·Mm/R² = mg, отсюда гравитационный параметр μ = fM = gR². Для тела, заданного отношениями к Земле, μ = μ_З·(M : M_З), g = g_З·(M : M_З)/(R : R_З)².',
    );
    steps.push({ title: 'Гравитационный параметр', blocks: bl });
  }
  {
    const lines: Line[] = [
      { c: ['первая космическая (круговая у поверхности): v₁ = √(μ/R) = √(gR)'] },
      { num: true, c: [`v₁ = √(${num(r.mu)}/${num(r.R)}) = `, b(`${num(r.v1, 4)} км/с`), `; T = 2πR/v₁ = ${dur(r.T1)}`] },
      { c: ['вторая космическая (параболическая): v₂ = √2·v₁ = √(2μ/R)'] },
      { num: true, c: ['v₂ = ', b(`${num(r.v2, 4)} км/с`)] },
    ];
    if (pr.H > 0) {
      lines.push({ c: [`на высоте H = ${num(pr.H)} км: r = R + H = ${num(r.R + pr.H)} км`] });
      lines.push({ num: true, c: [`круговая v = √(μ/r) = ${num(r.vc, 4)} км/с, период T = 2πr/v = ${dur(r.Tc)}; параболическая √2·v = ${num(r.vp, 4)} км/с`] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'По кругу радиуса r точка движется равномерно, когда сила тяготения mμ/r² создаёт центростремительное ускорение v²/r: v = √(μ/r). Чтобы уйти на бесконечность, нужна энергия v²/2 − μ/r ≥ 0, то есть v ≥ √(2μ/r).',
    );
    steps.push({ title: 'Космические скорости', blocks: bl });
  }
  if (r.rs != null && r.Hs != null) {
    const lines: Line[] = [
      { c: ['период обращения равен периоду вращения тела: 2πr^(3/2)/√μ = T → r = ∛(μT²/(4π²))'] },
      { num: true, c: [`r = ∛(${num(r.mu)}·${pw(pr.Trot)}²/(4π²)) = ${num(r.rs)} км; H = r − R = `, b(`${num(r.Hs)} км`)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Стационарный спутник висит над одной точкой экватора: он обращается в плоскости экватора с угловой скоростью вращения тела. Для Земли берут звёздные сутки — 86 164 с.',
    );
    steps.push({ title: 'Стационарная орбита', blocks: bl });
  }
  if (pr.G > 0) {
    const lines: Line[] = [
      { c: ['работа против тяготения от R до R + H: G·R²·(1/R − 1/(R + H)); кинетическая энергия на высоте: (G/g)·v²/2'] },
      { c: ['круговая скорость: A₁ = G·R·(R + 2H)/(2(R + H)); параболическая: A₂ = G·R'] },
      {
        num: true,
        c: [
          `A₁ = ${num(pr.G)}·${num(r.R)}·${num(r.R + 2 * pr.H)}/(2·${num(r.R + pr.H)}) = `,
          b(num(r.A1)),
          ` ; A₂ = ${num(pr.G)}·${num(r.R)} = `,
          b(num(r.A2)),
          ' (единица веса × км)',
        ],
      },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Полезная работа двигателя равна приросту механической энергии аппарата (сопротивление атмосферы не учитываем). Вес G — сила тяжести у поверхности: G = mμ/R².',
    );
    steps.push({ title: 'Работа двигателя', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`μ = ${num(r.mu, 4)} км³/с²`], note: `${r.name}: g = ${num(r.g, 4)} м/с², R = ${num(r.R)} км` },
    { kind: 'main', val: [`v₁ = ${num(r.v1, 4)} км/с`], note: `первая космическая; период ${dur(r.T1)}` },
    { kind: 'main', val: [`v₂ = ${num(r.v2, 4)} км/с`], note: 'вторая космическая' },
  ];
  if (pr.H > 0) rows.push({ kind: 'aux', val: [`v = ${num(r.vc, 4)} км/с`], note: `круговая на высоте ${num(pr.H)} км; период ${dur(r.Tc)}` });
  if (r.Hs != null) rows.push({ kind: 'main', val: [`H = ${num(r.Hs)} км`], note: `стационарная орбита, r = ${num(r.rs!)} км` });
  if (pr.G > 0) {
    rows.push({ kind: 'main', val: [`A₁ = ${num(r.A1)}`], note: 'работа: подъём на H и круговая скорость (вес × км)' });
    rows.push({ kind: 'main', val: [`A₂ = ${num(r.A2)}`], note: 'работа: параболическая скорость (вес × км)' });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- орбита ---------- */

const TYPE: Record<Elements['type'], string> = {
  circle: 'окружность (e = 0)',
  ellipse: 'эллипс (0 < e < 1)',
  parabola: 'парабола (e = 1)',
  hyperbola: 'гипербола (e > 1)',
  line: 'прямая (c = 0): точка движется по радиусу',
};

function elemLines(o: Elements, mu: number, L: string, R: number): Line[] {
  const lines: Line[] = [
    { c: ['интеграл площадей: c = r·v·cos θ'] },
    { num: true, c: [`c = ${num(o.r)}·${num(o.v)}·cos ${num(o.th, 6)}° = `, b(`${num(o.c)} ${L}²/с`)] },
    { c: ['интеграл энергии: h = v² − 2μ/r'] },
    { num: true, c: [`h = ${pw(o.v)}² − 2·${num(mu)}/${num(o.r)} = `, b(`${num(o.h)} ${L}²/с²`)] },
    { c: ['параметр p = c²/μ, эксцентриситет e = √(1 + c²h/μ²)'] },
    { num: true, c: [`p = `, b(`${num(o.p)} ${L}`), `; e = `, b(num(o.e))] },
  ];
  if (o.type !== 'circle' && o.type !== 'line') {
    lines.push({ c: ['начальная точка: e·cos ν = p/r₀ − 1, e·sin ν = p·v_r/c (ν — истинная аномалия)'] });
    lines.push({ num: true, c: [`ν = ${num(o.nu, 5)}° = ${num(rad(o.nu), 4)} рад; ε = φ₀ − ν = `, b(`${num(o.eps, 5)}°`), ' — направление на перицентр'] });
  }
  lines.push({ c: ['траектория: r = p/(1 + e·cos(φ − ε)) — ', b(TYPE[o.type])] });
  lines.push({ num: true, c: [`на r₀: круговая скорость ${num(o.vc)} ${L}/с, параболическая ${num(o.vpar)} ${L}/с; v₀ = ${num(o.v)} ${L}/с`] });
  if (o.type === 'line') return lines;
  lines.push({ c: ['перицентр r_п = p/(1 + e), скорость в нём v_п = c/r_п'] });
  lines.push({ num: true, c: [`r_п = `, b(`${num(o.rp)} ${L}`), R > 0 ? ` (высота ${num(o.rp - R)} ${L})` : '', `; v_п = ${num(o.vpe)} ${L}/с`] });
  if (o.ra != null && o.va != null && o.a != null && o.b != null && o.T != null) {
    lines.push({ c: ['апоцентр r_а = p/(1 − e), v_а = c/r_а; полуоси a = p/(1 − e²), b = a√(1 − e²); период T = 2π√(a³/μ)'] });
    lines.push({ num: true, c: [`r_а = `, b(`${num(o.ra)} ${L}`), R > 0 ? ` (высота ${num(o.ra - R)} ${L})` : '', `; v_а = ${num(o.va)} ${L}/с`] });
    lines.push({ num: true, c: [`a = ${num(o.a)} ${L}, b = ${num(o.b)} ${L}; T = `, b(dur(o.T))] });
  } else if (o.vinf != null) {
    lines.push({ c: ['уход на бесконечность: v∞ = √h'] });
    lines.push({ num: true, c: [`v∞ = `, b(`${num(o.vinf)} ${L}/с`), o.a != null ? `; действительная полуось a = p/(e² − 1) = ${num(o.a)} ${L}` : ''] });
  }
  return lines;
}

export function orbitDoc(pr: OrbitProblem, r: OrbitResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const L = LEN[pr.unit];
  const steps: Step[] = [];
  if (pr.force === 'formula') return formulaDoc(pr, r, opts);
  const o = r.orb!;
  {
    const lines: Line[] = [];
    if (pr.def === 'state' || pr.scale === 'mu') {
      if (pr.muMode === 'planet')
        lines.push({ c: [`μ = gR² = ${num(pr.g / LM[pr.unit])}·${pw(pr.R)}² = `, b(`${num(r.mu)} ${L}³/с²`), ` (g = ${num(pr.g)} м/с²)`] });
      else lines.push({ c: ['μ = ', b(`${num(r.mu)} ${L}³/с²`)] });
    }
    if (pr.def === 'elements') {
      const SH: Record<OrbitProblem['shape'], string> = {
        apsides: `перицентр ${num(pr.e1)} ${L}, апоцентр ${num(pr.e2)} ${L}: e = (r_а − r_п)/(r_а + r_п)`,
        ae: `a = ${num(pr.e1)} ${L}, e = ${num(pr.e2)}: r_п = a(1 − e)`,
        ab: `a = ${num(pr.e1)} ${L}, b = ${num(pr.e2)} ${L}: e = √(1 − b²/a²), r_п = a(1 − e)`,
        pe: `p = ${num(pr.e1)} ${L}, e = ${num(pr.e2)}: r_п = p/(1 + e)`,
      };
      lines.push({ c: ['орбита задана: ', SH[pr.shape]] });
      lines.push({ num: true, c: [`r_п = ${num(o.rp)} ${L}, e = ${num(o.e)}`] });
      if (pr.scale === 'T') lines.push({ c: [`период T = ${num(pr.T)} с: μ = 4π²a³/T² = `, b(`${num(r.mu)} ${L}³/с²`)] });
      if (pr.scale === 'vp') lines.push({ c: [`скорость в перицентре v_п = ${num(pr.vp)} ${L}/с: μ = v_п²·r_п/(1 + e) = `, b(`${num(r.mu)} ${L}³/с²`)] });
      lines.push({ c: [`начальная точка — перицентр: v₀ = √(μ(1 + e)/r_п) = ${num(o.v)} ${L}/с, θ₀ = 0, φ₀ = 0`] });
    } else
      lines.push({
        c: [
          `начальное состояние: r₀ = ${num(pr.r0)} ${L}, v₀ = ${num(pr.v0)} ${L}/с, угол с местным горизонтом θ₀ = ${num(pr.th0, 6)}°, полярный угол φ₀ = ${num(pr.ph0)}°`,
        ],
      });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Сила тяготения F = mμ/r² направлена к центру; μ = fM — гравитационный параметр центра. Угол θ отсчитывается от местного горизонта (перпендикуляра к радиусу) в сторону от центра.',
    );
    steps.push({ title: 'Данные орбиты', blocks: bl });
  }
  {
    const bl: Block[] = [{ k: 'eq', lines: elemLines(o, r.mu, L, pr.R) }];
    if (o.hit != null)
      bl.push({
        k: 'badge',
        tone: 'warn',
        text: `Перицентр ниже поверхности тела (R = ${num(pr.R)} ${L}): траектория пересекает её при |φ − ε| = ${num(o.hit, 4)}°.`,
      });
    for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
    ex(
      bl,
      'Центральная сила сохраняет момент количества движения (r²φ̇ = c) и энергию (v² − 2μ/r = h). Из этих двух интегралов следует уравнение конического сечения; знак h решает тип орбиты: h < 0 — эллипс, h = 0 — парабола, h > 0 — гипербола.',
    );
    steps.push({ title: 'Интегралы движения и траектория', blocks: bl });
  }
  if ((pr.m > 0 && r.Fp != null) || r.v1 != null) {
    const lines: Line[] = [];
    if (pr.m > 0 && r.Fp != null) {
      lines.push({ c: ['сила притяжения F = mμ/r² — наибольшая в перицентре, наименьшая в апоцентре'] });
      lines.push({
        num: true,
        c: [
          `F_п = ${num(pr.m)}·${num(r.mu)}/${pw(o.rp)}² = `,
          b(`${num(r.Fp)} ${FORCE[pr.unit]}`),
          r.Fa != null ? `; F_а = ${num(pr.m)}·${num(r.mu)}/${pw(o.ra!)}² = ` : '',
          r.Fa != null ? b(`${num(r.Fa)} ${FORCE[pr.unit]}`) : '',
        ],
      });
    }
    if (r.v1 != null) {
      const fin = r.after ?? o;
      lines.push({ c: [`скорость на расстоянии r₁ = ${num(pr.r1)} ${L}: v₁ = √(h + 2μ/r₁)`] });
      lines.push({ num: true, c: [`v₁ = √(${num(fin.h)} + 2·${num(r.mu)}/${num(pr.r1)}) = `, b(`${num(r.v1)} ${L}/с`)] });
    }
    steps.push({ title: 'Сила и скорость', blocks: [{ k: 'eq', lines }] });
  }
  if (pr.r1 > 0 && r.v1 == null)
    steps[steps.length - 1].blocks.push({ k: 'badge', tone: 'warn', text: `Расстояние r₁ = ${num(pr.r1)} ${L} на этой орбите не достигается.` });
  if (r.after && r.dv) {
    const a = r.after;
    const lines: Line[] = [];
    if (pr.man === 'target') {
      const what =
        pr.tgt === 'apo'
          ? `апоцентр r_а = ${num(pr.tgtVal)} ${L}`
          : pr.tgt === 'peri'
            ? `перицентр r_п = ${num(pr.tgtVal)} ${L}`
            : `скорость на бесконечности v∞ = ${num(pr.tgtVal)} ${L}/с`;
      lines.push({ c: [`нужен ${pr.tgtKind === 'tang' ? 'касательный (вдоль скорости)' : 'радиальный'} импульс u, после которого ${what}`] });
      lines.push({ c: ['u найден из условия на новую орбиту (наименьший по модулю корень)'] });
    }
    const u = pr.man === 'target' ? (pr.tgtKind === 'tang' ? r.dv.t : r.dv.r) : null;
    if (u != null)
      lines.push({ num: true, c: ['u = ', b(`${num(u)} ${L}/с`), u < 0 ? (pr.tgtKind === 'tang' ? ' (знак минус — торможение)' : ' (к центру)') : ''] });
    else lines.push({ num: true, c: [`импульс: вдоль скорости ${num(r.dv.t)} ${L}/с, по радиусу ${num(r.dv.r)} ${L}/с`] });
    lines.push({ c: [`после импульса: v = ${num(a.v)} ${L}/с, θ = ${num(a.th, 5)}°`] });
    const bl: Block[] = [
      { k: 'eq', lines },
      { k: 'eq', lines: elemLines(a, r.mu, L, pr.R).slice(1) },
    ];
    if (a.hit != null) bl.push({ k: 'badge', tone: 'warn', text: `Новая орбита пересекает поверхность тела (R = ${num(pr.R)} ${L}).` });
    ex(
      bl,
      'Импульс меняет скорость мгновенно, положение остаётся прежним. Радиальный импульс не меняет интеграла площадей c = r·v_t; касательный меняет и c, и энергию.',
    );
    steps.push({ title: 'Импульс скорости — новая орбита', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  const fin = r.after ?? o;
  rows.push({ kind: 'main', val: [`e = ${num(o.e)}`], note: `${TYPE[o.type]}; p = ${num(o.p)} ${L}, c = ${num(o.c)} ${L}²/с, h = ${num(o.h)} ${L}²/с²` });
  if (o.type !== 'line') {
    rows.push({
      kind: 'main',
      val: [`r_п = ${num(o.rp)} ${L}`],
      note: `перицентр${pr.R > 0 ? `, высота ${num(o.rp - pr.R)} ${L}` : ''}; v_п = ${num(o.vpe)} ${L}/с`,
    });
    if (o.ra != null)
      rows.push({
        kind: 'main',
        val: [`r_а = ${num(o.ra)} ${L}`],
        note: `апоцентр${pr.R > 0 ? `, высота ${num(o.ra - pr.R)} ${L}` : ''}; v_а = ${num(o.va!)} ${L}/с`,
      });
    if (o.T != null) rows.push({ kind: 'main', val: [`T = ${dur(o.T)}`], note: `период; a = ${num(o.a!)} ${L}` });
    if (o.vinf != null && o.type === 'hyperbola') rows.push({ kind: 'main', val: [`v∞ = ${num(o.vinf)} ${L}/с`], note: 'скорость на бесконечности' });
    if (o.type !== 'circle') rows.push({ kind: 'aux', val: [`ε = ${num(o.eps, 5)}°`], note: `направление на перицентр; ν₀ = ${num(rad(o.nu), 4)} рад` });
  }
  if (pr.m > 0 && r.Fp != null)
    rows.push({
      kind: 'main',
      val: [`F_max = ${num(r.Fp)} ${FORCE[pr.unit]}`],
      note: r.Fa != null ? `в перицентре; F_min = ${num(r.Fa)} ${FORCE[pr.unit]} — в апоцентре` : 'в перицентре',
    });
  if (r.v1 != null) rows.push({ kind: 'main', val: [`v₁ = ${num(r.v1)} ${L}/с`], note: `на расстоянии ${num(pr.r1)} ${L}` });
  if (r.after && r.dv) {
    const u = Math.hypot(r.dv.t, r.dv.r);
    if (pr.man === 'target')
      rows.push({
        kind: 'main',
        val: [`u = ${num(u)} ${L}/с`],
        note: `${pr.tgtKind === 'tang' ? 'касательный' : 'радиальный'} импульс${(pr.tgtKind === 'tang' ? r.dv.t : r.dv.r) < 0 ? (pr.tgtKind === 'tang' ? ', торможение' : ', к центру') : ''}`,
      });
    rows.push({ kind: 'main', val: [`e′ = ${num(fin.e)}`], note: `новая орбита: ${TYPE[fin.type]}` });
    if (fin.type !== 'line')
      rows.push({
        kind: 'aux',
        val: [`r_п′ = ${num(fin.rp)} ${L}`],
        note: fin.ra != null ? `r_а′ = ${num(fin.ra)} ${L}` : `v∞′ = ${num(fin.vinf ?? 0)} ${L}/с`,
      });
    if (fin.T != null) rows.push({ kind: 'main', val: [`T′ = ${dur(fin.T)}`], note: 'период новой орбиты' });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function formulaDoc(pr: OrbitProblem, r: OrbitResult, opts: { explain?: boolean }): Doc {
  const ex = exf(opts);
  const L = LEN[pr.unit];
  const steps: Step[] = [];
  const e = r.end!;
  {
    const lines: Line[] = [
      { c: ['радиальное ускорение (сила на единицу массы, + — от центра): ', v('a'), '(r) = ', b(printExpr(r.arExpr!))] },
      { c: [`r₀ = ${num(pr.r0)} ${L}, v₀ = ${num(pr.v0)} ${L}/с, θ₀ = ${num(pr.th0, 6)}° к местному горизонту, φ₀ = ${num(pr.ph0)}°`] },
      { c: ['уравнения: r̈ − rφ̇² = a(r), r²φ̇ = c = const'] },
      { num: true, c: [`c = r₀v₀cos θ₀ = ${num(r.c0!)} ${L}²/с; энергия v²/2 + U(r) = const, U(r) = −∫a dr`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Сила центральная, поэтому сохраняется момент количества движения (секторная скорость) и, раз сила зависит только от r, — механическая энергия. Траектория находится численным интегрированием уравнений движения в плоскости.',
    );
    steps.push({ title: 'Центральная сила', blocks: bl });
  }
  {
    const lines: Line[] = [
      { c: [`интегрирование до t = ${num(e.t)} с (Рунге — Кутта с контролем шага)`] },
      {
        num: true,
        c: [
          'r = ',
          b(`${num(e.r, 7)} ${L}`),
          ', φ = ',
          b(`${num(e.phi, 7)}°`),
          ` (${num(rad(e.phi), 6)} рад); v = ${num(e.v)} ${L}/с, v_r = ${num(e.vr)} ${L}/с`,
        ],
      },
      { num: true, c: [`r от ${num(r.rmin!, 6)} до ${num(r.rmax!, 6)} ${L}`] },
      { c: [`проверка: c в конце = ${num(r.c1!, 7)}; энергия в начале ${num(r.E0!, 7)}, в конце ${num(r.E1!, 7)}`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
    steps.push({ title: 'Движение', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`r = ${num(e.r, 6)} ${L}`], note: `в момент t = ${num(e.t)} с; φ = ${num(e.phi, 6)}°` },
    { kind: 'main', val: [`r_min = ${num(r.rmin!, 6)} ${L}`], note: `r_max = ${num(r.rmax!, 6)} ${L}` },
    { kind: 'aux', val: [`v = ${num(e.v)} ${L}/с`], note: `радиальная составляющая ${num(e.vr)} ${L}/с` },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- прямолинейное движение ---------- */

export function radialDoc(pr: RadialProblem, r: RadialResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const L = LEN[pr.unit];
  const steps: Step[] = [];
  const hgt = (x: number) => (pr.R > 0 ? ` (высота над поверхностью ${num(x - pr.R)} ${L})` : '');
  {
    const lines: Line[] = [];
    if (pr.muMode === 'planet') lines.push({ c: [`μ₁ = gR² = ${num(pr.g / LM[pr.unit])}·${pw(pr.R)}² = `, b(`${num(r.mu1)} ${L}³/с²`)] });
    else lines.push({ c: [pr.repel ? 'μ₁ = q₁q₂/m = ' : 'μ₁ = ', b(`${num(r.mu1)} ${L}³/с²`)] });
    const terms: string[] = [pr.repel ? '+μ₁/x²' : '−μ₁/x²'];
    const U: string[] = [pr.repel ? '+μ₁/x' : '−μ₁/x'];
    if (pr.two) {
      lines.push({ c: [`второй центр на x = d = ${num(pr.d)} ${L}: μ₂ = ${num(pr.k2)}·μ₁ = ${num(r.mu2)} ${L}³/с²`] });
      terms.push('+μ₂/(d − x)²');
      U.push('−μ₂/(d − x)');
    }
    if (pr.acc) {
      terms.push(`${pr.acc > 0 ? '+' : '−'}${num(Math.abs(pr.acc))}`);
      U.push(`${pr.acc > 0 ? '−' : '+'}${num(Math.abs(pr.acc))}·x`);
    }
    lines.push({ c: ['ускорение: ẍ = ', terms.join(' ').replace(/^\+/, '')] });
    lines.push({ c: ['потенциал на единицу массы: U(x) = ', U.join(' ').replace(/^\+/, ''), '; интеграл энергии v²/2 + U(x) = E'] });
    if (r.xeq != null) lines.push({ num: true, c: [`точка равного притяжения: μ₁/x² = μ₂/(d − x)² → x = d/(1 + √(μ₂/μ₁)) = `, b(`${num(r.xeq)} ${L}`)] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Ось x идёт от центра 1 по линии центров; скорость положительна при удалении от центра 1. Сила тяготения консервативна, поэтому скорость в любой точке находится из интеграла энергии, а время — интегрированием уравнения движения.',
    );
    steps.push({ title: 'Силы на прямой', blocks: bl });
  }
  const lines: Line[] = [];
  if (pr.fromInf) lines.push({ c: [`из бесконечности: E = v∞²/2 = ${num(r.E!)} ${L}²/с²`] });
  else if (pr.ask === 'x0') lines.push({ c: [`точка должна остановиться в x₁ = ${num(pr.x1)} ${L}: E = U(x₁) = ${num(r.E!)} ${L}²/с²`] });
  else if (pr.ask !== 'v0') lines.push({ c: [`начало: x₀ = ${num(pr.x0)} ${L}, v₀ = ${num(pr.v0)} ${L}/с; E = v₀²/2 + U(x₀) = ${num(r.E!)} ${L}²/с²`] });
  if (pr.ask === 'v0' && r.v0need != null && r.target != null) {
    lines.push({ c: [`дойти до x₁ = ${num(r.target)} ${L}${hgt(r.target)} из x₀ = ${num(pr.x0)} ${L}: v₀²/2 + U(x₀) = U(x₁) (скорость там — нуль)`] });
    lines.push({ num: true, c: ['v₀ = √(2(U(x₁) − U(x₀))) = ', b(`${num(r.v0need)} ${L}/с`)] });
  }
  if (pr.ask === 'x0' && r.x0need != null) {
    lines.push({ c: [`v₀²/2 + U(x₀) = U(x₁) при v₀ = ${num(pr.v0)} ${L}/с — уравнение для x₀`] });
    lines.push({ num: true, c: ['x₀ = ', b(`${num(r.x0need)} ${L}`), hgt(r.x0need)] });
  }
  if (pr.ask === 'top' && r.xtop != null) {
    lines.push({ c: ['точка остановки: v = 0 → U(x) = E'] });
    lines.push({ num: true, c: ['x = ', b(`${num(r.xtop)} ${L}`), hgt(r.xtop)] });
  }
  if (r.escape && r.vinfOut != null) {
    lines.push({ c: ['E ≥ 0 и сила не возвращает точку: она уходит на бесконечность, v∞ = √(2E)'] });
    lines.push({ num: true, c: ['v∞ = ', b(`${num(r.vinfOut)} ${L}/с`), ' — верхний предел скорости'] });
  }
  if (pr.ask === 'at' && r.v1 != null) {
    lines.push({ c: [`в точке x₁ = ${num(pr.x1)} ${L}: v₁ = √(2(E − U(x₁)))`] });
    lines.push({ num: true, c: ['|v₁| = ', b(`${num(r.v1)} ${L}/с`)] });
  }
  if (r.ttop != null) lines.push({ num: true, c: ['время до остановки t = ', b(dur(r.ttop))] });
  if (r.t1 != null) lines.push({ num: true, c: ['время до x₁: t = ', b(dur(r.t1))] });
  const bl: Block[] = [{ k: 'eq', lines }];
  for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
  if (r.ttop != null || r.t1 != null) ex(bl, 'Время найдено численным интегрированием ẍ = a(x) до момента, когда точка остановилась или пришла в x₁.');
  steps.push({ title: 'Интеграл энергии', blocks: bl });
  const rows: AnswerRow[] = [];
  if (r.v0need != null) rows.push({ kind: 'main', val: [`v₀ = ${num(r.v0need)} ${L}/с`], note: `чтобы дойти до x = ${num(r.target!)} ${L}` });
  if (r.x0need != null)
    rows.push({ kind: 'main', val: [`x₀ = ${num(r.x0need)} ${L}`], note: pr.R > 0 ? `высота ${num(r.x0need - pr.R)} ${L}` : 'начальное расстояние' });
  if (r.xtop != null && pr.ask === 'top')
    rows.push({ kind: 'main', val: [`x = ${num(r.xtop)} ${L}`], note: pr.R > 0 ? `точка остановки; высота ${num(r.xtop - pr.R)} ${L}` : 'точка остановки' });
  if (r.ttop != null) rows.push({ kind: 'aux', val: [`t = ${dur(r.ttop)}`], note: 'время до остановки' });
  if (r.vinfOut != null) rows.push({ kind: 'main', val: [`v∞ = ${num(r.vinfOut)} ${L}/с`], note: 'уход на бесконечность' });
  if (r.v1 != null) rows.push({ kind: 'main', val: [`v₁ = ${num(r.v1)} ${L}/с`], note: `на расстоянии ${num(pr.x1)} ${L}` });
  if (r.t1 != null) rows.push({ kind: 'main', val: [`t = ${dur(r.t1)}`], note: `время до x = ${num(pr.x1)} ${L}` });
  if (r.xeq != null) rows.push({ kind: 'aux', val: [`x_р = ${num(r.xeq)} ${L}`], note: 'точка равного притяжения' });
  if (!rows.length) rows.push({ kind: 'main', val: ['—'], note: r.notes[0] ?? 'нет результата' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
