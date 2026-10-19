/**
 * Решение по шагам для пяти режимов вкладки «Пространственное движение»: сложение вращений вокруг пересекающихся
 * осей, ориентация и угловая скорость по углам Эйлера, дифференциальная передача, кинематический винт, гироскоп.
 */
import { b, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { prettyName, setCoordNames, symText, varName } from '../../../shared/sym';
import { norm, type V3 } from '../../converging/model/forces';
import { num } from '../../orbit/text/solution';
import { RPM, type ComposeOut, type ComposeProblem } from '../model/compose';
import type { DiffOut, DiffProblem } from '../model/diff';
import type { EulerOut, EulerProblem } from '../model/euler';
import { precessionRate, type GyroOut, type GyroProblem } from '../model/gyro';
import type { ScrewOut, ScrewProblem } from '../model/screw';
import type { SpState } from '../presets';

const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const sb = (i: number) => String(i).replace(/\d/g, (x) => SUBD[+x]);
const nm = (x: number, d = 5) => {
  const t = num(x, d);
  return /^−|·/.test(t) ? `(${t})` : t;
};
const vec = (v: V3, d = 5) => `(${v.map((x) => num(Math.abs(x) < 1e-12 * Math.max(1e-300, norm(v)) ? 0 : x, d)).join('; ')})`;
const degs = (r: number) => `${num((r * 180) / Math.PI, 4)}°`;
/** Угол в градусах и минутах (как в задачнике). */
function dms(r: number): string {
  let d = (r * 180) / Math.PI;
  let m = Math.round((d - Math.floor(d)) * 60);
  d = Math.floor(d);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return `${d}°${String(m).padStart(2, '0')}′`;
}
const bad = (error: string): Doc => ({
  steps: [
    {
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'p', c: [error] },
      ],
    },
  ],
});
type Ex = (bl: Block[], ...c: Inline[]) => void;
const AXN = ['x', 'y', 'z'];

/* ───────────── Сложение вращений ───────────── */

