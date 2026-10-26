/**
 * Принцип возможных перемещений для плоской системы жёстких тел на шарнирах с замкнутыми контурами (пункт 29:
 * Мещерский 46.24, 46.28). Схема «Балок и рам» — дерево участков, замкнутую раму или две фермы на стержнях в ней не
 * собрать; здесь тела и связи задаются списком.
 *
 * Малое перемещение тела p — (δx_p, δy_p, δφ_p): δr(x, y) = (δx_p − δφ_p·y, δy_p + δφ_p·x). Каждая связь даёт
 * строки «работы единичной реакции» (как в model/virtual.ts): шарнир между телами (или с землёй) — две, каток или
 * стержень-опора — одна (проекция перемещения на линию реакции), стержень между двумя телами — одна (сближение
 * концов). Отбрасываем связь k: ищем перемещение, при котором строка k даёт 1, а остальные связи не нарушены, тогда
 * X_k·1 + Σ F·δr = 0. Для статически определимой системы матрица квадратная и невырожденная.
 */
import { gauss } from '../../../shared/gauss';
import { rankOf } from '../../../shared/rank';

export type P2 = [number, number];
export type VwLink =
  /** Шарнир тела a с телом b (null — с землёй) в точке at. */
  | { k: 'pin'; a: number; b: number | null; at: P2; name: string }
  /** Каток (или стержень-опора) тела a в точке at: реакция по направлению n. */
  | { k: 'roller'; a: number; at: P2; n: P2; name: string }
  /** Стержень между точкой pa тела a и pb тела b: усилие S > 0 — растяжение. */
  | { k: 'bar'; a: number; pa: P2; b: number; pb: P2; name: string };
export interface VwLoad {
  body: number;
  at: P2;
  F: P2;
  name: string;
}
export interface VwMotion {
  dx: number;
  dy: number;
  dphi: number;
  /** Мгновенный центр поворота (null — поступательное перемещение или покой). */
  center: P2 | null;
  kind: 'still' | 'trans' | 'rot';
}
export type VwResult =
  | { ok: true; value: number; motions: VwMotion[]; disp: (body: number, at: P2) => P2; works: { load: VwLoad; dr: P2; work: number }[] }
  | { ok: false; error: string };

const unit = (v: P2): P2 => {
  const L = Math.hypot(v[0], v[1]);
  return [v[0] / L, v[1] / L];
};
/** Строка работы силы с ортом d в точке (x, y) тела p (знак s). */
function put(r: number[], p: number, d: P2, at: P2, s: number) {
  r[3 * p] += s * d[0];
  r[3 * p + 1] += s * d[1];
  r[3 * p + 2] += s * (-d[0] * at[1] + d[1] * at[0]);
}

export function rows(n: number, links: VwLink[]): { rows: number[][]; owner: number[] } {
  const out: number[][] = [],
    owner: number[] = [];
  links.forEach((l, i) => {
    const add = (fill: (r: number[]) => void) => {
      const r = new Array(3 * n).fill(0);
      fill(r);
      out.push(r);
      owner.push(i);
    };
    if (l.k === 'pin')
      for (const d of [
        [1, 0],
        [0, 1],
      ] as P2[])
        add((r) => {
          put(r, l.a, d, l.at, 1);
          if (l.b != null) put(r, l.b, d, l.at, -1);
        });
    else if (l.k === 'roller') add((r) => put(r, l.a, unit(l.n), l.at, 1));
    else {
      const e = unit([l.pb[0] - l.pa[0], l.pb[1] - l.pa[1]]);
      add((r) => {
        put(r, l.a, e, l.pa, 1);
        put(r, l.b, e, l.pb, -1);
      });
    }
  });
  return { rows: out, owner };
}

/** Реакция (усилие) отброшенной связи `release` (каток или стержень) по принципу возможных перемещений. */
export function solveVW(n: number, links: VwLink[], loads: VwLoad[], release: number, size = 1): VwResult {
  const rl = links[release];
  if (!rl || rl.k === 'pin') return { ok: false, error: 'Отбрасывать можно каток или стержень (одна неизвестная).' };
  const { rows: A, owner } = rows(n, links);
  if (A.length !== 3 * n) return { ok: false, error: `Связей ${A.length}, а нужно ${3 * n} (по три на тело): система не статически определима.` };
  if (rankOf(A) < A.length) return { ok: false, error: 'Система геометрически изменяема: связи не закрепляют тела однозначно.' };
  const k = owner.indexOf(release);
  const e = new Array(A.length).fill(0);
  e[k] = 1;
  const d = gauss(A, e);
  if (!d.every(Number.isFinite)) return { ok: false, error: 'Перемещение не определяется: проверьте связи.' };
  const motions: VwMotion[] = Array.from({ length: n }, (_, p) => {
    const [dx, dy, dphi] = [d[3 * p], d[3 * p + 1], d[3 * p + 2]];
    if (Math.abs(dphi) * size > 1e-9) return { dx, dy, dphi, center: [-dy / dphi, dx / dphi], kind: 'rot' };
    if (Math.hypot(dx, dy) > 1e-9) return { dx, dy, dphi: 0, center: null, kind: 'trans' };
    return { dx: 0, dy: 0, dphi: 0, center: null, kind: 'still' };
  });
  const disp = (body: number, at: P2): P2 => {
    const m = motions[body];
    return [m.dx - m.dphi * at[1], m.dy + m.dphi * at[0]];
  };
  const works = loads.map((load) => {
    const dr = disp(load.body, load.at);
    return { load, dr, work: load.F[0] * dr[0] + load.F[1] * dr[1] };
  });
  return { ok: true, value: -works.reduce((s, w) => s + w.work, 0), motions, disp, works };
}
