/** Решение: закон движения, траектория, производные, скорость, ускорение (касательное и нормальное), радиус кривизны. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { torA, type KinProblem, type KinResult } from '../model/kin';
import { trajEquation, type TrajEq } from '../model/traj';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const D1: Record<string, string> = { x: 'ẋ', y: 'ẏ', z: 'ż', s: 'ṡ', r: 'ṙ', φ: 'φ′', θ: 'θ′', ψ: 'ψ′' };
const D2: Record<string, string> = { x: 'ẍ', y: 'ÿ', z: 'z̈', s: 's̈', r: 'r̈', φ: 'φ″', θ: 'θ″', ψ: 'ψ″' };
const HOW: Record<KinProblem['mode'], string> = {
  coord: 'координатный',
  natural: 'естественный (закон движения по траектории)',
  polar: 'в полярных координатах',
  cyl: 'в цилиндрических координатах r, φ, z',
  sph: 'в сферических координатах: r, долгота φ, широта θ (угол с плоскостью xy)',
  tor: 'в тороидальных координатах: r, долгота ψ, угол в сечении φ',
  uni: 'равнопеременное движение',
  path: 'путь по траектории',
  integ: 'интегрирование ускорения',
  harm: 'гармоническое колебание',
  shot: 'бросок под углом к горизонту',
  cam: 'кулачок',
  comp: 'составная задача',
  conv: 'пересчёт координат',
};

/** Шаг «Траектория»: уравнение (исключение t), вид кривой, начальная точка и пределы координат. */
export function trajStep(pr: KinProblem, e: TrajEq, opts: { explain?: boolean }): Step {
  const bl: Block[] = [];
  const [ta, tb] = pr.t2 > pr.t1 ? [pr.t1, pr.t2] : [Math.min(0, pr.t), Math.max(pr.t, 1)];
  if (e.dims === 3 && e.rels.length) bl.push({ k: 'p', c: ['Траектория пространственная; уравнения её проекций на координатные плоскости — цилиндрические поверхности, на пересечении которых она лежит:'] });
  const lines: { c: Inline[] }[] = [];
  for (const r of e.rels) {
    lines.push({ c: [e.dims === 3 ? `на плоскость ${r.a}${r.b}: ` : '', b(r.text), r.explicit && r.explicit !== r.text ? `,  т. е. ${r.explicit}` : '', ` — ${r.kind}`] });
    if (r.detail) lines.push({ c: [`  ${r.detail}`] });
  }
  if (lines.length) bl.push({ k: 'eq', lines });
  for (const [a, c] of e.none) bl.push({ k: 'p', c: [`Между ${a} и ${c} алгебраической связи (многочлена степени до четвёртой) нет — уравнение траектории в этой проекции не алгебраическое (циклоида, спираль, винтовая линия…).`] });
  const ax = e.dims === 3 ? [0, 1, 2] : [0, 1];
  const nm = ['x', 'y', 'z'];
  bl.push({
    k: 'p',
    c: [`При t = ${f(ta)} точка в (${ax.map((i) => f(e.start[i])).join('; ')}); на отрезке t от ${f(ta)} до ${f(tb)} `, ax.map((i) => `${nm[i]} — от ${f(e.range[i][0])} до ${f(e.range[i][1])}`).join(', '), ' (часть кривой, которую проходит точка).'],
  });
  if (opts.explain)
    bl.push({
      k: 'p',
      cls: 'explain',
      c: ['Чтобы получить уравнение траектории, из уравнений движения исключают время t. Здесь ищется многочлен наименьшей степени, обращающийся в нуль во всех точках траектории; коэффициенты приводятся к целым, если это возможно.'],
    });
  return { title: 'Траектория', blocks: bl };
}

