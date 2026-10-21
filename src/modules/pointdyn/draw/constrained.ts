/** Чертежи режимов «равновесие при вращении», «поверхности и кривые», «составные задачи», «теорема об импульсе». */
import { arrow } from '../../relative/draw/earth';
import { sig } from '../../relative/text/earth';
import type { ImpulseProblem, ImpulseResult } from '../model/impulse';
import type { SpinProblem, SpinResult } from '../model/spin';
import type { StageProblem, StageResult } from '../model/stages';
import type { SurfProblem, SurfResult } from '../model/surf';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
const D = Math.PI / 180;
type P2 = [number, number];
type Fig = { svg: string; viewBox: string };

/** Масштаб: мировые точки (y вверх) — в прямоугольник [x0, y0, w, h] экрана с сохранением пропорций. */
function fit(pts: P2[], box: [number, number, number, number]): (p: P2) => P2 {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs),
    yMin = Math.min(...ys),
    yMax = Math.max(...ys);
  const k = Math.min(box[2] / Math.max(xMax - xMin, 1e-9), box[3] / Math.max(yMax - yMin, 1e-9));
  const ox = box[0] + (box[2] - (xMax - xMin) * k) / 2,
    oy = box[1] + (box[3] - (yMax - yMin) * k) / 2;
  return (p) => [ox + (p[0] - xMin) * k, oy + (yMax - p[1]) * k];
}
const poly = (pts: P2[], cls: string) => `<path class="${cls}" fill="none" d="M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}"/>`;
const line = (a: P2, b: P2, cls: string) => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
const dot = (p: P2, r = 6) => `<circle class="cg-c" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}"/>`;
const pivot = (p: P2) => `<circle class="hinge" cx="${r1(p[0])}" cy="${r1(p[1])}" r="5"/>`;
const txt = (p: P2, s: string, cls = 't rl-t') => `<text class="${cls}" x="${r1(p[0])}" y="${r1(p[1])}">${s}</text>`;
const note = (s: string, y = H - 14) => `<text class="tb-note" x="16" y="${y}">${s}</text>`;
const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
function frame(ok: boolean, body: () => string[]): Fig {
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!ok) out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
  else out.push(...body());
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
/** Сила: стрелка из точки M по направлению u (единичный вектор экрана) длиной len с подписью. */
function force(M: P2, u: P2, len: number, cls: string, label: string): string {
  const E = add(M, u, len);
  return arrow(M, E, cls) + txt(add(E, u, 14), label, `t rl-t ${cls}-t`);
}
const axisV = (x: number, y0 = 30, y1 = H - 40) => line([x, y0], [x, y1], 'sb-axis') + txt([x + 6, y0 + 12], 'ω', 'sb-axt');

