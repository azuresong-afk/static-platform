/**
 * Смешанные задачи (Мещерский §43) и программное движение (Яблонский, Д.20) — дополнения к уравнениям Лагранжа.
 *
 * Реакция связей на тело: по теореме о движении центра масс R = m·a_C − m·g (ось y — вверх, g — параметр).
 * Центр масс задан формулами x_C(q), y_C(q); ускорение a_C — вторая производная по времени (с q̈ и q̇²).
 * Проекции на оси e (угол β с осью x, может зависеть от q) и n (e, повёрнутая на 90°):
 *   R_e = R_x cos β + R_y sin β,  R_n = −R_x sin β + R_y cos β.
 * Одна координата: q̈ — из уравнения движения, q̇² — из интеграла энергии при движении из покоя в q₀:
 *   A(q)q̇²/2 + Π(q) = Π(q₀) ⇒ R(q) в буквах (43.10: R и N как функции угла).
 * Отрыв — первый момент, когда выбранная проекция меняет знак или касается нуля (43.5, 43.7, 43.11);
 * событие «q₁ достигла значения» (43.1, 43.2, 43.12). После события тело может стать свободным: центр масс — по
 * параболе, угловая скорость постоянна.
 * Программное движение: по законам qⱼ(t) обобщённые силы, которые его осуществляют,
 *   Qⱼ = d/dt(∂T/∂q̇ⱼ) − ∂T/∂qⱼ + ∂Π/∂qⱼ  — в момент t* и как функции времени.
 */
import { gauss } from '../../../shared/gauss';
import {
  add,
  d,
  div,
  evalSym,
  expand,
  fn,
  mul,
  neg,
  normName,
  num,
  parseSym,
  pow,
  scale,
  sub,
  subst,
  trigSimplify,
  varsOf,
  type Sym,
  type SymContext,
  type Term,
  type Wrt,
} from '../../../shared/sym';
import type { LagProblem, LagSolution } from './lagrange';

const S = (s: Sym) => trigSimplify(expand(s));
const shorter = (a: Sym) => {
  const x = S(a);
  return x.length <= a.length ? x : a;
};
type Err = { ok: false; field: string; error: string };

export interface BodyInfo {
  m: Sym;
  xC: Sym;
  yC: Sym;
  beta: Sym | null;
  /** Скорость и ускорение центра масс. */
  vx: Sym;
  vy: Sym;
  ax: Sym;
  ay: Sym;
  /** Проекции реакции (с q̇, q̈) и, для одной координаты, — как функции q. */
  Re: Sym;
  Rn: Sym;
  ReQ: Sym | null;
  RnQ: Sym | null;
  /** q̇² из интеграла энергии (одна координата, из покоя в q₀). */
  vel2: Sym | null;
  from: Sym | null;
  R0: [number, number];
  series: { t: number[]; e: number[]; n: number[] } | null;
}
export interface EventInfo {
  kind: 'stop' | 'sep' | 'touch';
  /** Проекция реакции, обратившаяся в нуль (для отрыва). */
  comp: 'e' | 'n' | null;
  t: number;
  q: number[];
  v: number[];
  C: [number, number] | null;
  vC: [number, number] | null;
  omega: number | null;
  R: [number, number] | null;
}
export interface FlightInfo {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  omega: number | null;
  /** y = a + b·x + c·x² (null — вертикальный полёт). */
  parabola: { a: number; b: number; c: number } | null;
}
export interface ProgramInfo {
  laws: Sym[];
  dl: Sym[];
  ddl: Sym[];
  /** Требуемые обобщённые силы в буквах (через q, q̇, q̈). */
  Q: Sym[];
  at: number;
  /** Значения законов и сил в момент t*. */
  qAt: number[];
  vAt: number[];
  aAt: number[];
  Qat: number[];
  series: { t: number[]; q: number[][]; Q: number[][] } | null;
}
export interface ReactSolution {
  ok: true;
  body: BodyInfo | null;
  event: EventInfo | null;
  flight: FlightInfo | null;
  program: ProgramInfo | null;
}
export type ReactResult = ReactSolution | Err;

