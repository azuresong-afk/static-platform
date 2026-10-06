/**
 * Принцип возможных перемещений для конструкций из «Балок и рам» (Мещерский §46): реакции и неизвестные нагрузки
 * по одной, без уравнений равновесия для каждого тела.
 *
 * Конструкция — жёсткие части (по внутренним шарнирам). Малое перемещение части p задаётся тремя числами:
 * сдвигом (δx_p, δy_p) точки, совпадающей с началом координат, и поворотом δφ_p (против часовой — «+»):
 *   δr_p(x, y) = (δx_p − δφ_p·y,  δy_p + δφ_p·x).
 * Каждой неизвестной u (реакции, неизвестной нагрузке, взаимной силе в шарнире) соответствует линейная функция
 * перемещений w_u(δ) — работа единичной силы u:
 *   сила в точке (x, y) части p по орту d — проекция δr_p(x, y) на d;
 *   пара на части p — s·δφ_p;
 *   взаимная сила в шарнире — проекция разности перемещений двух частей в шарнире (совместность).
 * Для искомой неизвестной k «отбрасываем связь»: ищем δ с w_k(δ) = 1 и w_u(δ) = 0 для остальных u — все прочие
 * связи и шарниры перемещение допускают, а работу совершают только X_k и известные нагрузки. Тогда
 *   X_k·1 + Σ_известных F·δr = 0  ⇒  X_k = −Σ_известных F·δr.
 * Для определимой конструкции система квадратная (3 уравнения на часть) и решение единственно: это механизм
 * с одной степенью свободы. Если неизвестных меньше 3·(число частей) (тело-механизм, равновесие возможно только
 * при особой нагрузке), берётся перемещение наименьшей нормы — ответ от выбора не зависит, раз равновесие есть.
 */
import { gauss } from '../../../shared/gauss';
import type { Analysis } from '../../frames/analyze';
import type { Pt } from '../../frames/model/geometry';
import type { Structure } from '../../frames/model/types';
import type { Action, Known, Unknown } from '../../frames/solver/model';

export interface PartMotion {
  /** Перемещение части: сдвиг точки-начала координат и поворот (на единицу δs искомой неизвестной). */
  dx: number;
  dy: number;
  dphi: number;
  /** Неподвижна, движется поступательно или поворачивается вокруг центра (мгновенного центра поворота). */
  kind: 'still' | 'trans' | 'rot';
  center: Pt | null;
}

export interface WorkTerm {
  act: Known;
  part: number;
  /** Перемещение точки приложения вдоль силы (или угол поворота части для пары) на единицу δs. */
  disp: number;
  /** Полное перемещение точки (для пояснения), на единицу δs. */
  dr: Pt;
  work: number;
}

export interface Release {
  unknown: Unknown;
  motions: PartMotion[];
  terms: WorkTerm[];
  /** Найденное значение и значение из уравнений равновесия («Балки и рамы»). */
  value: number;
  ref: number;
  /** Перемещение единственное (одна степень свободы после отбрасывания связи). */
  unique: boolean;
}

export type VirtualResult =
  | { ok: true; releases: Release[]; parts: number; partNames: string[][] }
  | { ok: false; why: 'status' | 'baddist' | 'empty' | 'friction' };

const EPS = 1e-9;

/** Перемещение точки (x, y) части с движением m. */
export const dispAt = (m: Pick<PartMotion, 'dx' | 'dy' | 'dphi'>, x: number, y: number): Pt => [m.dx - m.dphi * y, m.dy + m.dphi * x];

/** Строка «работы единичной неизвестной» по 3·P переменным (dx, dy, dphi части 0, части 1, …). */
function rowOf(a: Action, P: number): number[] {
  const r = new Array(3 * P).fill(0);
  if (a.hinge) {
    const { on, from } = a.hinge;
    for (const [p, sg] of [
      [on, 1],
      [from, -1],
    ] as const) {
      r[3 * p] += sg * a.dx;
      r[3 * p + 1] += sg * a.dy;
      r[3 * p + 2] += sg * (-a.dx * a.y + a.dy * a.x);
    }
    return r;
  }
  const p = a.part ?? 0;
  if (a.kind === 'm') r[3 * p + 2] = a.s;
  else {
    r[3 * p] = a.dx;
    r[3 * p + 1] = a.dy;
    r[3 * p + 2] = -a.dx * a.y + a.dy * a.x;
  }
  return r;
}

function motionOf(dx: number, dy: number, dphi: number, size: number): PartMotion {
  const tol = EPS;
  if (Math.abs(dphi) * size > tol) return { dx, dy, dphi, kind: 'rot', center: [-dy / dphi, dx / dphi] };
  if (Math.hypot(dx, dy) > tol) return { dx, dy, dphi: 0, kind: 'trans', center: null };
  return { dx: 0, dy: 0, dphi: 0, kind: 'still', center: null };
}

export function virtualWork(s: Structure, a: Analysis): VirtualResult {
  const { model: m, solution: sol } = a;
  if (!s.segs.length && !s.items.length) return { ok: false, why: 'empty' };
  if (m.badDists.length) return { ok: false, why: 'baddist' };
  if (sol.status === 'friction') return { ok: false, why: 'friction' };
  if (sol.status !== 'ok') return { ok: false, why: 'status' };
  const P = m.parts.count;
  const A = m.unknowns.map((u) => rowOf(u, P));
  const n = A.length;
  const size = Math.max(1, m.w, m.h);
  const releases: Release[] = [];
  for (let k = 0; k < n; k++) {
    const u = m.unknowns[k];
    if (u.hinge) continue;
    const e = new Array(n).fill(0);
    e[k] = 1;
    let d: number[];
    const unique = n === 3 * P;
    if (unique) d = gauss(A, e);
    else {
      // Перемещение наименьшей нормы: δ = Aᵀy, (A·Aᵀ)·y = e.
      const AAt = A.map((r) => A.map((q) => r.reduce((acc, x, i) => acc + x * q[i], 0)));
      const y = gauss(AAt, e);
      d = new Array(3 * P).fill(0).map((_, j) => A.reduce((acc, r, i) => acc + r[j] * y[i], 0));
    }
    const motions = Array.from({ length: P }, (_, p) => motionOf(d[3 * p], d[3 * p + 1], d[3 * p + 2], size));
    const terms: WorkTerm[] = m.knowns.map((act) => {
      const p = act.part ?? 0;
      const mo = motions[p];
      const dr = dispAt(mo, act.x, act.y);
      const disp = act.kind === 'm' ? act.s * mo.dphi : dr[0] * act.dx + dr[1] * act.dy;
      return { act, part: p, disp, dr, work: act.val * disp };
    });
    const value = -terms.reduce((acc, t) => acc + t.work, 0);
    releases.push({ unknown: u, motions, terms, value, ref: sol.vals[u.key], unique });
  }
  return { ok: true, releases, parts: P, partNames: m.partNames };
}
