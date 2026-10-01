/** Решение: масса и центробежные моменты, силы инерции, уравнения кинетостатики, реакции и давления. */
import { b, sub, sup, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { G } from '../../inertia/model/inertia';
import type { Reactions, ShaftProblem, ShaftResult } from '../model/shaft';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const KEYS: [keyof Reactions, string, string][] = [
  ['XA', 'X', 'A'],
  ['YA', 'Y', 'A'],
  ['ZA', 'Z', 'A'],
  ['XB', 'X', 'B'],
  ['YB', 'Y', 'B'],
];

export function shaftDoc(pr: ShaftProblem, r: ShaftResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] });
    return { steps };
  }
  const FU = pr.byWeight ? 'кГ' : 'Н';
  const MU = pr.byWeight ? 'кГ·м' : 'Н·м';
  const JU = pr.byWeight ? 'кГ·м·с²' : 'кг·м²';
  const w = pr.omega,
    e = pr.eps;
  // 1. Тело.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [v('M'), ` = ${f(r.M)} ${pr.byWeight ? 'кГ·с²/м' : 'кг'}`, pr.byWeight ? ` (вес ${f(r.M * G)} кГ)` : '', `;  центр масс C (${r.C.map(f).join('; ')})`] },
      { c: [v('J'), sub('xz'), ' = Σ', v('m'), v('x'), v('z'), ` = ${f(r.Jxz)};  `, v('J'), sub('yz'), ' = Σ', v('m'), v('y'), v('z'), ` = ${f(r.Jyz)};  `, v('J'), sub('z'), ` = ${f(r.Jz)} ${JU}`] },
    ];
    const bl: Block[] = [{ k: 'p', c: [`Оси x, y связаны с телом, z — ось вращения; подпятник A в точке z = ${f(pr.zA)}, подшипник B — z = ${f(pr.zB)}. ω = ${f(w)} рад/с, ε = ${f(e)} рад/с².`] }, { k: 'eq', lines }];
    ex(bl, 'Центробежные моменты J_xz, J_yz вычислены, как во вкладке «Геометрия масс»: для каждой части — свой центробежный момент плюс m·x_C·z_C (теорема Штейнера). Если J_xz = J_yz = 0, ось z — главная ось инерции в точке O; если к тому же центр масс на оси, она главная центральная, и динамических давлений нет.');
    steps.push({ title: 'Масса, центр масс и центробежные моменты', blocks: bl });
  }
  // 2. Силы инерции.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['Φ', sub('x'), ' = M(ω²x', sub('C'), ' + εy', sub('C'), `) = ${f(r.M)}·(${f(w)}²·${fp(r.C[0])} + ${fp(e)}·${fp(r.C[1])}) = `, b(f(r.Phi[0]))] },
      { c: ['Φ', sub('y'), ' = M(ω²y', sub('C'), ' − εx', sub('C'), `) = ${f(r.M)}·(${f(w)}²·${fp(r.C[1])} − ${fp(e)}·${fp(r.C[0])}) = `, b(f(r.Phi[1]))] },
      { c: ['M', sub('x'), sup('Φ'), ' = εJ', sub('xz'), ' − ω²J', sub('yz'), ` = ${fp(e)}·${fp(r.Jxz)} − ${f(w)}²·${fp(r.Jyz)} = `, b(f(r.MPhi[0]))] },
      { c: ['M', sub('y'), sup('Φ'), ' = εJ', sub('yz'), ' + ω²J', sub('xz'), ` = ${fp(e)}·${fp(r.Jyz)} + ${f(w)}²·${fp(r.Jxz)} = `, b(f(r.MPhi[1]))] },
      { c: ['M', sub('z'), sup('Φ'), ' = −εJ', sub('z'), ` = `, b(f(r.MPhi[2]))] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Сила инерции точки −m·a: центробежная mω²r (от оси) и вращательная mεr (против касательного ускорения). Силы инерции всех точек приводим к центру O: главный вектор Φ = −M·a_C, главный момент сил инерции относительно O равен −dK_O/dt. Принцип Даламбера: реакции, активные силы и силы инерции образуют уравновешенную систему.');
    steps.push({ title: 'Силы инерции, приведённые к центру O', blocks: bl });
  }
  // 3. Уравнения кинетостатики.
  {
    const g: Inline[] = pr.gravity === 'none' ? [] : [' + ', v('G'), sub(pr.gravity)];
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['ΣF', sub('x'), ' = ', v('X'), sub('A'), ' + ', v('X'), sub('B'), ' + Φ', sub('x'), ' = 0'] },
      { c: ['ΣF', sub('y'), ' = ', v('Y'), sub('A'), ' + ', v('Y'), sub('B'), ' + Φ', sub('y'), ...(pr.gravity === 'y' ? g : []), ' = 0'] },
      { c: ['ΣF', sub('z'), ' = ', v('Z'), sub('A'), ...(pr.gravity === 'z' ? g : []), ' = 0'] },
      { c: ['ΣM', sub('x'), ` = −${fp(pr.zA)}·`, v('Y'), sub('A'), ` − ${fp(pr.zB)}·`, v('Y'), sub('B'), ' + M', sub('x'), sup('Φ'), ' + M', sub('x'), sup('G'), ' = 0'] },
      { c: ['ΣM', sub('y'), ` = ${fp(pr.zA)}·`, v('X'), sub('A'), ` + ${fp(pr.zB)}·`, v('X'), sub('B'), ' + M', sub('y'), sup('Φ'), ' + M', sub('y'), sup('G'), ' = 0'] },
      { c: ['ΣM', sub('z'), ' = ', v('M'), sub('вр'), ' + M', sub('z'), sup('Φ'), ' + M', sub('z'), sup('G'), ' = 0 → ', v('M'), sub('вр'), ' = ', b(`${f(r.Mz)} ${MU}`)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    if (pr.gravity !== 'none') bl.push({ k: 'p', c: [`Сила тяжести ${f(-(pr.gravity === 'z' ? r.Gv[2] : r.Gv[1]))} ${FU} — вдоль −${pr.gravity}, приложена в C: её момент относительно O (${r.MG.map(f).join('; ')}).`] });
    ex(bl, 'Последнее уравнение даёт вращающий момент, который должен действовать на тело, чтобы оно вращалось с заданным ε (при ε = 0 и без сил тяжести он равен нулю).');
    steps.push({ title: 'Уравнения кинетостатики', blocks: bl });
  }
  // 4. Реакции.
  {
    const items: Inline[][] = KEYS.map(([k, L, S]) => [v(L), sub(S), ` = ${f(r.stat[k])} + ${fp(r.dyn[k])} = `, b(`${f(r.total[k])} ${FU}`), '  (статическая + динамическая)']);
    const NA = Math.hypot(r.dyn.XA, r.dyn.YA),
      NB = Math.hypot(r.dyn.XB, r.dyn.YB);
    const bl: Block[] = [
      { k: 'ul', items },
      { k: 'p', c: [`Модули динамических радиальных давлений: на A — ${f(NA)} ${FU}, на B — ${f(NB)} ${FU}. Давления на опоры равны реакциям по модулю и противоположны по направлению.`] },
    ];
    if (NA < 1e-9 && NB < 1e-9 && (w !== 0 || e !== 0)) bl.push({ k: 'badge', tone: 'ok', text: 'динамических давлений нет: тело уравновешено' });
    ex(bl, 'Статические реакции — от силы тяжести, динамические — от сил инерции; динамические растут как ω² и при быстром вращении могут во много раз превышать статические (см. 42.1, 42.11).');
    steps.push({ title: 'Реакции опор', blocks: bl });
  }
  const rows: AnswerRow[] = KEYS.map(([k, L, S]) => ({ kind: 'main' as const, val: [v(L), sub(S), ` = ${f(r.total[k])} ${FU}`], note: `динамическая часть ${f(r.dyn[k])}` }));
  rows.push({ kind: 'aux', val: [v('M'), sub('вр'), ` = ${f(r.Mz)} ${MU}`], note: 'вращающий момент' });
  steps.push({ title: 'Ответ (реакции; давления на опоры — с обратным знаком)', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
