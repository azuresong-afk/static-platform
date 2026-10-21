/** Чертежи режимов «путь», «интегрирование», «колебания», «бросок», «кулачок»: графики по времени и кривые в плоскости. */
import { evalExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import type { CamRot, CamTrans } from '../model/cam';
import type { HarmResult, IntegResult, PathResult, ShotResult } from '../model/ext';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];
type Fig = { svg: string; viewBox: string };
const base = () => [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
const done = (out: string[]): Fig => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const note = (out: string[], text: string) => out.push(`<text class="tb-note" x="16" y="${H - 14}">${text}</text>`);
const empty = (text: string): Fig => {
  const out = base();
  out.push(`<text class="tb-note" x="16" y="${H / 2}">${text}</text>`);
  return done(out);
};

/** Отображение плоской области в прямоугольник чертежа в одном масштабе. */
function frame(pts: P2[], x0: number, y0: number, w: number, h: number, pad = 0) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const a = Math.min(...xs),
    b = Math.max(...xs),
    c = Math.min(...ys),
    d = Math.max(...ys);
  const k = Math.min((w - 2 * pad) / Math.max(b - a, 1e-9), (h - 2 * pad) / Math.max(d - c, 1e-9));
  const ox = x0 + pad + (w - 2 * pad - (b - a) * k) / 2,
    oy = y0 + h - pad - (h - 2 * pad - (d - c) * k) / 2;
  return { k, S: (p: P2): P2 => [ox + (p[0] - a) * k, oy - (p[1] - c) * k] };
}
const poly = (pts: P2[], cls: string, close = false) => {
  const step = Math.max(1, Math.floor(pts.length / 700));
  const sel = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  return `<path class="${cls}" fill="none" d="M${sel.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}${close ? 'Z' : ''}"/>`;
};
const dot = (p: P2, cls = 'cg-c', r = 5) => `<circle class="${cls}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}"/>`;
const label = (p: P2, text: string, dx = 8, dy = -8) => `<text class="t cv-t" x="${r1(p[0] + dx)}" y="${r1(p[1] + dy)}">${text}</text>`;

export function renderPath(r: PathResult): Fig {
  if (!r.ok) return empty('Проверьте формулы и промежуток времени.');
  const out = base();
  if (r.src === 's') {
    const N = 400;
    const S: P2[] = [],
      V: P2[] = [];
    for (let i = 0; i <= N; i++) {
      const t = r.t1 + ((r.t2 - r.t1) * i) / N;
      S.push([t - r.t1, evalAt(r, 0, t)]);
      V.push([t - r.t1, evalAt(r, 1, t)]);
    }
    out.push(plot(80, 60, 380, 330, S, 's', 'ед. длины', 'с от t₁'), plot(570, 60, 380, 330, V, 'ṡ', 'ед./с', 'с от t₁'));
    note(
      out,
      `Закон движения по траектории s(t) и скорость ṡ; путь σ = ${fmt(r.path, 4)}, остановки со сменой направления: ${r.turns.length ? r.turns.map((t) => fmt(t.t, 4)).join('; ') : 'нет'}.`,
    );
    return done(out);
  }
  const pts: P2[] = [];
  for (let i = 0; i <= 400; i++) {
    const t = r.t1 + ((r.t2 - r.t1) * i) / 400;
    pts.push([evalAt(r, 0, t), evalAt(r, 1, t)]);
  }
  const all = [...pts, ...r.rows.map((q) => [q.pos![0], q.pos![1]] as P2)];
  const { S } = frame(all, 90, 40, W - 180, H - 110);
  out.push(poly(pts.map(S), 'rt-line'));
  r.rows.forEach((q, i) => {
    const p = S([q.pos![0], q.pos![1]]);
    out.push(dot(p, 'cg-c', 4), label(p, String(i + 1)));
  });
  note(out, `Траектория (проекция на xy) и ${r.rows.length} положений через равные промежутки времени; путь σ = ${fmt(r.path, 4)}.`);
  return done(out);
}
function evalAt(r: PathResult, i: number, t: number): number {
  // Формулы: у s(t) — [s, ṡ]; у координат — x(t), y(t).
  const e = r.src === 's' ? (i === 0 ? r.f[0].e : r.f[0].d1) : r.f[i]?.e;
  return e ? evalExpr(e, t) : 0;
}