function composeDoc(pr: ComposeProblem, r: ComposeOut, ex: Ex): Doc {
  if (!r.ok) return bad(r.error);
  const steps: Step[] = [];
  const ans: AnswerRow[] = [];
  const rpm = pr.unit === 'rpm';
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Неподвижная точка O — начало осей Oxyz. Переносное вращение — вокруг оси ',
        b('Oz'),
        ', относительное — вокруг оси тела ',
        b('e'),
        ` в плоскости Oyz под углом α = ${num(pr.alpha)}° к Oz: e = ${vec(r.e)}.`,
      ],
    });
    const lines: { c: Inline[] }[] = [];
    if (pr.scale === 'period') lines.push({ c: [`ωₑ = 2π/T = 2π/${nm(pr.T)} = `, b(`${num(r.we)} с⁻¹`)] });
    else if (pr.scale === 'we') lines.push({ c: [rpm ? `ωₑ = πn/30 = π·${nm(pr.we)}/30 = ` : 'ωₑ = ', b(`${num(r.we)} с⁻¹`)] });
    if (r.ratio != null && r.u) {
      bl.push({
        k: 'p',
        c: [
          'Качение без скольжения: точки тела на линии касания неподвижны, значит, ω направлена по ней — по прямой OP под углом ',
          `γ = ${num(pr.gamma)}° к Oz, u = ${vec(r.u)}. Условие (ωₑk + ωᵣe) × u = 0 даёт `,
          b('ωᵣ = ωₑ·sin γ / sin(α − γ)'),
          `, ωᵣ/ωₑ = sin ${num(pr.gamma)}°/sin(${num(pr.alpha - pr.gamma)}°) = ${num(r.ratio)}.`,
        ],
      });
      if (pr.scale === 'point') {
        const p = pr.points[pr.pi];
        bl.push({
          k: 'p',
          c: [
            `Масштаб задан скоростью точки ${p.name}: при ωₑ = 1 её скорость |(k + ${nm(r.ratio)}e) × r| = ${num(pr.vp / r.we)}, поэтому ωₑ = ${num(pr.vp)}/${nm(pr.vp / r.we)} = `,
            b(`${num(r.we)} с⁻¹`),
            '.',
          ],
        });
      }
      lines.push({ c: [`ωᵣ = ${nm(r.ratio)}·ωₑ = `, b(`${num(r.wr)} с⁻¹`), r.wr < 0 ? ' (против орта e)' : ''] });
      if (r.ee) lines.push({ c: [`εᵣ = ${nm(r.ratio)}·εₑ = ${num(r.er)} с⁻²`] });
    } else lines.push({ c: [rpm ? `ωᵣ = π·${nm(pr.wr)}/30 = ` : 'ωᵣ = ', b(`${num(r.wr)} с⁻¹`)] });
    if (r.ee || r.er) lines.push({ c: [`εₑ = ${num(r.ee)} с⁻², εᵣ = ${num(r.er)} с⁻²`] });
    bl.push({ k: 'eq', lines });
    ex(
      bl,
      'Знак угловой скорости — по правилу правого винта вдоль орта оси (k для переносной, e для относительной). Оба вращения — вокруг осей, проходящих через неподвижную точку, поэтому тело вращается вокруг этой точки.',
    );
    steps.push({ title: 'Оси и угловые скорости', blocks: bl });
  }
  {
    const bl: Block[] = [];
    const wn = norm(r.w);
    bl.push({
      k: 'eq',
      lines: [
        { c: ['ω = ωₑk + ωᵣe = ', vec(r.w)] },
        { c: [`|ω| = √(ωₑ² + ωᵣ² + 2ωₑωᵣ cos α) = √(${nm(r.we)}² + ${nm(r.wr)}² + 2·${nm(r.we)}·${nm(r.wr)}·cos ${num(pr.alpha)}°) = `, b(`${num(wn)} с⁻¹`)] },
      ],
    });
    if (wn > 0) {
      bl.push({
        k: 'p',
        c: [
          'Мгновенная ось — прямая через O по ω; углы ω с осями: ',
          [0, 1, 2].map((i) => `с ${AXN[i]} — ${dms(Math.acos(Math.max(-1, Math.min(1, r.w[i] / wn))))}`).join(', '),
          `; с осью тела — ${dms(r.axMoving)}.`,
        ],
      });
      if (rpm) bl.push({ k: 'p', c: [`|ω| = ${num(wn / RPM)} об/мин.`] });
    }
    ex(bl, 'Угловые скорости вращений вокруг пересекающихся осей складываются как векторы (по правилу параллелограмма).');
    steps.push({ title: 'Абсолютная угловая скорость', blocks: bl });
    ans.push({ kind: 'main', val: [`ω = ${num(wn)} с⁻¹`], note: `абсолютная угловая скорость ${vec(r.w)}` });
    if (r.ratio != null) ans.push({ kind: 'aux', val: [`ωₑ = ${num(r.we)} с⁻¹, ωᵣ = ${num(r.wr)} с⁻¹`], note: 'переносная и относительная угловые скорости' });
  }
  {
    const bl: Block[] = [];
    const [p1, p2, p3] = r.epsParts;
    bl.push({ k: 'p', c: ['Ось тела поворачивается вместе с переносным вращением, поэтому производная ωᵣe содержит член ωₑk × ωᵣe:'] });
    const lines: { c: Inline[] }[] = [{ c: ['ε = εₑk + εᵣe + ωₑk × ωᵣe'] }];
    if (norm(p1) || norm(p2)) lines.push({ c: [`εₑk = ${vec(p1)}, εᵣe = ${vec(p2)}`] });
    lines.push({ c: [`ωₑ × ωᵣ = ωₑωᵣ sin α·(k × e)/|k × e| = ${vec(p3)}`] });
    lines.push({ c: ['ε = ', vec(r.eps), ', |ε| = ', b(`${num(norm(r.eps))} с⁻²`)] });
    bl.push({ k: 'eq', lines });
    ex(bl, 'При постоянных ωₑ и ωᵣ угловое ускорение равно скорости конца вектора ω: ε = ωₑ × ω — оно перпендикулярно плоскости осей.');
    steps.push({ title: 'Угловое ускорение', blocks: bl });
    ans.push({ kind: 'main', val: [`ε = ${num(norm(r.eps))} с⁻²`], note: `угловое ускорение ${vec(r.eps)}` });
  }
  if (!r.ee && !r.er && norm(r.w) > 0) {
    const bl: Block[] = [];
    const R = norm(r.w) * Math.sin(r.axFixed);
    bl.push({
      k: 'p',
      c: [
        'ωₑ и ωᵣ постоянны: ω сохраняет величину и поворачивается вокруг Oz с ωₑ. Неподвижный аксоид — круговой конус с осью Oz и полууглом ',
        b(dms(r.axFixed)),
        ` (угол при вершине ${dms(2 * Math.min(r.axFixed, Math.PI - r.axFixed))}), подвижный — конус с осью тела и полууглом `,
        b(dms(r.axMoving)),
        ` (угол при вершине ${dms(2 * Math.min(r.axMoving, Math.PI - r.axMoving))}); подвижный катится по неподвижному. Годограф ω — окружность радиуса ${num(R)} с⁻¹ в плоскости z = ${num(r.w[2])}: ω_x = ${num(R)} cos ${nm(r.we)}t, ω_y = ${num(R)} sin ${nm(r.we)}t (от положения, где ω в плоскости Oyz).`,
      ],
    });
    steps.push({ title: 'Аксоиды и годограф угловой скорости', blocks: bl });
  }
  if (r.points.length) {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: ['Скорость точки тела v = ω × r (вращение вокруг мгновенной оси), ускорение a = ε × r + ω × (ω × r) — вращательное и осестремительное:'],
    });
    for (const q of r.points) {
      bl.push({
        k: 'eq',
        lines: [
          { c: [`${q.name}: r = ${vec(q.r)}`] },
          { c: [`v = ω × r = ${vec(q.v)}, |v| = `, b(num(norm(q.v))), Number.isFinite(q.h) ? `; до мгновенной оси h = ${num(q.h)}` : ''] },
          { c: [`ε × r = ${vec(q.aE)}, ω × v = ${vec(q.aW)}`] },
          { c: [`a = ${vec(q.a)}, |a| = `, b(num(norm(q.a)))] },
        ],
      });
      ans.push({
        kind: 'main',
        val: [`v_${q.name} = ${num(norm(q.v))}, a_${q.name} = ${num(norm(q.a))}`],
        note: `скорость ${vec(q.v)}, ускорение ${vec(q.a)}`,
      });
    }
    ex(bl, 'Точки на мгновенной оси (h = 0) неподвижны в данный момент; их ускорение — только вращательное ε × r.');
    steps.push({ title: 'Скорости и ускорения точек', blocks: bl });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}