export function renderSpin(p: SpinProblem, r: SpinResult): Fig {
  return frame(r.ok, () => {
    const out: string[] = [];
    if (r.bank) {
      const q = r.bank;
      const a = (p.find === 'speed' ? p.alpha : q.alphaStar) * D;
      const M: P2 = [560, 300];
      const t: P2 = [Math.cos(a), -Math.sin(a)]; // вдоль полотна наружу (вверх)
      out.push(axisV(160), line(add(M, t, -300), add(M, t, 300), 'mc-ground'), dot(M));
      out.push(force(M, [0, 1], 110, 'rl-e', 'mg'), force(M, [1, 0], 110 * Math.min(2.5, Math.max(0.3, q.q)), 'rl-c', 'mv²/R'));
      out.push(force(M, [-Math.sin(a), -Math.cos(a)], 120, 'en-v', 'N'));
      out.push(txt([M[0] - 200, M[1] + 60], `α = ${sig(a / D, 4)}°`), line([160, M[1]], M, 'mc-guide'), txt([300, M[1] - 8], `R = ${sig(q.Rfound, 4)} м`));
      out.push(note('Сечение полотна плоскостью через ось поворота; центробежная сила инерции направлена от оси.'));
    }
    if (r.cone) {
      const q = r.cone;
      const O: P2 = [500, 60];
      const k = 360 / p.l;
      const th = q.theta * D;
      const M: P2 = [O[0] + p.l * Math.sin(th) * k, O[1] + p.l * Math.cos(th) * k];
      out.push(axisV(O[0], 30, H - 30), pivot(O), line(O, M, 'mc-bar'), dot(M));
      out.push(`<ellipse class="mc-wheel0" cx="${O[0]}" cy="${r1(M[1])}" rx="${r1(M[0] - O[0])}" ry="${r1(Math.max(8, (M[0] - O[0]) * 0.18))}"/>`);
      out.push(
        force(M, [0, 1], 90, 'rl-e', 'mg'),
        force(M, [1, 0], 90 * Math.tan(th), 'rl-c', 'mω²r'),
        force(M, [-Math.sin(th), -Math.cos(th)], 90 / Math.cos(th), 'en-v', 'T'),
      );
      out.push(
        txt([O[0] + 14, O[1] + 70], `θ = ${sig(q.theta, 4)}°`),
        note(`ω = ${sig(q.omega, 4)} рад/с, v = ${sig(q.v, 4)} м/с, период ${sig(q.period, 4)} с.`),
      );
    }
    if (r.vert) {
      const q = r.vert;
      const C: P2 = [500, 260],
        R = 170;
      out.push(`<circle class="mc-wheel0" cx="${C[0]}" cy="${C[1]}" r="${R}"/>`, pivot(C));
      const B: P2 = [C[0], C[1] + R],
        T: P2 = [C[0], C[1] - R];
      out.push(dot(B), dot(T), force(B, [0, -1], 70, 'en-v', `N = ${sig(q.Nb, 4)}`), force(T, [0, q.Nt >= 0 ? 1 : -1], 50, 'en-v', `N = ${sig(q.Nt, 4)}`));
      out.push(
        note(
          `Равномерно: ω = ${sig(q.omega, 4)} рад/с, v = ${sig(q.v, 4)} м/с${q.vTrain != null ? `; скорость тепловоза ${sig(q.vTrain * 3.6, 4)} км/ч` : ''}.`,
        ),
      );
    }
    if (r.spring) {
      const q = r.spring;
      const x0 = 160,
        y = 280;
      const k = 600 / Math.max(q.r, q.rs, 1e-9);
      const M: P2 = [x0 + q.r * k, y];
      out.push(axisV(x0), line([x0, y + 16], [x0 + 680, y + 16], 'mc-ground'), line([x0, y - 16], [x0 + 680, y - 16], 'mc-ground'));
      const n = 14,
        zz: P2[] = [[x0, y]];
      for (let i = 1; i < n; i++) zz.push([x0 + ((M[0] - x0) * i) / n, y + (i % 2 ? -10 : 10)]);
      zz.push(M);
      out.push(poly(zz, 'mc-path'), dot(M), force(M, [1, 0], 90, 'rl-c', 'mω²r'), force([M[0] - 8, M[1] + 40], [-1, 0], 70, 'en-v', 'c(r − r_s)'));
      out.push(line([x0 + q.rs * k, y - 40], [x0 + q.rs * k, y + 40], 'mc-guide'), txt([x0 + q.rs * k - 10, y - 46], 'r_s'), txt([M[0] - 6, y - 28], 'r'));
      out.push(note(`r = ${sig(q.r, 4)} м, r_s = ${sig(q.rs, 4)} м, c = ${sig(q.c, 4)}, ω = ${sig(q.omega, 4)} рад/с.`));
    }
    if (r.rods) {
      const q = r.rods;
      const O: P2 = [500, 200];
      const k = 260 / Math.max(p.a, p.b);
      const dir = (deg: number): P2 => [Math.sin(deg * D), Math.cos(deg * D)];
      const A = add(O, dir(q.phi), p.a * k),
        B = add(O, dir(q.phi - p.gamma), p.b * k);
      out.push(axisV(O[0], 20, H - 30), line(O, A, 'mc-bar'));
      if (p.b > 0) out.push(line(O, B, 'mc-bar'), txt(add(B, dir(q.phi - p.gamma), 16), 'b'));
      out.push(pivot(O), txt(add(A, dir(q.phi), 16), 'a'), txt([O[0] + 10, O[1] + 60], `φ = ${sig(q.phi, 4)}°`));
      out.push(note(`ω = ${sig(q.omega, 4)} рад/с; давление на шарнир N = ${sig(q.N, 4)}.`));
    }
    if (r.tube) {
      const x1 = Math.max(Math.abs(p.x1), 1e-3) * 1.4;
      const pts: P2[] = [];
      for (let i = -60; i <= 60; i++) {
        const x = (x1 * i) / 60;
        pts.push([x, (p.omega ** 2 * x * x) / (2 * p.g)]);
      }
      const S = fit([...pts, [0, 0]], [200, 60, 600, 380]);
      const M = S([p.x1, r.tube.y]);
      out.push(
        axisV(S([0, 0])[0], 40, H - 40),
        poly(pts.map(S), 'mc-bar'),
        dot(M),
        force(M, [0, 1], 70, 'rl-e', 'mg'),
        force(M, [p.x1 >= 0 ? 1 : -1, 0], 70 * Math.abs(r.tube.slope), 'rl-c', 'mω²x'),
      );
      out.push(note(`y = ω²x²/(2g) + c; при x = ${sig(p.x1, 4)} м наклон ${sig(r.tube.ang, 4)}°.`));
    }
    return out;
  });
}

