/**
 * Чертежи «Формул Кеплера и Бине»: эллипс с вспомогательной окружностью (аномалии ν и E, время полёта), средние
 * радиусы, граница падения (конус касательных к планете), траектория r(φ) с силой по формуле Бине, трасса спутника
 * на карте «широта — долгота».
 */
import { evalExpr } from '../../../shared/expr';
import { elementsOf, type Elements } from '../model/orbit';
import type { TrajProblem, TrajResult } from '../model/traj';
import { LEN, dur, num } from '../text/solution';
import { plot } from '../../rotation/draw/rotation';
import { H, arrow, conic, fitter, label, legend, note, path, r1, sheet, wrap, type P2 } from './orbit';

const rad = (a: number) => (a * Math.PI) / 180;
const TWO_PI = 2 * Math.PI;
const bad = () => {
  const out = sheet();
  out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
  return wrap(out);
};
const dot = (p: P2, cls: string, rr = 4.5) => `<circle class="${cls}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${rr}"/>`;
const seg = (a: P2, b: P2, cls: string) => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
const arc = (c: P2, rr: number, a0: number, a1: number, P: (p: P2) => P2) => {
  // Дуга около точки c (в системе чертежа, ось y вверх) от угла a0 до a1, радиус — в пикселях.
  const pts: string[] = [];
  const N = 24;
  const C = P(c);
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N;
    pts.push(`${r1(C[0] + rr * Math.cos(a))} ${r1(C[1] - rr * Math.sin(a))}`);
  }
  return `<path class="ob-guide" d="M${pts.join('L')}"/>`;
};

/** Эллипс по a, e в системе с фокусом в начале и осью x через перицентр. */
function ellipsePts(a: number, e: number, n = 360): P2[] {
  const p = a * (1 - e * e);
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const f = (TWO_PI * i) / n;
    const r = p / (1 + e * Math.cos(f));
    out.push([r * Math.cos(f), r * Math.sin(f)]);
  }
  return out;
}

