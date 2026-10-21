/**
 * Силы и массы на механизме с одной степенью свободы в одном положении.
 *
 * Мощность силы F в точке со скоростью v: N = F·v = F(v_x cos θ + v_y sin θ); пары M на звене: N = M·ω (обе — против
 * часовой стрелки положительны); момента сопротивления M в шарнире между звеньями 1 и 2: N = −M·|ω₁ − ω₂|.
 * Скорости — при заданном ведущем; они же возможные скорости, поэтому принцип возможных перемещений даёт уравнение
 * равновесия Σ N = 0 (моменты сопротивления в нём не участвуют — их направление зависит от направления движения).
 * Вес массы m: сила m·g против оси y. Кинетическая энергия: точечная масса — m v²/2; стержень — m v_C²/2 + (m l²/12) ω²/2;
 * тело с центром C — m v_C²/2 + J_C ω²/2 (диск J_C = m r²/2, обод J_C = m r²). Приведённые к ведущему звену момент инерции
 * и момент сил: J_пр = 2T/ω², M_пр = ΣN/ω (ведущая точка — m_пр = 2T/v², F_пр = ΣN/v).
 */
import { num, type MechProblem, type MechResult, type V2 } from './mech';

export interface LoadTerm {
  /** Номер нагрузки в списке. */
  i: number;
  /** Мощность при заданном ведущем (для неизвестной — при найденном значении). */
  P: number;
  /** Мощность при единичном значении силы или момента (для трения — при заданном M). */
  coef: number;
  unknown: boolean;
  friction: boolean;
  /** Значение: F или M (для неизвестной — найденное). */
  val: number;
  /** Сила: направление (орт) и скорость точки приложения; пара и трение — угловые скорости. */
  dir?: V2;
  v?: V2;
  omega?: number;
}
export interface MassTerm {
  i: number;
  m: number;
  /** Центр масс, его скорость, звено и его ω, момент инерции относительно центра масс. */
  c: V2;
  vC: V2;
  body: string | null;
  omega: number;
  J: number;
  /** Длина стержня или радиус тела (для пояснений). */
  size: number;
  T: number;
}
export interface Lead {
  kind: 'omega' | 'v';
  /** Звено или точка ведущего. */
  name: string;
  /** Угловая скорость звена или скорость точки при заданном ведущем. */
  value: number;
}
export interface Forces {
  lead: Lead;
  loads: LoadTerm[];
  /** Мощности весов масс (в порядке масс), g. */
  weights: { i: number; P: number }[];
  g: number;
  /** Неизвестная сила или пара (номер в loads) и её значение из условия равновесия. */
  unknown: number | null;
  X: number | null;
  /** Сумма мощностей известных нагрузок без трения (с весами). */
  Pknown: number;
  /** Мощность моментов сопротивления (≤ 0). */
  Pfric: number;
  masses: MassTerm[];
  T: number;
  /** Приведённый момент инерции (масса), если массы заданы. */
  Jred: number | null;
}

const rad = (d: number) => (d * Math.PI) / 180;
const hyp = (v: V2) => Math.hypot(v[0], v[1]);