export function renderInteg(r: IntegResult): Fig {
  if (!r.ok || r.curve.length < 2) return empty('Задайте ускорение (или скорость) и начальные условия.');
  const out = base();
  const w = 270;
  const c = (k: 'a' | 'v' | 'x'): P2[] => r.curve.map((q) => [q.t - r.curve[0].t, q[k]]);
  out.push(
    plot(70, 60, w, 330, c('a'), 'a', 'ед./с²', 'с'),
    plot(70 + w + 90, 60, w, 330, c('v'), 'v', 'ед./с', 'с'),
    plot(70 + 2 * (w + 90), 60, w, 330, c('x'), 'x', 'ед. длины', 'с'),
  );
  note(out, `Ускорение, скорость и положение по времени (отсчёт от t = ${fmt(r.curve[0].t, 3)} с${r.numeric ? '; численное интегрирование' : ''}).`);
  return done(out);
}

export function renderHarm(r: HarmResult): Fig {
  if (!r.ok) return empty('Проверьте закон: нужно x = a₀ + a·sin(kt + ε).');
  const out = base();
  const X: P2[] = r.curve.map((q) => [q.t - r.curve[0].t, q.x]);
  const V: P2[] = r.curve.map((q) => [q.t - r.curve[0].t, r.a * r.k * Math.cos(r.k * q.t + r.eps)]);
  out.push(plot(80, 60, 380, 330, X, 'x', 'ед. длины', 'с'), plot(570, 60, 380, 330, V, 'ẋ', 'ед./с', 'с'));
  note(out, `Колебание: центр ${fmt(r.a0, 4)}, амплитуда ${fmt(r.a, 4)}, период ${fmt(r.T, 4)} с.`);
  return done(out);
}

export function renderShot(r: ShotResult): Fig {
  if (!r.ok) return empty('Проверьте начальную скорость, угол и g.');
  const out = base();
  const all: P2[] = [...r.curve, ...r.safe, [0, 0]];
  if (r.target) all.push([r.target.x, r.target.y]);
  const { S } = frame(all, 70, 30, W - 140, H - 90, 10);
  const O = S([0, 0]);
  out.push(
    `<line class="sb-axis" x1="40" y1="${r1(O[1])}" x2="${W - 40}" y2="${r1(O[1])}"/><text class="sb-axt" x="${W - 36}" y="${r1(O[1] + 5)}">x</text><line class="sb-axis" x1="${r1(O[0])}" y1="${H - 50}" x2="${r1(O[0])}" y2="24"/><text class="sb-axt" x="${r1(O[0] + 6)}" y="22">y</text>`,
  );
  if (r.safe.length) out.push(poly(r.safe.map(S), 'cv-r'));
  out.push(poly(r.curve.map(S), 'rt-line'));
  const top = S([r.v0 * Math.cos((r.alpha * Math.PI) / 180) * r.tTop, r.H]);
  out.push(dot(top, 'cg-c', 4), label(top, `H = ${fmt(r.H, 3)}`, 8, -8));
  const end = S([r.L, 0]);
  out.push(dot(end, 'cg-c', 4), label(end, `L = ${fmt(r.L, 3)}`, -30, 20));
  if (r.target) out.push(`<circle class="en-v" cx="${r1(S([r.target.x, r.target.y])[0])}" cy="${r1(S([r.target.x, r.target.y])[1])}" r="6" fill="none"/>`);
  note(out, 'Траектория (синяя) и парабола безопасности (красная) — граница области, которой может достичь снаряд при данной скорости.');
  return done(out);
}

