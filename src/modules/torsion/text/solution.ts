/** Решение по шагам: моменты, реакции, эпюра M_z методом сечений, диаметр по прочности и жёсткости, τ, Θ, φ. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { roman } from '../../frames/model/geometry';
import { shaftMoments, type Shaft, type ShaftSolution } from '../model/shaft';

const f = (x: number, d = 4) => fmt(x, d);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
export const pointName = (i: number): string => String.fromCharCode(65 + i);
const deg = (r: number) => (r * 180) / Math.PI;

export function torsionDoc(s: Shaft, r: ShaftSolution, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const m = shaftMoments(s);
  const n = s.steps.length;
  {
    const lines: { c: Inline[] }[] = [];
    if (s.load === 'power') {
      lines.push({ c: [`ω = πn/30 = π·${f(s.rpm)}/30 = ${f((Math.PI * s.rpm) / 30)} рад/с;  M = P/ω`] });
      m.forEach((M, j) => s.powers[j] && lines.push({ c: [v('M'), sub(pointName(j)), ` = ${f(s.powers[j])}/${f((Math.PI * s.rpm) / 30)} = `, b(f(M)), ' кН·м'] }));
    } else m.forEach((M, j) => M && lines.push({ c: [v('M'), sub(pointName(j)), ` = ${f(M)} кН·м`] }));
    if (!lines.length) lines.push({ c: ['внешних моментов нет'] });
    lines.push({ c: [`ΣM = ${f(r.sum)} кН·м`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, s.load === 'power' ? 'Момент на шкиве равен передаваемой мощности, делённой на угловую скорость вала (кВт / (рад/с) = кН·м). Ведущий шкив передаёт мощность на вал — его момент направлен против моментов ведомых шкивов.' : 'Значение «+» — вектор момента направлен по оси z (если смотреть с правого конца вала на левый, момент вращает против часовой стрелки).');
    steps.push({ title: 'Внешние моменты', blocks: bl });
  }
  if (s.supports !== 'none') {
    const lines: { c: Inline[] }[] = [];
    if (s.supports === 'both' && r.indet) {
      lines.push({ c: ['отбрасываем правую заделку, заменяем её моментом X; условие совместности: φ', sub(pointName(n)), ' = 0'] });
      lines.push({ c: ['Σ (M', sub('z,i'), ' + X)·l', sub('i'), '/(GI', sub('p,i'), ') = 0 ⇒ X = −', `${f(r.indet.phiF)}/${f(r.indet.flex)} = `, b(f(r.RB!)), ' кН·м'] });
    }
    if (r.RA != null) lines.push({ c: [v('M'), sub(pointName(0)), ` (заделка) = ${s.supports === 'both' ? `−ΣM − X = ` : '−ΣM = '}`, b(f(r.RA)), ' кН·м'] });
    if (r.RB != null && s.supports !== 'both') lines.push({ c: [v('M'), sub(pointName(n)), ' (заделка) = −ΣM = ', b(f(r.RB)), ' кН·м'] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, s.supports === 'both' ? 'Вал с двумя заделками один раз статически неопределим: уравнение равновесия одно, неизвестных моментов два. Недостающее уравнение — угол поворота правого торца равен нулю. Податливость участка l/(k⁴(1 − c⁴)) — общий множитель 32/(πGd⁴) сокращается.' : 'Реактивный момент заделки уравновешивает сумму внешних моментов.');
    steps.push({ title: s.supports === 'both' ? 'Реактивные моменты (статически неопределимый вал)' : 'Реактивный момент', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = r.steps.map((st, i) => {
      const fromRight = s.supports !== 'right';
      const terms = fromRight ? m.slice(i + 1).map((M, k) => [M, i + 1 + k] as const) : m.slice(0, i + 1).map((M, k) => [-M, k] as const);
      const extra = s.supports === 'both' ? [[r.RB!, n] as const] : [];
      const all = [...terms, ...extra].filter(([M]) => M !== 0);
      const expr = all.length ? all.map(([M], k) => (k ? (M < 0 ? ` − ${f(-M)}` : ` + ${f(M)}`) : f(M))).join('') : '0';
      return { c: [`участок ${roman(i)} (${pointName(i)}${pointName(i + 1)}): `, v('M'), sub('z'), ` = ${expr} = `, b(f(st.Mz)), ' кН·м'] };
    });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Метод сечений (Антонов, п. 7.2): M_z равен алгебраической сумме внешних моментов по одну сторону от сечения; момент, видимый со стороны сечения по часовой стрелке, — со знаком «+». Здесь берём моменты правее сечения' + (s.supports === 'right' ? ' — кроме заделки справа: там удобнее левая часть (знаки обратные).' : ' (вместе с реактивным моментом правой заделки, если она есть).'));
    steps.push({ title: 'Крутящие моменты по участкам', blocks: bl });
  }
  if (s.dMode === 'find') {
    const lines: { c: Inline[] }[] = [];
    lines.push({ c: ['прочность: τ', sub('max'), ' = M', sub('z'), '/W', sub('p'), ' ≤ [τ], W', sub('p'), ' = π(kd)³(1 − c⁴)/16 ⇒ d ≥ ∛(16|M', sub('z'), '|/(πk³(1 − c⁴)[τ])) = ', b(`${f(r.dStrength!)} мм`)] });
    if (r.dStiff != null) lines.push({ c: ['жёсткость: Θ = M', sub('z'), '/(GI', sub('p'), ') ≤ [Θ] = ', `${f(s.thetaAllow)}°/м = ${f((s.thetaAllow * Math.PI) / 180, 5)} рад/м ⇒ d ≥ ⁴√(32|M`, sub('z'), '|/(πk⁴(1 − c⁴)G[Θ])) = ', b(`${f(r.dStiff)} мм`)] });
    lines.push({ c: ['d = ', b(`${f(r.d)} мм`), ` → принимаем ${Math.ceil(r.d - 1e-9)} мм${r.dStiff != null ? (r.dStiff > r.dStrength! ? ' (определяет жёсткость)' : ' (определяет прочность)') : ''}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Условие берётся для каждого участка, решающим оказывается участок с наибольшим требуемым d. Дальше напряжения и углы — при расчётном d (до округления).');
    steps.push({ title: 'Диаметр вала', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = r.steps.flatMap((st, i) => [
      { c: [`${roman(i)}: D = ${f(st.D, 2)}${st.dIn ? `, d₀ = ${f(st.dIn, 2)}` : ''} мм;  W`, sub('p'), ` = ${f(st.Wp, 0)} мм³, I`, sub('p'), ` = ${f(st.Ip, 0)} мм⁴`] },
      { c: ['     τ', sub('max'), ` = ${fp(st.Mz)}·10⁶/${f(st.Wp, 0)} = `, b(f(st.tau)), ' МПа;  Θ = ', `${f(st.theta, 5)} рад/м = ${f(deg(st.theta))}°/м`] },
    ]);
    lines.push({ c: ['|τ|', sub('max'), ` = ${f(Math.abs(r.tauMax.v))} МПа на участке ${roman(r.tauMax.i)}${s.tauAllow > 0 ? (Math.abs(r.tauMax.v) <= s.tauAllow + 1e-9 ? ` ≤ [τ] = ${f(s.tauAllow)}` : ` > [τ] = ${f(s.tauAllow)} — прочность не обеспечена`) : ''}`] });
    if (s.thetaAllow > 0) lines.push({ c: ['|Θ|', sub('max'), ` = ${f(deg(Math.abs(r.thetaMax.v)))}°/м${deg(Math.abs(r.thetaMax.v)) <= s.thetaAllow + 1e-9 ? ' ≤ ' : ' > '}[Θ] = ${f(s.thetaAllow)}°/м${deg(Math.abs(r.thetaMax.v)) <= s.thetaAllow + 1e-9 ? '' : ' — жёсткость не обеспечена'}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'τ_max = M_z/W_p достигается на поверхности вала; W_p = πD³(1 − c⁴)/16. Относительный угол закручивания Θ = M_z/(GI_p), I_p = πD⁴(1 − c⁴)/32.');
    steps.push({ title: 'Напряжения и относительные углы закручивания', blocks: bl });
  }
  {
    const base = s.supports === 'right' ? pointName(n) : pointName(0);
    const lines: { c: Inline[] }[] = r.steps.map((st, i) => ({ c: [`φ`, sub(`${pointName(i)}${pointName(i + 1)}`), ` = M`, sub('z'), 'l/(GI', sub('p'), `) = ${f(st.phi, 6)} рад;  φ`, sub(pointName(i + 1)), ` = ${f(st.phi1, 6)} рад (${f(deg(st.phi1))}°)`] }));
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, `Углы поворота сечений отсчитываются от сечения ${base}${s.supports === 'none' ? ' (вал без заделок — поворот относительно левого торца)' : ' (заделка)'}; угол поворота в конце участка равен сумме углов закручивания участков от начала отсчёта.`);
    steps.push({ title: 'Углы закручивания', blocks: bl });
  }
  const rows: AnswerRow[] = [
    ...(s.dMode === 'find' ? [{ kind: 'main' as const, val: [`d = ${f(r.d)} мм`] as Inline[], note: `принимаем ${Math.ceil(r.d - 1e-9)} мм` }] : []),
    { kind: 'main', val: [`|M`, sub('z'), `|max = ${f(Math.max(...r.steps.map((x) => Math.abs(x.Mz))))} кН·м`], note: 'опасный участок' },
    { kind: 'main', val: [`τ`, sub('max'), ` = ${f(Math.abs(r.tauMax.v))} МПа`], note: `участок ${roman(r.tauMax.i)}` },
    { kind: 'aux', val: [`φ`, sub('max'), ` = ${f(deg(Math.abs(r.phiMax.v)))}°`], note: `${f(Math.abs(r.phiMax.v), 6)} рад при z = ${f(r.phiMax.z)} м` },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