function renderAnomalies(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const { a, e, b } = r;
  const L = LEN[pr.unit];
  const ell = ellipsePts(a, e);
  const C: P2 = [-a * e, 0];
  const aux: P2[] = Array.from({ length: 181 }, (_, i) => [C[0] + a * Math.cos((TWO_PI * i) / 180), C[1] + a * Math.sin((TWO_PI * i) / 180)]);
  const F = fitter([...aux, [0, 0]], 30, 30, 580, 400);
  const O = F.P([0, 0]);
  out.push(`<path class="ob-guide" d="${path(aux, F.P, true)}"/>`);
  out.push(`<path class="ob-orb" d="${path(ell, F.P, true)}"/>`);
  // Оси: большая — через фокус, малая — через центр.
  out.push(seg(F.P([-a - a * e, 0]), F.P([a - a * e, 0]), 'ob-guide'));
  out.push(dot(O, 'cg-c', 5), label(O[0] + 8, O[1] + 20, '', 'F'));
  const Cc = F.P(C);
  out.push(dot(Cc, 'ob-pt', 2.5), label(Cc[0] - 4, Cc[1] + 18, '', 'C', '', 'end'));
  const Pp = F.P([a * (1 - e), 0]);
  out.push(
    dot(Pp, 'ob-pt', 3.5),
    label(Pp[0] + 6, Pp[1] - 6, '', 'П'),
    dot(F.P([-a * (1 + e), 0]), 'ob-pt', 3.5),
    label(F.P([-a * (1 + e), 0])[0] - 6, F.P([-a * (1 + e), 0])[1] - 6, '', 'А', '', 'end'),
  );
  const timeMode = pr.kind === 'time' && r.pts.length === 2;
  r.pts.forEach((q, i) => {
    if (pr.kind === 'mean') return;
    const nm = timeMode ? String(i + 1) : '';
    const Pq = F.P([q.x, q.y]);
    const Qc: P2 = [C[0] + a * Math.cos(q.E), C[1] + a * Math.sin(q.E)];
    const Qp = F.P(Qc);
    out.push(seg(O, Pq, 'ob-orb2'), seg(Cc, Qp, 'ob-guide'), seg(Pq, Qp, 'ob-guide'), seg(F.P([Qc[0], 0]), Qp, 'ob-guide'));
    out.push(dot(Qp, 'ob-pt2', 3.5), dot(Pq, 'ob-pt', 4.5));
    const up = q.y >= 0;
    out.push(label(Pq[0] + 10, Pq[1] + (up ? 16 : -8), '', 'M', nm));
    // Точки на оси (E = 0, 180°) совпадают с Q — вторую подпись не ставим.
    if (Math.hypot(Qp[0] - Pq[0], Qp[1] - Pq[1]) > 6) out.push(label(Qp[0] + 8, Qp[1] + (up ? -8 : 20), 'ob-t2', 'Q', nm));
    // Дуги ν (у фокуса) и E (у центра).
    const sgn = q.y >= 0 ? 1 : -1;
    const nu = Math.atan2(q.y, q.x),
      Ea = Math.atan2(Qc[1] - C[1], Qc[0] - C[0]);
    out.push(arc([0, 0], 26 + 8 * i, 0, nu, F.P), arc(C, 34 + 8 * i, 0, Ea, F.P));
    out.push(
      label(O[0] + 34 * Math.cos(nu / 2) + 6, O[1] - 30 * Math.sin(nu / 2) * sgn * sgn - 2, '', 'ν', nm),
      label(Cc[0] + 46 * Math.cos(Ea / 2) + 4, Cc[1] - 46 * Math.sin(Ea / 2) - 2, 'ob-t2', 'E', nm),
    );
  });
  if (timeMode) {
    // Площадь, ометаемая радиус-вектором от точки 1 до точки 2 (второй закон Кеплера).
    const n1 = r.pts[0].nu,
      n2 = r.pts[1].nu;
    let d = n2 - n1;
    while (d < 0) d += TWO_PI;
    const pa = a * (1 - e * e);
    const arcPts: P2[] = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const f = n1 + (d * i) / N;
      const rr = pa / (1 + e * Math.cos(f));
      arcPts.push([rr * Math.cos(f), rr * Math.sin(f)]);
    }
    const sec = [[0, 0] as P2, ...arcPts];
    out.splice(1, 0, `<path d="${path(sec, F.P, true)}" fill="var(--load)" fill-opacity=".16" stroke="none"/>`);
  }
  const rows: [string, string][] = [
    ['μ =', `${num(r.mu)} ${L}³/с²`],
    ['a =', `${num(a)} ${L}`],
    ['e =', num(e)],
    ['b =', `${num(b)} ${L}`],
    ['T =', dur(r.T)],
  ];
  r.pts.forEach((q, i) => {
    const nm = timeMode ? `${i + 1}` : '';
    rows.push([`ν${nm} =`, `${num((q.nu * 180) / Math.PI, 6)}°`], [`E${nm} =`, `${num((q.E * 180) / Math.PI, 6)}°`], [`r${nm} =`, `${num(q.r)} ${L}`]);
    if (!timeMode) rows.push(['v =', `${num(q.v)} ${L}/с`], ['t =', dur(q.t)]);
  });
  if (timeMode && r.dt != null) rows.push(['Δt =', dur(r.dt)]);
  legend(out, 640, rows.slice(0, 16));
  note(
    out,
    timeMode
      ? 'Окружность радиуса a — вспомогательная; Q — точка на ней над M; штриховка — площадь, ометаемая радиус-вектором за время Δt.'
      : 'Окружность радиуса a — вспомогательная; M — точка орбиты, Q — над ней на окружности; ν — истинная, E — эксцентрическая аномалия.',
  );
  return wrap(out);
}

