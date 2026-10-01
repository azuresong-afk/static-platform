/** Решение: закон движения, производные, скорость, ускорение (касательное и нормальное), радиус кривизны. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { KinProblem, KinResult } from '../model/kin';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const D1: Record<string, string> = { x: 'ẋ', y: 'ẏ', z: 'ż', s: 'ṡ', r: 'ṙ', φ: 'φ′' };
const D2: Record<string, string> = { x: 'ẍ', y: 'ÿ', z: 'z̈', s: 's̈', r: 'r̈', φ: 'φ″' };

export function kinDoc(pr: KinProblem, r: KinResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  const used = r.f.filter((q) => pr.mode !== 'coord' || pr[q.name as 'x' | 'y' | 'z'].trim() !== '');
  const how = pr.mode === 'coord' ? 'координатный' : pr.mode === 'natural' ? 'естественный (закон движения по траектории)' : 'в полярных координатах';
  {
    const lines = used.map((q) => ({ c: [v(q.name), `(t) = ${printExpr(q.e)}`] as Inline[] }));
    const bl: Block[] = [{ k: 'p', c: [`Способ задания движения — ${how}.${pr.mode === 'natural' ? ` Радиус кривизны траектории ρ = ${pr.rho > 0 ? f(pr.rho) : '∞ (прямая)'}.` : ''}`] }, { k: 'eq', lines }];
    steps.push({ title: 'Закон движения', blocks: bl });
  }
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
    } else {
      const p = r.polar!;
      lines.push({ c: [`при t = ${t}: r = ${f(p.r)}, φ = ${f(p.phi)} рад (${f((p.phi * 180) / Math.PI)}°)`] });
      lines.push({ c: [v('v'), sub('r'), ' = ṙ = ', b(f(p.vr)), ';  ', v('v'), sub('φ'), ' = rφ′ = ', b(f(p.vphi)), ';  ', v('v'), ' = ', b(f(r.v))] });
      lines.push({ c: [v('a'), sub('r'), ' = r̈ − rφ′² = ', b(f(p.ar)), ';  ', v('a'), sub('φ'), ' = rφ″ + 2ṙφ′ = ', b(f(p.aphi)), ';  ', v('a'), ' = ', b(f(r.a))] });
      lines.push({ c: [v('a'), sub('τ'), ` = ${f(r.at)};  `, v('a'), sub('n'), ` = ${f(r.an)}`] });
    }
    lines.push({ c: ['радиус кривизны ρ = v²/a', sub('n'), ' = ', r.rho != null ? b(f(r.rho)) : '∞', r.rho == null ? (pr.mode === 'natural' ? ' (прямая)' : ' (a_n = 0: точка перегиба или прямолинейный участок)') : ''] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Касательное ускорение a_τ = dv/dt меняет величину скорости, нормальное a_n = v²/ρ — её направление; полное ускорение a = √(a_τ² + a_n²). В полярных координатах v_r и v_φ — радиальная и поперечная составляющие скорости.');
    steps.push({ title: 'Скорость, ускорение, радиус кривизны', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('v'), ` = ${f(r.v)}`], note: `при t = ${f(pr.t)}` },
    { kind: 'main', val: [v('a'), ` = ${f(r.a)}`], note: 'полное ускорение' },
    { kind: 'main', val: [v('a'), sub('τ'), ` = ${f(r.at)}, `, v('a'), sub('n'), ` = ${f(r.an)}`], note: 'касательное и нормальное' },
    { kind: 'aux', val: [`ρ = ${r.rho != null ? f(r.rho) : '∞'}`], note: 'радиус кривизны' },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