export function renderSurf(p: SurfProblem, r: SurfResult): Fig {
  return frame(r.ok, () => {
    const out: string[] = [];
    if (r.cyl) {
      const q = r.cyl;
      const n = 200,
        pts: P2[] = [];
      for (let i = 0; i <= n; i++) {
        const t = (p.t1 * i) / n;
        const ph = q.w * t;
        pts.push([p.r * Math.sin(ph), -(p.v0 * Math.sin(p.alpha * D) * t + (p.g * t * t) / 2)]);
      }
      const S = fit([...pts, [-p.r, 0], [p.r, 0]], [250, 40, 500, 420]);
      out.push(
        line(S([-p.r, 0]), S([-p.r, Math.min(...pts.map((q) => q[1]))]), 'mc-ground'),
        line(S([p.r, 0]), S([p.r, Math.min(...pts.map((q) => q[1]))]), 'mc-ground'),
      );
      out.push(poly(pts.map(S), 'rl-r'), dot(S(pts[pts.length - 1])), note(`Вид сбоку (ось z — вниз): винтовая линия; N = ${sig(q.N, 4)} постоянно.`));
    }
    if (r.cone) {
      const q = r.cone;
      const pts = q.path.map(([rr, ph]): P2 => [rr * Math.cos(ph), rr * Math.sin(ph)]);
      const S = fit([...pts, [0, 0]], [200, 40, 600, 420]);
      out.push(pivot(S([0, 0])), txt(add(S([0, 0]), [8, -8]), 'O'), poly(pts.map(S), 'rl-r'), dot(S(pts[pts.length - 1])));
      out.push(note(`Проекция траектории на плоскость, перпендикулярную оси конуса; при t = ${sig(p.t1, 4)} с r = ${sig(q.r, 4)} м.`));
    }
    if (r.rough) {
      const q = r.rough;
      const C: P2 = [500, p.side === 'outer' ? 420 : 260],
        R = p.side === 'outer' ? 300 : 200;
      const pos = (deg: number): P2 =>
        p.side === 'outer' ? [C[0] + R * Math.sin(deg * D), C[1] - R * Math.cos(deg * D)] : [C[0] + R * Math.sin(deg * D), C[1] + R * Math.cos(deg * D)];
      if (p.side === 'outer') {
        const half: P2[] = [];
        for (let d = -90; d <= 90; d += 2) half.push(pos(d));
        out.push(poly(half, 'mc-bar'), line([C[0] - R - 40, C[1]], [C[0] + R + 40, C[1]], 'mc-ground'));
      } else out.push(`<circle class="mc-wheel0" cx="${C[0]}" cy="${C[1]}" r="${R}"/>`);
      out.push(pivot(C));
      const arc: P2[] = q.curve.map((c) => pos(c.phi));
      out.push(poly(arc, 'rl-r'), dot(pos(0), 4), dot(pos(q.phi)));
      out.push(
        note(
          `${q.kind === 'stop' ? 'Остановка' : q.kind === 'slideBack' ? 'Остановка и скатывание назад' : q.kind === 'detach' ? 'Сход с поверхности' : q.kind === 'top' ? 'Верхняя точка' : 'Без событий'} при φ = ${sig(q.phi, 4)}°; предельная v₀ = ${sig(q.vCritBook, 4)} м/с.`,
        ),
      );
    }
    if (r.wire) {
      const O: P2 = [500, 80];
      const k = 340 / p.l;
      const dir = (deg: number): P2 => [Math.sin(deg * D), Math.cos(deg * D)];
      const O1 = add(O, dir(-p.beta), p.h * k);
      const M0 = add(O, dir(p.alpha), p.l * k);
      const arc: P2[] = [];
      for (let a = p.alpha; a >= -p.beta; a -= 1) arc.push(add(O, dir(a), p.l * k));
      out.push(
        axisV(O[0], 40, 470).replace('ω', ''),
        pivot(O),
        pivot(O1),
        txt(add(O1, [8, -6]), 'O₁'),
        txt(add(O, [8, -6]), 'O'),
        line(O, M0, 'mc-bar'),
        dot(M0),
        poly(arc, 'rl-path'),
      );
      out.push(`<circle class="mc-wheel0" cx="${r1(O1[0])}" cy="${r1(O1[1])}" r="${r1((p.l - p.h) * k)}"/>`);
      out.push(
        note(r.wire.alphaMin != null ? `Наименьший угол, при котором нить навивается: α = ${sig(r.wire.alphaMin, 4)}°.` : 'Нить не навивается ни при каком α.'),
      );
    }
    if (r.chain) {
      const q = r.chain;
      const xs = q.path.map((s) => s[0]);
      const lo = Math.min(...xs, -1.2 * p.a),
        hi = Math.max(...xs, 1.2 * p.a);
      const curve: P2[] = [];
      for (let i = 0; i <= 120; i++) {
        const x = lo + ((hi - lo) * i) / 120;
        curve.push([x, p.a * Math.cosh(x / p.a)]);
      }
      const S = fit([...curve, [lo, 0]], [100, 40, 800, 420]);
      out.push(line(S([lo, 0]), S([hi, 0]), 'sb-axis'), poly(curve.map(S), 'mc-path'), poly(q.path.map(S), 'rl-r'), dot(S([q.x, q.y])));
      out.push(note(`y = a ch(x/a); при t = ${sig(p.t1, 4)} с x = ${sig(q.x, 4)} м, давление N = ${sig(q.N, 4)}.`));
    }
    if (r.helix) {
      const pts: P2[] = [];
      for (let i = 0; i <= 240; i++) {
        const ph = (i / 240) * 6 * Math.PI;
        pts.push([p.r * Math.cos(ph), p.a * ph + 0.25 * p.r * Math.sin(ph)]);
      }
      const S = fit(pts, [300, 40, 400, 420]);
      out.push(
        poly(pts.map(S), 'rl-r'),
        note(`Винтовая линия r = r₀: tg α = ${sig(r.helix.tanA, 4)}, нужный коэффициент трения k = ${sig(r.helix.kNeed, 4)}, v = ${sig(r.helix.v, 4)} м/с.`),
      );
    }
    if (r.alt) out.push(note(`На высоте ${sig(p.H, 4)} м g = ${sig(r.alt.gH, 5)} м/с²; длину нити уменьшить на ${sig(r.alt.ratio, 4)}·l.`, H / 2));
    return out;
  });
}