function renderMean(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const { a, e, b } = r;
  const L = LEN[pr.unit];
  const C: P2 = [-a * e, 0];
  const ell = ellipsePts(a, e);
  const F = fitter(ell, 30, 30, 580, 400);
  const O = F.P([0, 0]);
  const m = r.mean!;
  const circ = (rr: number): string => `<circle cx="${r1(O[0])}" cy="${r1(O[1])}" r="${r1(rr * F.s)}" fill="none"`;
  out.push(`${circ(m.t)} class="ob-orb2"/>`);
  out.push(`${circ(m.phi)} class="ob-guide"/>`);
  out.push(`<path class="ob-orb" d="${path(ell, F.P, true)}"/>`);
  out.push(dot(O, 'cg-c', 5), label(O[0] + 8, O[1] + 20, '', 'F'));
  const Cc = F.P(C);
  out.push(seg(Cc, F.P([C[0] + a, 0]), 'ob-guide'), seg(Cc, F.P([C[0], b]), 'ob-guide'), dot(Cc, 'ob-pt', 2.5));
  out.push(label((Cc[0] + F.P([C[0] + a, 0])[0]) / 2, Cc[1] + 18, '', 'a', '', 'middle'), label(Cc[0] + 8, (Cc[1] + F.P([C[0], b])[1]) / 2, '', 'b'));
  legend(out, 640, [
    ['μ =', `${num(r.mu)} ${L}³/с²`],
    ['a =', `${num(a)} ${L}`],
    ['e =', num(e)],
    ['b =', `${num(b)} ${L}`],
    ['T =', dur(r.T)],
    ['[r]_t =', `${num(m.t, 7)} ${L}`],
    ['[r]_φ =', `${num(m.phi, 7)} ${L}`],
    ['[r]_E =', `${num(m.E, 7)} ${L}`],
  ]);
  note(out, 'Штрих — окружность радиуса [r]_t = a(1 + e²/2) вокруг фокуса F (среднее по времени); тонкая — радиуса b (среднее по углу φ).');
  return wrap(out);
}

function renderFall(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const f = r.fall!;
  const L = LEN[pr.unit];
  const M0: P2 = [f.r0, 0];
  const rView = f.r0 * 1.7;
  const orbits: { el: Elements; cls: string }[] = [];
  if (f.vcrit != null) orbits.push({ el: elementsOf(r.mu, f.r0, f.vcrit, pr.th0, 0, f.R), cls: 'ob-orb2' });
  if (f.el) orbits.push({ el: f.el, cls: 'ob-orb' });
  const curves = orbits.map(({ el }) => (el.type === 'line' ? [] : conic(el, rView)));
  const pts: P2[] = [[-f.R, -f.R], [f.R, f.R], M0, [-f.r0 * 0.4, f.r0 * 0.9], [-f.r0 * 0.4, -f.r0 * 0.9]];
  curves.forEach((c) => c.forEach((part) => pts.push(...part)));
  const F = fitter(pts, 30, 30, 580, 400);
  const O = F.P([0, 0]);
  const A = F.P(M0);
  orbits.forEach(({ cls }, k) => {
    for (const part of curves[k]) out.push(`<path class="${cls}" d="${path(part, F.P)}"/>`);
  });
  out.push(`<circle class="ob-body" cx="${r1(O[0])}" cy="${r1(O[1])}" r="${r1(f.R * F.s)}"/>`);
  // Конус касательных к планете из начальной точки.
  const d = Math.sqrt(f.r0 * f.r0 - f.R * f.R);
  const del = rad(f.delta);
  for (const s of [1, -1]) {
    const T: P2 = [f.r0 - d * Math.cos(del), s * d * Math.sin(del)];
    const Far: P2 = [f.r0 - 1.25 * d * Math.cos(del), s * 1.25 * d * Math.sin(del)];
    out.push(seg(A, F.P(Far), 'ob-guide'), dot(F.P(T), 'ob-pt', 2.5));
  }
  out.push(seg(O, A, 'ob-guide'));
  out.push(dot(A, 'ob-pt', 4.5), label(A[0] + 8, A[1] + 20, '', 'M', '0'));
  const th = rad(pr.th0);
  const dir: P2 = [Math.sin(th), Math.cos(th)];
  out.push(arrow(A, [A[0] + dir[0] * 62, A[1] - dir[1] * 62], 'en-v'), label(A[0] + dir[0] * 74 + 6, A[1] - dir[1] * 74, 'en-v-t', 'v', '0'));
  const rows: [string, string][] = [
    ['r₀ =', `${num(f.r0)} ${L}`],
    ['H =', `${num(f.r0 - f.R)} ${L}`],
    ['θ₀ =', `${num(pr.th0)}°`],
    ['θ_к =', `−${num(f.thCone)}°`],
    ['v₁ =', `${num(f.vc)} ${L}/с`],
  ];
  if (f.vcrit != null) rows.push(['v_кр =', `${num(f.vcrit)} ${L}/с`]);
  else rows.push(['', f.inside ? 'падение при любой v₀' : '']);
  if (f.hits != null) rows.push(['v₀ =', `${num(pr.v0)} ${L}/с`], ['', f.hits ? 'падает на планету' : 'не пересекает поверхность']);
  legend(out, 640, rows);
  note(out, 'Штрих — траектория при v_кр (касается поверхности), сплошная — при заданной v₀; тонкие линии — конус касательных из M₀.');
  return wrap(out);
}

