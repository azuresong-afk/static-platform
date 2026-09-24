/**
 * Чертёж конструкции и расчётной схемы (перенос renderSVG() прототипа).
 * Чистая функция: возвращает разметку SVG и параметры раскладки (масштаб, начало координат,
 * положения размерных надписей) — они нужны интерфейсу для перетаскивания, двойного щелчка и правки размеров.
 * Разметка совпадает с прототипом (проверяется golden-тестами).
 */
import { LOADDIR, REFS, TYPES } from '../model/constants';
import { fmt, r1 } from '../model/format';
import { distGeom, pathNodes, resolve, type Geom, type PointItem } from '../model/geometry';
import type { Seg, Structure } from '../model/types';
import type { Action, Model } from '../solver/model';
import type { Solution } from '../solver/solve';
import { STATUS } from '../text/labels';

export const W = 1000;

export type View = 'construct' | 'schema';

export interface Layout {
  W: number;
  H: number;
  /** Пикселей на метр. */
  SC: number;
  OX: number;
  OY: number;
  MAXY: number;
  /** Центр размерной надписи участка (для поля правки длины). */
  dimPos: Record<string, [number, number]>;
}

export interface Drawing {
  svg: string;
  viewBox: string;
  layout: Layout;
}

/** Экранные координаты точки чертежа. */
export const toScreen = (L: Layout, x: number, y: number): [number, number] => [L.OX + x * L.SC, L.OY + (L.MAXY - y) * L.SC];

type Sym = { L: string; S: string };
const ssym = (o: Sym, extra = '') =>
  `<tspan font-style="italic">${o.L}</tspan>${o.S ? `<tspan dy="5" font-size="12">${o.S}</tspan><tspan dy="-5">${extra}</tspan>` : `<tspan>${extra}</tspan>`}`;