export function renderStages(p: StageProblem, r: StageResult): Fig {
  return frame(r.ok, () => {
    const out: string[] = [];
    if (r.loop) {
      const q = r.loop;
      const a = p.alpha * D,
        R = p.r;
      const arc: P2[] = [];
      for (let t = a; t <= 2 * Math.PI - a + 1e-9; t += 0.02) arc.push([R * Math.sin(t), R + R * Math.cos(t)]);
      const Dp: P2 = [-R * Math.sin(a), R + R * Math.cos(a)];
      const fl: P2[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = (q.tFly * i) / 60;
        fl.push([Dp[0] + q.vD * Math.cos(a) * t, Dp[1] + q.vD * Math.sin(a) * t - (p.g * t * t) / 2]);
      }
      const h = q.hNeed;
      const ramp: P2[] = [
        [-3.2 * R, h],
        [0, 0],
      ];
      const S = fit([...arc, ...fl, ...ramp, [R, 0]], [80, 30, 840, 440]);
      out.push(
        poly(ramp.map(S), 'mc-ground'),
        line(S([0, 0]), S([R * 1.4, 0]), 'mc-ground'),
        poly(arc.map(S), 'mc-bar'),
        poly(fl.map(S), 'rl-r'),
        dot(S(Dp)),
        txt(add(S(Dp), [-24, -8]), 'D'),
        txt(add(S([-Dp[0], Dp[1]]), [10, -8]), 'C'),
        dot(S(ramp[0])),
      );
      out.push(note(`h = r(1 + cos α + 1/(2cos α)) = ${sig(h, 4)} м; наименьшая h = ${sig(q.hMin, 4)} м при α = 45°.`));
    }
    if (r.jump) {
      const q = r.jump;
      const ta = Math.tan(p.alpha * D);
      const fl: P2[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = (q.t * i) / 60;
        fl.push([q.vC * t, p.vy * t - (p.g * t * t) / 2]);
      }
      const ramp: P2[] = [
        [-p.h / ta, p.h],
        [0, 0],
      ];
      const land: P2[] = [
        [0, 0],
        [q.x * 1.1, -q.x * 1.1 * Math.tan(p.beta * D)],
      ];
      const S = fit([...fl, ...ramp, ...land], [60, 30, 880, 440]);
      out.push(
        poly(ramp.map(S), 'mc-ground'),
        poly(land.map(S), 'mc-ground'),
        poly(fl.map(S), 'rl-r'),
        dot(S([0, 0])),
        dot(S([q.x, q.y])),
        txt(add(S([0, 0]), [8, -10]), 'C'),
      );
      out.push(note(`Дальность по линии приземления l = ${sig(q.l, 4)} м, время полёта ${sig(q.t, 4)} с.`));
    }
    if (r.plate) {
      const q = r.plate;
      const x = 500,
        base = 460;
      const k = 300 / Math.max(p.H + p.h, 1e-9);
      const top = base - 120;
      const zz: P2[] = [[x, base]];
      for (let i = 1; i < 12; i++) zz.push([x + (i % 2 ? -22 : 22), base - (120 * i) / 12]);
      zz.push([x, top]);
      out.push(
        line([x - 160, base], [x + 160, base], 'mc-ground'),
        poly(zz, 'mc-path'),
        line([x - 60, top], [x + 60, top], 'mc-bar'),
        dot([x, top - 10 - p.H * k], 9),
        line([x + 90, top], [x + 90, top - p.H * k], 'mc-guide'),
        txt([x + 98, top - (p.H * k) / 2], 'H'),
      );
      out.push(note(`Время сжатия T = ${sig(q.T, 4)} с, импульс пружины S = ${sig(q.S, 4)}; жёсткость c = ${sig(q.c, 4)}.`));
    }
    if (r.fly) {
      const q = r.fly;
      const fl: P2[] = [];
      for (let i = 0; i <= 60; i++) {
        const x = (p.s * i) / 60;
        fl.push([x, x - (x * x) / p.s]);
      }
      const S = fit([...fl, [0, -0.05 * p.s]], [80, 60, 840, 400]);
      out.push(
        line(S([0, 0]), S([p.s, 0]), 'mc-ground'),
        poly(fl.map(S), 'rl-r'),
        dot(S([0, 0])),
        dot(S([p.s, 0])),
        note(`Вылет под 45° со скоростью ${sig(q.v, 4)} м/с: ω = ${sig(q.omega, 4)} рад/с = ${sig(q.rpm, 4)} об/мин.`),
      );
    }
    if (r.slack) {
      const q = r.slack;
      const circ: P2[] = [];
      for (let t = 0; t <= 2 * Math.PI + 1e-9; t += 0.03) circ.push([p.r * Math.cos(t), p.r * Math.sin(t)]);
      const S = fit(circ, [300, 40, 400, 420]);
      out.push(
        poly(circ.map(S), 'mc-wheel0'),
        pivot(S([0, 0])),
        line(S([0, 0]), S(q.M), 'mc-bar'),
        poly(q.path.map(S), 'rl-r'),
        dot(S(q.M)),
        dot(S(q.end)),
        txt(add(S(q.M), [10, -8]), 'M'),
      );
      out.push(note(`Нить ослабевает в M (на ${sig(q.hM, 4)} м над O); полёт по параболе ${sig(q.t, 4)} с.`));
    }
    return out;
  });
}

