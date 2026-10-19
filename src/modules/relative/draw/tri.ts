/** Чертёж: треугольник скоростей (ускорений) — v_e из начала, v_r из конца v_e, v — замыкающая; второе наблюдение рядом. */
import { fmt } from '../../../shared/format';
import { unit, type TriProblem, type TriResult, type TriSol } from '../model/tri';
import { arrow } from './earth';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
type P2 = [number, number];

export function renderTri(p: TriProblem, r: TriResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok || !r.sols.length) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">${r.errors[0] ?? 'Нет решения.'}</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const L = p.what === 'v' ? 'v' : 'a';
  const V = (q: { mod: number; dir: number | null }): P2 => {
    if (q.dir == null) return [0, 0];
    const u = unit(q.dir, p.compass);
    return [q.mod * u[0], q.mod * u[1]];
  };
  const C: P2 =
    p.what === 'a'
      ? (() => {
          const u = unit(p.c.dir, p.compass);
          return [p.c.mod * u[0], p.c.mod * u[1]];
        })()
      : [0, 0];
  // Треугольники: [начало, конец v_e, конец v_e + v_r, (конец + a_c)].
  type T = { e: P2; r: P2; v: P2 };
  const tris: { t: T; dash: boolean; label: string }[] = [];
  const mk = (s: TriSol, two: boolean): T => (two ? { e: V(s.e2!), r: V(s.r2!), v: V(s.v2!) } : { e: V(s.e), r: V(s.r), v: V(s.v) });
  r.sols.forEach((s, i) => {
    tris.push({ t: mk(s, false), dash: i > 0, label: r.sols.length > 1 ? `решение ${i + 1}` : '' });
    if (p.two && s.v2) tris.push({ t: mk(s, true), dash: false, label: '' });
  });
  const pts: P2[] = [[0, 0]];
  for (const { t } of tris) pts.push(t.e, [t.e[0] + t.r[0], t.e[1] + t.r[1]], t.v);
  const xs = pts.map((q) => q[0]),
    ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const k = Math.min(760 / Math.max(x1 - x0, 1e-9), 380 / Math.max(y1 - y0, 1e-9));
  const ox = 120 + (760 - (x1 - x0) * k) / 2 - x0 * k,
    oy = 60 + (380 - (y1 - y0) * k) / 2 + y1 * k;
  const S = (q: P2): P2 => [ox + q[0] * k, oy - q[1] * k];
  const O = S([0, 0]);
  out.push(
    `<line class="sb-axis" x1="40" y1="${r1(O[1])}" x2="${W - 40}" y2="${r1(O[1])}"/><text class="sb-axt" x="${W - 60}" y="${r1(O[1] - 6)}">${p.compass ? 'восток' : 'x'}</text><line class="sb-axis" x1="${r1(O[0])}" y1="${H - 50}" x2="${r1(O[0])}" y2="24"/><text class="sb-axt" x="${r1(O[0] + 6)}" y="22">${p.compass ? 'север' : 'y'}</text>`,
  );
  const lab = (a: P2, b: P2, text: string, cls: string) => {
    const m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n: P2 = [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
    return `<text class="t cv-t rl-t ${cls}-t" text-anchor="middle" x="${r1(m[0] + n[0] * 20)}" y="${r1(m[1] + n[1] * 20 + 4)}">${text}</text>`;
  };
  for (const { t, dash, label } of tris) {
    const A = O,
      B = S(t.e),
      Cc = S([t.e[0] + t.r[0], t.e[1] + t.r[1]]),
      Dd = S(t.v);
    const cls = (c: string) => c;
    if (dash) out.push('<g opacity="0.5">');
    if (Math.hypot(t.e[0], t.e[1]) > 0) out.push(arrow(A, B, cls('rl-e')), lab(A, B, `${L}ₑ = ${fmt(Math.hypot(...t.e), 3)}`, 'rl-e'));
    if (Math.hypot(t.r[0], t.r[1]) > 0) out.push(arrow(B, Cc, cls('rl-r')), lab(B, Cc, `${L}ᵣ = ${fmt(Math.hypot(...t.r), 3)}`, 'rl-r'));
    if (p.what === 'a' && Math.hypot(...C) > 0) out.push(arrow(Cc, Dd, cls('rl-c')), lab(Cc, Dd, `a_c = ${fmt(Math.hypot(...C), 3)}`, 'rl-c'));
    if (Math.hypot(t.v[0], t.v[1]) > 0) out.push(arrow(A, Dd, cls('en-v')), lab(Dd, A, `${L} = ${fmt(Math.hypot(...t.v), 3)}`, 'en-v'));
    if (label) out.push(`<text class="tb-note" x="${r1(Dd[0] + 8)}" y="${r1(Dd[1] - 8)}">${label}</text>`);
    if (dash) out.push('</g>');
  }
  out.push(`<circle class="cg-c" cx="${r1(O[0])}" cy="${r1(O[1])}" r="4"/>`);
  out.push(
    `<text class="tb-note" x="16" y="${H - 12}">Серая — переносная, зелёная — относительная, синяя — абсолютная${p.what === 'a' ? ', коричневая — кориолисово ускорение' : ''}${p.two ? '; два наблюдения — два треугольника с общим вектором' : r.sols.length > 1 ? '; бледнее — второе решение' : ''}. Направления — ${p.compass ? 'курсом (от севера по часовой)' : 'от оси x против часовой стрелки'}.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