function renderInverse(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const i = r.inverse!;
  const L = LEN[pr.unit];
  if (pr.inv === 'mass') {
    const C: P2 = [320, 235];
    out.push(`<circle class="cg-c" cx="${C[0]}" cy="${C[1]}" r="6"/>`, label(C[0], C[1] + 24, '', 'центр', '', 'middle'));
    out.push(`<circle class="ob-orb" cx="${C[0]}" cy="${C[1]}" r="110"/>`, `<circle class="ob-orb2" cx="${C[0]}" cy="${C[1]}" r="190"/>`);
    out.push(
      dot([C[0] + 110 * Math.cos(-0.7), C[1] + 110 * Math.sin(-0.7)], 'ob-pt', 5),
      dot([C[0] + 190 * Math.cos(-2.4), C[1] + 190 * Math.sin(-2.4)], 'ob-pt2', 5),
    );
    out.push(
      label(C[0] + 110 * Math.cos(-0.7) + 8, C[1] + 110 * Math.sin(-0.7) - 6, '', 'a', '1'),
      label(C[0] + 190 * Math.cos(-2.4) - 8, C[1] + 190 * Math.sin(-2.4) - 8, 'ob-t2', 'a', '2', 'end'),
    );
    legend(out, 640, [
      ['a₁ =', `${num(pr.a1)} ${L}`],
      ['T₁ =', dur(pr.T1)],
      ['a₂ =', `${num(pr.a2)} ${L}`],
      ['T₂ =', dur(pr.T2)],
      ['M₁ : M₂ =', `1 : ${num(1 / i.ratio!, 5)}`],
    ]);
    note(out, 'Третий закон Кеплера для двух тел, обращающихся вокруг одного центра: T²/a³ = 4π²/(f·M); масштаб орбит условный.');
    return wrap(out);
  }
  const a = i.a ?? i.aNeed,
    e = i.e ?? pr.e;
  if (a == null || !(e >= 0 && e < 1)) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const ell = ellipsePts(a, e);
  const pts = pr.inv === 'axes' ? ell : [...ell, [-pr.R, -pr.R] as P2, [pr.R, pr.R] as P2];
  const F = fitter(pts, 40, 40, 560, 380);
  const O = F.P([0, 0]);
  out.push(`<path class="ob-orb" d="${path(ell, F.P, true)}"/>`);
  if (pr.inv !== 'axes' && pr.R > 0) out.push(`<circle class="ob-body" cx="${r1(O[0])}" cy="${r1(O[1])}" r="${r1(Math.max(pr.R * F.s, 3))}"/>`);
  else out.push(dot(O, 'cg-c', 5));
  out.push(label(O[0] + 8, O[1] + 20, '', 'F'));
  const Pp = F.P([a * (1 - e), 0]),
    Pa = F.P([-a * (1 + e), 0]);
  out.push(
    seg(Pa, Pp, 'ob-guide'),
    dot(Pp, 'ob-pt', 3.5),
    label(Pp[0] + 6, Pp[1] - 6, '', 'П'),
    dot(Pa, 'ob-pt', 3.5),
    label(Pa[0] - 6, Pa[1] - 6, '', 'А', '', 'end'),
  );
  const rows: [string, string][] = [];
  if (pr.inv === 'axes')
    rows.push(
      ['p =', `${num(pr.p)} ${L}`],
      ['e =', num(pr.e)],
      ['c =', `${num(pr.c)} ${L}²/с`],
      ['a =', `${num(i.a!)} ${L}`],
      ['b =', `${num(i.b!)} ${L}`],
      ['T =', dur(i.T!)],
    );
  if (pr.inv === 'ecc') rows.push(['T =', dur(pr.T)], ['H =', `${num(pr.Hd)} ${L}`], ['a =', `${num(i.aNeed!)} ${L}`], ['e =', num(i.e!)]);
  if (pr.inv === 'sma')
    rows.push(
      ['e =', num(pr.e)],
      ['H_п : H_а =', num(pr.gam)],
      ['a =', `${num(i.aNeed!)} ${L}`],
      ['r_п =', `${num(i.rpNeed!)} ${L}`],
      ['r_а =', `${num(i.raNeed!)} ${L}`],
    );
  legend(out, 640, rows);
  note(out, 'Эллипс с телом в фокусе F; П — перицентр, А — апоцентр.');
  return wrap(out);
}