/* ───────────── Углы Эйлера ───────────── */

const FIX = ['ξ', 'η', 'ζ'];
function eulerDoc(pr: EulerProblem, r: EulerOut, ex: Ex): Doc {
  if (!r.ok) return bad(r.error);
  setCoordNames(r.names);
  const steps: Step[] = [];
  const ans: AnswerRow[] = [];
  const nmQ = r.names.map((n) => prettyName(n));
  const seq = pr.seq.split('');
  {
    const bl: Block[] = [];
    const FX: Record<string, string> = { x: 'ξ', y: 'η', z: 'ζ' };
    bl.push({
      k: 'p',
      c: [
        'Неподвижные оси Oξηζ, оси тела Oxyz (до поворотов совпадают с ними). Повороты: ',
        b(`${nmQ[0]} вокруг O${FX[seq[0]]}`),
        ', затем ',
        b(`${nmQ[1]} вокруг повёрнутой оси ${seq[1]}′`),
        ', затем ',
        b(`${nmQ[2]} вокруг оси тела ${seq[2]}`),
        ` (последовательность ${seq.join('–')}). Матрица R = R${sb(1)}(${nmQ[0]})·R${sb(2)}(${nmQ[1]})·R${sb(3)}(${nmQ[2]}); её столбцы — орты осей тела.`,
      ],
    });
    const lines: { c: Inline[] }[] = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) lines.push({ c: [`cos(${AXN[j]}, ${FIX[i]}) = `, symText(r.sym.R[i][j])] });
    bl.push({ k: 'p', c: ['Направляющие косинусы осей тела:'] }, { k: 'eq', lines });
    ex(
      bl,
      'Поворот вокруг оси x на угол q: y → y cos q + z sin q (матрица [[1, 0, 0], [0, cos q, −sin q], [0, sin q, cos q]]); второй и третий повороты — вокруг уже повёрнутых осей, поэтому матрицы умножаются справа.',
    );
    steps.push({ title: 'Ориентация тела', blocks: bl });
  }
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Угловая скорость — сумма угловых скоростей трёх поворотов, каждая — вдоль своей оси: ',
        b(`ω = ${varName(nmQ[0], 1)}·a₁ + ${varName(nmQ[1], 1)}·a₂′ + ${varName(nmQ[2], 1)}·a₃″`),
        ':',
      ],
    });
    bl.push({ k: 'eq', lines: [0, 1, 2].map((i) => ({ c: [`ω_${FIX[i]} = `, symText(r.sym.wFixed[i])] as Inline[] })) });
    bl.push({ k: 'eq', lines: [0, 1, 2].map((i) => ({ c: [`ω_${AXN[i]} = `, symText(r.sym.wBody[i])] as Inline[] })) });
    ex(
      bl,
      'Проекции на неподвижные оси получаются поворотом ортов a₂, a₃ первыми поворотами, на оси тела — обратными поворотами (кинематические уравнения Эйлера).',
    );
    steps.push({ title: 'Кинематические формулы Эйлера', blocks: bl });
  }
  {
    const bl: Block[] = [];
    bl.push({ k: 'p', c: [`Законы: ${nmQ.map((n, i) => `${n} = ${pr.laws[i].trim() || '0'}`).join(', ')}; момент t₁ = ${num(pr.t1)} с:`] });
    bl.push({
      k: 'eq',
      lines: [
        { c: [nmQ.map((n, i) => `${n} = ${num(r.q[i])} рад (${num((r.q[i] * 180) / Math.PI, 4)}°)`).join(', ')] },
        { c: [nmQ.map((n, i) => `${varName(n, 1)} = ${num(r.dq[i])}`).join(', '), ' с⁻¹'] },
        { c: ['ω = ', vec(r.w), ' (в осях ξηζ) = ', vec(r.wBody), ' (в осях xyz)'] },
        { c: ['|ω| = ', b(`${num(norm(r.w))} с⁻¹`)] },
      ],
    });
    if (r.wOfT)
      bl.push({
        k: 'p',
        c: ['Годограф угловой скорости (проекции на неподвижные оси): ', r.wOfT.map((s, i) => `ω_${FIX[i]} = ${symText(s)}`).join(', '), '.'],
      });
    bl.push({
      k: 'eq',
      lines: [{ c: ['ε = dω/dt = ', vec(r.eps), ' (в осях ξηζ) = ', vec(r.epsBody), ' (в осях xyz)'] }, { c: ['|ε| = ', b(`${num(norm(r.eps))} с⁻²`)] }],
    });
    ex(
      bl,
      'ε — производная по времени от проекций ω на неподвижные оси (скорость конца вектора ω); её проекции на оси тела равны производным проекций ω на эти же оси.',
    );
    steps.push({ title: 'Угловая скорость и ускорение', blocks: bl });
    ans.push({ kind: 'main', val: [`ω = ${num(norm(r.w))} с⁻¹`], note: `проекции на ξ, η, ζ: ${vec(r.w)}; на x, y, z: ${vec(r.wBody)}` });
    ans.push({ kind: 'main', val: [`ε = ${num(norm(r.eps))} с⁻²`], note: `проекции на ξ, η, ζ: ${vec(r.eps)}` });
  }
  if (r.precession) {
    const p = r.precession;
    steps.push({
      title: 'Регулярная прецессия: аксоиды',
      blocks: [
        {
          k: 'p',
          c: [
            `${varName(nmQ[0], 1)}, ${nmQ[1]} и ${varName(nmQ[2], 1)} постоянны — регулярная прецессия: ω постоянна по величине и описывает конус вокруг оси O${FIX[2]}. Неподвижный аксоид — конус с осью O${FIX[2]} и углом раствора `,
            b(degs(2 * p.fixed)),
            `, подвижный — с осью тела ${seq[2]} и углом раствора `,
            b(degs(2 * p.moving)),
            Math.abs(p.fixed - Math.PI / 2) < 1e-9 ? '. Угол 180° — неподвижный аксоид вырождается в плоскость.' : '.',
          ],
        },
      ],
    });
    ans.push({ kind: 'aux', val: [`2θ_н = ${degs(2 * p.fixed)}, 2θ_п = ${degs(2 * p.moving)}`], note: 'углы раствора неподвижного и подвижного аксоидов' });
  }
  if (r.point) {
    const q = r.point;
    steps.push({
      title: 'Скорость и ускорение точки тела',
      blocks: [
        {
          k: 'eq',
          lines: [
            { c: [`ρ = ${vec(q.rho)} (в осях тела), r = R·ρ = ${vec(q.r)}`] },
            { c: [`v = ω × r = ${vec(q.v)}, |v| = `, b(num(norm(q.v)))] },
            { c: [`a = ε × r + ω × v = ${vec(q.aE)} + ${vec(q.aW)} = ${vec(q.a)}, |a| = `, b(num(norm(q.a)))] },
          ],
        },
      ],
    });
    ans.push({
      kind: 'main',
      val: [`v = ${num(norm(q.v))}, a = ${num(norm(q.a))}`],
      note: 'скорость и ускорение точки (проекции на неподвижные оси — в решении)',
    });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}

