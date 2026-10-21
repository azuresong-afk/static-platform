/** Чертёж движения по окружности: схема (связь, начальное положение, скорость, пружина, событие) и график N(φ). */
import { fmt } from '../../../shared/format';
import { ticks } from '../../rotation/draw/rotation';
import type { CircleProblem, CircleResult } from '../model/circle';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
const rad = (a: number) => (a * Math.PI) / 180;
export const LINK_NAME: Record<CircleProblem['link'], string> = {
  thread: 'нить',
  inner: 'внутренняя поверхность',
  outer: 'внешняя поверхность',
  rod: 'двусторонняя (стержень, трубка, кольцо на проволоке)',
};

export function renderCircle(pr: CircleProblem, r: CircleResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  // Схема: окружность радиусом 150 px; точки пружины — в том же масштабе.
  const cx = 250,
    cy = 230,
    Rp = 150,
    k = Rp / pr.R;
  const P = (phi: number): [number, number] => [cx + Rp * Math.sin(rad(phi)), cy + Rp * Math.cos(rad(phi))];
  out.push(`<circle class="${pr.link === 'outer' ? 'mc-wheel' : pr.link === 'inner' ? 'mc-wheel0' : 'mc-path'}" cx="${cx}" cy="${cy}" r="${Rp}"/>`);
  if (pr.link === 'inner' || pr.link === 'outer')
    out.push(`<circle class="mc-ground" cx="${cx}" cy="${cy}" r="${pr.link === 'inner' ? Rp + 5 : Rp - 5}" fill="none" stroke-dasharray="3 5"/>`);
  const [mx, my] = P(pr.phi0);
  if (pr.link === 'thread' || pr.link === 'rod')
    out.push(`<line class="${pr.link === 'rod' ? 'mc-bar' : 'mc-spoke'}" x1="${cx}" y1="${cy}" x2="${r1(mx)}" y2="${r1(my)}"/>`);
  out.push(`<circle class="mc-pivot" cx="${cx}" cy="${cy}" r="5"/><text class="t-pt" x="${cx + 8}" y="${cy - 8}">O</text>`);
  if (pr.spring && pr.c) {
    const ax = cx + pr.ax * k,
      ay = cy - pr.ay * k;
    out.push(
      `<line class="mc-guide" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(mx)}" y2="${r1(my)}"/><circle class="hinge" cx="${r1(ax)}" cy="${r1(ay)}" r="5"/><text class="t-pt" x="${r1(ax + 8)}" y="${r1(ay - 8)}">A</text>`,
    );
  }
  out.push(`<circle class="cg-ci" cx="${r1(mx)}" cy="${r1(my)}" r="7"/><text class="t-pt" x="${r1(mx + 10)}" y="${r1(my + 18)}">M₀</text>`);
  if (r.dir !== 0 && Math.abs(pr.v0) > 0) {
    // Скорость — по касательной в сторону движения.
    const t: [number, number] = [Math.cos(rad(pr.phi0)) * r.dir, -Math.sin(rad(pr.phi0)) * r.dir];
    out.push(
      `<line class="ld" x1="${r1(mx)}" y1="${r1(my)}" x2="${r1(mx + 60 * t[0])}" y2="${r1(my + 60 * t[1])}" marker-end="url(#ar)"/><text class="t-ld" x="${r1(mx + 70 * t[0])}" y="${r1(my + 70 * t[1])}">v₀</text>`,
    );
  }
  // Асимптотический возврат в исходное положение (толчок из неустойчивого равновесия) не отмечаем.
  const ev = r.fwd && r.fwd.kind !== 'round' && Math.abs(r.fwd.phi - pr.phi0) < 360 - 1e-9 ? r.fwd : null;
  if (ev) {
    const [ex, ey] = P(ev.phi);
    out.push(
      `<circle class="rt-end" cx="${r1(ex)}" cy="${r1(ey)}" r="6"/><text class="rt-val cv-t" x="${r1(ex + 10)}" y="${r1(ey - 10)}">${ev.kind === 'detach' ? 'отрыв' : 'остановка'}</text>`,
    );
  }
  if (r.zero) {
    const [zx, zy] = P(r.zero.phi);
    out.push(`<circle class="rt-end" cx="${r1(zx)}" cy="${r1(zy)}" r="5"/><text class="rt-val cv-t" x="${r1(zx + 10)}" y="${r1(zy + 18)}">N = 0</text>`);
  }
  if (r.back && r.back.kind !== 'round' && Math.abs(r.back.phi - pr.phi0) > 1e-6) {
    const [bx, by] = P(r.back.phi);
    out.push(`<circle class="rt-end" cx="${r1(bx)}" cy="${r1(by)}" r="5"/>`);
  }
  if (r.at) {
    const [ax, ay] = P(r.at.phi);
    out.push(`<circle class="cg-ci" cx="${r1(ax)}" cy="${r1(ay)}" r="5"/><text class="t-pt" x="${r1(ax - 30)}" y="${r1(ay + 22)}">φ₁</text>`);
  }
  out.push(
    `<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`,
  );
  out.push(`<text class="tb-note" x="40" y="${H - 40}">${LINK_NAME[pr.link]}; φ — от нижней точки против часовой стрелки</text>`);

  // График N(φ) — проекция реакции на направление к центру.
  const pts = r.curve;
  if (pts.length > 1) {
    const x0 = 560,
      y0 = 60,
      w = 380,
      h = 330;
    const xs = pts.map((p) => p.phi),
      ys = pts.map((p) => p.N);
    let lo = Math.min(0, ...ys),
      hi = Math.max(0, ...ys);
    const ty = ticks(lo, hi);
    lo = Math.min(lo, ty[0]);
    hi = Math.max(hi, ty[ty.length - 1]);
    const xa = Math.min(...xs),
      xb = Math.max(...xs);
    const X = (x: number) => x0 + ((x - xa) / (xb - xa || 1)) * w,
      Y = (v: number) => y0 + h - ((v - lo) / (hi - lo || 1)) * h;
    const dy = ty.length > 1 ? Math.abs(ty[1] - ty[0]) : 1;
    const dig = Math.max(0, Math.ceil(-Math.log10(dy || 1)) + 1);
    for (const v of ty)
      out.push(
        `<line class="rt-grid" x1="${x0}" y1="${r1(Y(v))}" x2="${x0 + w}" y2="${r1(Y(v))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(Y(v) + 4)}" text-anchor="end">${fmt(v, dig)}</text>`,
      );
    for (const t of ticks(xa, xb, 6))
      if (t >= xa - 1e-9 && t <= xb + 1e-9) out.push(`<text class="rt-tick" x="${r1(X(t))}" y="${y0 + h + 18}" text-anchor="middle">${fmt(t, 1)}</text>`);
    out.push(
      `<line class="rt-axis" x1="${x0}" y1="${r1(Y(0))}" x2="${x0 + w}" y2="${r1(Y(0))}"/><line class="rt-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}"/>`,
    );
    out.push(
      `<text class="rt-title" x="${x0}" y="${y0 - 16}">N(φ) — реакция к центру, ${pr.byWeight ? 'кГ' : 'Н'}</text><text class="rt-tick" x="${x0 + w}" y="${y0 + h + 38}" text-anchor="end">φ, °</text>`,
    );
    // Сплошная — связь удерживает, пунктир — уже нет (после отрыва формула неприменима).
    let seg: string[] = [];
    let cur: boolean | null = null;
    const flush = () => {
      if (seg.length > 1) out.push(`<path class="rt-line"${cur ? '' : ' stroke-dasharray="6 5"'} d="M${seg.join('L')}"/>`);
    };
    for (const p of pts) {
      const q = `${r1(X(p.phi))} ${r1(Y(p.N))}`;
      if (cur !== null && p.holds !== cur) {
        seg.push(q);
        flush();
        seg = [q];
      } else seg.push(q);
      cur = p.holds;
    }
    flush();
    out.push(`<circle class="cg-ci" cx="${r1(X(pr.phi0))}" cy="${r1(Y(r.N0))}" r="5"><title>φ₀ = ${fmt(pr.phi0, 2)}°: N = ${fmt(r.N0, 4)}</title></circle>`);
    if (r.at?.reached)
      out.push(
        `<circle class="rt-end" cx="${r1(X(nearest(xs, r.at.phi, pr.phi0)))}" cy="${r1(Y(r.at.N))}" r="5"><title>φ₁: N = ${fmt(r.at.N, 4)}</title></circle>`,
      );
  }
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

/** Угол φ₁ — в окне графика (φ₀ ± 180°). */
function nearest(xs: number[], phi: number, phi0: number): number {
  let a = phi;
  while (a > phi0 + 180) a -= 360;
  while (a < phi0 - 180) a += 360;
  return Math.min(Math.max(a, Math.min(...xs)), Math.max(...xs));
}
