/**
 * Чертежи центроид: в неподвижной плоскости — неподвижная центроида (синяя), подвижная центроида в текущем положении
 * (красная), тело и мгновенный центр P; во второй плоскости — подвижная центроида в подвижных осях ξη.
 */
import type { Centrodes, Pose, V2 } from '../model/centrodes';

const r1 = (v: number) => Math.round(v * 10) / 10;

interface View {
  S: (p: V2) => [number, number];
  W: number;
  H: number;
  k: number;
}

function view(points: V2[], W = 1000, maxH = 520, pad = 50): View {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  let x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  if (!isFinite(x0)) ((x0 = -1), (x1 = 1), (y0 = -1), (y1 = 1));
  const w = Math.max(x1 - x0, 1e-9),
    h = Math.max(y1 - y0, 1e-9);
  const k = Math.min((W - 2 * pad) / w, (maxH - 2 * pad) / h);
  const H = Math.round(h * k + 2 * pad);
  const ox = pad + (W - 2 * pad - w * k) / 2 - x0 * k,
    oy = pad + h * k + y0 * k;
  return { S: (p) => [ox + p[0] * k, oy - p[1] * k], W, H, k };
}

const path = (v: View, line: V2[]) => line.map((p, i) => `${i ? 'L' : 'M'}${r1(v.S(p)[0])} ${r1(v.S(p)[1])}`).join('');

function axes(v: View, labels: [string, string], origin: V2, len: number): string {
  const [ox, oy] = v.S(origin);
  const L = len * v.k;
  const out: string[] = [];
  out.push(
    `<line x1="${r1(ox - L * 0.15)}" y1="${r1(oy)}" x2="${r1(ox + L)}" y2="${r1(oy)}" class="ce-axis"/><text x="${r1(ox + L + 6)}" y="${r1(oy + 5)}" class="ce-axt">${labels[0]}</text>`,
  );
  out.push(
    `<line x1="${r1(ox)}" y1="${r1(oy + L * 0.15)}" x2="${r1(ox)}" y2="${r1(oy - L)}" class="ce-axis"/><text x="${r1(ox + 6)}" y="${r1(oy - L - 4)}" class="ce-axt">${labels[1]}</text>`,
  );
  return out.join('');
}

function support(p: [number, number]): string {
  return `<polygon points="${r1(p[0])},${r1(p[1] + 4)} ${r1(p[0] - 11)},${r1(p[1] + 22)} ${r1(p[0] + 11)},${r1(p[1] + 22)}" class="sup"/>`;
}

export function renderFixed(cen: Centrodes, pose: Pose | null): { svg: string; viewBox: string } {
  const toFixed = (l: V2) =>
    pose ? ([pose.origin[0] + l[0] * pose.xi[0] + l[1] * pose.eta[0], pose.origin[1] + l[0] * pose.xi[1] + l[1] * pose.eta[1]] as V2) : l;
  const movF = pose ? cen.moving.map((line) => line.map(toFixed)) : [];
  const pts: V2[] = [...cen.fixed.flat(), ...movF.flat(), [0, 0]];
  if (pose) {
    pts.push(...pose.lines.flat(), ...pose.fixedPts.map((p) => p.p));
    for (const c of pose.circles) pts.push([c.c[0] + c.r, c.c[1]], [c.c[0] - c.r, c.c[1]], [c.c[0], c.c[1] + c.r], [c.c[0], c.c[1] - c.r]);
  }
  const v = view(pts);
  const span = Math.max(1, Math.min(v.W, v.H) / v.k / 4);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  out.push(axes(v, ['x', 'y'], [0, 0], span));
  for (const l of cen.fixed) out.push(`<path d="${path(v, l)}" class="ce-fixed"/>`);
  if (pose) {
    for (const l of movF) out.push(`<path d="${path(v, l)}" class="ce-moving"/>`);
    for (const c of pose.circles) {
      const [cx, cy] = v.S(c.c);
      out.push(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(c.r * v.k)}" class="ce-body ce-disc"/>`);
    }
    for (const l of pose.lines) out.push(`<path d="${path(v, l)}" class="ce-body"/>`);
    for (const f of pose.fixedPts) {
      const q = v.S(f.p);
      out.push(support(q), `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="4.5" class="hinge"/>`);
    }
    const o = v.S(pose.origin);
    out.push(`<circle cx="${r1(o[0])}" cy="${r1(o[1])}" r="3.5" class="ce-pt"/>`);
    if (pose.ic) {
      const q = v.S(pose.ic);
      out.push(`<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="6.5" class="ce-ic"/><text x="${r1(q[0] + 10)}" y="${r1(q[1] - 9)}" class="t-pt">P</text>`);
    }
  }
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note"><tspan class="ce-lf">━ неподвижная центроида</tspan><tspan dx="18" class="ce-lm">━ подвижная центроида (в текущем положении)</tspan></text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}

export function renderMoving(cen: Centrodes, pose: Pose | null): { svg: string; viewBox: string } {
  const toLocal = (p: V2): V2 =>
    pose
      ? [
          (p[0] - pose.origin[0]) * pose.xi[0] + (p[1] - pose.origin[1]) * pose.xi[1],
          (p[0] - pose.origin[0]) * pose.eta[0] + (p[1] - pose.origin[1]) * pose.eta[1],
        ]
      : p;
  const lines = pose ? pose.lines.map((l) => l.map(toLocal)) : [];
  const circles = pose ? pose.circles.map((c) => ({ c: toLocal(c.c), r: c.r })) : [];
  const pts: V2[] = [...cen.moving.flat(), ...lines.flat(), [0, 0]];
  for (const c of circles) pts.push([c.c[0] + c.r, c.c[1]], [c.c[0] - c.r, c.c[1]], [c.c[0], c.c[1] + c.r], [c.c[0], c.c[1] - c.r]);
  const v = view(pts, 1000, 420);
  const span = Math.max(1, Math.min(v.W, v.H) / v.k / 4);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  out.push(axes(v, ['ξ', 'η'], [0, 0], span));
  for (const l of cen.moving) out.push(`<path d="${path(v, l)}" class="ce-moving"/>`);
  for (const c of circles) {
    const [cx, cy] = v.S(c.c);
    out.push(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(c.r * v.k)}" class="ce-body ce-disc"/>`);
  }
  for (const l of lines) out.push(`<path d="${path(v, l)}" class="ce-body"/>`);
  if (pose?.local) {
    const q = v.S(pose.local);
    out.push(`<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="6.5" class="ce-ic"/><text x="${r1(q[0] + 10)}" y="${r1(q[1] - 9)}" class="t-pt">P</text>`);
  }
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note">Тело и подвижная центроида в подвижных осях ξη (начало — точка тела, оси жёстко связаны с телом).</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}
