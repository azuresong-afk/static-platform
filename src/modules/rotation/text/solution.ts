/** Решение: дифференциальное уравнение вращения и сохранение кинетического момента. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { G, type EqResult, type KItem, type KResult, type RotEq } from '../model/rotation';

const f = (x: number) => fmt(x, 4);
const sg = (x: number, first = false) => (x < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ') + f(Math.abs(x));

export function eqDoc(e: RotEq, byWeight: boolean, r: EqResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] });
    return { steps };
  }
  const JU = byWeight ? 'кГ·м·с²' : 'кг·м²';
  const MU = byWeight ? 'кГ·м' : 'Н·м';
  // 1. Момент инерции.
  {
    const bd = e.body;
    const mm = byWeight ? `${f(bd.m)}/${f(G)}` : f(bd.m);
    const form = bd.kind === 'J' ? '' : bd.kind === 'disk' ? `mR²/2 = ${mm}·${f(bd.R)}²/2` : bd.kind === 'ring' ? `mR² = ${mm}·${f(bd.R)}²` : `mρ² = ${mm}·${f(bd.R)}²`;
    const lines: { num?: boolean; c: Inline[] }[] = [{ c: [v('J'), sub('тела'), ` = ${form ? `${form} = ` : ''}`, b(f(r.Jbody)), form ? '' : ' (задан)'] }];
    if (e.loads.length)
      lines.push({ c: [v('J'), ' = ', v('J'), sub('тела'), ' + Σ', v('m'), sub('i'), v('r'), sub('i'), `² = ${f(r.Jbody)}${e.loads.map((l) => ` + ${byWeight ? `(${f(l.m)}/${f(G)})` : f(l.m)}·${f(l.r)}²`).join('')} = `, b(`${f(r.J)} ${JU}`)] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Груз на тросе, намотанном на барабан радиуса r, движется со скоростью v = ωr: его кинетический момент mr²ω, поэтому к моменту инерции барабана добавляется mr².');
    steps.push({ title: 'Момент инерции относительно оси вращения', blocks: bl });
  }
  // 2. Моменты сил.
  const terms: Inline[][] = [];
  {
    const items: Inline[][] = [];
    if (e.M0) items.push([`постоянный вращающий момент M₀ = ${f(e.M0)} ${MU}`]), terms.push([sg(e.M0, true)]);
    e.loads.forEach((l, i) => {
      const P = byWeight ? l.m : l.m * G;
      items.push([`вес груза ${i + 1}: ${l.down ? '+' : '−'}P·r = ${l.down ? '' : '−'}${f(P)}·${f(l.r)} = ${f((l.down ? 1 : -1) * P * l.r)} ${MU} (груз ${l.down ? 'опускается' : 'поднимается'})`]);
    });
    if (e.loads.length) terms.push([sg(r.Mconst - e.M0, !terms.length)]);
    if (e.at) items.push([`момент, растущий со временем: a·t, a = ${f(e.at)}`]), terms.push([sg(e.at, !terms.length), '·', v('t')]);
    if (e.m0 && e.p) items.push([`гармонический момент m₀ sin pt, m₀ = ${f(e.m0)}, p = ${f(e.p)}`]), terms.push([sg(e.m0, !terms.length), '·sin(', f(e.p), v('t'), ')']);
    if (e.c) items.push([`упругий момент −cφ, c = ${f(e.c)}`]), terms.push([sg(-e.c, !terms.length), v('φ')]);
    if (e.Pa) items.push([`момент силы тяжести маятника −Pa·sin φ, Pa = ${f(e.Pa)}`]), terms.push([sg(-e.Pa, !terms.length), '·sin ', v('φ')]);
    if (e.kv) items.push([`вязкое сопротивление −kω, k = ${f(e.kv)}`]), terms.push([sg(-e.kv, !terms.length), v('ω')]);
    if (e.kq) items.push([`сопротивление, пропорциональное квадрату скорости: −kω|ω|, k = ${f(e.kq)}`]), terms.push([sg(-e.kq, !terms.length), v('ω'), '|', v('ω'), '|']);
    if (e.Mf) items.push([`момент сухого трения M_тр = ${f(e.Mf)} ${MU} — против вращения`]), terms.push([sg(-e.Mf, !terms.length), '·sign ', v('ω')]);
    const bl: Block[] = items.length ? [{ k: 'ul', items }] : [{ k: 'p', c: ['Моментов внешних сил относительно оси нет.'] }];
    ex(bl, 'Реакции оси (подшипников) момента относительно оси вращения не создают. Знак «+» — момент направлен в сторону положительного отсчёта угла φ.');
    steps.push({ title: 'Моменты внешних сил относительно оси', blocks: bl });
  }
  // 3. Уравнение и его решение.
  {
    const rhs: Inline[] = terms.length ? terms.flat() : ['0'];
    const lines: { num?: boolean; c: Inline[] }[] = [{ c: [v('J'), 'd', v('ω'), '/d', v('t'), ' = Σ', v('M'), sub('z'), ':  ', f(r.J), '·d', v('ω'), '/d', v('t'), ' = ', ...rhs] }];
    const bl: Block[] = [{ k: 'eq', lines }, { k: 'p', c: [`Начальные условия: φ(0) = ${f(e.phi0)} рад, ω(0) = ${f(e.omega0)} рад/с.`] }];
    const J = r.J,
      M = r.Mconst;
    const sol: { c: Inline[] }[] = [];
    if (r.kind === 'const') {
      const eps = (M - e.Mf * Math.sign(e.omega0 || M)) / J;
      sol.push({ c: ['ε = ΣM/J = ', b(f(eps)), ' рад/с² — постоянно'] }, { c: ['ω = ω₀ + εt,  φ = φ₀ + ω₀t + εt²/2'] });
    } else if (r.kind === 'viscous') {
      const wi = (M - e.Mf * Math.sign(e.omega0 || M)) / e.kv;
      sol.push({ c: [`ω = ω∞ + (ω₀ − ω∞)e^{−kt/J}, ω∞ = M/k = ${f(wi)} рад/с, J/k = ${f(J / e.kv)} с`] }, { c: ['φ = φ₀ + ω∞t + (ω₀ − ω∞)(J/k)(1 − e^{−kt/J})'] });
    } else if (r.kind === 'quadratic' || r.kind === 'omega') {
      sol.push({ c: ['Момент зависит только от ω — разделяем переменные: ', v('t'), ' = J∫dω/M(ω),  φ − φ₀ = J∫ω dω/M(ω)'] });
      if (r.kind === 'quadratic' && e.Mf === 0 && M > 0 && e.omega0 === 0) sol.push({ c: [`при ω₀ = 0: ω = √(M/k)·th(√(kM)·t/J), √(M/k) = ${f(Math.sqrt(M / e.kq))} рад/с — предельная скорость`] });
    } else if (r.kind === 'harmonic') {
      const k = Math.sqrt(e.c / J),
        ps = M / e.c;
      sol.push({ c: [`J·φ̈ + cφ = M: k = √(c/J) = ${f(k)} рад/с, положение равновесия φ* = M/c = ${f(ps)} рад`] }, { c: ['φ = φ* + (φ₀ − φ*)cos kt + (ω₀/k)sin kt'] });
    } else if (r.kind === 'time') {
      sol.push({ c: ['ω = ω₀ + (M₀t + at²/2)/J,  φ = φ₀ + ω₀t + (M₀t²/2 + at³/6)/J'] });
    } else sol.push({ c: ['Уравнение решаем численно (метод Рунге — Кутты четвёртого порядка с контролем шага).'] });
    bl.push({ k: 'eq', lines: sol });
    if (r.period != null) bl.push({ k: 'p', c: [`Период малых колебаний (sin φ ≈ φ): T = 2π√(J/(c + Pa)) = 2π√(${f(J)}/${f(e.c + e.Pa)}) = `, b(`${f(r.period)} с`)] });
    ex(bl, 'Дифференциальное уравнение вращения твёрдого тела вокруг неподвижной оси: произведение момента инерции на угловое ускорение равно сумме моментов внешних сил относительно оси (теорема об изменении кинетического момента K = Jω).');
    steps.push({ title: 'Дифференциальное уравнение вращения', blocks: bl });
  }
  // 4. Ответ.
  {
    const bl: Block[] = [];
    if (e.ask === 'omega') {
      if (r.note === 'never') bl.push({ k: 'badge', tone: 'bad', text: `угловая скорость ${f(e.omega1)} рад/с не достигается` });
      if (r.note === 'stuck') bl.push({ k: 'badge', tone: 'warn', text: `тело остановилось при t = ${f(r.tStop!)} с и дальше стоит` });
    } else if (r.tStop != null) bl.push({ k: 'badge', tone: 'warn', text: `тело остановилось при t = ${f(r.tStop)} с и дальше стоит (сухое трение)` });
    const lines = [
      { c: [v('t'), ' = ', b(`${f(r.t)} с`), e.ask === 'omega' ? ` — когда ω = ${f(e.omega1)} рад/с` : ''] as Inline[] },
      { c: [v('ω'), ' = ', b(`${f(r.w)} рад/с`), ` (${f((r.w * 30) / Math.PI)} об/мин)`] as Inline[] },
      { c: [v('φ'), ' = ', b(`${f(r.phi)} рад`), ` (${f(r.phi / (2 * Math.PI))} об.)`] as Inline[] },
      { c: ['ε = ', f(r.eps), ' рад/с²; кинетический момент ', v('K'), ' = Jω = ', f(r.J * r.w), `; кинетическая энергия Jω²/2 = ${f((r.J * r.w ** 2) / 2)}`] as Inline[] },
    ];
    bl.push({ k: 'eq', lines });
    steps.push({ title: 'Состояние в конце', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  if (r.note === 'ok' || e.ask === 't') {
    if (e.ask === 'omega') rows.push({ kind: 'main', val: [v('t'), ` = ${f(r.t)} с`], note: `до ω = ${f(e.omega1)} рад/с` });
    rows.push({ kind: 'main', val: [v('ω'), ` = ${f(r.w)} рад/с`], note: `${f((r.w * 30) / Math.PI)} об/мин` });
    rows.push({ kind: 'main', val: [v('φ'), ` = ${f(r.phi)} рад`], note: `${f(r.phi / (2 * Math.PI))} оборота` });
  }
  if (r.period != null) rows.push({ kind: 'aux', val: [v('T'), ` = ${f(r.period)} с`], note: 'период малых колебаний' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function kDoc(items: KItem[], byWeight: boolean, r: KResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] });
    return { steps };
  }
  const name = (it: KItem, i: number) => `${i + 1} (${it.name || (it.kind === 'body' ? 'тело' : 'точка')})`;
  {
    const lines = items.map((it, i) => {
      const row = r.items[i];
      return it.kind === 'body'
        ? { c: [v('K'), sub(String(i + 1)), ` = J₁ω₁ = ${f(it.J1)}·${f(it.w1)} = ${f(row.K1)}`, `  — ${name(it, i)}`] as Inline[] }
        : { c: [v('K'), sub(String(i + 1)), ` = m r(ωr + u) = ${f(row.mass)}·${f(it.r1)}·(${f(it.w1)}·${f(it.r1)} + ${f(it.u1)}) = ${f(row.K1)}`, `  — ${name(it, i)}`] as Inline[] };
    });
    lines.push({ c: [v('K'), ' = Σ', v('K'), sub('i'), ' = ', b(f(r.K))] });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (byWeight) bl.push({ k: 'p', c: [`Массы точек: m = P/g, g = ${f(G)} м/с².`] });
    ex(bl, 'Кинетический момент тела относительно оси вращения K = Jω; точки, движущейся по окружности радиуса r с абсолютной скоростью ωr + u (u — скорость относительно несущего тела), — m·r·(ωr + u).');
    steps.push({ title: 'Кинетический момент до', blocks: bl });
  }
  {
    const Js = items.map((it, i) => (it.kind === 'body' ? f(it.J2) : `${f(r.items[i].mass)}·${f(it.r2)}²`)).join(' + ');
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [v('K'), ' = (ΣJ)ω + Σm r u = ', `(${Js})ω`, r.Ku2 ? ` + ${f(r.Ku2)}` : ''] },
      { c: ['ΣJ = ', f(r.J2), ';  ω = (K − Σm r u)/ΣJ = (', f(r.K), ' − ', f(r.Ku2), ')/', f(r.J2), ' = ', b(`${f(r.w2)} рад/с`), ` (${f((r.w2 * 30) / Math.PI)} об/мин)`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.w2 < 0) bl.push({ k: 'p', c: ['Знак «−»: вращение после — в сторону, противоположную принятой положительной.'] });
    ex(bl, 'Моменты внешних сил относительно оси равны нулю (силы тяжести параллельны оси, реакции оси её пересекают), поэтому кинетический момент системы относительно оси сохраняется: внутренние силы (мышцы человека, пружины) могут перераспределить его между телами, но не изменить.');
    steps.push({ title: 'Закон сохранения кинетического момента', blocks: bl });
  }
  {
    const bl: Block[] = [{ k: 'p', c: [`Кинетическая энергия до: ${f(r.T1)}, после: ${f(r.T2)} — изменение ${f(r.T2 - r.T1)} равно работе внутренних сил.`] }];
    steps.push({ title: 'Кинетическая энергия', blocks: bl });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: [{ kind: 'main', val: [v('ω'), ` = ${f(r.w2)} рад/с`], note: `${f((r.w2 * 30) / Math.PI)} об/мин` }] }] });
  return { steps };
}