export function forcesAt(pr: MechProblem, r: MechResult): { f: Forces | null; errors: string[] } {
  const loads = pr.loads ?? [],
    masses = pr.masses ?? [];
  const errors: string[] = [];
  const gv = pr.g?.trim() ? num(pr.g) : 0;
  if (gv == null) errors.push(`g — не число («${pr.g}»).`);
  if (!loads.length && !masses.length) return { f: null, errors };
  if (!r.ok) return { f: null, errors };
  if (r.dof !== 1) return { f: null, errors: [`Силы и массы рассчитываются для механизма с одной степенью свободы (сейчас подвижность ${r.dof}).`] };
  const P = (n: string, what: string) => {
    const q = r.points.find((p) => p.name === n);
    if (!q) errors.push(`${what}: нет точки «${n}».`);
    else if (q.aux) errors.push(`${what}: точка ${n} не входит ни в одно звено (неподвижна).`);
    return q;
  };
  const B = (n: string, what: string) => {
    const q = r.bodies.find((b) => b.name === n);
    if (!q) errors.push(`${what}: нет звена «${n}».`);
    return q;
  };
  const N = (s: string, what: string) => {
    const v = num(s);
    if (v == null) errors.push(`${what} — не число («${s}»).`);
    return v ?? 0;
  };
  // Ведущее — первое условие движения.
  const d0 = pr.drives[0];
  let lead: Lead;
  if (d0.k === 'omega') lead = { kind: 'omega', name: d0.b, value: r.bodies.find((b) => b.name === d0.b)?.omega ?? 0 };
  else {
    const q = r.points.find((p) => p.name === d0.p);
    lead = { kind: 'v', name: d0.p, value: q ? hyp(q.v) : 0 };
  }
  if (!(Math.abs(lead.value) > 0)) errors.push('Скорость ведущего звена должна быть отлична от нуля (возможные скорости — при ненулевом ведущем).');

  const terms: LoadTerm[] = [];
  let nUnknown = 0;
  loads.forEach((l, i) => {
    const w = `Нагрузка ${i + 1}`;
    if (l.k === 'force') {
      const q = P(l.p, w);
      let base = 0;
      if (l.ref) {
        const a = r.pos[l.ref],
          b = r.pos[l.ref2];
        if (!a || !b) errors.push(`${w}: направление отсчитывается от отрезка ${l.ref}${l.ref2} — нет такой точки.`);
        else if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-12) errors.push(`${w}: точки ${l.ref} и ${l.ref2} совпадают.`);
        else base = Math.atan2(b[1] - a[1], b[0] - a[0]);
      }
      const th = base + rad(N(l.ang, `${w}: угол`));
      const dir: V2 = [Math.cos(th), Math.sin(th)];
      const v: V2 = q ? q.v : [0, 0];
      const coef = v[0] * dir[0] + v[1] * dir[1];
      const F = l.unknown ? 0 : N(l.F, `${w}: F`);
      if (l.unknown) nUnknown++;
      terms.push({ i, P: coef * F, coef, unknown: l.unknown, friction: false, val: F, dir, v });
    } else if (l.k === 'couple') {
      const b = B(l.b, w);
      const om = b?.omega ?? 0;
      const M = l.unknown ? 0 : N(l.M, `${w}: M`);
      if (l.unknown) nUnknown++;
      terms.push({ i, P: om * M, coef: om, unknown: l.unknown, friction: false, val: M, omega: om });
    } else {
      const b1 = B(l.b1, w),
        b2 = l.b2 ? B(l.b2, w) : null;
      const rel = (b1?.omega ?? 0) - (b2?.omega ?? 0);
      const M = Math.abs(N(l.M, `${w}: M`));
      terms.push({ i, P: -M * Math.abs(rel), coef: -Math.abs(rel), unknown: false, friction: true, val: M, omega: rel });
    }
  });
  if (nUnknown > 1) errors.push('Неизвестной может быть только одна сила или пара — уравнение равновесия одно.');

  const g = gv ?? 0;
  const mt: MassTerm[] = [];
  const weights: { i: number; P: number }[] = [];
  masses.forEach((m, i) => {
    const w = `Масса ${i + 1}`;
    const mm = N(m.m, `${w}: m`);
    if (!(mm >= 0)) errors.push(`${w}: масса не может быть отрицательной.`);
    if (m.k === 'point') {
      const q = P(m.p, w);
      const vC: V2 = q ? q.v : [0, 0];
      mt.push({ i, m: mm, c: q?.pos ?? [0, 0], vC, body: null, omega: 0, J: 0, size: 0, T: (mm * (vC[0] ** 2 + vC[1] ** 2)) / 2 });
    } else if (m.k === 'rod') {
      const q1 = P(m.p1, w),
        q2 = P(m.p2, w);
      const body = pr.bodies.find((b) => b.pts.includes(m.p1) && b.pts.includes(m.p2));
      if (q1 && q2 && !body) errors.push(`${w}: точки ${m.p1} и ${m.p2} должны принадлежать одному звену.`);
      const om = body ? (r.bodies.find((b) => b.name === body.name)?.omega ?? 0) : 0;
      const a = q1?.pos ?? [0, 0],
        b = q2?.pos ?? [0, 0];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const vC: V2 = q1 && q2 ? [(q1.v[0] + q2.v[0]) / 2, (q1.v[1] + q2.v[1]) / 2] : [0, 0];
      const J = (mm * l * l) / 12;
      mt.push({
        i,
        m: mm,
        c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        vC,
        body: body?.name ?? null,
        omega: om,
        J,
        size: l,
        T: (mm * (vC[0] ** 2 + vC[1] ** 2)) / 2 + (J * om * om) / 2,
      });
    } else {
      const bd = B(m.b, w);
      const body = pr.bodies.find((b) => b.name === m.b);
      const q = r.points.find((p) => p.name === m.c);
      if (!q) errors.push(`${w}: нет точки «${m.c}».`);
      else if (body && !body.pts.includes(m.c) && !q.aux) errors.push(`${w}: центр масс ${m.c} должен быть точкой звена ${m.b}.`);
      const om = bd?.omega ?? 0;
      const rr = m.shape === 'J' ? 0 : N(m.r, `${w}: радиус`);
      const J = m.shape === 'disk' ? (mm * rr * rr) / 2 : m.shape === 'ring' ? mm * rr * rr : N(m.J, `${w}: J`);
      if (m.shape === 'J' && J < 0) errors.push(`${w}: момент инерции не может быть отрицательным.`);
      const vC: V2 = q ? q.v : [0, 0];
      mt.push({ i, m: mm, c: q?.pos ?? [0, 0], vC, body: m.b, omega: om, J, size: rr, T: (mm * (vC[0] ** 2 + vC[1] ** 2)) / 2 + (J * om * om) / 2 });
    }
    if (g) weights.push({ i, P: -mm * g * mt[mt.length - 1].vC[1] });
  });
  if (errors.length) return { f: null, errors };

  const Pknown = terms.filter((t) => !t.unknown && !t.friction).reduce((s, t) => s + t.P, 0) + weights.reduce((s, w) => s + w.P, 0);
  const Pfric = terms.filter((t) => t.friction).reduce((s, t) => s + t.P, 0);
  const ui = terms.findIndex((t) => t.unknown);
  let X: number | null = null;
  if (ui >= 0) {
    const c = terms[ui].coef;
    const scale = Math.max(1e-300, ...terms.map((t) => Math.abs(t.coef)), ...weights.map((w) => Math.abs(w.P)));
    if (Math.abs(c) < 1e-9 * scale)
      errors.push('Неизвестная сила (пара) не совершает работы на возможном перемещении: в этом положении её нельзя найти из условия равновесия.');
    else {
      X = -Pknown / c;
      terms[ui].val = X;
      terms[ui].P = X * c;
    }
  }
  const T = mt.reduce((s, m) => s + m.T, 0);
  const Jred = mt.length ? (2 * T) / lead.value ** 2 : null;
  return { f: { lead, loads: terms, weights, g, unknown: ui >= 0 ? ui : null, X, Pknown, Pfric, masses: mt, T, Jred }, errors };
}