function renderBinet(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const bn = r.binet!;
  const phi1 = rad(bn.at.phi);
  const rr = (x: number) => evalExpr(bn.expr, x);
  const rMax = bn.at.r * 6;
  const parts: P2[][] = [];
  let cur: P2[] = [];
  const N = 720;
  for (let i = 0; i <= N; i++) {
    const phi = phi1 - Math.PI + (TWO_PI * i) / N;
    const q = rr(phi);
    if (Number.isFinite(q) && q > 0 && q <= rMax) cur.push([q * Math.cos(phi), q * Math.sin(phi)]);
    else if (cur.length) (parts.push(cur), (cur = []));
  }
  if (cur.length) parts.push(cur);
  const all = parts.flat();
  const M: P2 = [bn.at.r * Math.cos(phi1), bn.at.r * Math.sin(phi1)];
  const F = fitter([...all, [0, 0], M], 40, 40, 560, 380);
  const O = F.P([0, 0]);
  for (const part of parts) out.push(`<path class="ob-orb" d="${path(part, F.P)}"/>`);
  out.push(dot(O, 'cg-c', 5), label(O[0] - 8, O[1] + 20, '', 'O', '', 'end'));
  const A = F.P(M);
  out.push(seg(O, A, 'ob-guide'), dot(A, 'ob-pt', 4.5), label(A[0] + 8, A[1] + 20, '', 'M'));
  const er: P2 = [Math.cos(phi1), Math.sin(phi1)],
    ef: P2 = [-Math.sin(phi1), Math.cos(phi1)];
  // Скорость: v = v_r e_r + v_φ e_φ (ось y чертежа вверх — в SVG знак минус).
  const vv: P2 = [bn.at.vr * er[0] + bn.at.vt * ef[0], bn.at.vr * er[1] + bn.at.vt * ef[1]];
  const vl = Math.hypot(vv[0], vv[1]) || 1;
  out.push(
    arrow(A, [A[0] + (vv[0] / vl) * 60, A[1] - (vv[1] / vl) * 60], 'en-v'),
    label(A[0] + (vv[0] / vl) * 72 + 6, A[1] - (vv[1] / vl) * 72, 'en-v-t', 'v'),
  );
  // Ускорение — вдоль радиуса (центральная сила): к центру при a_r < 0.
  const sg = bn.at.ar < 0 ? -1 : 1;
  out.push(
    arrow(A, [A[0] + sg * er[0] * 54, A[1] - sg * er[1] * 54], 'rc'),
    label(A[0] + sg * er[0] * 66 - 8, A[1] - sg * er[1] * 66 + 16, 't-rc', 'F', '', 'middle'),
  );
  const L = LEN[pr.unit];
  const rows: [string, string][] = [
    ['c =', `${num(pr.cb)} ${L}²/с`],
    ['φ₁ =', `${num(bn.at.phi)}°`],
    ['r₁ =', `${num(bn.at.r)} ${L}`],
    ['a_r =', `${num(bn.at.ar)} ${L}/с²`],
    ['v =', `${num(bn.at.v)} ${L}/с`],
  ];
  if (bn.inverseSquare) rows.push(['μ =', `${num(bn.mu!)} ${L}³/с²`]);
  else if (bn.power != null) rows.push(['a_r ∝ r^', num(bn.power)]);
  else rows.push(['', 'закон не степенной']);
  legend(out, 640, rows);
  note(out, 'O — центр силы; F — сила (вдоль радиуса); v — скорость. Сила находится по формуле Бине F = −mc²u²(u″ + u), u = 1/r.');
  return wrap(out);
}