/* ───────────── Дифференциал ───────────── */

function diffDoc(pr: DiffProblem, r: DiffOut, ex: Ex): Doc {
  if (!r.ok) return bad(r.error);
  const steps: Step[] = [];
  const ans: AnswerRow[] = [];
  if (r.car) {
    const c = pr.car;
    steps.push({
      title: 'Колёса автомобиля на повороте',
      blocks: [
        { k: 'p', c: ['Колёса заднего моста проходят окружности радиусов ρ ± l/2 за одно время; их угловые скорости:'] },
        {
          k: 'eq',
          lines: [
            { c: [`ω₁ = v(ρ + l/2)/(ρR) = ${nm(c.v)}·${nm(c.rho + c.l / 2)}/(${nm(c.rho)}·${nm(c.Rw)}) = `, b(`${num(r.car.w1)} с⁻¹`)] },
            { c: [`ω₂ = v(ρ − l/2)/(ρR) = ${nm(c.v)}·${nm(c.rho - c.l / 2)}/(${nm(c.rho)}·${nm(c.Rw)}) = `, b(`${num(r.car.w2)} с⁻¹`)] },
          ],
        },
      ],
    });
    ans.push({ kind: 'main', val: [`ω₁ = ${num(r.w1)}, ω₂ = ${num(r.w2)}`], note: 'угловые скорости колёс' });
  }
  {
    const bl: Block[] = [];
    bl.push({
      k: 'p',
      c: [
        'Метод Виллиса: в движении относительно водила H оси всех колёс неподвижны, колёса вращаются с угловыми скоростями ωᵢ − ω_H. Скорость точки зацепления сателлита с колесом 1: (ω₁ − ω_H)R₁ = ω_c·r₁, с колесом 2: (ω₂ − ω_H)R₂ = ',
        pr.sign === 'opp' ? '−' : '',
        'ω_c·r₂',
        pr.sign === 'opp' ? ' (колёса по разные стороны сателлита вращаются относительно водила в противоположные стороны).' : '.',
      ],
    });
    bl.push({
      k: 'eq',
      lines: [
        {
          c: [
            `(ω₁ − ω_H)/(ω₂ − ω_H) = ${pr.sign === 'opp' ? '−' : ''}R₂r₁/(R₁r₂) = ${pr.sign === 'opp' ? '−' : ''}${nm(pr.R2)}·${nm(pr.r1)}/(${nm(pr.R1)}·${nm(pr.r2)}) = `,
            b(num(r.i)),
          ],
        },
      ],
    });
    const lines: { c: Inline[] }[] = [];
    if (pr.unknown === 'H') lines.push({ c: [`ω_H = (ω₁ − iω₂)/(1 − i) = (${nm(r.w1)} − ${nm(r.i)}·${nm(r.w2)})/(1 − ${nm(r.i)}) = `, b(num(r.wH))] });
    else if (pr.unknown === '1') lines.push({ c: [`ω₁ = ω_H + i(ω₂ − ω_H) = ${nm(r.wH)} + ${nm(r.i)}·(${nm(r.w2)} − ${nm(r.wH)}) = `, b(num(r.w1))] });
    else lines.push({ c: [`ω₂ = ω_H + (ω₁ − ω_H)/i = ${nm(r.wH)} + (${nm(r.w1)} − ${nm(r.wH)})/${nm(r.i)} = `, b(num(r.w2))] });
    bl.push({ k: 'eq', lines });
    ex(bl, 'Угловые скорости — со знаком: положительные в одну сторону вращения вокруг главной оси. Неподвижное колесо — ω = 0 (планетарная передача).');
    steps.push({ title: 'Угловые скорости колёс и водила', blocks: bl });
    const U = { H: ['ω_H', 'водило'], '1': ['ω₁', 'колесо 1'], '2': ['ω₂', 'колесо 2'] }[pr.unknown];
    ans.push({ kind: 'main', val: [`${U[0]} = ${num(pr.unknown === 'H' ? r.wH : pr.unknown === '1' ? r.w1 : r.w2)}`], note: `угловая скорость: ${U[1]}` });
  }
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [`ω_c = (ω₁ − ω_H)R₁/r₁ = (${nm(r.w1)} − ${nm(r.wH)})·${nm(pr.R1)}/${nm(pr.r1)} = `, b(num(r.ws))] },
          { c: [`ω_абс = √(ω_H² + ω_c²) = `, b(num(r.wAbs))] },
          ...(r.vC != null ? [{ c: [`v_C = |ω_H|·d = ${num(Math.abs(r.wH))}·${nm(pr.d)} = `, b(num(r.vC))] as Inline[] }] : []),
        ],
      },
    ];
    ex(
      bl,
      'Ось сателлита перпендикулярна главной оси и вращается вместе с водилом: абсолютная угловая скорость сателлита — векторная сумма ω_H (по главной оси) и ω_c (по оси сателлита).',
    );
    steps.push({ title: 'Сателлит', blocks: bl });
    ans.push({ kind: 'main', val: [`ω_c = ${num(Math.abs(r.ws))}`], note: 'угловая скорость сателлита относительно водила' });
    ans.push({ kind: 'aux', val: [`ω = ${num(r.wAbs)}`], note: 'абсолютная угловая скорость сателлита' });
    if (r.vC != null) ans.push({ kind: 'main', val: [`v = ${num(r.vC)}`], note: 'скорость центра сателлита' });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}

