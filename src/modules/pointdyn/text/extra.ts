/** Решения: первая задача динамики (силы по закону движения) и криволинейное движение в плоскости. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { FirstProblem, FirstResult } from '../model/first';
import type { PlaneProblem, PlaneResult } from '../model/plane';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const AX = ['x', 'y', 'z'] as const;
const D1 = ['ẋ', 'ẏ', 'ż'];
const D2 = ['ẍ', 'ÿ', 'z̈'];
const GDIR: Record<FirstProblem['gravity'], string> = { none: 'не учитывается', '-y': 'вдоль −y', '+y': 'вдоль +y', '-z': 'вдоль −z', '+x': 'вдоль +x', '-x': 'вдоль −x' };

export function firstDoc(pr: FirstProblem, r: FirstResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] });
    return { steps };
  }
  // При заданном весе сила — в тех же единицах, что вес (кГ или Н).
  const FU = pr.byWeight ? '' : 'Н';
  const used = [0, 1, 2].filter((i) => pr[AX[i]].trim() !== '');
  {
    const lines = used.map((i) => ({ c: [v(AX[i]), `(t) = ${printExpr(r.r[i])}`] as Inline[] }));
    const bl: Block[] = [{ k: 'eq', lines }, { k: 'p', c: [`m = ${pr.byWeight ? `P/g = ${f(pr.m)}/${f(pr.g)} = ` : ''}${f(r.mass)}${pr.byWeight ? ' (силы — в единицах веса)' : ' кг'}; сила тяжести ${GDIR[pr.gravity]}${pr.gravity === 'none' ? '' : `, g = ${f(pr.g)} м/с²`}.`] }];
    steps.push({ title: 'Закон движения', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    for (const i of used) lines.push({ c: [v(D1[i]), ' = ', printExpr(r.v[i]), `;  при t = ${f(pr.t)}: `, b(f(r.vt[i]))] });
    for (const i of used) lines.push({ c: [v(D2[i]), ' = ', printExpr(r.a[i]), `;  при t = ${f(pr.t)}: `, b(f(r.at[i]))] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Проекции скорости — первые производные координат по времени, проекции ускорения — вторые.');
    steps.push({ title: 'Скорость и ускорение', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = used.map((i) => ({ c: [v('F'), sub(AX[i]), ' = m', v(D2[i]), r.mg[i] ? ` − (mg)${AX[i]}` : '', ` = ${f(r.mass)}·${fp(r.at[i])}${r.mg[i] ? ` − ${fp(r.mg[i])}` : ''} = `, b(`${f(r.F[i])} ${FU}`)] as Inline[] }));
    lines.push({ c: ['|', v('F'), '| = ', b(`${f(r.Fn)} ${FU}`)] });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.speed > 1e-12)
      bl.push({ k: 'p', c: [`По касательной к траектории F_τ = ${f(r.Ftau)}, по нормали F_n = ${f(r.Fnorm)} ${FU}`, r.rho != null ? `; радиус кривизны ρ = v²/a_n = ${f(r.rho)} м` : '', '.'] });
    ex(bl, 'Первая задача динамики: по известному движению найти силу. Второй закон Ньютона m·a = ΣF; если среди сил есть сила тяжести mg, искомая сила F = m·a − m·g. Знак проекции показывает направление силы относительно оси.');
    steps.push({ title: 'Сила по второму закону Ньютона', blocks: bl });
  }
  if (r.Fmax != null)
    steps.push({ title: 'Наибольшая сила на отрезке', blocks: [{ k: 'p', c: [`На отрезке t ∈ [${f(pr.t1)}; ${f(pr.t2)}] наибольшее |F| = `, b(`${f(r.Fmax)} ${FU}`), ` при t = ${f(r.tMax!)} с.`] }] });
  const rows: AnswerRow[] = used.map((i) => ({ kind: 'main' as const, val: [v('F'), sub(AX[i]), ` = ${f(r.F[i])} ${FU}`], note: `при t = ${f(pr.t)} с` }));
  rows.push({ kind: 'main', val: ['|', v('F'), `| = ${f(r.Fn)} ${FU}`], note: 'модуль' });
  if (r.Fmax != null) rows.push({ kind: 'aux', val: [v('F'), sub('max'), ` = ${f(r.Fmax)} ${FU}`], note: `при t = ${f(r.tMax!)} с` });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function planeDoc(pr: PlaneProblem, r: PlaneResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] });
    return { steps };
  }
  const m = r.mass;
  const vx0 = pr.v0 * Math.cos((pr.ang * Math.PI) / 180),
    vy0 = pr.v0 * Math.sin((pr.ang * Math.PI) / 180);
  // 1. Силы и уравнения.
  {
    const items: Inline[][] = [[`m = ${pr.byWeight ? `P/g = ${f(pr.m)}/${f(pr.g)} = ` : ''}${f(m)}`]];
    const X: string[] = [],
      Y: string[] = [];
    if (pr.gravity) items.push([`сила тяжести mg = ${f(m * pr.g)} — вдоль −y`]), Y.push(`− ${f(m * pr.g)}`);
    if (pr.Fx || pr.Fy) items.push([`постоянная сила (${f(pr.Fx)}; ${f(pr.Fy)})`]), pr.Fx && X.push(`+ ${f(pr.Fx)}`), pr.Fy && Y.push(`+ ${f(pr.Fy)}`);
    if (pr.kv) items.push([`сопротивление −k₁v, k₁ = ${f(pr.kv)}`]), X.push(`− ${f(pr.kv)}ẋ`), Y.push(`− ${f(pr.kv)}ẏ`);
    if (pr.kq) items.push([`сопротивление −k₂|v|v, k₂ = ${f(pr.kq)}`]), X.push(`− ${f(pr.kq)}vẋ`), Y.push(`− ${f(pr.kq)}vẏ`);
    if (pr.c) items.push([`${pr.c > 0 ? 'притяжение к центру' : 'отталкивание от центра'} C(${f(pr.cx)}; ${f(pr.cy)}): −c(r − r_C), c = ${f(pr.c)}`]), X.push(`− ${f(pr.c)}(x − ${f(pr.cx)})`), Y.push(`− ${f(pr.c)}(y − ${f(pr.cy)})`);
    if (pr.q) items.push([`сила, перпендикулярная скорости: q(ẏ; −ẋ), q = ${f(pr.q)}`]), X.push(`+ ${f(pr.q)}ẏ`), Y.push(`− ${f(pr.q)}ẋ`);
    const fix = (a: string[]) => (a.length ? a.join(' ').replace(/^\+ /, '').replace(/^− /, '−') : '0').replace(/− −/g, '+ ').replace(/\+ −/g, '− ');
    const bl: Block[] = [
      { k: 'ul', items },
      {
        k: 'eq',
        lines: [
          { c: [`${f(m)}·`, v('ẍ'), ' = ', fix(X)] },
          { c: [`${f(m)}·`, v('ÿ'), ' = ', fix(Y)] },
        ],
      },
      { k: 'p', c: [`Начальные условия: x₀ = ${f(pr.x0)}, y₀ = ${f(pr.y0)}; ẋ₀ = v₀ cos α = ${f(vx0)}, ẏ₀ = v₀ sin α = ${f(vy0)} м/с.`] },
    ];
    const onlyG = !pr.kv && !pr.kq && !pr.c && !pr.q && !pr.Fx && !pr.Fy;
    if (onlyG && pr.gravity)
      bl.push({ k: 'eq', lines: [{ c: ['Без сопротивления: x = x₀ + ẋ₀t,  y = y₀ + ẏ₀t − gt²/2 — траектория парабола.'] }] });
    else bl.push({ k: 'p', c: ['Систему решаем численно (метод Рунге — Кутты с контролем шага).'] });
    ex(bl, 'Вторая задача динамики в проекциях на оси: m·ẍ = ΣF_x, m·ÿ = ΣF_y; шесть (на плоскости — четыре) постоянных интегрирования определяются начальными условиями.');
    steps.push({ title: 'Дифференциальные уравнения движения', blocks: bl });
  }
  // 2. Результат.
  {
    const bl: Block[] = [];
    const what = pr.ask === 'land' ? `точка опустилась до уровня y = ${f(pr.y1)} м` : pr.ask === 'apex' ? 'высшая точка траектории (ẏ = 0)' : pr.ask === 'x' ? `x = ${f(pr.x1)} м` : `момент t = ${f(pr.t)} с`;
    if (r.note === 'never') bl.push({ k: 'badge', tone: 'bad', text: 'такое положение не достигается' });
    else
      bl.push(
        { k: 'p', c: [`Ищем: ${what}.`] },
        {
          k: 'eq',
          lines: [
            { c: [v('t'), ' = ', b(`${f(r.t)} с`), ';  ', v('x'), ' = ', b(`${f(r.x)} м`), ';  ', v('y'), ' = ', b(`${f(r.y)} м`)] },
            { c: ['ẋ = ', f(r.vx), ', ẏ = ', f(r.vy), ` м/с; v = ${f(Math.hypot(r.vx, r.vy))} м/с`] },
          ],
        },
      );
    if (r.apex) bl.push({ k: 'p', c: [`Высшая точка траектории: t = ${f(r.apex.t)} с, x = ${f(r.apex.x)} м, y = `, b(`${f(r.apex.y)} м`), '.'] });
    steps.push({ title: 'Результат', blocks: bl });
  }
  const rows: AnswerRow[] = r.note === 'ok' ? [{ kind: 'main', val: [`t = ${f(r.t)} с`], note: '' }, { kind: 'main', val: [`x = ${f(r.x)} м, y = ${f(r.y)} м`], note: 'положение' }, { kind: 'main', val: [`v = ${f(Math.hypot(r.vx, r.vy))} м/с`], note: 'скорость' }] : [];
  if (r.apex) rows.push({ kind: 'aux', val: [`h = ${f(r.apex.y)} м`], note: 'высшая точка' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