function renderTrack(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const t = r.track!;
  const x0 = 60,
    y0 = 26,
    w = 880,
    h = 330;
  const X = (lon: number) => x0 + ((lon + 180) / 360) * w,
    Y = (lat: number) => y0 + ((90 - lat) / 180) * h;
  for (const lat of [-60, -30, 0, 30, 60])
    out.push(
      `<line class="${lat === 0 ? 'rt-axis' : 'rt-grid'}" x1="${x0}" y1="${r1(Y(lat))}" x2="${x0 + w}" y2="${r1(Y(lat))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(Y(lat) + 4)}" text-anchor="end">${lat}°</text>`,
    );
  for (const lon of [-180, -120, -60, 0, 60, 120, 180])
    out.push(
      `<line class="rt-grid" x1="${r1(X(lon))}" y1="${y0}" x2="${r1(X(lon))}" y2="${y0 + h}"/><text class="rt-tick" x="${r1(X(lon))}" y="${y0 + h + 18}" text-anchor="middle">${lon}°</text>`,
    );
  // Трасса — ломаная; при переходе через ±180° линия прерывается.
  let cur: string[] = [];
  const flush = () => {
    if (cur.length > 1) out.push(`<path class="ob-orb" d="M${cur.join('L')}"/>`);
    cur = [];
  };
  let prev: { lon: number } | null = null;
  for (const q of t.pts) {
    if (prev && Math.abs(q.lon - prev.lon) > 180) flush();
    cur.push(`${r1(X(q.lon))} ${r1(Y(q.lat))}`);
    prev = q;
  }
  flush();
  const s0 = t.pts[0],
    s1 = t.pts[t.pts.length - 1];
  out.push(dot([X(s0.lon), Y(s0.lat)], 'ob-pt', 5), label(X(s0.lon) + 8, Y(s0.lat) - 8, '', 'старт'));
  out.push(dot([X(s1.lon), Y(s1.lat)], 'rt-end', 5));
  const L = LEN[pr.unit];
  const rows = [
    `H = ${num(pr.H)} ${L}, α = ${num(pr.alpha)}°, T = ${dur(t.T)}, Ω√(r³/μ) = ${num(t.k)}`,
    t.geo
      ? 'синхронная орбита в плоскости экватора: подспутниковая точка неподвижна'
      : `угол трассы с экватором β = ${num(t.beta)}°, смещение за виток на запад ${num(t.shift)}°, широта до ${num(t.lat)}°`,
  ];
  rows.forEach((s, i) => out.push(`<text class="rt-tick" x="${x0}" y="${y0 + h + 44 + i * 20}">${s}</text>`));
  note(out, `Трасса за ${pr.turns} витк. от восходящего узла (долгота 0°); вращение тела уносит трассу на запад.`);
  return wrap(out);
}