/* ───────────── Кинематический винт ───────────── */

function screwDoc(pr: ScrewProblem, r: ScrewOut, ex: Ex): Doc {
  if (!r.ok) return bad(r.error);
  const steps: Step[] = [];
  const ans: AnswerRow[] = [];
  const red = r.red;
  {
    const lines: { c: Inline[] }[] = [];
    pr.rots.forEach((q, i) =>
      lines.push({
        c: [
          `${q.name}: ω = ${num(q.w)} с⁻¹ вдоль ${vec(q.d, 4)} через точку ${vec(q.p, 4)}: ω = ${vec(r.ws[i])}, (A − O) × ω = ${vec(cross0(q.p, pr.O, r.ws[i]))}`,
        ],
      }),
    );
    pr.trans.forEach((t) => lines.push({ c: [`${t.name}: поступательное, v = ${vec(t.v)}`] }));
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          `Вращение вокруг оси через точку A сообщает точке O = ${vec(pr.O, 4)} скорость (A − O) × ω — как момент силы; поступательное движение — как пара. Приводим к точке O:`,
        ],
      },
      { k: 'eq', lines },
    ];
    bl.push({
      k: 'eq',
      lines: [
        { c: ['ω = Σωᵢ = ', vec(red.R), ', |ω| = ', b(`${num(norm(red.R))} с⁻¹`)] },
        { c: ['v_O = Σ(Aᵢ − O) × ωᵢ + Σvⱼ = ', vec(red.M), ', |v_O| = ', b(num(norm(red.M)))] },
      ],
    });
    ex(
      bl,
      'Так же, как система сил приводится к главному вектору и главному моменту, мгновенные движения тела приводятся к угловой скорости и скорости центра приведения (кинематический винт).',
    );
    steps.push({ title: 'Приведение к центру O', blocks: bl });
  }
  {
    const bl: Block[] = [];
    const wn = norm(red.R);
    if (red.kind === 'equilibrium') {
      bl.push({ k: 'p', c: [b('Тело покоится'), ' (ω = 0, v_O = 0).'] });
      ans.push({ kind: 'main', val: ['покой'], note: 'результирующее движение' });
    } else if (red.kind === 'pair') {
      bl.push({
        k: 'p',
        c: [b('Поступательное движение'), ` со скоростью v = ${vec(red.M)}, |v| = ${num(norm(red.M))}: угловые скорости уравновешиваются (пары вращений).`],
      });
      ans.push({ kind: 'main', val: [`v = ${vec(red.M)}`], note: 'поступательное движение' });
    } else {
      bl.push({ k: 'eq', lines: [{ c: [`ω·v_O = ${num(red.inv)} — `, red.kind === 'resultant' ? 'вращение вокруг мгновенной оси' : 'винтовое движение'] }] });
      if (red.axisPoint)
        bl.push({
          k: 'p',
          c: [
            red.kind === 'resultant' ? 'Мгновенная ось' : 'Мгновенная винтовая ось',
            ` параллельна ω и проходит через точку O + ω × v_O/ω² = ${vec(red.axisPoint)}`,
            red.xyPoint ? `; пересекает плоскость Oxy в точке (${num(red.xyPoint[0])}; ${num(red.xyPoint[1])})` : '',
            '.',
          ],
        });
      if (red.kind === 'dynamo')
        bl.push({
          k: 'p',
          c: [
            'Точки винтовой оси имеют наименьшую скорость ',
            b(`v_min = ω·v_O/|ω| = ${num(Math.abs(red.Mstar))}`),
            `, направленную по оси; шаг винта v_min/|ω| = ${num(Math.abs(red.Mstar) / wn)} (на радиан).`,
          ],
        });
      ans.push({
        kind: 'main',
        val: [`ω = ${num(wn)} с⁻¹`],
        note: red.kind === 'resultant' ? 'вращение вокруг мгновенной оси' : `винтовое движение, v_min = ${num(Math.abs(red.Mstar))}`,
      });
    }
    if (r.points.length) {
      bl.push({
        k: 'eq',
        lines: r.points.map((q) => ({
          c: [
            `v_${q.name} = v_O + ω × (r − O) = ${vec(q.v)}, |v| = `,
            b(num(norm(q.v))),
            wn > 0 ? `; до мгновенной оси ${num(distToAxis(q.r, red.axisPoint ?? pr.O, red.R))}` : '',
          ] as Inline[],
        })),
      });
      r.points.forEach((q) => ans.push({ kind: 'main', val: [`v_${q.name} = ${num(norm(q.v))}`], note: `скорость точки ${vec(q.v)}` }));
    }
    steps.push({ title: 'Результирующее движение', blocks: bl });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}