export function kinDoc(pr: KinProblem, r: KinResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  // Пустые координаты (z у плоского движения) не показываем.
  const used = r.f.filter((q) => !((pr.mode === 'coord' || pr.mode === 'cyl') && ['x', 'y', 'z'].includes(q.name) && !pr[q.name as 'x' | 'y' | 'z'].trim()));
  const how = HOW[pr.mode];
  const traj = trajEquation(pr, r);
  {
    const lines = used.map((q) => ({ c: [v(q.name), `(t) = ${printExpr(q.e)}`] as Inline[] }));
    const bl: Block[] = [{ k: 'p', c: [`Способ задания движения — ${how}.${pr.mode === 'natural' ? ` Радиус кривизны траектории ρ = ${pr.rho > 0 ? f(pr.rho) : '∞ (прямая)'}.` : ''}`] }, { k: 'eq', lines }];
    steps.push({ title: 'Закон движения', blocks: bl });
  }
  if (traj) steps.push(trajStep(pr, traj, opts));
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    for (const q of used) lines.push({ c: [v(D1[q.name]), ` = ${printExpr(q.d1)}`] });
    for (const q of used) lines.push({ c: [v(D2[q.name]), ` = ${printExpr(q.d2)}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Скорость — первая производная, ускорение — вторая производная от закона движения по времени.');
    steps.push({ title: 'Производные', blocks: bl });
  }
  {
    const t = f(pr.t);
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (pr.mode === 'coord') {
      const ax = ['x', 'y', 'z'].filter((_, i) => i < 2 || pr.z.trim() !== '');
      lines.push({ c: [`при t = ${t}: положение (${ax.map((_, i) => f(r.pos[i])).join('; ')})`] });
      lines.push({ c: [v('v'), ' = √(', ax.map((n) => `${D1[n]}²`).join(' + '), `) = √(${ax.map((_, i) => `${fp(r.vel[i])}²`).join(' + ')}) = `, b(f(r.v))] });
      lines.push({ c: [v('a'), ' = √(', ax.map((n) => `${D2[n]}²`).join(' + '), `) = √(${ax.map((_, i) => `${fp(r.acc[i])}²`).join(' + ')}) = `, b(f(r.a))] });
      if (r.vAngles) lines.push({ c: [`cos(v, x) = ${f(r.vel[0] / r.v)} → угол скорости с осью x ${f(r.vAngles[0])}°`, r.aAngles ? `;  угол ускорения с осью x ${f(r.aAngles[0])}°` : ''] });
      lines.push({ c: [v('a'), sub('τ'), ' = (v·a)/v = ', b(f(r.at)), ';  ', v('a'), sub('n'), ' = |v × a|/v = ', b(f(r.an))] });
    } else if (pr.mode === 'natural') {
      lines.push({ c: [`при t = ${t}: s = ${f(r.pos[0])};  `, v('v'), ' = |ṡ| = ', b(f(r.v))] });
      lines.push({ c: [v('a'), sub('τ'), ' = s̈ = ', b(f(r.at)), ';  ', v('a'), sub('n'), ` = v²/ρ = ${pr.rho > 0 ? `${f(r.v)}²/${f(pr.rho)} = ` : ''}`, b(f(r.an))] });
      lines.push({ c: [v('a'), ' = √(a', sub('τ'), '² + a', sub('n'), `²) = `, b(f(r.a))] });
    } else if (pr.mode === 'tor') {
      const c = r.curv!;
      const deg = (x: number) => f((x * 180) / Math.PI);
      const aT = f(torA(pr, []));
      lines.push({ c: [`при t = ${t}: r = ${f(c.q[0])}, ψ = ${f(c.q[1])} рад (${deg(c.q[1])}°), φ = ${f(c.q[2])} рад (${deg(c.q[2])}°);  a = ${aT}`] });
      lines.push({ c: ['x = (a + r cos φ) cos ψ,  y = (a + r cos φ) sin ψ,  z = r sin φ;  коэффициенты Ляме H', sub('r'), ' = 1, H', sub('ψ'), ' = a + r cos φ, H', sub('φ'), ' = r'] });
      lines.push({ c: [v('v'), sub('r'), ' = ṙ = ', b(f(c.v[0])), ';  ', v('v'), sub('ψ'), ' = (a + r cos φ)ψ′ = ', b(f(c.v[1])), ';  ', v('v'), sub('φ'), ' = rφ′ = ', b(f(c.v[2])), ';  ', v('v'), ' = ', b(f(r.v))] });
      lines.push({ c: [v('a'), sub('r'), ' = r̈ − (a + r cos φ)cos φ·ψ′² − rφ′² = ', b(f(c.a[0]))] });
      lines.push({ c: [v('a'), sub('ψ'), ' = (a + r cos φ)ψ″ + 2(ṙ cos φ − rφ′ sin φ)ψ′ = ', b(f(c.a[1]))] });
      lines.push({ c: [v('a'), sub('φ'), ' = rφ″ + 2ṙφ′ + (a + r cos φ) sin φ·ψ′² = ', b(f(c.a[2]))] });
      lines.push({ c: [v('a'), ' = ', b(f(r.a)), ';  ', v('a'), sub('τ'), ` = ${f(r.at)};  `, v('a'), sub('n'), ` = ${f(r.an)}`] });
    } else if (pr.mode === 'cyl' || pr.mode === 'sph') {
      const c = r.curv!;
      const sph = pr.mode === 'sph';
      const deg = (x: number) => f((x * 180) / Math.PI);
      lines.push({ c: [`при t = ${t}: r = ${f(c.q[0])}, φ = ${f(c.q[1])} рад (${deg(c.q[1])}°), `, sph ? `θ = ${f(c.q[2])} рад (${deg(c.q[2])}°)` : `z = ${f(c.q[2])}`] });
      lines.push({
        c: [v('v'), sub('r'), ' = ṙ = ', b(f(c.v[0])), ';  ', v('v'), sub('φ'), sph ? ' = rφ′ cos θ = ' : ' = rφ′ = ', b(f(c.v[1])), ';  ', v('v'), sub(sph ? 'θ' : 'z'), sph ? ' = rθ′ = ' : ' = ż = ', b(f(c.v[2])), ';  ', v('v'), ' = ', b(f(r.v))],
      });
      if (sph) {
        lines.push({ c: [v('a'), sub('r'), ' = r̈ − rθ′² − rφ′² cos²θ = ', b(f(c.a[0]))] });
        lines.push({ c: [v('a'), sub('φ'), ' = (rφ″ + 2ṙφ′) cos θ − 2rφ′θ′ sin θ = ', b(f(c.a[1]))] });
        lines.push({ c: [v('a'), sub('θ'), ' = rθ″ + 2ṙθ′ + rφ′² sin θ cos θ = ', b(f(c.a[2]))] });
      } else lines.push({ c: [v('a'), sub('r'), ' = r̈ − rφ′² = ', b(f(c.a[0])), ';  ', v('a'), sub('φ'), ' = rφ″ + 2ṙφ′ = ', b(f(c.a[1])), ';  ', v('a'), sub('z'), ' = z̈ = ', b(f(c.a[2]))] });
      lines.push({ c: [v('a'), ' = ', b(f(r.a)), ';  ', v('a'), sub('τ'), ` = ${f(r.at)};  `, v('a'), sub('n'), ` = ${f(r.an)}`] });
    } else {
      const p = r.polar!;
      lines.push({ c: [`при t = ${t}: r = ${f(p.r)}, φ = ${f(p.phi)} рад (${f((p.phi * 180) / Math.PI)}°)`] });
      lines.push({ c: [v('v'), sub('r'), ' = ṙ = ', b(f(p.vr)), ';  ', v('v'), sub('φ'), ' = rφ′ = ', b(f(p.vphi)), ';  ', v('v'), ' = ', b(f(r.v))] });
      lines.push({ c: [v('a'), sub('r'), ' = r̈ − rφ′² = ', b(f(p.ar)), ';  ', v('a'), sub('φ'), ' = rφ″ + 2ṙφ′ = ', b(f(p.aphi)), ';  ', v('a'), ' = ', b(f(r.a))] });
      lines.push({ c: [v('a'), sub('τ'), ` = ${f(r.at)};  `, v('a'), sub('n'), ` = ${f(r.an)}`] });
    }
    lines.push({ c: ['радиус кривизны ρ = v²/a', sub('n'), ' = ', r.rho != null ? b(f(r.rho)) : '∞', r.rho == null ? (pr.mode === 'natural' ? ' (прямая)' : ' (a_n = 0: точка перегиба или прямолинейный участок)') : ''] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Касательное ускорение a_τ = dv/dt меняет величину скорости, нормальное a_n = v²/ρ — её направление; полное ускорение a = √(a_τ² + a_n²). В полярных координатах v_r и v_φ — радиальная и поперечная составляющие скорости.',
      pr.mode === 'sph' ? ' В сферических координатах орт e_θ направлен в сторону роста широты (к северу), e_φ — в сторону роста долготы.' : '',
    );
    steps.push({ title: 'Скорость, ускорение, радиус кривизны', blocks: bl });
  }
  if (r.hodo) {
    const h = r.hodo;
    const cyl = pr.mode === 'cyl';
    const lines: { c: Inline[] }[] = [
      { c: ['годограф — кривая, которую описывает конец вектора скорости, отложенного от неподвижной точки; его точка M', sub('1'), ' имеет радиус-вектор ', v('v'), ' (в проекции на плоскость r, φ)'] },
      { c: ['r', sub('1'), ' = ', v('v'), sub('xy'), ' = ', b(f(h.r)), ';  φ', sub('1'), ` = направление скорости = ${f(h.phi)} рад (${f((h.phi * 180) / Math.PI)}°)`, cyl ? [';  z', sub('1'), ' = ', v('v'), sub('z'), ' = ', b(f(h.z!))] : ''].flat() as Inline[] },
      { c: ['скорость M', sub('1'), ' равна ускорению M:  ', v('v'), sub('r1'), ' = ', v('a'), sub('τ'), ' = ', b(f(h.vr)), ';  ', v('v'), sub('φ1'), ' = ', v('a'), sub('n'), ' = ', b(f(h.vphi)), cyl ? [';  ', v('v'), sub('z1'), ' = ', v('a'), sub('z'), ' = ', b(f(h.vz!))] : ''].flat() as Inline[] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Скорость точки M₁, описывающей годограф, по теореме Резаля равна ускорению точки M. Проекции берутся на орты той же системы координат, но в точке M₁ (орт e_r1 направлен вдоль скорости M, e_φ1 повёрнут на 90° против часовой стрелки).');
    steps.push({ title: 'Годограф скорости', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('v'), ` = ${f(r.v)}`], note: `при t = ${f(pr.t)}` },
    { kind: 'main', val: [v('a'), ` = ${f(r.a)}`], note: 'полное ускорение' },
    { kind: 'main', val: [v('a'), sub('τ'), ` = ${f(r.at)}, `, v('a'), sub('n'), ` = ${f(r.an)}`], note: 'касательное и нормальное' },
    { kind: 'aux', val: [`ρ = ${r.rho != null ? f(r.rho) : '∞'}`], note: 'радиус кривизны' },
  ];
  if (traj?.rels.length) rows.unshift({ kind: 'main', val: [traj.rels.map((x) => x.text).join(';  ')], note: `траектория — ${traj.rels.map((x) => x.kind).join(', ')}` });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