function renderTwo(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const t = r.two!;
  const L = LEN[pr.unit];
  const Mt = pr.m1 + pr.m2;
  const k1 = -pr.m2 / Mt,
    k2 = pr.m1 / Mt;
  const rel = ellipsePts(pr.a, pr.e);
  const o1 = rel.map((p): P2 => [p[0] * k1, p[1] * k1]),
    o2 = rel.map((p): P2 => [p[0] * k2, p[1] * k2]);
  const F = fitter([...o1, ...o2, ...rel], 30, 30, 580, 400);
  const C = F.P([0, 0]);
  const nu = rad(40);
  const rr = (pr.a * (1 - pr.e * pr.e)) / (1 + pr.e * Math.cos(nu));
  const R: P2 = [rr * Math.cos(nu), rr * Math.sin(nu)];
  const p1 = F.P([R[0] * k1, R[1] * k1]),
    p2 = F.P([R[0] * k2, R[1] * k2]);
  out.push(`<path class="ob-guide" d="${path(rel, F.P, true)}"/>`);
  out.push(`<path class="ob-orb2" d="${path(o1, F.P, true)}"/>`, `<path class="ob-orb" d="${path(o2, F.P, true)}"/>`);
  out.push(seg(p1, p2, 'ob-guide'), dot(C, 'cg-c', 5), label(C[0] + 8, C[1] + 20, '', 'C'));
  out.push(dot(p1, 'ob-pt2', 5), label(p1[0] - 8, p1[1] - 8, 'ob-t2', 'm', '1', 'end'), dot(p2, 'ob-pt', 6), label(p2[0] + 8, p2[1] - 8, '', 'm', '2'));
  legend(out, 640, [
    ['μ = f(m₁ + m₂) =', `${num(t.mu)} ${L}³/с²`],
    ['μ₁ = fm₂³/(m₁ + m₂)² =', `${num(t.mu1)} ${L}³/с²`],
    ['μ₂ = fm₁³/(m₁ + m₂)² =', `${num(t.mu2)} ${L}³/с²`],
    ['a (относительная) =', `${num(pr.a)} ${L}`],
    ['a₁ = a·m₂/(m₁ + m₂) =', `${num(t.a1)} ${L}`],
    ['a₂ = a·m₁/(m₁ + m₂) =', `${num(t.a2)} ${L}`],
    ['T =', dur(t.T)],
    ['T/T(μ = fm₁) =', num(t.ratio, 8)],
  ]);
  note(out, 'Штрих — движение m₂ относительно m₁; сплошные — движение m₂ и m₁ около центра масс C; обе точки лежат на одной прямой с C.');
  return wrap(out);
}

