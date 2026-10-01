/** Решение: силы вдоль прямой, дифференциальное уравнение движения точки, интегрирование, ответ. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { G } from '../../rotation/model/rotation';
import type { PointProblem, PointResult } from '../model/point';

const f = (x: number) => fmt(x, 4);
const sg = (x: number, first = false) => (x < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ') + f(Math.abs(x));

export function pointDoc(pr: PointProblem, r: PointResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] });
    return { steps };
  }
  const FU = pr.byWeight ? 'кГ' : 'Н';
  const e = r.eq;
  const dirTxt = pr.alpha === 0 ? 'по горизонтали' : pr.alpha === 90 ? (pr.up ? 'вертикально вверх' : 'вертикально вниз') : pr.up ? `вверх по прямой, наклонённой под ${f(pr.alpha)}° к горизонту` : `вниз по прямой, наклонённой под ${f(pr.alpha)}° к горизонту`;
  // 1. Силы.
  const terms: Inline[][] = [];
  {
    const items: Inline[][] = [];
    items.push([`масса m = ${pr.byWeight ? `P/g = ${f(pr.m)}/${f(G)} = ` : ''}${f(r.mass)} ${pr.byWeight ? 'кГ·с²/м' : 'кг'}; вес P = ${f(r.P)} ${FU}`]);
    if (r.Gx) items.push([`проекция силы тяжести на x: ${pr.up ? '−' : '+'}P·sin α = ${f(r.Gx)} ${FU}`]);
    if (pr.F0) items.push([`постоянная сила F₀ = ${f(pr.F0)} ${FU}`]);
    if (r.Gx || pr.F0) terms.push([sg(r.Gx + pr.F0, true)]);
    if (pr.at) items.push([`сила, растущая со временем: a·t, a = ${f(pr.at)}`]), terms.push([sg(pr.at, !terms.length), '·', v('t')]);
    if (pr.F1 && pr.p) items.push([`гармоническая сила F₁ sin pt: F₁ = ${f(pr.F1)}, p = ${f(pr.p)}`]), terms.push([sg(pr.F1, !terms.length), '·sin(', f(pr.p), v('t'), ')']);
    if (pr.c) items.push([`упругая сила −cx, c = ${f(pr.c)}`]), terms.push([sg(-pr.c, !terms.length), v('x')]);
    if (pr.kv) items.push([`сопротивление, пропорциональное скорости: −k₁v, k₁ = ${f(pr.kv)}`]), terms.push([sg(-pr.kv, !terms.length), v('v')]);
    if (pr.kq) items.push([`сопротивление, пропорциональное квадрату скорости: −k₂v|v|, k₂ = ${f(pr.kq)}`]), terms.push([sg(-pr.kq, !terms.length), v('v'), '|', v('v'), '|']);
    if (r.Ffr) items.push([`нормальная реакция N = P·cos α = ${f(r.P * Math.cos((pr.alpha * Math.PI) / 180))} ${FU}; сила трения F = fN = ${f(pr.f)}·N = ${f(r.Ffr)} ${FU} — против скорости`]), terms.push([sg(-r.Ffr, !terms.length), '·sign ', v('v')]);
    const bl: Block[] = [{ k: 'p', c: [`Ось x направлена ${dirTxt}. Силы, действующие на точку, в проекции на x:`] }, { k: 'ul', items }];
    ex(bl, 'Нормальная реакция плоскости и составляющая силы тяжести, перпендикулярная движению, уравновешены (ускорения поперёк прямой нет), поэтому N = P cos α. Сила трения скольжения направлена против скорости.');
    steps.push({ title: 'Силы, действующие на точку', blocks: bl });
  }
  // 2. Уравнение.
  {
    const rhs = terms.length ? terms.flat() : ['0'];
    const bl: Block[] = [
      { k: 'eq', lines: [{ c: [v('m'), 'd', v('v'), '/d', v('t'), ' = Σ', v('F'), sub('x'), ':  ', f(r.mass), '·d', v('v'), '/d', v('t'), ' = ', ...rhs] }] },
      { k: 'p', c: [`Начальные условия: x(0) = ${f(pr.x0)} м, v(0) = ${f(pr.v0)} м/с.`] },
    ];
    const sol: { c: Inline[] }[] = [];
    const C = r.Gx + pr.F0;
    if (e.kind === 'const') {
      const a = (C - r.Ffr * Math.sign(pr.v0 || C)) / r.mass;
      sol.push({ c: ['a = ΣF/m = ', b(f(a)), ' м/с² — постоянно: v = v₀ + at,  x = x₀ + v₀t + at²/2'] });
    } else if (e.kind === 'viscous') sol.push({ c: [`v = v∞ + (v₀ − v∞)e^{−k₁t/m}, v∞ = (ΣF)/k₁;  x = x₀ + v∞t + (v₀ − v∞)(m/k₁)(1 − e^{−k₁t/m}), m/k₁ = ${f(r.mass / pr.kv)} с`] });
    else if (e.kind === 'quadratic' || e.kind === 'omega') sol.push({ c: ['Сила зависит только от v — разделяем переменные: ', v('t'), ' = m∫dv/F(v),  x − x₀ = m∫v dv/F(v)'] });
    else if (e.kind === 'harmonic') sol.push({ c: [`m·ẍ + cx = F: k = √(c/m) = ${f(Math.sqrt(pr.c / r.mass))} рад/с, x = x* + (x₀ − x*)cos kt + (v₀/k)sin kt, x* = F/c = ${f(C / pr.c)} м`] });
    else if (e.kind === 'time') sol.push({ c: ['v = v₀ + (F₀t + at²/2)/m,  x = x₀ + v₀t + (F₀t²/2 + at³/6)/m'] });
    else sol.push({ c: ['Уравнение решаем численно (метод Рунге — Кутты четвёртого порядка с контролем шага).'] });
    bl.push({ k: 'eq', lines: sol });
    if (r.vLim != null) bl.push({ k: 'p', c: ['Предельная (установившаяся) скорость — при ΣF = 0: ', v('v'), sub('пр'), ' = ', b(`${f(r.vLim)} м/с`), ` (${f(r.vLim * 3.6)} км/ч)`] });
    if (e.period != null) bl.push({ k: 'p', c: [`Период колебаний T = 2π√(m/c) = ${f(e.period)} с.`] });
    ex(bl, 'Вторая основная задача динамики: по силам найти движение. Дифференциальное уравнение m·ẍ = ΣF_x интегрируем дважды; постоянные интегрирования — из начальных условий.');
    steps.push({ title: 'Дифференциальное уравнение движения', blocks: bl });
  }
  // 3. Ответ.
  {
    const bl: Block[] = [];
    if (pr.ask !== 't' && e.note === 'never') bl.push({ k: 'badge', tone: 'bad', text: pr.ask === 'v' ? `скорость ${f(pr.v1)} м/с не достигается` : `координата ${f(pr.x1)} м не достигается` });
    if (e.tStop != null) bl.push({ k: 'badge', tone: 'warn', text: `точка остановилась при t = ${f(e.tStop)} с и дальше стоит (трение)` });
    bl.push({
      k: 'eq',
      lines: [
        { c: [v('t'), ' = ', b(`${f(e.t)} с`)] },
        { c: [v('v'), ' = ', b(`${f(e.w)} м/с`), ` (${f(e.w * 3.6)} км/ч)`] },
        { c: [v('x'), ' = ', b(`${f(e.phi)} м`)] },
        { c: [v('a'), ' = ', f(e.eps), ' м/с²'] },
      ],
    });
    steps.push({ title: 'Состояние в конце', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  if (e.note === 'ok') {
    rows.push({ kind: 'main', val: [v('t'), ` = ${f(e.t)} с`], note: pr.ask === 'v' ? `до v = ${f(pr.v1)} м/с` : pr.ask === 'x' ? `до x = ${f(pr.x1)} м` : 'заданный момент' });
    rows.push({ kind: 'main', val: [v('v'), ` = ${f(e.w)} м/с`], note: `${f(e.w * 3.6)} км/ч` });
    rows.push({ kind: 'main', val: [v('x'), ` = ${f(e.phi)} м`], note: 'координата' });
  }
  if (r.vLim != null) rows.push({ kind: 'aux', val: [v('v'), sub('пр'), ` = ${f(r.vLim)} м/с`], note: 'предельная скорость' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
