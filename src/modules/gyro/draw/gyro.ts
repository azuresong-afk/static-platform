/**
 * Чертежи гироскопа: ротор между опорами с осью прецессии и парой гироскопических давлений; бегун на основании;
 * волчок с конусом прецессии; рамка с пружинами или маятниковый гироскоп.
 */
import { fmt } from '../../../shared/format';
import { unitsOf, type GyroProblem, type GyroResult } from '../model/gyro';

type P2 = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 460;
const wrap = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const note = (out: string[], text: string) => out.push(`<text class="tb-note" x="16" y="${H - 14}">${text}</text>`);

function arrow(a: P2, b: P2, cls: string) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0] - ux * 8)}" y2="${r1(b[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(b[0])} ${r1(b[1])}L${r1(b[0] - ux * 11 - uy * 4.5)} ${r1(b[1] - uy * 11 + ux * 4.5)}L${r1(b[0] - ux * 11 + uy * 4.5)} ${r1(b[1] - uy * 11 - ux * 4.5)}Z"/>`;
}
const label = (x: number, y: number, cls: string, text: string, anchor = 'start') =>
  `<text class="t cv-t ${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${text}</text>`;
const line = (a: P2, b: P2, cls: string) => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
/** Дуговая стрелка вращения вокруг оси, видимой сбоку. */
function spin(c: P2, ang: number, rx: number, cls: string) {
  const t = (ang * Math.PI) / 180;
  const u: P2 = [Math.cos(t), -Math.sin(t)],
    n: P2 = [-u[1], u[0]];
  const p = (a: number): P2 => [
    c[0] + n[0] * rx * Math.cos(a) + u[0] * rx * 0.35 * Math.sin(a),
    c[1] + n[1] * rx * Math.cos(a) + u[1] * rx * 0.35 * Math.sin(a),
  ];
  const pts = Array.from({ length: 13 }, (_, i) => p(-1.2 + (i * 2.6) / 12));
  const e = pts[pts.length - 1],
    d = pts[pts.length - 2];
  return `<path class="${cls}" d="M${pts.map((q) => `${r1(q[0])} ${r1(q[1])}`).join('L')}"/>` + arrow(d, e, cls);
}
function legend(out: string[], rows: [string, string][]) {
  rows.forEach(([k, v], i) => out.push(`<text class="rt-tick" x="700" y="${44 + i * 22}"><tspan font-weight="600">${k}</tspan> ${v}</text>`));
}

export function renderGyro(pr: GyroProblem, r: GyroResult) {
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const U = unitsOf(pr.units);
  const C: P2 = [330, 220];
  if (pr.mode === 'forced' && pr.sup !== 'roller') {
    // Ротор на оси A—B, ось прецессии под углом β.
    const A: P2 = [130, 220],
      B: P2 = [530, 220];
    const onPrec = pr.sup === 'prec';
    out.push(line(A, B, 'gy-shaft'));
    out.push(`<ellipse class="gy-rotor" cx="${C[0]}" cy="${C[1]}" rx="22" ry="80"/>`);
    out.push(spin([C[0] + 70, C[1]], 0, 34, 'gy-spin'), label(C[0] + 60, C[1] - 44, 'gy-t', 'ω'));
    const bt = (pr.beta * Math.PI) / 180;
    const pd: P2 = [Math.cos(bt), -Math.sin(bt)];
    out.push(line([C[0] - pd[0] * 170, C[1] - pd[1] * 170], [C[0] + pd[0] * 190, C[1] + pd[1] * 190], 'gy-prec'));
    const tip: P2 = [C[0] + pd[0] * 160, C[1] + pd[1] * 160];
    out.push(spin(tip, pr.beta, 26, 'gy-spin2'), label(tip[0] + 18, tip[1] - 18, 'gy-t2', 'ω₁'));
    // Опоры: на оси ротора или на оси прецессии.
    const sA: P2 = onPrec ? [C[0] - pd[0] * 150, C[1] - pd[1] * 150] : A,
      sB: P2 = onPrec ? [C[0] + pd[0] * 130, C[1] + pd[1] * 130] : B;
    for (const [s, name] of [
      [sA, 'A'],
      [sB, 'B'],
    ] as [P2, string][])
      out.push(`<path class="gy-sup" d="M${s[0]} ${s[1]}l-12 22h24z"/>`, label(s[0] - 20, s[1] + 4, 'gy-t3', name, 'end'));
    const dir = onPrec ? ([-pd[1], pd[0]] as P2) : ([0, -1] as P2);
    const k = r.sA;
    const tA: P2 = [sA[0] - dir[0] * 60 * k, sA[1] - dir[1] * 60 * k],
      tB: P2 = [sB[0] + dir[0] * 60 * k, sB[1] + dir[1] * 60 * k];
    out.push(arrow(sA, tA, 'gy-n'), arrow(sB, tB, 'gy-n'));
    out.push(label(tA[0] + 10, tA[1] + (tA[1] > sA[1] ? 4 : 10), 'gy-nt', 'ΔN'), label(tB[0] + 10, tB[1] + (tB[1] > sB[1] ? 4 : 10), 'gy-nt', 'ΔN'));
    legend(out, [
      ['J', `${fmt(r.J, 4)} ${U.J}`],
      ['ω', `${fmt(r.om, 4)} с⁻¹`],
      ['ω₁', `${fmt(r.w1, 4)} с⁻¹`],
      ['β', `${fmt(pr.beta, 2)}°`],
      ['M_г', `${fmt(r.M, 4)} ${U.M}`],
      ['ΔN', `${fmt(r.dN, 4)} ${U.F}`],
      ...(r.NA != null && r.NB != null ? ([['N_A, N_B', `${fmt(r.NA, 4)}; ${fmt(r.NB, 4)} ${U.F}`]] as [string, string][]) : []),
      ...(r.ratio != null ? ([['ΔN/N_ст', fmt(r.ratio, 4)]] as [string, string][]) : []),
    ]);
    note(out, 'Стрелки ΔN — давления ротора на опоры от гироскопического момента (пара сил); ω — вдоль оси от A к B.');
  } else if (pr.mode === 'forced') {
    // Бегун на основании: ось на шарнире на оси прецессии.
    const O: P2 = [200, 140],
      base = 330;
    const bt = (pr.beta * Math.PI) / 180;
    const ax: P2 = [Math.sin(bt), Math.cos(bt)];
    const Cw: P2 = [O[0] + ax[0] * 220, O[1] + ax[1] * 220];
    const R = Math.max(40, base - Cw[1]);
    out.push(line([O[0], 60], [O[0], base + 20], 'gy-prec'), line([60, base], [620, base], 'gy-base'));
    for (let x = 60; x <= 620; x += 16) out.push(line([x, base], [x - 8, base + 10], 'fp-hatch'));
    out.push(line(O, [O[0] + ax[0] * 260, O[1] + ax[1] * 260], 'gy-shaft'), `<circle class="gy-hinge" cx="${O[0]}" cy="${O[1]}" r="6"/>`);
    out.push(
      `<ellipse class="gy-rotor" cx="${r1(Cw[0])}" cy="${r1(Cw[1])}" rx="18" ry="${r1(R)}" transform="rotate(${r1(-(90 - pr.beta))} ${r1(Cw[0])} ${r1(Cw[1])})"/>`,
    );
    out.push(spin([O[0], 90], 90, 26, 'gy-spin2'), label(O[0] + 26, 76, 'gy-t2', 'ω₁'));
    out.push(arrow([Cw[0], base - 70], [Cw[0], base - 4], 'gy-n'), label(Cw[0] + 10, base - 40, 'gy-nt', 'ΔN'));
    legend(out, [
      ['J', `${fmt(r.J, 4)} ${U.J}`],
      ['ω', `${fmt(r.om, 4)} с⁻¹`],
      ['ω₁', `${fmt(r.w1, 4)} с⁻¹`],
      ['M_г', `${fmt(r.M, 4)} ${U.M}`],
      ['ΔN', `${fmt(r.dN, 4)} ${U.F}`],
      ...(r.NA != null ? ([['N', `${fmt(r.NA, 4)} ${U.F}`]] as [string, string][]) : []),
    ]);
    note(out, 'Бегун (коническое колесо) катится по неподвижному основанию; гироскопический момент прижимает его к основанию.');
  } else if (pr.mode === 'free') {
    const O: P2 = [330, 360];
    const th = (30 * Math.PI) / 180;
    const T: P2 = [O[0] + Math.sin(th) * 230, O[1] - Math.cos(th) * 230];
    out.push(line([O[0], 380], [O[0], 80], 'gy-prec'), `<ellipse class="gy-cone" cx="${O[0]}" cy="${r1(T[1])}" rx="${r1(T[0] - O[0])}" ry="26"/>`);
    out.push(line(O, T, 'gy-shaft'), `<path class="gy-sup" d="M${O[0]} ${O[1]}l-14 24h28z"/>`);
    const Cr: P2 = [O[0] + Math.sin(th) * 150, O[1] - Math.cos(th) * 150];
    out.push(`<ellipse class="gy-rotor" cx="${r1(Cr[0])}" cy="${r1(Cr[1])}" rx="70" ry="20" transform="rotate(${r1(30)} ${r1(Cr[0])} ${r1(Cr[1])})"/>`);
    out.push(spin([T[0] - 20, T[1] + 30], 60, 24, 'gy-spin'), label(T[0] + 6, T[1] + 4, 'gy-t', 'ω'));
    out.push(arrow([O[0] - 80, T[1] + 22], [O[0] - 30, T[1] + 30], 'gy-spin2'), label(O[0] - 96, T[1] + 18, 'gy-t2', 'ω_п', 'end'));
    legend(out, [
      ['H', `${fmt(r.H, 4)} ${U.H}`],
      ['M₀', `${fmt(r.M0, 4)} ${U.M}`],
      ['ω_п', `${fmt(r.wp, 4)} с⁻¹`],
      ['T', `${fmt(r.Tp, 4)} с`],
    ]);
    note(out, 'Ось гироскопа описывает конус вокруг направления, вдоль которого действует сила (прецессия); ω_п = M₀/H.');
  } else {
    // Рамка с пружинами или маятниковый гироскоп.
    out.push(`<rect class="gy-frame" x="190" y="110" width="280" height="220" rx="6"/>`, line([150, 220], [510, 220], 'gy-prec'));
    out.push(`<ellipse class="gy-rotor" cx="330" cy="220" rx="80" ry="24"/>`, line([330, 120], [330, 320], 'gy-shaft'));
    if (pr.bal === 'spring') {
      for (const x of [230, 430])
        out.push(`<path class="gy-spring" d="M${x} 330l0 12l-8 6l16 8l-16 8l16 8l-8 6l0 12"/>`, line([x - 14, 390], [x + 14, 390], 'gy-base'));
      note(out, 'Рамка поворачивается вокруг оси до равновесия моментов пружин и гироскопического момента.');
    } else {
      out.push(arrow([330, 250], [330, 330], 'gy-n'), label(340, 320, 'gy-nt', 'P'));
      const g = (pr.gam * Math.PI) / 180;
      out.push(
        arrow([330, 220], [330 + Math.sin(g) * 150, 220 - Math.cos(g) * 150], 'gy-spin2'),
        label(330 + Math.sin(g) * 150 + 6, 220 - Math.cos(g) * 150, 'gy-t2', 'Ω_о'),
      );
      note(out, 'Ось основания (Земли) — в плоскости поворота рамки под углом γ к вертикали; вес с плечом создаёт статический момент.');
    }
    legend(out, [
      ['Jω', `${fmt(r.H, 4)} ${U.H}`],
      ['α', `${fmt(r.alpha, 4)}°`],
    ]);
  }
  return wrap(out);
}