function renderFly(pr: TrajProblem, r: TrajResult) {
  const out = sheet();
  const f = r.fly!;
  const rows: [string, string][] = [
    ['J =', `${num(pr.Jf)} кг·м²`],
    ['J₀ =', `${num(pr.J0)} кг·м²`],
  ];
  if (f.kind !== 'turn') rows.push(['Ω₀ =', `${num(pr.Om0)} рад/с`], ['K = J₀Ω₀ =', `${num(f.K)} кг·м²/с`], ['ω_м =', `${num(f.omF)} рад/с`]);
  if (f.kind === 'stop') rows.push(['A =', `${num(f.A)} Дж`]);
  if (f.kind === 'motor') {
    rows.push(['α =', `${num(f.alpha!)} 1/с`], ['M_мин =', `${num(f.Mmin!)} Н·м`]);
    if (f.ok) rows.push(['T =', dur(f.T!)], ['ψ =', `${num(f.psi!)} рад = ${num((f.psi! * 180) / Math.PI)}°`]);
  }
  if (f.kind === 'turn')
    rows.push(['τ =', `${num(f.tau!)} с`], ['t₁ =', `${num(f.t1!)} с`], ['t₂ =', `${num(f.t2!)} с`], ['ω_макс =', `${num(f.omPeak!)} рад/с`]);
  if (f.kind === 'stop') {
    // Схема: аппарат с маховиком до и после остановки корпуса.
    const draw = (cx: number, cy: number, om: string, ot: string, k: string) => {
      out.push(`<circle class="ob-body" cx="${cx}" cy="${cy}" r="110"/><circle class="ob-orb" cx="${cx}" cy="${cy}" r="42" fill="var(--sheet)"/>`);
      out.push(
        `<line class="ob-guide" x1="${cx}" y1="${cy}" x2="${cx + 110}" y2="${cy}"/>`,
        `<line class="ob-orb" x1="${cx + 42}" y1="${cy}" x2="${cx + 110}" y2="${cy}"/>`,
      );
      out.push(label(cx, cy + 150, '', k, '', 'middle'), label(cx, cy - 124, 'en-v-t', om, '', 'middle'), label(cx, cy + 5, 'ob-t2', ot, '', 'middle'));
    };
    draw(140, 215, 'корпус вращается: Ω₀', 'маховик', 'до торможения');
    draw(430, 215, 'корпус неподвижен', 'маховик: ω', 'после остановки: ω = J₀Ω₀/J');
    legend(out, 640, rows);
    note(out, 'Момент количества движения системы сохраняется: J₀Ω₀ = Jω; работа двигателя равна изменению кинетической энергии.');
    return wrap(out);
  }
  const pts: [number, number][] = [];
  const N = 120;
  if (f.kind === 'motor' && f.ok) {
    for (let i = 0; i <= N; i++) {
      const t = (f.T! * i) / N;
      pts.push([t, pr.Om0 - (pr.Jf / pr.J0) * (pr.M0 / pr.kap) * (1 - Math.exp(-f.alpha! * t))]);
    }
  } else if (f.kind === 'turn') {
    const T = pr.Tc;
    for (let i = 0; i <= N; i++) {
      const t = (f.tTotal! * i) / N;
      const w = t <= f.t1! ? T * pr.u0 * (1 - Math.exp(-t / T)) : -T * pr.u0 + (f.omPeak! + T * pr.u0) * Math.exp(-(t - f.t1!) / T);
      pts.push([t, (pr.Jf / pr.J0) * w]);
    }
  }
  if (pts.length) out.push(plot(70, 50, 520, 330, pts, f.kind === 'turn' ? 'Ω корпуса' : 'Ω корпуса', 'рад/с', 'с'));
  else out.push(`<text class="tb-note" x="16" y="${H / 2}">Момент двигателя недостаточен — корпус не остановится.</text>`);
  legend(out, 640, rows);
  note(
    out,
    f.kind === 'turn'
      ? 'u = +u₀ на разгоне и −u₀ на торможении маховика; корпус поворачивается на ψ и останавливается.'
      : 'Маховик раскручивается моментом M₀ − κω и забирает момент количества движения корпуса.',
  );
  return wrap(out);
}

export function renderTraj(pr: TrajProblem, r: TrajResult) {
  if (!r.ok) return bad();
  switch (pr.kind) {
    case 'point':
    case 'time':
      return renderAnomalies(pr, r);
    case 'mean':
      return renderMean(pr, r);
    case 'fall':
      return renderFall(pr, r);
    case 'inverse':
      return renderInverse(pr, r);
    case 'binet':
      return renderBinet(pr, r);
    case 'track':
      return renderTrack(pr, r);
    case 'two':
      return renderTwo(pr, r);
    case 'flywheel':
      return renderFly(pr, r);
  }
}
