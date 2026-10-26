/**
 * Пункт 31: разбор формул второго экрана и быстрый счёт по ним.
 * Формула разбирается символьно (shared/sym: координаты, их производные со штрихом, параметры, t) и переводится
 * в замыкание, которое считает значение по массиву значений переменных — в тысячи раз быстрее evalSym при
 * интегрировании и переборе.
 */
import { normName, parseSym, type Atom, type Fn, type Sym, type SymContext } from '../../../shared/sym';

export type Num = (vals: number[], t: number) => number;

const FN: Record<Fn, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tg: Math.tan,
  ctg: (x) => 1 / Math.tan(x),
  arctg: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  exp: Math.exp,
  ln: Math.log,
  sh: Math.sinh,
  ch: Math.cosh,
  th: Math.tanh,
  abs: Math.abs,
};

/** Замыкание по формуле; slot(name, ord) — номер переменной в массиве значений (−1 — нет такой). */
export function compile(s: Sym, slot: (name: string, ord: number) => number): Num {
  const atomFn = (a: Atom): Num => {
    switch (a.k) {
      case 'var': {
        const i = slot(a.name, a.ord);
        if (i < 0) throw new Error(`неизвестная переменная ${a.name}`);
        return (v) => v[i];
      }
      case 't':
        return (_v, t) => t;
      case 'grp':
        return compile(a.a, slot);
      case 'fn': {
        const g = FN[a.f],
          inner = compile(a.a, slot);
        return (v, t) => g(inner(v, t));
      }
    }
  };
  const terms = s.map((term) => {
    const c = term.c;
    const fs = term.f.map(([a, p]) => {
      const f = atomFn(a);
      return p === 1
        ? f
        : p === 2
          ? (v: number[], t: number) => f(v, t) ** 2
          : p === 0.5
            ? (v: number[], t: number) => Math.sqrt(f(v, t))
            : (v: number[], t: number) => Math.pow(f(v, t), p);
    });
    return (v: number[], t: number) => {
      let x = c;
      for (const f of fs) x *= f(v, t);
      return x;
    };
  });
  return (v, t) => {
    let sum = 0;
    for (const f of terms) sum += f(v, t);
    return sum;
  };
}

export interface Vars {
  /** Координаты (имена после normName); у каждой — значение, скорость (ord 1). */
  coords: string[];
  /** Параметры: имя → значение. */
  params: Record<string, number>;
}

/** Разбор формулы: ok — символьное выражение и замыкание по массиву [координаты…, скорости…, параметры…]. */
export function formula(src: string, v: Vars, what: string): { ok: true; s: Sym; f: Num } | { ok: false; error: string } {
  const coords = v.coords.map(normName);
  const pnames = Object.keys(v.params);
  const ctx: SymContext = { coords, params: pnames };
  const r = parseSym(src, ctx);
  if (!r.ok) return { ok: false, error: `${what}: ${r.error}` };
  try {
    return { ok: true, s: r.s, f: compile(r.s, slotOf(v)) };
  } catch (e) {
    return { ok: false, error: `${what}: ${(e as Error).message}` };
  }
}

/** Номер переменной: координаты, затем скорости, затем параметры. */
export function slotOf(v: Vars): (name: string, ord: number) => number {
  const coords = v.coords.map(normName);
  const pnames = Object.keys(v.params).map(normName);
  const n = coords.length;
  return (name, ord) => {
    const i = coords.indexOf(name);
    if (i >= 0) return ord === 0 ? i : ord === 1 ? n + i : -1;
    const j = pnames.indexOf(name);
    return j >= 0 && ord === 0 ? 2 * n + j : -1;
  };
}

/** Массив значений: координаты, скорости, параметры (порядок — как в slotOf). */
export const valsOf = (v: Vars, q: number[], dq: number[] = []): number[] => [...q, ...v.coords.map((_, i) => dq[i] ?? 0), ...Object.values(v.params)];
