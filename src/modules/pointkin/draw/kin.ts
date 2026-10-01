/** Чертёж: траектория в плоскости xy в одном масштабе с векторами скорости и ускорения; для естественного способа — графики s(t), v(t). */
import { evalExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import { trajectory, type KinProblem, type KinResult } from '../model/kin';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

export function renderKin(pr: KinProblem, r: KinResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте формулы закона движения.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  if (pr.mode === 'natural') {
    const ta = pr.t2 > pr.t1 ? pr.t1 : 0,
      tb = pr.t2 > pr.t1 ? pr.t2 : Math.max(pr.t, 1);
    const S: P2[] = [],
      V: P2[] = [];
    for (let i = 0; i <= 400; i++) {
      const t = ta + ((tb - ta) * i) / 400;
      S.push([t - ta, evalExpr(r.f[0].e, t)]);
      V.push([t - ta, evalExpr(r.f[0].d1, t)]);
    }
    out.push(plot(80, 60, 380, 330, S, 's', 'ед. длины', 'с'), plot(570, 60, 380, 330, V, 'v', 'ед./с', 'с'));
    out.push(`<text class="tb-note" x="16" y="${H - 14}">Путь и скорость по времени. Траектория задана радиусом кривизны ρ = ${pr.rho > 0 ? fmt(pr.rho, 4) : '∞'}.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const pts = trajectory(pr, r);
  const P: P2 = [r.pos[0], r.pos[1]];
  const all = [...pts, P, [0, 0] as P2];
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const k = Math.min((W - 260) / Math.max(x1 - x0, 1e-9), (H - 160) / Math.max(y1 - y0, 1e-9));
  const ox = 130 + (W - 260 - (x1 - x0) * k) / 2,
    oy = H - 80 - (H - 160 - (y1 - y0) * k) / 2;
  const S = (p: P2): P2 => [ox + (p[0] - x0) * k, oy - (p[1] - y0) * k];
  const O = S([0, 0]);
  out.push(`<line class="sb-axis" x1="50" y1="${r1(O[1])}" x2="${W - 50}" y2="${r1(O[1])}"/><text class="sb-axt" x="${W - 42}" y="${r1(O[1] + 5)}">x</text><line class="sb-axis" x1="${r1(O[0])}" y1="${H - 40}" x2="${r1(O[0])}" y2="30"/><text class="sb-axt" x="${r1(O[0] + 6)}" y="28">y</text>`);
  const step = Math.max(1, Math.floor(pts.length / 800));
  out.push(`<path class="rt-line" d="M${pts.filter((_, i) => i % step === 0).map((p) => S(p).map(r1).join(' ')).join('L')}"/>`);
  const M = S(P);
  // Векторы v и a — направление по проекциям на xy, длина — 90 px у большего.
  const vv: P2 = [r.vel[0], r.vel[1]],
    aa: P2 = [r.acc[0], r.acc[1]];
  const nv = Math.hypot(...vv),
    na = Math.hypot(...aa);
  if (nv > 1e-12) out.push(arrow(M, [M[0] + (vv[0] / nv) * 90, M[1] - (vv[1] / nv) * 90], 'en-v'), `<text class="t cv-t en-vt" x="${r1(M[0] + (vv[0] / nv) * 104)}" y="${r1(M[1] - (vv[1] / nv) * 104 + 4)}">v = ${fmt(r.v, 4)}</text>`);
  if (na > 1e-12) out.push(arrow(M, [M[0] + (aa[0] / na) * 70, M[1] - (aa[1] / na) * 70], 'cv-r'), `<text class="t cv-t t-cvr" x="${r1(M[0] + (aa[0] / na) * 84)}" y="${r1(M[1] - (aa[1] / na) * 84 + 4)}">a = ${fmt(r.a, 4)}</text>`);
  out.push(`<circle class="cg-c" cx="${r1(M[0])}" cy="${r1(M[1])}" r="5"/>`);
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Траектория${pr.mode === 'coord' && pr.z.trim() ? ' (проекция на xy)' : ''} в одном масштабе; в момент t = ${fmt(pr.t, 4)} — скорость (синяя) и ускорение (красная).</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
