/** Чертежи: траектория в плоскости (в одном масштабе по осям) и график силы по времени. */
import { evalExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import type { FirstProblem, FirstResult } from '../model/first';
import type { PlaneProblem, PlaneResult } from '../model/plane';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;

/** Траектория y(x) в равном масштабе; отмечены начало, конец и высшая точка. */
function trajectory(pts: [number, number][], box: [number, number, number, number], marks: { p: [number, number]; cls: string; label: string }[], extra: (S: (x: number, y: number) => [number, number]) => string = () => ''): string {
  const [bx, by, bw, bh] = box;
  const xs = pts.map((p) => p[0]).concat(marks.map((m) => m.p[0]), [0]),
    ys = pts.map((p) => p[1]).concat(marks.map((m) => m.p[1]), [0]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const k = Math.min(bw / Math.max(x1 - x0, 1e-9), bh / Math.max(y1 - y0, 1e-9));
  const ox = bx + (bw - (x1 - x0) * k) / 2,
    oy = by + bh - (bh - (y1 - y0) * k) / 2;
  const S = (x: number, y: number): [number, number] => [ox + (x - x0) * k, oy - (y - y0) * k];
  const out: string[] = [];
  const [Ox, Oy] = S(0, 0);
  out.push(`<line class="sb-axis" x1="${r1(bx)}" y1="${r1(Oy)}" x2="${r1(bx + bw)}" y2="${r1(Oy)}"/><text class="sb-axt" x="${r1(bx + bw + 8)}" y="${r1(Oy + 5)}">x</text>`);
  out.push(`<line class="sb-axis" x1="${r1(Ox)}" y1="${r1(by + bh)}" x2="${r1(Ox)}" y2="${r1(by)}"/><text class="sb-axt" x="${r1(Ox + 6)}" y="${r1(by - 4)}">y</text>`);
  out.push(extra(S));
  const step = Math.max(1, Math.floor(pts.length / 800));
  const sel = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  out.push(`<path class="rt-line" d="M${sel.map(([x, y]) => S(x, y).map(r1).join(' ')).join('L')}"/>`);
  for (const m of marks) {
    const [px, py] = S(m.p[0], m.p[1]);
    out.push(`<circle class="${m.cls}" cx="${r1(px)}" cy="${r1(py)}" r="5"><title>${m.label}</title></circle><text class="rt-val cv-t" x="${r1(px + 8)}" y="${r1(py - 8)}">${m.label}</text>`);
  }
  return out.join('');
}

export function renderPlane(pr: PlaneProblem, r: PlaneResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok || r.path.length < 2) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Нет данных для траектории.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const marks = [{ p: [pr.x0, pr.y0] as [number, number], cls: 'cg-ci', label: 'начало' }];
  if (r.apex && pr.ask !== 'apex') marks.push({ p: [r.apex.x, r.apex.y], cls: 'cg-ci', label: `h = ${fmt(r.apex.y, 4)}` });
  marks.push({ p: [r.x, r.y], cls: 'rt-end', label: `(${fmt(r.x, 4)}; ${fmt(r.y, 4)})` });
  out.push(
    trajectory(
      r.path.map((p) => [p.x, p.y]),
      [70, 50, W - 160, H - 130],
      marks,
      (S) => {
        const s: string[] = [];
        if (pr.c) {
          const [cx, cy] = S(pr.cx, pr.cy);
          s.push(`<circle class="hinge" cx="${r1(cx)}" cy="${r1(cy)}" r="5"/><text class="t-pt" x="${r1(cx + 8)}" y="${r1(cy + 16)}">C</text>`);
        }
        return s.join('');
      },
    ),
  );
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Траектория в одном масштабе по осям x и y (м); y — вверх${pr.gravity ? ', сила тяжести вдоль −y' : ''}.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

export function renderFirst(pr: FirstProblem, r: FirstResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте формулы закона движения.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  // Траектория по закону движения на отрезке (или около момента t).
  const ta = pr.t2 > pr.t1 ? pr.t1 : Math.max(0, pr.t - 1),
    tb = pr.t2 > pr.t1 ? pr.t2 : pr.t + 1;
  const planeYZ = pr.x.trim() === '' && pr.y.trim() !== '' && pr.z.trim() !== '';
  const ia = planeYZ ? 1 : 0,
    ib = planeYZ ? 2 : pr.y.trim() !== '' ? 1 : -1;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 600; i++) {
    const t = ta + ((tb - ta) * i) / 600;
    const a = evalExpr(r.r[ia], t),
      bb = ib >= 0 ? evalExpr(r.r[ib], t) : t;
    if (Number.isFinite(a) && Number.isFinite(bb)) pts.push(ib >= 0 ? [a, bb] : [bb, a]);
  }
  const hasCurve = r.curve.length > 1;
  const left: [number, number, number, number] = hasCurve ? [70, 60, 380, 320] : [90, 60, W - 200, H - 140];
  if (ib >= 0) out.push(trajectory(pts, left, [{ p: [r.rt[ia], r.rt[ib as 1 | 2]], cls: 'rt-end', label: `t = ${fmt(pr.t, 4)}` }]));
  else out.push(plot(left[0], left[1], left[2], left[3], pts, 'x', 'м', 'с'));
  if (hasCurve) out.push(plot(580, 60, 380, 320, r.curve.map((c) => [c.t - pr.t1, c.F]), '|F|', pr.byWeight ? 'кГ' : 'Н', `с (от ${fmt(pr.t1, 3)})`));
  out.push(`<text class="tb-note" x="16" y="${H - 14}">${ib >= 0 ? 'Траектория по закону движения; точка — положение в момент t.' : 'Закон движения x(t).'}${hasCurve ? ' Справа — модуль искомой силы на отрезке.' : ''}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