export function solveReact(pr: LagProblem, sol: LagSolution): ReactResult {
  const ctx: SymContext = sol.ctx;
  const pctx: SymContext = { coords: [], params: ctx.params };
  const cn = ctx.coords;
  const pv = new Map(pr.params.map((p) => [normName(p.name.trim()), p.value]));
  const parse = (src: string, field: string, c = ctx, need = true): Sym | Err => {
    const r = parseSym(src, c);
    if (!r.ok) return { ok: false, field, error: r.error };
    if (need && !r.s.length && !/^\s*0\s*$/.test(src)) return { ok: false, field, error: 'Задайте формулу.' };
    return r.s;
  };
  const isCoord = (n: string) => cn.includes(n);
  const tw: Wrt = { k: 'time', isCoord };
  const valAt = (q: number[], v: number[], a?: number[]) => (name: string, ord: number) => {
    const i = cn.indexOf(name);
    if (i >= 0) return ord === 0 ? q[i] : ord === 1 ? v[i] : a ? a[i] : NaN;
    return pv.get(name) ?? NaN;
  };
  const accAt = (q: number[], v: number[], t: number): number[] => {
    const val = valAt(q, v);
    const M = sol.A.map((row) => row.map((x) => evalSym(x, val, t)));
    const rhs = sol.b.map((x) => -evalSym(x, val, t));
    return cn.length === 1 ? [rhs[0] / M[0][0]] : gauss(M, rhs);
  };
  const rk4 = (q: number[], v: number[], t: number, h: number): { q: number[]; v: number[] } => {
    const f = (qq: number[], vv: number[], tt: number) => ({ dq: vv, dv: accAt(qq, vv, tt) });
    const k1 = f(q, v, t);
    const k2 = f(
      q.map((x, i) => x + (h / 2) * k1.dq[i]),
      v.map((x, i) => x + (h / 2) * k1.dv[i]),
      t + h / 2,
    );
    const k3 = f(
      q.map((x, i) => x + (h / 2) * k2.dq[i]),
      v.map((x, i) => x + (h / 2) * k2.dv[i]),
      t + h / 2,
    );
    const k4 = f(
      q.map((x, i) => x + h * k3.dq[i]),
      v.map((x, i) => x + h * k3.dv[i]),
      t + h,
    );
    return {
      q: q.map((x, i) => x + (h / 6) * (k1.dq[i] + 2 * k2.dq[i] + 2 * k3.dq[i] + k4.dq[i])),
      v: v.map((x, i) => x + (h / 6) * (k1.dv[i] + 2 * k2.dv[i] + 2 * k3.dv[i] + k4.dv[i])),
    };
  };

  // Тело.
  let body: BodyInfo | null = null;
  let Rx: Sym = [],
    Ry: Sym = [],
    cb: Sym = [],
    sb: Sym = [];
  let angle: Sym | null = null;
  const bd = pr.body;
  if (bd) {
    if (!pv.has('g')) return { ok: false, field: 'bm', error: 'Для реакции нужен параметр g — ускорение свободного падения.' };
    const m = parse(bd.m, 'bm', pctx);
    if (!Array.isArray(m)) return m;
    const xC = parse(bd.x, 'bx');
    if (!Array.isArray(xC)) return xC;
    const yC = parse(bd.y, 'by');
    if (!Array.isArray(yC)) return yC;
    if ([xC, yC].some((s) => [...varsOf(s).values()].some((v) => v.ord > 0)))
      return { ok: false, field: 'bx', error: 'Положение центра масс зависит только от координат.' };
    let beta: Sym | null = null;
    if (bd.dir.trim()) {
      const b0 = parse(bd.dir, 'bdir');
      if (!Array.isArray(b0)) return b0;
      beta = b0;
      // cos(u + c₀), sin(u + c₀) — по формулам сложения (постоянная часть c₀ — числом, в том числе π/2).
      const c0 = b0.filter((t) => !t.f.length).reduce((x, t) => x + t.c, 0);
      const u = b0.filter((t) => t.f.length);
      const r = (x: number) => (Math.abs(x) < 1e-12 ? 0 : Math.abs(x - Math.round(x)) < 1e-12 ? Math.round(x) : x);
      const [cc, sc] = [r(Math.cos(c0)), r(Math.sin(c0))];
      const cu = u.length ? fn('cos', u) : num(1),
        su = u.length ? fn('sin', u) : [];
      cb = add(scale(cu, cc), scale(su, -sc));
      sb = add(scale(cu, sc), scale(su, cc));
    } else {
      cb = [{ c: 1, f: [] }];
      sb = [];
    }
    if (bd.angle.trim()) {
      const a = parse(bd.angle, 'bangle');
      if (!Array.isArray(a)) return a;
      angle = a;
    }
    const vx = shorter(d(xC, tw)),
      vy = shorter(d(yC, tw));
    const ax = shorter(d(vx, tw)),
      ay = shorter(d(vy, tw));
    const g: Sym = [{ c: 1, f: [[{ k: 'var', name: 'g', ord: 0 }, 1]] }];
    Rx = shorter(mul(m, ax));
    Ry = shorter(mul(m, add(ay, g)));
    const Re = shorter(add(mul(Rx, cb), mul(Ry, sb)));
    const Rn = shorter(add(neg(mul(Rx, sb)), mul(Ry, cb)));
    // Одна координата: q̈ из уравнения, q̇² из интеграла энергии.
    let ReQ: Sym | null = null,
      RnQ: Sym | null = null,
      vel2: Sym | null = null,
      from: Sym | null = null;
    if (cn.length === 1 && sol.acc1) {
      const q = cn[0];
      const putAcc = (s: Sym) => subst(s, (a) => (a.name === q && a.ord === 2 ? sol.acc1! : null));
      if (bd.from.trim() && sol.conservative) {
        const f0 = parse(bd.from, 'bfrom', pctx);
        if (!Array.isArray(f0)) return f0;
        from = f0;
        const vq: Wrt = { k: 'var', name: q, ord: 1 };
        const A = S(d(d(sol.T, vq), vq));
        const rest = S(sub(sol.T, scale(mul(A, pow([{ c: 1, f: [[{ k: 'var', name: q, ord: 1 }, 1]] }], 2)), 0.5)));
        if (!rest.length && ![...varsOf(A).values()].some((v) => v.ord > 0)) {
          const P0 = subst(sol.P, (a) => (a.name === q && a.ord === 0 ? f0 : null));
          vel2 = shorter(div(scale(sub(P0, sol.P), 2), A));
        }
      }
      const putVel = (s: Sym): Sym | null => {
        if (!vel2) return s;
        const out: Sym[] = [];
        for (const t of s) {
          let e = 0;
          const f: Term['f'] = [];
          for (const [a, k] of t.f) {
            if (a.k === 'var' && a.name === q && a.ord === 1) e += k;
            else {
              if ((a.k === 'fn' || a.k === 'grp') && [...varsOf(a.a).values()].some((v) => v.name === q && v.ord === 1)) return null;
              f.push([a, k]);
            }
          }
          if (e % 2) return null;
          out.push(e ? mul([{ c: t.c, f }], pow(vel2, e / 2)) : [{ c: t.c, f }]);
        }
        return add(...out);
      };
      const r1 = putVel(putAcc(Re)),
        r2 = putVel(putAcc(Rn));
      ReQ = r1 && shorter(r1);
      RnQ = r2 && shorter(r2);
    }
    const q0 = pr.coords.map((c) => c.q0),
      v0 = pr.coords.map((c) => c.v0);
    const R0e = evalSym(Re, valAt(q0, v0, sol.acc0)),
      R0n = evalSym(Rn, valAt(q0, v0, sol.acc0));
    body = { m, xC, yC, beta, vx, vy, ax, ay, Re, Rn, ReQ, RnQ, vel2, from, R0: [R0e, R0n], series: null };
  }
  const RofState = (q: number[], v: number[], t: number): [number, number] => {
    if (!body) return [NaN, NaN];
    const val = valAt(q, v, accAt(q, v, t));
    return [evalSym(body.Re, val, t), evalSym(body.Rn, val, t)];
  };

  let stopV: number | null = null;
  if (pr.stop && pr.stop.trim()) {
    const s = parse(pr.stop, 'stop', pctx);
    if (!Array.isArray(s)) return s;
    stopV = evalSym(s, (n) => pv.get(n) ?? NaN);
    if (!Number.isFinite(stopV)) return { ok: false, field: 'stop', error: 'Значение координаты не вычисляется.' };
  }

  // По движению: ряды реакций и событие.
  let event: EventInfo | null = null;
  const sim = sol.sim;
  if (sim && sim.t.length > 1) {
    const N = sim.t.length;
    const st = (k: number) => ({ q: sim.q.map((x) => x[k]), v: sim.v.map((x) => x[k]) });
    if (body) {
      const e: number[] = [],
        n: number[] = [];
      for (let k = 0; k < N; k++) {
        const { q, v } = st(k);
        const R = RofState(q, v, sim.t[k]);
        e.push(R[0]);
        n.push(R[1]);
      }
      body.series = { t: sim.t, e, n };
    }
    const comp = bd && bd.sep !== 'none' ? bd.sep : null;
    const fOf = (q: number[], v: number[], t: number): { stop: number; sep: number } => ({
      stop: stopV != null ? q[0] - stopV : NaN,
      sep: comp ? RofState(q, v, t)[comp === 'e' ? 0 : 1] : NaN,
    });
    const hS = sim.t[1] - sim.t[0];
    const at = (k: number, tau: number) => {
      const { q, v } = st(k);
      return tau === 0 ? { q, v } : rk4(q, v, sim.t[k], tau);
    };
    const refine = (k: number, key: 'stop' | 'sep') => {
      // Корень на [t_k, t_k + hS] делением пополам по одному шагу Рунге — Кутта из t_k.
      let lo = 0,
        hi = hS;
      const f = (tau: number) => {
        const s = at(k, tau);
        return fOf(s.q, s.v, sim.t[k] + tau)[key];
      };
      const flo = f(lo);
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === Math.sign(flo)) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const vals = Array.from({ length: N }, (_, k) => {
      const { q, v } = st(k);
      return fOf(q, v, sim.t[k]);
    });
    let found: { k: number; tau: number; kind: EventInfo['kind'] } | null = null;
    for (let k = 1; k < N && !found; k++) {
      for (const key of ['stop', 'sep'] as const) {
        const a = vals[k - 1][key],
          b2 = vals[k][key];
        if (!Number.isFinite(a) || !Number.isFinite(b2)) continue;
        if (a === 0 && k === 1) continue;
        if (Math.sign(a) !== Math.sign(b2) || b2 === 0) {
          const tau = refine(k - 1, key);
          if (!found || sim.t[k - 1] + tau < sim.t[found.k] + found.tau) found = { k: k - 1, tau, kind: key };
        }
      }
    }
    // Касание нуля: локальный минимум |R| почти нулевой.
    if (comp && (!found || found.kind !== 'sep')) {
      const sv = vals.map((x) => x.sep);
      const sc = Math.max(1e-300, ...sv.filter(Number.isFinite).map(Math.abs));
      for (let k = 1; k < N - 1; k++) {
        if (found && k > found.k) break;
        if (!(Math.abs(sv[k]) <= Math.abs(sv[k - 1]) && Math.abs(sv[k]) <= Math.abs(sv[k + 1]))) continue;
        if (Math.abs(sv[k]) > 1e-2 * sc) continue;
        // Золотое сечение по τ ∈ [0, 2hS] от t_{k−1}.
        let a = 0,
          b2 = 2 * hS;
        const f = (tau: number) => {
          const s = at(k - 1, tau);
          return Math.abs(fOf(s.q, s.v, sim.t[k - 1] + tau).sep);
        };
        const gr = (Math.sqrt(5) - 1) / 2;
        let c1 = b2 - gr * (b2 - a),
          c2 = a + gr * (b2 - a);
        let f1 = f(c1),
          f2 = f(c2);
        for (let i = 0; i < 80; i++) {
          if (f1 < f2) {
            b2 = c2;
            c2 = c1;
            f2 = f1;
            c1 = b2 - gr * (b2 - a);
            f1 = f(c1);
          } else {
            a = c1;
            c1 = c2;
            f1 = f2;
            c2 = a + gr * (b2 - a);
            f2 = f(c2);
          }
        }
        const tau = (a + b2) / 2;
        if (f(tau) <= 1e-6 * sc) {
          found = { k: k - 1, tau, kind: 'touch' };
          break;
        }
      }
    }
    if (found) {
      const s = at(found.k, found.tau);
      const t = sim.t[found.k] + found.tau;
      const val = valAt(s.q, s.v);
      const C: [number, number] | null = body ? [evalSym(body.xC, val, t), evalSym(body.yC, val, t)] : null;
      const vC: [number, number] | null = body ? [evalSym(body.vx, val, t), evalSym(body.vy, val, t)] : null;
      const omega = angle ? evalSym(shorter(d(angle, tw)), val, t) : null;
      event = { kind: found.kind, comp: found.kind === 'stop' ? null : comp, t, q: s.q, v: s.v, C, vC, omega, R: body ? RofState(s.q, s.v, t) : null };
    }
  }
  let flight: FlightInfo | null = null;
  if (bd && bd.flight && event && event.C && event.vC) {
    const g = pv.get('g')!;
    const [x0, y0] = event.C,
      [vx, vy] = event.vC;
    const sp = Math.hypot(vx, vy);
    const parabola =
      Math.abs(vx) > 1e-9 * Math.max(1e-12, sp)
        ? { a: y0 - (vy / vx) * x0 - (g * x0 * x0) / (2 * vx * vx), b: vy / vx + (g * x0) / (vx * vx), c: -g / (2 * vx * vx) }
        : null;
    flight = { x0, y0, vx, vy, omega: event.omega, parabola };
  }

  // Программное движение.
  let program: ProgramInfo | null = null;
  const pg = pr.program;
  if (pg) {
    if (pg.laws.length !== cn.length) return { ok: false, field: 'law0', error: 'Закон движения нужен для каждой координаты.' };
    const lctx: SymContext = { coords: [], params: ctx.params };
    const laws: Sym[] = [];
    for (const [j, src] of pg.laws.entries()) {
      const l = parse(src, 'law' + j, lctx);
      if (!Array.isArray(l)) return l;
      laws.push(l);
    }
    const atS = parse(pg.at, 'at', pctx);
    if (!Array.isArray(atS)) return atS;
    const at = evalSym(atS, (n) => pv.get(n) ?? NaN);
    if (!Number.isFinite(at)) return { ok: false, field: 'at', error: 'Момент времени не вычисляется.' };
    const lw: Wrt = { k: 'time', isCoord: () => false };
    const dl = laws.map((l) => shorter(d(l, lw)));
    const ddl = dl.map((l) => shorter(d(l, lw)));
    const Q = sol.rows.map((r) => shorter(sub(sub(r.dp, r.tq), r.qPot)));
    const pvf = (n: string) => pv.get(n) ?? NaN;
    const stateAt = (t: number) => {
      const q = laws.map((l) => evalSym(l, pvf, t)),
        v = dl.map((l) => evalSym(l, pvf, t)),
        a = ddl.map((l) => evalSym(l, pvf, t));
      return { q, v, a, Q: Q.map((x) => evalSym(x, valAt(q, v, a), t)) };
    };
    const s0 = stateAt(at);
    if (!s0.Q.every(Number.isFinite)) return { ok: false, field: 'law0', error: 'Силы не вычисляются при заданном законе.' };
    let series: ProgramInfo['series'] = null;
    const tE = pr.tEnd > 0 ? pr.tEnd : 0;
    if (tE > 0) {
      const ts = Array.from({ length: 201 }, (_, i) => (tE * i) / 200);
      const Qs = Q.map(() => [] as number[]),
        qs = Q.map(() => [] as number[]);
      for (const t of ts) {
        const x = stateAt(t);
        x.Q.forEach((v, j) => Qs[j].push(v));
        x.q.forEach((v, j) => qs[j].push(v));
      }
      series = { t: ts, q: qs, Q: Qs };
    }
    program = { laws, dl, ddl, Q, at, qAt: s0.q, vAt: s0.v, aAt: s0.a, Qat: s0.Q, series };
  }
  return { ok: true, body, event, flight, program };
}
