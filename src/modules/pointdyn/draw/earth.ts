/** Чертёж: движение вблизи вращающейся Земли — траектория падения, движение по горизонтали, маятник Фуко, g по широте. */
import { fmt } from '../../../shared/format';
import { arrow } from '../../relative/draw/earth';
import { sig } from '../../relative/text/earth';
import type { EarthDyn, EarthDynResult } from '../model/earth';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
type P2 = [number, number];

export function renderEarthDyn(p: EarthDyn, r: EarthDynResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const done = () => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return done();
  }
  if (r.fall) {
    // Вид с юга: x — восток вправо, z — вверх; отклонение увеличено.
    const q = r.fall;
    const pts = [...q.path, ...q.path0];
    const zMax = Math.max(...pts.map((s) => s[2]), 1e-9);
    const xs = pts.map((s) => s[0]);
    const xMin = Math.min(...xs, 0),
      xMax = Math.max(...xs, 0);
    const kz = 400 / zMax;
    const span = xMax - xMin;
    // Если горизонтальный размах мал по сравнению с высотой, растягиваем его.
    const kx = span > 0 ? Math.min(600 / span, Math.max(kz, (0.4 * 600) / span)) : kz;
    const mag = kx / kz;
    const ox = 200 + (600 - span * kx) / 2 - xMin * kx,
      oy = 450;
    const S = (s: number[]): P2 => [ox + s[0] * kx, oy - s[2] * kz];
    out.push(
      `<line class="sb-axis" x1="40" y1="${oy}" x2="${W - 40}" y2="${oy}"/><text class="sb-axt" x="${W - 120}" y="${oy - 6}">x, восток</text><line class="sb-axis" x1="${r1(ox)}" y1="${oy + 20}" x2="${r1(ox)}" y2="24"/><text class="sb-axt" x="${r1(ox + 6)}" y="22">z</text>`,
    );
    out.push(`<path class="rl-path" d="M${q.path0.map((s) => S(s).map(r1).join(' ')).join('L')}"/>`);
    out.push(`<path class="rl-r" d="M${q.path.map((s) => S(s).map(r1).join(' ')).join('L')}"/>`);
    const E = S([q.land[0], 0, 0]),
      E0 = S([q.land0[0], 0, 0]);
    out.push(`<circle class="cg-c" cx="${r1(E[0])}" cy="${r1(E[1])}" r="5"/><circle class="cg-c" cx="${r1(E0[0])}" cy="${r1(E0[1])}" r="3"/>`);
    out.push(`<text class="t rl-t" x="${r1(Math.max(E[0], E0[0]) + 10)}" y="${oy - 12}">отклонение на восток ${sig(q.dev[0], 3)} м</text>`);
    out.push(
      `<text class="tb-note" x="16" y="${H - 30}">Вид с юга. Пунктир — без вращения Земли, сплошная — с вращением${mag > 1.5 ? `; горизонтальный масштаб увеличен в ${sig(mag, 3)} раз` : ''}.</text>`,
    );
    out.push(`<text class="tb-note" x="16" y="${H - 12}">Время полёта ${sig(q.T, 4)} с; на север ${sig(q.dev[1], 3)} м.</text>`);
    return done();
  }
  if (r.line) {
    // Вид сверху: x — восток, y — север; скорость по курсу, сила инерции вправо, отклонённый путь.
    const q = r.line;
    const O: P2 = [500, 300];
    out.push(
      `<line class="sb-axis" x1="${O[0] - 300}" y1="${O[1]}" x2="${O[0] + 300}" y2="${O[1]}"/><text class="sb-axt" x="${O[0] + 306}" y="${O[1] + 5}">восток</text><line class="sb-axis" x1="${O[0]}" y1="${O[1] + 180}" x2="${O[0]}" y2="${O[1] - 260}"/><text class="sb-axt" x="${O[0] + 6}" y="${O[1] - 264}">север</text>`,
    );
    const kd = (p.k * Math.PI) / 180;
    const u: P2 = [Math.sin(kd), -Math.cos(kd)];
    const n: P2 = [-u[1], u[0]]; // вправо от скорости на экране
    const side = p.lat >= 0 ? 1 : -1;
    // Путь: прямая и (свободно вбок) парабола, отклонение увеличено до 60 px.
    const Lp = 230;
    out.push(`<line class="rl-path" x1="${O[0]}" y1="${O[1]}" x2="${r1(O[0] + u[0] * Lp)}" y2="${r1(O[1] + u[1] * Lp)}"/>`);
    if (q.acH > 0) {
      const pts: string[] = [];
      for (let i = 0; i <= 40; i++) {
        const s = i / 40;
        const d = side * 60 * s * s;
        pts.push(`${r1(O[0] + u[0] * Lp * s + n[0] * d)} ${r1(O[1] + u[1] * Lp * s + n[1] * d)}`);
      }
      out.push(`<path class="rl-r" d="M${pts.join('L')}"/>`);
    }
    out.push(
      arrow(O, [O[0] + u[0] * 120, O[1] + u[1] * 120], 'en-v'),
      `<text class="t cv-t rl-t en-v-t" x="${r1(O[0] + u[0] * 130 - 10)}" y="${r1(O[1] + u[1] * 130)}">v = ${sig(p.v, 4)}</text>`,
    );
    if (q.FH > 0) {
      const B: P2 = [O[0] + side * n[0] * 90, O[1] + side * n[1] * 90];
      out.push(
        arrow(O, B, 'rl-c'),
        `<text class="t cv-t rl-t rl-c-t" x="${r1(B[0] + side * n[0] * 10 - (side * n[0] < 0 ? 120 : 0))}" y="${r1(B[1] + side * n[1] * 10 + 4)}">Φ_c = ${sig(q.FH, 4)} ${p.byWeight ? 'кГ' : 'Н'}</text>`,
      );
    }
    out.push(`<circle class="cg-c" cx="${O[0]}" cy="${O[1]}" r="5"/>`);
    out.push(
      `<text class="tb-note" x="16" y="${H - 30}">Вид сверху. Пунктир — прямая; сплошная — путь, если вбок движение свободно (отклонение увеличено)${p.L > 0 ? `: ${sig(q.dev, 3)} м на ${sig(p.L, 4)} м` : ''}.</text>`,
    );
    out.push(
      `<text class="tb-note" x="16" y="${H - 12}">Коричневая — горизонтальная кориолисова сила инерции (давление на рельс); курс ${fmt(p.k, 3)}°, широта ${fmt(p.lat, 3)}°.</text>`,
    );
    return done();
  }
  if (r.pend) {
    // Вид сверху на маятник: начальная плоскость север — юг и плоскость через угол ψ.
    const q = r.pend;
    const O: P2 = [500, 260],
      R = 190;
    out.push(
      `<circle class="rl-path" cx="${O[0]}" cy="${O[1]}" r="${R}"/><text class="sb-axt" x="${O[0] - 6}" y="${O[1] - R - 8}">С</text><text class="sb-axt" x="${O[0] + R + 8}" y="${O[1] + 5}">В</text><text class="sb-axt" x="${O[0] - 6}" y="${O[1] + R + 20}">Ю</text><text class="sb-axt" x="${O[0] - R - 22}" y="${O[1] + 5}">З</text>`,
    );
    const dir = p.lat >= 0 ? 1 : -1; // по часовой стрелке — к востоку от севера
    const line = (a: number, cls: string) => {
      const u: P2 = [Math.sin(a), -Math.cos(a)];
      return `<line class="${cls}" x1="${r1(O[0] - u[0] * R)}" y1="${r1(O[1] - u[1] * R)}" x2="${r1(O[0] + u[0] * R)}" y2="${r1(O[1] + u[1] * R)}"/>`;
    };
    const psi = (dir * p.psi * Math.PI) / 180;
    out.push(line(0, 'mc-guide'), line(psi, 'rl-r'));
    const Ra = 70,
      steps = 30;
    const arc: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (psi * i) / steps;
      arc.push(`${r1(O[0] + Ra * Math.sin(a))} ${r1(O[1] - Ra * Math.cos(a))}`);
    }
    if (Math.abs(psi) > 1e-6) out.push(`<path class="gr-spin" d="M${arc.join('L')}"/>`);
    out.push(`<text class="t gr-t" x="${r1(O[0] + 80 * Math.sin(psi / 2) + 6)}" y="${r1(O[1] - 80 * Math.cos(psi / 2))}">ψ = ${fmt(p.psi, 3)}°</text>`);
    out.push(
      `<text class="tb-note" x="16" y="${H - 30}">Вид сверху: пунктир — начальная плоскость качаний (север — юг), зелёная — через ${sig(q.t / 3600, 4)} ч.</text>`,
    );
    out.push(
      `<text class="tb-note" x="16" y="${H - 12}">Поворот ${dir > 0 ? 'по часовой стрелке' : 'против часовой стрелки'} с угловой скоростью ω sin φ = ${sig(q.rate, 4)} рад/с; полный оборот — за ${sig(q.T / 3600, 4)} ч.</text>`,
    );
    return done();
  }
  if (r.gr) {
    const q = r.gr;
    const C: P2 = [380, 260],
      R = 190,
      f = (p.lat * Math.PI) / 180;
    const M: P2 = [C[0] + R * Math.cos(f), C[1] - R * Math.sin(f)];
    out.push(
      `<circle class="rl-path" cx="${C[0]}" cy="${C[1]}" r="${R}"/><line class="rl-axis" x1="${C[0]}" y1="${C[1] + R + 24}" x2="${C[0]}" y2="${C[1] - R - 24}"/><line class="sb-axis" x1="${C[0] - R - 10}" y1="${C[1]}" x2="${C[0] + R + 10}" y2="${C[1]}"/>`,
    );
    out.push(
      `<line class="mc-guide" x1="${C[0]}" y1="${C[1]}" x2="${r1(M[0])}" y2="${r1(M[1])}"/><text class="t gr-t" x="${C[0] + 30}" y="${C[1] - 10}">φ = ${fmt(p.lat, 3)}°</text>`,
    );
    // Притяжение — к центру, 120 px; центробежная — от оси, увеличена для наглядности.
    const L0 = 120;
    const toC: P2 = [-Math.cos(f), Math.sin(f)];
    const ce = q.aOmega > 0 ? 0.3 * L0 * Math.cos(f) : 0;
    const kc = ce > 0 ? ce / ((L0 * q.aOmega) / p.g) : 1;
    const G0: P2 = [M[0] + toC[0] * L0, M[1] + toC[1] * L0];
    const Ce: P2 = [M[0] + ce, M[1]];
    const Gs: P2 = [G0[0] + ce, G0[1]];
    out.push(arrow(M, G0, 'rl-e'), `<text class="t cv-t rl-t rl-e-t" x="${r1(G0[0] - 60)}" y="${r1(G0[1] + 18)}">g₀</text>`);
    if (ce > 1) out.push(arrow(M, Ce, 'rl-c'), `<text class="t cv-t rl-t rl-c-t" x="${r1(Ce[0] + 8)}" y="${r1(Ce[1] + 4)}">ω²R cos φ</text>`);
    out.push(arrow(M, Gs, 'cv-r'), `<text class="t cv-t rl-t cv-r-t" x="${r1(Gs[0] + 8)}" y="${r1(Gs[1] + 4)}">g(φ) = ${sig(q.gPhi, 5)}</text>`);
    out.push(`<circle class="cg-c" cx="${r1(M[0])}" cy="${r1(M[1])}" r="5"/>`);
    out.push(
      `<text class="tb-note" x="16" y="${H - 30}">Плоскость меридиана. Серая — притяжение g₀ (к центру), коричневая — центробежная (от оси${kc > 1.5 ? `, увеличена в ${sig(kc, 3)} раз` : ''}), красная — сила тяжести g(φ).</text>`,
    );
    out.push(`<text class="tb-note" x="16" y="${H - 12}">n = g₀/(ω²R) = ${sig(q.n, 4)}; отвес отклонён от направления к центру на ${sig(q.dev, 3)}°.</text>`);
  }
  return done();
}
