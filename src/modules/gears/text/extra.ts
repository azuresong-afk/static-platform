/** Решения: равнопеременное вращение, эллиптические колёса, фрикционная передача. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { EllProblem, EllResult } from '../model/ellipse';
import type { FrProblem, FrResult } from '../model/friction';
import { UNI_KEYS, type UniKey, type UniProblem, type UniResult } from '../model/uniform';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
type Opts = { explain?: boolean };
const bad = (errors: string[]): Doc => ({ steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: errors.map((x) => [x]) }] }] });
const explainer = (opts: Opts) => (bl: Block[], ...c: Inline[]) => {
  if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
};

export const UNI_NAMES: Record<UniKey, string> = { w0: 'ω₀', w: 'ω', eps: 'ε', t: 't', phi: 'φ' };

export function uniDoc(pr: UniProblem, r: UniResult, opts: Opts = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = explainer(opts);
  const steps: Step[] = [];
  const rpm = pr.wUnit === 'rpm',
    turn = pr.phiUnit === 'turn';
  const show = (k: UniKey, x: number) =>
    k === 'w0' || k === 'w' ? `${f(x)} рад/с${rpm ? ` (${f((x * 30) / Math.PI)} об/мин)` : ''}` : k === 'phi' ? `${f(x)} рад${turn ? ` (${f(x / (2 * Math.PI))} об.)` : ''}` : k === 't' ? `${f(x)} с` : `${f(x)} рад/с²`;
  {
    const lines: { c: Inline[] }[] = UNI_KEYS.filter((k) => pr.known.includes(k)).map((k) => ({ c: [v(UNI_NAMES[k]), ` = ${show(k, r[k])}`] }));
    const bl: Block[] = [{ k: 'p', c: ['Известны (в единицах СИ):'] }, { k: 'eq', lines }];
    ex(bl, 'Обороты в минуту переводим в рад/с умножением на π/30, обороты — в радианы умножением на 2π.');
    steps.push({ title: 'Данные', blocks: bl });
  }
  {
    const bl: Block[] = [
      { k: 'eq', lines: [{ c: ['ω = ω₀ + εt;  φ = ω₀t + εt²/2;  ω² − ω₀² = 2εφ;  φ = (ω₀ + ω)t/2'] }, { c: [r.how] }] },
    ];
    ex(bl, 'При равнопеременном вращении ε = const; из пяти величин ω₀, ω, ε, t, φ любые три определяют две остальные. Отрицательное ε при положительной ω — вращение замедленное.');
    steps.push({ title: 'Формулы равнопеременного вращения', blocks: bl });
  }
  const unknown = UNI_KEYS.filter((k) => !pr.known.includes(k));
  steps.push({ title: 'Результат', blocks: [{ k: 'eq', lines: UNI_KEYS.map((k) => ({ c: [v(UNI_NAMES[k]), ' = ', unknown.includes(k) ? b(show(k, r[k])) : show(k, r[k])] })) }] });
  const rows: AnswerRow[] = unknown.map((k) => ({ kind: 'main' as const, val: [v(UNI_NAMES[k]), ` = ${show(k, r[k])}`] as Inline[], note: [k !== 't' ? `= ${f(r[k] / Math.PI)}π` : '', k === 'eps' ? (r.eps * r.w0 < 0 || r.eps * r.w < 0 ? 'вращение замедленное' : 'вращение ускоренное') : ''].filter(Boolean).join('; ') }));
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function ellDoc(pr: EllProblem, r: EllResult, opts: Opts = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = explainer(opts);
  const steps: Step[] = [];
  const focus = pr.pivot === 'focus';
  {
    const lines: { c: Inline[] }[] = [
      { c: [`a = ${f(pr.a)}, b = ${f(pr.b)}, c = √(a² − b²) = ${f(r.c)};  A = O₁O₂ = ${f(r.A)};  `, v('ω'), sub('1'), ` = ${f(r.w1)} рад/с`] },
      focus ? { c: ['ось в фокусе:  ', v('r'), sub('1'), ' = (a² − c²)/(a − c cos φ)'] } : { c: ['ось в центре:  ', v('r'), sub('1'), ' = ab/√(b² cos² φ + a² sin² φ)'] },
      { c: [v('r'), sub('2'), ' = A − ', v('r'), sub('1'), ';  ', v('ω'), sub('2'), ' = ', v('ω'), sub('1'), '·', v('r'), sub('1'), '/', v('r'), sub('2')] },
    ];
    if (focus && Math.abs(r.A - 2 * pr.a) < 1e-9) lines.push({ c: [v('ω'), sub('2'), ' = ', v('ω'), sub('1'), '(a² − c²)/(a² − 2ac cos φ + c²)'] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Колёса катятся друг по другу без скольжения, точка касания лежит на линии центров; скорости точек касания равны: ω₁r₁ = ω₂r₂, а r₁ + r₂ = O₁O₂. φ — угол между линией центров и большой осью колеса 1. Колесо 2 вращается в обратную сторону.');
    steps.push({ title: 'Закон передачи', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [
      { c: [`при φ = ${f(pr.phi)}°: `, v('r'), sub('1'), ` = ${f(r.r1)}, `, v('r'), sub('2'), ` = ${f(r.r2)};  `, v('ω'), sub('2'), ` = ${f(r.w1)}·${f(r.r1)}/${f(r.r2)} = `, b(f(r.w2)), ' рад/с'] },
      { c: [v('ε'), sub('2'), ' = ', v('ω'), sub('1'), '²·d(r₁/r₂)/dφ = ', b(f(r.eps2)), ' рад/с²'] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'ω₁ постоянна, поэтому угловое ускорение колеса 2 — производная его угловой скорости по углу φ, умноженная на ω₁ = dφ/dt.');
    steps.push({ title: 'Положение колеса 1', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [
      { c: [`наибольший ${v('r')}`, sub('1'), ` = ${f(r.max.r1)} (φ = ${f(r.max.phi)}°): `, v('ω'), sub('2 max'), ` = ${f(r.w1)}·${f(r.max.r1)}/${f(r.A - r.max.r1)} = `, b(f(r.max.w)), ` = ${f(r.max.w / Math.PI)}π рад/с`] },
      { c: [`наименьший ${v('r')}`, sub('1'), ` = ${f(r.min.r1)} (φ = ${f(r.min.phi)}°): `, v('ω'), sub('2 min'), ` = ${f(r.w1)}·${f(r.min.r1)}/${f(r.A - r.min.r1)} = `, b(f(r.min.w)), ` = ${f(r.min.w / Math.PI)}π рад/с`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    if (!focus) bl.push({ k: 'p', c: ['Профиль колеса 1 принят эллипсом. Два одинаковых эллипса на центрах точно не сопрягаются (сопряжённое колесо за оборот колеса 1 не делает полного оборота), поэтому в задаче речь об «овалах»; крайние значения ω₂ зависят только от наибольшего и наименьшего радиусов и от формы овала не зависят, а закон ω₂(φ) между ними здесь — для эллипса.'] });
    ex(bl, focus ? 'Для эллипса с осью в фокусе крайние радиусы — a + c и a − c (вершины большой оси).' : 'Для эллипса с осью в центре крайние радиусы — полуоси a и b.');
    steps.push({ title: 'Наибольшая и наименьшая угловые скорости', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('ω'), sub('2 min'), ` = ${f(r.min.w)} рад/с`], note: `${f(r.min.w / Math.PI)}π` },
    { kind: 'main', val: [v('ω'), sub('2 max'), ` = ${f(r.max.w)} рад/с`], note: `${f(r.max.w / Math.PI)}π` },
    { kind: 'aux', val: [v('ω'), sub('2'), ` = ${f(r.w2)}, `, v('ε'), sub('2'), ` = ${f(r.eps2)}`], note: `при φ = ${f(pr.phi)}°` },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function frDoc(pr: FrProblem, r: FrResult, opts: Opts = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = explainer(opts);
  const steps: Step[] = [];
  const x = r.vals;
  {
    const lines: { c: Inline[] }[] = [
      { c: [v('φ'), sub('1'), ` = ${printExpr(r.phi1)};  `, v('ω'), sub('1'), ` = ${printExpr(r.w1)};  `, v('ε'), sub('1'), ` = ${printExpr(r.e1)}`] },
      { c: [v('d'), ` = ${printExpr(r.dE)};  ḋ = ${printExpr(r.dd)};  r = ${f(pr.r)}`] },
      { c: [v('ω'), sub('2'), ' = ', v('ω'), sub('1'), 'r/d = ', printExpr(r.w2)] },
      { c: [v('ε'), sub('2'), ' = (', v('ε'), sub('1'), 'r·d − ', v('ω'), sub('1'), 'r·ḋ)/d² = ', printExpr(r.e2)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Ролик касается диска 2 на расстоянии d от его оси и не проскальзывает: ω₁r = ω₂d. Плечо d меняется, поэтому ω₂ меняется даже при постоянной ω₁; ε₂ — производная ω₂ по времени.');
    steps.push({ title: 'Передаточное отношение', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [];
    if (pr.find) lines.push({ c: [`d(t) = ${f(pr.dTarget)} ⇒ `, r.found != null ? b(`t = ${f(r.found)}`) : `на отрезке [0; ${f(pr.tMax)}] не достигается`] });
    lines.push({ c: [`при t = ${f(r.t)}: d = ${f(x.d)};  `, v('ω'), sub('2'), ` = ${f(x.w1)}·${f(pr.r)}/${fp(x.d)} = `, b(f(x.w2)), ' рад/с;  ', v('ε'), sub('2'), ' = ', b(f(x.e2)), ' рад/с²'] });
    if (r.point) {
      const p = r.point;
      lines.push({ c: [`R = ${f(p.R)}: `, v('v'), ' = |ω₂|R = ', b(f(p.v)), ';  ', v('a'), sub('τ'), ` = ε₂R = ${f(p.at)};  `, v('a'), sub('n'), ` = ω₂²R = ${f(p.an)}`] });
      lines.push({ c: [v('a'), ' = R√(ε₂² + ω₂⁴) = ', b(f(p.a))] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Точка обода диска 2 движется по окружности радиуса R: касательное ускорение ε₂R, нормальное ω₂²R. Если d меняет знак (ролик проходит через ось диска), меняется и направление вращения диска.');
    steps.push({ title: 'В заданный момент', blocks: bl });
  }
  const rows: AnswerRow[] = [
    ...(pr.find ? [{ kind: 'main' as const, val: [r.found != null ? `t = ${f(r.found)}` : 'не достигается'] as Inline[], note: `d = ${f(pr.dTarget)}` }] : []),
    { kind: 'main', val: [v('ω'), sub('2'), ` = ${f(x.w2)} рад/с`], note: `n = ${f((Math.abs(x.w2) * 30) / Math.PI)} об/мин` },
    { kind: 'main', val: [v('ε'), sub('2'), ` = ${f(x.e2)} рад/с²`], note: `ε₂(t) = ${printExpr(r.e2)}` },
    ...(r.point ? [{ kind: 'main' as const, val: [v('a'), ` = ${f(r.point.a)}`] as Inline[], note: `v = ${f(r.point.v)} — точка на расстоянии ${f(r.point.R)}` }] : []),
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