function head(hx: number, hy: number, ux: number, uy: number, cls: string) {
  const s = 12,
    w = 4.6,
    bx = hx - ux * s,
    by = hy - uy * s;
  return `<polygon points="${r1(hx)},${r1(hy)} ${r1(bx - uy * w)},${r1(by + ux * w)} ${r1(bx + uy * w)},${r1(by - ux * w)}" class="${cls}-f"/>`;
}
function arrowLine(tx: number, ty: number, hx: number, hy: number, cls: string, dash?: boolean) {
  const dx = hx - tx,
    dy = hy - ty,
    len = Math.hypot(dx, dy) || 1,
    ux = dx / len,
    uy = dy / len;
  return (
    `<line x1="${r1(tx)}" y1="${r1(ty)}" x2="${r1(hx - ux * 10)}" y2="${r1(hy - uy * 10)}" class="${cls}"${dash ? ' stroke-dasharray="7 5"' : ''}/>` +
    head(hx, hy, ux, uy, cls)
  );
}
function forceArrow(px: number, py: number, ang: number, side: number[], cls: string, dash: boolean, label: string, tcls: string, len = 72, gap = 7) {
  const t = (ang * Math.PI) / 180,
    ux = Math.cos(t),
    uy = -Math.sin(t);
  const out = ux * side[0] + uy * side[1] > 0;
  const a = [px + side[0] * gap, py + side[1] * gap],
    b = [px + side[0] * (gap + len), py + side[1] * (gap + len)];
  const s = out ? arrowLine(a[0], a[1], b[0], b[1], cls, dash) : arrowLine(b[0], b[1], a[0], a[1], cls, dash);
  if (Math.abs(side[1]) < 0.2) {
    const mx = px + side[0] * (gap + len / 2);
    return s + `<text x="${r1(mx)}" y="${r1(py - 14)}" text-anchor="middle" class="t ${tcls}">${label}</text>`;
  }
  const lx = px + side[0] * (gap + len + 18),
    ly = py + side[1] * (gap + len + 18) + 6;
  const anchor = Math.abs(side[0]) > 0.5 ? (side[0] > 0 ? 'start' : 'end') : 'middle';
  return s + `<text x="${r1(lx + (anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0))}" y="${r1(ly)}" text-anchor="${anchor}" class="t ${tcls}">${label}</text>`;
}
function momentArc(px: number, py: number, r: number, ccw: boolean, cls: string, label: string, tcls: string, dash?: boolean) {
  const P = (a: number) => [px + r * Math.cos((a * Math.PI) / 180), py - r * Math.sin((a * Math.PI) / 180)];
  const a0 = ccw ? -35 : 215,
    a1 = ccw ? 215 : -35,
    [x0, y0] = P(a0),
    [x1, y1] = P(a1),
    t = (a1 * Math.PI) / 180;
  const [ux, uy] = ccw ? [-Math.sin(t), -Math.cos(t)] : [Math.sin(t), Math.cos(t)];
  return (
    `<path d="M${r1(x0)} ${r1(y0)} A${r} ${r} 0 1 ${ccw ? 0 : 1} ${r1(x1 - ux * 8)} ${r1(y1 - uy * 8)}" class="${cls}"${dash ? ' stroke-dasharray="6 4"' : ''}/>` +
    head(x1 + ux * 3, y1 + uy * 3, ux, uy, cls) +
    `<text x="${r1(px + r + 8)}" y="${r1(py + r + 14)}" class="t ${tcls}">${label}</text>`
  );
}
function ground(cx: number, y: number, w: number) {
  let s = `<line x1="${cx - w / 2}" y1="${y}" x2="${cx + w / 2}" y2="${y}" class="sup"/>`;
  for (let x = cx - w / 2 + 6; x <= cx + w / 2 + 1; x += 8) s += `<line x1="${x}" y1="${y}" x2="${x - 7}" y2="${y + 8}" class="hatch"/>`;
  return s;
}
function drawSupport(it: PointItem, px: number, py: number) {
  let inner = '';
  if (it.type === 'pin') inner = `<polygon points="${px},${py + 5} ${px - 16},${py + 34} ${px + 16},${py + 34}" class="sup"/>` + ground(px, py + 34, 50);
  if (it.type === 'roller')
    inner = `<polygon points="${px},${py + 5} ${px - 14},${py + 29} ${px + 14},${py + 29}" class="sup"/><circle cx="${px - 7}" cy="${py + 34}" r="4.5" class="hinge"/><circle cx="${px + 7}" cy="${py + 34}" r="4.5" class="hinge"/>${ground(px, py + 39, 48)}`;
  if (it.type === 'rod')
    inner = `<line x1="${px}" y1="${py}" x2="${px}" y2="${py + 82}" class="sup" stroke-width="2.4"/><circle cx="${px}" cy="${py + 82}" r="4.5" class="hinge"/>${ground(px, py + 87, 40)}`;
  if (it.type === 'fixed') {
    inner = `<line x1="${px - 40}" y1="${py}" x2="${px + 40}" y2="${py}" class="sup" stroke-width="2.4"/>`;
    for (let x = px - 36; x <= px + 40; x += 8) inner += `<line x1="${x}" y1="${py}" x2="${x - 9}" y2="${py + 9}" class="hatch"/>`;
  }
  return `<g transform="rotate(${r1(90 - (it.angle as number))} ${r1(px)} ${r1(py)})">${inner}</g>`;
}

interface Iv {
  s: Seg;
  lo: number;
  hi: number;
  y?: number;
  x?: number;
  row?: number;
}
function pack(intervals: Iv[]) {
  const rows: Iv[][] = [];
  intervals
    .sort((a, b) => a.lo - b.lo)
    .forEach((iv) => {
      let r = rows.findIndex((row) => row.every((o) => iv.lo >= o.hi - 1e-9 || iv.hi <= o.lo + 1e-9));
      if (r < 0) {
        rows.push([]);
        r = rows.length - 1;
      }
      rows[r].push(iv);
      iv.row = r;
    });
  return rows.length;
}

export interface DrawOptions {
  view: View;
  sel: string | null;
}