/** Кулачок с вращением: контур в положении, соответствующем моменту t, толкатель вдоль оси x, график x(t). */
export function renderCamRot(r: CamRot): Fig {
  if (!r.ok) return empty('Проверьте участки закона или контура.');
  const out = base();
  const ang = r.at.phi;
  const prof: P2[] = r.prof.map((q) => [q.r * Math.cos(q.phi + ang), q.r * Math.sin(q.phi + ang)]);
  const R = r.rMax * 1.08;
  // Контур — слева, график — справа; ось толкателя — горизонталь (к точке контура φ = 0 в начальном положении).
  const box = frame([...prof, [R, 0], [-R, 0], [0, R], [0, -R]], 40, 30, 420, 380);
  const S = box.S;
  out.push(poly(prof.map(S), 'rt-line', true));
  const O = S([0, 0]);
  const tip = S([r.at.x, 0]);
  out.push(`<line class="sb-axis" x1="${r1(O[0] - R * box.k)}" y1="${r1(O[1])}" x2="${r1(S([R * 1.15, 0])[0])}" y2="${r1(O[1])}"/>`);
  out.push(`<line class="en-v" x1="${r1(tip[0])}" y1="${r1(tip[1])}" x2="${r1(S([R * 1.15, 0])[0])}" y2="${r1(tip[1])}" stroke-width="5"/>`);
  out.push(dot(O, 'cg-c', 4), label(O, 'O', -14, 18), dot(tip, 'cg-c', 5), label(tip, `x = ${fmt(r.at.x, 3)}`, 8, -10));
  out.push(
    plot(
      540,
      60,
      420,
      330,
      r.curve.map((q) => [q.t, q.x]),
      'x',
      'ед. длины',
      'с',
    ),
  );
  note(
    out,
    `Контур кулака при t = ${fmt(r.at.t, 3)} с (φ = ${fmt((ang * 180) / Math.PI, 2)}°) и закон движения толкателя за один оборот T = ${fmt(r.T, 4)} с.`,
  );
  return done(out);
}

/** Поступательно движущийся круговой кулак: круг и толкатель, график опускания h(t). */
export function renderCamTrans(r: CamTrans): Fig {
  if (!r.ok) return empty('Проверьте радиус, скорость и ускорение кулака.');
  const out = base();
  const k = Math.min(400 / (2 * r.r), 1e9);
  const cx = 250,
    cy = 330;
  const u = r.u;
  const ccx = cx + u * k,
    ccy = cy; // центр круга; низ — на уровне опоры
  const topY = cy - r.r * k;
  out.push(`<line class="sb-axis" x1="40" y1="${cy + r.r * k}" x2="470" y2="${cy + r.r * k}"/>`);
  out.push(`<circle class="rt-line" cx="${r1(ccx)}" cy="${r1(ccy)}" r="${r1(r.r * k)}" fill="none"/>`);
  out.push(`<line class="sb-axis" x1="${cx}" y1="30" x2="${cx}" y2="${r1(topY + r.h * k)}" stroke-dasharray="4 4"/>`);
  out.push(`<line class="en-v" x1="${cx}" y1="50" x2="${cx}" y2="${r1(topY + r.h * k)}" stroke-width="5"/>`);
  out.push(
    dot([ccx, ccy], 'cg-c', 4),
    dot([cx, topY + r.h * k], 'cg-c', 5),
    label([cx, topY + r.h * k], `h = ${fmt(r.h, 4)}`, 10, -6),
    label([ccx, ccy], `u = ${fmt(u, 4)}`, 8, 18),
  );
  out.push(
    plot(
      540,
      60,
      420,
      330,
      r.curve.map((q) => [q.t, q.h]),
      'h',
      'ед. длины',
      'с',
    ),
  );
  note(out, 'Кулак — круг радиуса r, движется по горизонтали; толкатель вертикален и касается круга сверху (h — опускание от наивысшего положения).');
  return done(out);
}