export function renderImpulse(p: ImpulseProblem, r: ImpulseResult): Fig {
  return frame(r.ok, () => {
    const out: string[] = [];
    if (r.line) {
      const q = r.line;
      const a = p.alpha * D;
      const M: P2 = [500, 300];
      const t: P2 = [Math.cos(a), -Math.sin(a)];
      out.push(
        line(add(M, t, -320), add(M, t, 320), 'mc-ground'),
        `<rect class="mc-pivot" x="${M[0] - 22}" y="${M[1] - 34}" width="44" height="30" transform="rotate(${r1(-p.alpha)} ${M[0]} ${M[1]})"/>`,
      );
      const C = add(M, [Math.sin(a), Math.cos(a)], -18);
      if (q.F) out.push(force(C, t, 110, 'en-v', 'F'));
      out.push(force(C, [-t[0], -t[1]], 80, 'rl-c', 'R'), force(C, [0, 1], 90, 'rl-e', 'mg'));
      out.push(note(`m(v₁ − v₀) = (F − R)t: v₀ = ${sig(p.v0, 4)}, v₁ = ${sig(q.v1, 4)} м/с за ${sig(q.t, 4)} с; путь ${sig(q.s, 4)} м.`));
    }
    if (r.vec) {
      const q = r.vec;
      const u0: P2 = [r.mass * p.v0 * Math.cos(p.a0 * D), r.mass * p.v0 * Math.sin(p.a0 * D)],
        u1: P2 = [r.mass * p.v1 * Math.cos(p.a1 * D), r.mass * p.v1 * Math.sin(p.a1 * D)];
      const S = fit([[0, 0], u0, u1], [250, 50, 500, 400]);
      const O = S([0, 0]);
      out.push(
        arrow(O, S(u0), 'rl-e'),
        txt(add(S(u0), [8, -6]), 'mv₀'),
        arrow(O, S(u1), 'en-v'),
        txt(add(S(u1), [8, 16]), 'mv₁'),
        arrow(S(u0), S(u1), 'cv-r'),
        txt([(S(u0)[0] + S(u1)[0]) / 2 + 10, (S(u0)[1] + S(u1)[1]) / 2], 'S', 't rl-t cv-r-t'),
      );
      out.push(note(`S = mv₁ − mv₀ = (${sig(q.S[0], 4)}; ${sig(q.S[1], 4)}).`));
    }
    if (r.circle) {
      const C: P2 = [500, 260],
        R = 170;
      const A: P2 = [C[0] + R, C[1]];
      const ps = p.psi * D;
      const B: P2 = [C[0] + R * Math.cos(ps), C[1] - R * Math.sin(ps)];
      out.push(
        `<circle class="mc-wheel0" cx="${C[0]}" cy="${C[1]}" r="${R}"/>`,
        dot(A),
        dot(B),
        arrow(A, add(A, [0, -1], 90), 'en-v'),
        arrow(B, add(B, [-Math.sin(ps), -Math.cos(ps)], 90), 'en-v'),
        txt(add(A, [10, -50]), 'v₀'),
        txt(add(B, [10, 0]), 'v₁'),
      );
      out.push(note(`За поворот на ${sig(p.psi, 4)}°: S = 2mv sin(ψ/2) = ${sig(r.circle.S, 4)}, средняя сила ${sig(r.circle.F, 4)}.`));
    }
    if (r.area || r.hole) {
      const pts: P2[] = [];
      if (r.hole) {
        for (let i = 0; i <= 200; i++) {
          const t = (p.t * i) / 200;
          const rr = p.R - p.a * t,
            ph = (p.u0 * t) / rr;
          pts.push([rr * Math.cos(ph), rr * Math.sin(ph)]);
        }
      } else {
        for (let i = 0; i <= 200; i++) {
          const ph = (i / 200) * 4 * Math.PI;
          const rr = p.r1 + ((p.r2 - p.r1) * i) / 200;
          pts.push([rr * Math.cos(ph), rr * Math.sin(ph)]);
        }
      }
      const S = fit([...pts, [0, 0]], [200, 40, 600, 420]);
      out.push(pivot(S([0, 0])), poly(pts.map(S), 'rl-r'), dot(S(pts[pts.length - 1])), line(S([0, 0]), S(pts[pts.length - 1]), 'mc-bar'));
      out.push(note(r.hole ? `r = R − at; натяжение T = ${sig(r.hole.T, 4)} при t = ${sig(p.t, 4)} с.` : `Закон площадей: n₂ = ${sig(r.area!.n2, 4)} об/мин.`));
    }
    if (r.sync) {
      const q = r.sync;
      const k = 300 / Math.max(p.l1, p.l2);
      out.push(
        line([300, 60], [700, 60], 'mc-ground'),
        line([400, 60], [400 + 0.3 * p.l1 * k, 60 + 0.95 * p.l1 * k], 'mc-bar'),
        line([600, 60], [600 + 0.3 * p.l2 * k, 60 + 0.95 * p.l2 * k], 'mc-bar'),
      );
      out.push(
        dot([400 + 0.3 * p.l1 * k, 60 + 0.95 * p.l1 * k]),
        dot([600 + 0.3 * p.l2 * k, 60 + 0.95 * p.l2 * k]),
        txt([380, 50], 'l₁'),
        txt([580, 50], 'l₂'),
      );
      out.push(note(q.k ? `√(l₁/l₂) = ${q.k}/${q.n}; T = ${sig(q.T, 4)} с.` : '√(l₁/l₂) иррационально.'));
    }
    return out;
  });
}