export function renderDrawing(s: Structure, m: Model, sol: Solution, opts: DrawOptions): Drawing {
  const { items } = resolve(s);
  const G: Geom = m.g;
  const schema = opts.view === 'schema',
    solved = sol.status === 'ok';
  const w = m.w,
    h = m.h;
  const hs: Iv[] = [],
    vl: Iv[] = [],
    vr: Iv[] = [];
  s.segs.forEach((q) => {
    const A = G.pos[q.a],
      B = G.pos[q.b];
    if (q.dir === 'r' || q.dir === 'l') hs.push({ s: q, lo: Math.min(A[0], B[0]), hi: Math.max(A[0], B[0]), y: A[1] });
    else (A[0] > w / 2 + 1e-9 ? vr : vl).push({ s: q, lo: Math.min(A[1], B[1]), hi: Math.max(A[1], B[1]), x: A[0] });
  });
  const nH = pack(hs),
    nL = pack(vl),
    nR = pack(vr);
  const xsDistinct = new Set(m.pts.map((p) => p.x)).size,
    totalRow = hs.length > 1 && xsDistinct > 2 && nH === 1;
  const mL = vl.length ? 130 + 28 * nL : 110,
    mR = vr.length ? 130 + 28 * nR : 110,
    top = 115;
  const aw = W - mL - mR,
    ah = 340;
  let SC = Math.min(w > 1e-9 ? aw / w : Infinity, h > 1e-9 ? ah / h : Infinity);
  if (!isFinite(SC)) SC = 100;
  const OX = mL + (aw - w * SC) / 2,
    OY = top,
    MAXY = h;
  const X = (x: number) => OX + x * SC,
    Y = (y: number) => OY + (MAXY - y) * SC;
  const sp = (id: string): [number, number] => [X(G.pos[id][0]), Y(G.pos[id][1])];
  const yD = Y(0) + 118,
    rowsH = nH + (totalRow ? 1 : 0);
  const H = Math.max(450, Math.round(yD + 30 * Math.max(rowsH - 1, 0) + 110));
  const dimPos: Layout['dimPos'] = {};
  const o: string[] = [];
  o.push(
    `<defs><pattern id="mm" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="g1"/></pattern><pattern id="cm" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#mm)"/><path d="M50 0H0V50" class="g2"/></pattern></defs>`,
  );
  o.push(`<rect width="${W}" height="${H}" fill="var(--sheet)"/><rect width="${W}" height="${H}" fill="url(#cm)"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" class="frame"/>`);
  // размеры
  const tick = (x: number, y: number) => `<line x1="${r1(x - 5)}" y1="${r1(y + 5)}" x2="${r1(x + 5)}" y2="${r1(y - 5)}" class="dim" stroke-width="1.6"/>`;
  hs.forEach((iv) => {
    const yy = yD + 30 * iv.row!,
      xa = X(iv.lo),
      xb = X(iv.hi),
      yn = Y(iv.y!),
      cx = (xa + xb) / 2,
      wpx = xb - xa;
    o.push(
      `<line x1="${r1(xa)}" y1="${r1(yn + 8)}" x2="${r1(xa)}" y2="${r1(yy + 6)}" class="ext"/><line x1="${r1(xb)}" y1="${r1(yn + 8)}" x2="${r1(xb)}" y2="${r1(yy + 6)}" class="ext"/>`,
    );
    o.push(`<line x1="${r1(xa)}" y1="${yy}" x2="${r1(xb)}" y2="${yy}" class="dim"/>` + tick(xa, yy) + tick(xb, yy));
    const hw = Math.max(14, Math.min(34, wpx / 2));
    o.push(
      `<text x="${r1(cx)}" y="${yy - 7}" text-anchor="middle" class="t-dimed"${wpx < 28 ? ' font-size="11"' : ''}>${fmt(iv.s.len, 2)}</text><rect x="${r1(cx - hw)}" y="${yy - 26}" width="${r1(2 * hw)}" height="25" class="dimhit" data-dim="${iv.s.id}"><title>Изменить длину участка</title></rect>`,
    );
    dimPos[iv.s.id] = [cx, yy - 12];
  });
  if (totalRow) {
    const yy = yD + 30 * nH;
    o.push(
      `<line x1="${r1(X(0))}" y1="${yy}" x2="${r1(X(w))}" y2="${yy}" class="dim"/>` +
        tick(X(0), yy) +
        tick(X(w), yy) +
        `<text x="${r1(X(w / 2))}" y="${yy - 6}" text-anchor="middle" class="t-dim">${fmt(w, 2)}</text>`,
    );
  }
  const vdim = (iv: Iv, xx: number) => {
    const ya = Y(iv.hi),
      yb = Y(iv.lo),
      cy = (ya + yb) / 2,
      xn = X(iv.x!),
      hpx = yb - ya,
      dirOut = xx < xn ? -1 : 1;
    o.push(
      `<line x1="${r1(xn + dirOut * 8)}" y1="${r1(ya)}" x2="${r1(xx + dirOut * 6)}" y2="${r1(ya)}" class="ext"/><line x1="${r1(xn + dirOut * 8)}" y1="${r1(yb)}" x2="${r1(xx + dirOut * 6)}" y2="${r1(yb)}" class="ext"/>`,
    );
    o.push(`<line x1="${r1(xx)}" y1="${r1(ya)}" x2="${r1(xx)}" y2="${r1(yb)}" class="dim"/>` + tick(xx, ya) + tick(xx, yb));
    const tx = xx - 7,
      hh = Math.max(14, Math.min(34, hpx / 2));
    o.push(
      `<text x="${r1(tx)}" y="${r1(cy)}" transform="rotate(-90 ${r1(tx)} ${r1(cy)})" text-anchor="middle" class="t-dimed"${hpx < 28 ? ' font-size="11"' : ''}>${fmt(iv.s.len, 2)}</text><rect x="${r1(tx - 19)}" y="${r1(cy - hh)}" width="25" height="${r1(2 * hh)}" class="dimhit" data-dim="${iv.s.id}"><title>Изменить длину участка</title></rect>`,
    );
    dimPos[iv.s.id] = [tx - 4, cy];
  };
  vl.forEach((iv) => vdim(iv, X(0) - 95 - 28 * iv.row!));
  vr.forEach((iv) => vdim(iv, X(w) + 95 + 28 * iv.row!));
  // опоры
  const pointItems = items.filter((it): it is PointItem => it.type !== 'dist');
  o.push(
    `<g class="${schema ? 'faint' : ''}">` +
      pointItems
        .filter((it) => TYPES[it.type].support)
        .map((it) => drawSupport(it, X(it.x), Y(it.y)))
        .join('') +
      `</g>`,
  );
  // распределённая нагрузка
  const qmax = Math.max(1e-9, ...m.dists.map((d) => Math.max(Math.abs(d.q1), Math.abs(d.q2))));
  for (const d of m.dists) {
    const [ax, ay] = sp(d.from),
      [bx, by] = sp(d.to),
      t = (LOADDIR[d.it.dir].ang * Math.PI) / 180,
      u = [Math.cos(t), -Math.sin(t)],
      n = [-u[0], -u[1]];
    const hq = (q: number) => (54 * Math.abs(q)) / qmax,
      B = 8,
      pt = (x: number, y: number, k: number) => [x + n[0] * k, y + n[1] * k];
    const p1 = pt(ax, ay, B),
      p2 = pt(ax, ay, B + hq(d.q1)),
      p3 = pt(bx, by, B + hq(d.q2)),
      p4 = pt(bx, by, B);
    let s = `<polygon points="${[p1, p2, p3, p4].map((p) => r1(p[0]) + ',' + r1(p[1])).join(' ')}" class="ldfill"/>`;
    const len = Math.hypot(bx - ax, by - ay),
      k = Math.max(2, Math.floor(len / 26) + 1);
    for (let i = 0; i < k; i++) {
      const f = i / (k - 1),
        xx = ax + (bx - ax) * f,
        yy = ay + (by - ay) * f,
        hh = hq(d.q1 + (d.q2 - d.q1) * f);
      if (hh > 12) {
        const [x0, y0] = pt(xx, yy, B + hh),
          [x1, y1] = pt(xx, yy, B);
        s += arrowLine(x0, y0, x1, y1, 'ldt');
      }
    }
    const lab = Math.abs(d.q1 - d.q2) < 1e-12 ? ssym({ L: 'q', S: d.S }, ` = ${fmt(d.q1)}`) : ssym({ L: 'q', S: d.S }, ` = ${fmt(d.q1)}…${fmt(d.q2)}`);
    const [lx, ly] = pt((ax + bx) / 2, (ay + by) / 2, B + Math.max(hq(d.q1), hq(d.q2)) + 10);
    if (Math.abs(n[0]) > 0.5) {
      const rx = lx + (n[0] < 0 ? -2 : 14);
      s += `<text x="${r1(rx)}" y="${r1(ly)}" transform="rotate(-90 ${r1(rx)} ${r1(ly)})" text-anchor="middle" class="t t-ld">${lab}</text>`;
    } else s += `<text x="${r1(lx)}" y="${r1(ly + (n[1] > 0.5 ? 12 : 0))}" text-anchor="middle" class="t t-ld">${lab}</text>`;
    o.push(schema ? `<g class="faint">${s}</g>` : s);
    if (schema) {
      if (d.split)
        // Знакопеременная нагрузка: две равнодействующие, каждая со своей стороны.
        for (const p of d.split.parts) {
          const tp = (LOADDIR[p.dir].ang * Math.PI) / 180;
          o.push(forceArrow(X(p.o.x), Y(p.o.y), p.o.angle, [-Math.cos(tp), Math.sin(tp)], 'ld', false, ssym(p.o, ` = ${fmt(p.Q)}`), 't-ld', 62));
        }
      else o.push(forceArrow(X(d.o.x), Y(d.o.y), d.o.angle, n, 'ld', false, ssym(d.o, ` = ${fmt(d.Q)}`), 't-ld', 62));
    }
  }
  // участки
  s.segs.forEach((q) => {
    const [x1, y1] = sp(q.a),
      [x2, y2] = sp(q.b);
    o.push(`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" class="mem"/>`);
  });
  s.segs.forEach((q) => {
    const [x1, y1] = sp(q.a),
      [x2, y2] = sp(q.b);
    o.push(`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" class="memhit" data-segid="${q.id}"><title>Двойной щелчок — добавить точку</title></line>`);
  });
  pointItems
    .filter((it) => it.type === 'pin' || it.type === 'roller' || it.type === 'rod')
    .forEach((it) => o.push(`<circle cx="${r1(X(it.x))}" cy="${r1(Y(it.y))}" r="4.5" class="hinge"${schema ? ' opacity=".35"' : ''}/>`));
  // Внутренние шарниры: кружок на стержне (в конструкции без шарниров ничего не добавляется).
  m.parts.hinges.forEach((h) => {
    const [hx, hy] = sp(h);
    o.push(`<circle cx="${r1(hx)}" cy="${r1(hy)}" r="6.5" class="hinge ihinge" stroke-width="2"><title>Внутренний шарнир</title></circle>`);
  });
  // нагрузки
  const loadObj = (id: string): Action | undefined => [...m.knowns, ...m.unkLoads].find((a) => a.itemId === id);
  const angleMark = (px: number, py: number, it: PointItem & { type: 'force' }) => {
    const a = +it.alpha || 0;
    if (Math.abs(a % 180) < 1e-9) return '';
    const r = REFS[it.ref] || REFS.down,
      th0 = r.base + 180,
      sg = it.rot === 'ccw' ? 1 : -1,
      th1 = th0 + sg * a;
    const P = (t: number, R: number) => [px + R * Math.cos((t * Math.PI) / 180), py - R * Math.sin((t * Math.PI) / 180)];
    const R = 34,
      [x0, y0] = P(th0, R),
      [x1, y1] = P(th1, R),
      [lx, ly] = P(th0 + (sg * a) / 2, R + 15);
    let s = '';
    if (!G.adj[it.at].has(r.back)) {
      const [ex, ey] = P(th0, 66);
      s += `<line x1="${r1(px)}" y1="${r1(py)}" x2="${r1(ex)}" y2="${r1(ey)}" class="angref"/>`;
    }
    s += `<path d="M${r1(x0)} ${r1(y0)} A${R} ${R} 0 ${a > 180 ? 1 : 0} ${sg > 0 ? 0 : 1} ${r1(x1)} ${r1(y1)}" class="angarc"/>`;
    s += `<text x="${r1(lx)}" y="${r1(ly + 5)}" text-anchor="middle" class="t-ang">${it.angleName ? it.angleName + ' = ' : ''}${fmt(a, 2)}°</text>`;
    return s;
  };
  for (const it of pointItems) {
    if (TYPES[it.type].support) continue;
    const px = X(it.x),
      py = Y(it.y),
      a = loadObj(it.id);
    if (!a) continue;
    if (it.type === 'force') {
      const unk = it.unknown,
        v = unk && solved ? sol.vals[a.key!] : null;
      let ang = it.angle as number;
      if (v != null && v < 0) ang += 180;
      const lab = ssym(a, unk ? (v != null ? ` = ${fmt(Math.abs(v))}` : ' = ?') : ` = ${fmt(it.F)}`);
      o.push(angleMark(px, py, it));
      o.push(
        forceArrow(
          px,
          py,
          ang,
          [-Math.cos(((it.angle as number) * Math.PI) / 180), Math.sin(((it.angle as number) * Math.PI) / 180)],
          unk && v != null ? 'rc' : 'ld',
          unk && v == null,
          lab,
          unk && v != null ? 't-rc' : 't-ld',
        ),
      );
    } else if (it.type === 'weight') {
      if (schema || G.adj[it.at].has('d')) o.push(forceArrow(px, py, 270, [0, -1], 'ld', false, ssym(a, ` = ${fmt(it.G)}`), 't-ld'));
      else
        o.push(
          `<line x1="${px}" y1="${py + 5}" x2="${px}" y2="${py + 50}" class="ld" stroke-width="1.4"/><rect x="${px - 15}" y="${py + 50}" width="30" height="26" class="ld" fill="var(--sheet)"/><text x="${px + 22}" y="${py + 69}" class="t t-ld">${ssym(a, ` = ${fmt(it.G)}`)}</text>`,
        );
    } else if (it.type === 'moment') {
      const unk = it.unknown,
        v = unk && solved ? sol.vals[a.key!] : null;
      let ccw = it.dir === 'ccw';
      if (v != null && v < 0) ccw = !ccw;
      const lab = ssym(a, unk ? (v != null ? ` = ${fmt(Math.abs(v))}` : ' = ?') : ` = ${fmt(it.M)}`);
      o.push(momentArc(px, py, 28, ccw, unk && v != null ? 'rc' : 'ld', lab, unk && v != null ? 't-rc' : 't-ld', unk && v == null));
    }
  }
  // реакции
  if (schema) {
    for (const q of m.supports) {
      const px = X(q.it.x),
        py = Y(q.it.y),
        adj = G.adj[q.it.at];
      for (const u of q.list) {
        const v = solved ? sol.vals[u.key] : null,
          lab = ssym(u, v != null ? ` = ${fmt(Math.abs(v))}` : '');
        if (u.kind === 'm') {
          let ccw = u.s > 0;
          if (v != null && v < 0) ccw = !ccw;
          o.push(momentArc(px, py, 40, ccw, 'rc', lab, 't-rc'));
          continue;
        }
        let ang = u.angle;
        if (v != null && v < 0) ang += 180;
        let side: number[];
        if (u.L === 'X') side = [!adj.has('l') ? -1 : !adj.has('r') ? 1 : -1, 0];
        else if (u.L === 'Y') side = [0, !adj.has('d') ? 1 : !adj.has('u') ? -1 : 1];
        else {
          const t = (u.angle * Math.PI) / 180;
          side = [-Math.cos(t), Math.sin(t)];
        }
        o.push(forceArrow(px, py, ang, side, 'rc', false, lab, 't-rc', u.L === 'X' ? 60 : 72, 7));
      }
    }
  }
  // имена точек — в самом свободном из восьми направлений
  const occ: Record<string, number[][]> = {};
  G.order.forEach((id) => (occ[id] = [...G.adj[id]].map((d) => ({ r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] })[d])));
  for (const it of items) {
    if (it.type === 'dist') {
      const g = distGeom(G, it);
      if (!g.ok) continue;
      const t = (LOADDIR[it.dir].ang * Math.PI) / 180,
        n = [-Math.cos(t), Math.sin(t)];
      pathNodes(G, it.from, it.to).forEach((id) => occ[id].push(n));
      continue;
    }
    const t = ((it.angle || 0) * Math.PI) / 180;
    if (TYPES[it.type].support || it.type === 'force') occ[it.at].push([-Math.cos(t), Math.sin(t)]);
    if (it.type === 'fixed') occ[it.at].push([Math.sin(t), Math.cos(t)], [-Math.sin(t), -Math.cos(t)]);
    if (it.type === 'weight') occ[it.at].push(G.adj[it.at].has('d') ? [0, -1] : [0, 1]);
    if (it.type === 'moment') occ[it.at].push([0.7, 0.7]);
  }
  const cand = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ].map(([x, y]) => {
    const l = Math.hypot(x, y);
    return [x / l, y / l];
  });
  for (const p of m.pts) {
    let best = cand[0],
      bs = -2;
    cand.forEach((c, i) => {
      const ds = occ[p.id].map((v) => {
        const l = Math.hypot(v[0], v[1]) || 1;
        return (c[0] * v[0] + c[1] * v[1]) / l;
      });
      const sc = -Math.max(-1, ...ds) - 0.15 * (ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0) - i * 0.01;
      if (sc > bs + 1e-9) {
        bs = sc;
        best = c;
      }
    });
    const lx = X(p.x) + best[0] * 24,
      ly = Y(p.y) + best[1] * 24 + 6,
      anc = best[0] < -0.3 ? 'end' : best[0] > 0.3 ? 'start' : 'middle';
    o.push(`<text x="${r1(lx)}" y="${r1(ly)}" text-anchor="${anc}" class="t-pt">${p.name}</text>`);
  }
  // выделение и области захвата
  for (const it of items) {
    if (it.type === 'dist') {
      const [ax, ay] = sp(it.from),
        [bx, by] = sp(it.to),
        t = (LOADDIR[it.dir].ang * Math.PI) / 180,
        n = [-Math.cos(t), Math.sin(t)];
      const xs = [ax, bx, ax + n[0] * 64, bx + n[0] * 64],
        ys = [ay, by, ay + n[1] * 64, by + n[1] * 64];
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
      if (it.id === opts.sel) o.push(`<rect x="${r1(x0 - 6)}" y="${r1(y0 - 6)}" width="${r1(x1 - x0 + 12)}" height="${r1(y1 - y0 + 12)}" class="selring" rx="4"/>`);
      o.push(`<rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(Math.max(10, x1 - x0))}" height="${r1(Math.max(10, y1 - y0))}" class="hit hitsel" data-pick="${it.id}"/>`);
      continue;
    }
    const px = X(it.x),
      py = Y(it.y),
      t = ((it.angle || 0) * Math.PI) / 180;
    let off = [0, 0];
    if (TYPES[it.type].support) off = [-Math.cos(t) * (it.type === 'rod' ? 40 : 24), Math.sin(t) * (it.type === 'rod' ? 40 : 24)];
    else if (it.type === 'force') off = [-Math.cos(t) * 44, Math.sin(t) * 44];
    else if (it.type === 'weight') off = [0, 58];
    const hx = px + off[0],
      hy = py + off[1];
    if (it.id === opts.sel) o.push(`<circle cx="${r1(hx)}" cy="${r1(hy)}" r="30" class="selring"/>`);
    o.push(`<circle cx="${r1(hx)}" cy="${r1(hy)}" r="${it.type === 'force' ? 30 : 24}" class="hit" data-drag="${it.id}"/>`);
  }
  // штамп
  const st = STATUS[sol.status],
    sx = 688,
    sy = H - 70;
  o.push(`<rect x="${sx}" y="${sy}" width="300" height="58" class="stamp"/><line x1="${sx}" y1="${sy + 19}" x2="${sx + 300}" y2="${sy + 19}" class="stl"/><line x1="${sx}" y1="${sy + 38}" x2="${sx + 300}" y2="${sy + 38}" class="stl"/><line x1="${sx + 104}" y1="${sy}" x2="${sx + 104}" y2="${sy + 58}" class="stl"/>
    <text x="${sx + 8}" y="${sy + 14}" class="t-st">Вид</text><text x="${sx + 112}" y="${sy + 14}" class="t-stv">${schema ? 'Расчётная схема' : 'Конструкция'}</text>
    <text x="${sx + 8}" y="${sy + 33}" class="t-st">Габарит</text><text x="${sx + 112}" y="${sy + 33}" class="t-stv">${h > 1e-9 ? fmt(w, 2) + ' × ' + fmt(h, 2) + ' м' : 'L = ' + fmt(w, 2) + ' м'}, неизвестных: ${sol.n}</text>
    <text x="${sx + 8}" y="${sy + 52}" class="t-st">Статус</text><text x="${sx + 112}" y="${sy + 52}" class="t-stv ${st[2]}">${st[0]}</text>`);
  o.push(`<text x="26" y="${H - 24}" class="t-st">Силы — кН, моменты — кН·м, длины — м</text>`);
  return { svg: o.join(''), viewBox: `0 0 ${W} ${H}`, layout: { W, H, SC, OX, OY, MAXY, dimPos } };
}

/** Ближайший к экранной точке узел (для перетаскивания элементов). */
export function nearestNode(L: Layout, g: Geom, p: [number, number]): string {
  let b = g.order[0],
    bd = Infinity;
  g.order.forEach((id) => {
    const [x, y] = toScreen(L, g.pos[id][0], g.pos[id][1]),
      d = Math.hypot(x - p[0], y - p[1]);
    if (d < bd) {
      bd = d;
      b = id;
    }
  });
  return b;
}