function cross0(p: V3, O: V3, w: V3): V3 {
  const a: V3 = [p[0] - O[0], p[1] - O[1], p[2] - O[2]];
  return [a[1] * w[2] - a[2] * w[1], a[2] * w[0] - a[0] * w[2], a[0] * w[1] - a[1] * w[0]];
}
function distToAxis(p: V3, a: V3, w: V3): number {
  const d: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  return norm(cross0(d, [0, 0, 0], w)) / norm(w);
}

/* ───────────── Гироскоп ───────────── */

function gyroDoc(pr: GyroProblem, r: GyroOut, ex: Ex): Doc {
  if (!r.ok) return bad(r.error);
  const steps: Step[] = [];
  const ans: AnswerRow[] = [];
  {
    const lines: { c: Inline[] }[] = [];
    const m = `${nm(pr.P)}/${nm(pr.g)}`;
    if (pr.jMode === 'J') lines.push({ c: [`J = ${num(r.J)}`] });
    else if (pr.jMode === 'Prho') lines.push({ c: [`J = (P/g)ρ² = ${m}·${nm(pr.rho)}² = ${num(r.J)}`] });
    else if (pr.jMode === 'disc') lines.push({ c: [`J = (P/g)r²/2 = ${m}·${nm(pr.r)}²/2 = ${num(r.J)}`] });
    else lines.push({ c: [`J = (P/g)r² = ${m}·${nm(pr.r)}² = ${num(r.J)} (масса — по ободу)`] });
    if (pr.spin === 'rpm') lines.push({ c: [`ω = πn/30 = π·${nm(pr.w)}/30 = ${num(r.w)} с⁻¹`] });
    else if (pr.spin === 'roll') lines.push({ c: [`ω = Ω·d/R = ${num(r.Om)}·${nm(pr.dRoll)}/${nm(pr.Rroll)} = ${num(r.w)} с⁻¹ (качение)`] });
    else lines.push({ c: [`ω = ${num(r.w)} с⁻¹`] });
    lines.push({ c: ['Кинетический момент K = Jω = ', b(num(r.K))] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Приближённая теория: кинетический момент быстро вращающегося ротора считаем равным Jω и направленным по его оси (угловую скорость прецессии в K не учитываем).',
    );
    steps.push({ title: 'Ротор', blocks: bl });
  }
  const omLine = (): Inline[] => {
    const O = precessionRate(pr);
    switch (pr.omMode) {
      case 'rad':
        return [`Ω = ${num(O)} с⁻¹`];
      case 'rpm':
        return [`Ω = πn/30 = π·${nm(pr.Om)}/30 = ${num(O)} с⁻¹`];
      case 'deg':
        return [`Ω = ${num(pr.Om)}°/с = ${num(O)} с⁻¹`];
      case 'curve':
        return [`Ω = v/R = ${nm(pr.v)}/${nm(pr.Rc)} = ${num(O)} с⁻¹`];
      case 'pitch':
        return [`качка θ = θ₀ sin(2πt/T): Ω_max = 2πθ₀/T = 2π·${num(pr.amp)}°/${nm(pr.T)} = ${num(O)} с⁻¹`];
    }
  };
  if (pr.task === 'precession' && r.prec) {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [`M = F·h = ${nm(pr.F)}·${nm(pr.h)} = ${num(r.M)}`] },
          { c: [`Ω = M/(Jω) = ${num(r.M)}/${nm(r.K)} = `, b(`${num(r.prec.Om)} с⁻¹`)] },
          { c: [`T = 2π/Ω = `, b(`${num(r.prec.T)} с`)] },
        ],
      },
    ];
    ex(
      bl,
      'По теореме Резаля скорость конца вектора K равна моменту силы: Ω × K = M. Момент силы тяжести (или сопротивления) Fh sin β и Jω sin β содержат один и тот же sin β — Ω от наклона оси не зависит.',
    );
    steps.push({ title: 'Регулярная прецессия', blocks: bl });
    ans.push({ kind: 'main', val: [`Ω = ${num(r.prec.Om)} с⁻¹`], note: `угловая скорость прецессии, период ${num(r.prec.T)} с` });
  } else {
    const bl: Block[] = [{ k: 'eq', lines: [{ c: omLine() }, { c: [`M_г = JωΩ sin β = ${nm(r.K)}·${nm(r.Om)}·sin ${num(pr.beta)}° = `, b(num(r.M))] }] }];
    bl.push({
      k: 'p',
      c: [
        'Ось ротора вынуждена поворачиваться: подшипники прикладывают к ротору момент M = Ω × K, а ротор давит на них гироскопическим моментом M_г = −M. Правило Жуковского: M_г стремится кратчайшим путём совместить ось собственного вращения с осью прецессии.',
      ],
    });
    if (pr.task === 'spring' && r.alpha != null) {
      bl.push({
        k: 'eq',
        lines: [{ c: [`α = M_г/(2ca²) = ${num(r.M)}/(2·${nm(pr.c)}·${nm(pr.a)}²) = `, b(`${num(r.alpha)} рад (${num((r.alpha * 180) / Math.PI, 4)}°)`)] }],
      });
      ex(
        bl,
        'Гиротахометр: рамку поворачивает гироскопический момент, удерживают две пружины (момент 2ca²α); по углу α судят об угловой скорости основания Ω.',
      );
      ans.push({ kind: 'main', val: [`α = ${num(r.alpha)} рад`], note: 'угол поворота рамки гиротахометра' });
    } else if (r.dN != null && r.N) {
      bl.push({
        k: 'eq',
        lines: [
          { c: [`ΔN = M_г/l = ${num(r.M)}/${nm(pr.l)} = `, b(num(r.dN))] },
          ...(pr.N0
            ? [
                {
                  c: pr.one
                    ? [`N = N₀ + ΔN = ${num(pr.N0)} + ${num(r.dN)} = `, b(num(r.N[0]))]
                    : [`N = N₀ ± ΔN = ${num(pr.N0)} ± ${num(r.dN)}: `, b(`${num(r.N[0])} и ${num(r.N[1])}`)],
                } as { c: Inline[] },
              ]
            : []),
        ],
      });
      ex(bl, 'Гироскопический момент передаётся на опоры парой сил: одна опора нагружается, другая разгружается на ΔN.');
      ans.push({ kind: 'main', val: [`ΔN = ${num(r.dN)}`], note: 'добавочное (гироскопическое) давление на опору' });
      if (pr.N0)
        ans.push({
          kind: 'main',
          val: [pr.one ? `N = ${num(r.N[0])}` : `N = ${num(r.N[0])}; ${num(r.N[1])}`],
          note: pr.one ? 'полное давление на опору' : 'полные давления на опоры',
        });
    }
    ans.unshift({ kind: 'main', val: [`M_г = ${num(r.M)}`], note: 'гироскопический момент' });
    steps.push({ title: 'Гироскопический момент', blocks: bl });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: ans }] });
  return { steps };
}

export function spatialDoc(
  st: SpState,
  out: { compose?: ComposeOut; euler?: EulerOut; diff?: DiffOut; screw?: ScrewOut; gyro?: GyroOut },
  opts: { explain?: boolean } = {},
): Doc {
  const ex: Ex = (bl, ...c) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  switch (st.mode) {
    case 'compose':
      return composeDoc(st.compose, out.compose!, ex);
    case 'euler':
      return eulerDoc(st.euler, out.euler!, ex);
    case 'diff':
      return diffDoc(st.diff, out.diff!, ex);
    case 'screw':
      return screwDoc(st.screw, out.screw!, ex);
    case 'gyro':
      return gyroDoc(st.gyro, out.gyro!, ex);
  }
}
