/**
 * Формулы от времени t: разбор, вычисление, символьное дифференцирование и запись.
 *
 * Поддерживается: числа (запятая или точка), t, π (pi), e как основание (через exp), + − * / ^, скобки,
 * неявное умножение («2t», «3 sin(2πt)», «0,5(1 − cos t)»), функции sin, cos, tg (tan), ctg, arctg (atan),
 * arcsin, arccos, exp, ln, sqrt, abs, sh (sinh), ch (cosh), th (tanh).
 * По желанию — и другие переменные (для сил F(t, x, v)): parseExpr(src, { vars: ['x', 'v'] }), evalExpr(e, t, { x, v }).
 * Производная diff — только по t: такие переменные в ней считаются постоянными (формулы сил не дифференцируются).
 */
export type Expr =
  | { k: 'num'; v: number }
  | { k: 't' }
  | { k: 'var'; n: string }
  | { k: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Expr; b: Expr }
  | { k: 'neg'; a: Expr }
  | { k: 'fn'; f: Fn; a: Expr };

export type Fn = 'sin' | 'cos' | 'tg' | 'ctg' | 'arctg' | 'arcsin' | 'arccos' | 'exp' | 'ln' | 'sqrt' | 'abs' | 'sh' | 'ch' | 'th';
const FN_ALIAS: Record<string, Fn> = {
  sin: 'sin',
  cos: 'cos',
  tg: 'tg',
  tan: 'tg',
  ctg: 'ctg',
  cot: 'ctg',
  arctg: 'arctg',
  atan: 'arctg',
  arcsin: 'arcsin',
  asin: 'arcsin',
  arccos: 'arccos',
  acos: 'arccos',
  exp: 'exp',
  ln: 'ln',
  sqrt: 'sqrt',
  abs: 'abs',
  sh: 'sh',
  sinh: 'sh',
  ch: 'ch',
  cosh: 'ch',
  th: 'th',
  tanh: 'th',
};

export type ParseResult = { ok: true; e: Expr } | { ok: false; error: string };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string, vars: string[] = []): Tok[] | string {
  const s = src.replace(/[−–]/g, '-').replace(/[·×]/g, '*').replace(/\s+/g, ' ');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || ((c === '.' || c === ',') && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      // «1,5» — десятичная запятая; запятая между числами в аргументах не нужна (функции одного аргумента).
      if ((s.slice(i, j).match(/[.,]/g) ?? []).length > 1) return `неверное число «${s.slice(i, j)}»`;
      const raw = s.slice(i, j).replace(',', '.');
      let k = j;
      // Порядок: 2e-3 / 2е5
      if ((s[k] === 'e' || s[k] === 'E') && /[0-9+-]/.test(s[k + 1] ?? '') && !/[a-zа-я]/i.test(s[k + 1] ?? '')) {
        k++;
        if (s[k] === '+' || s[k] === '-') k++;
        while (k < s.length && /[0-9]/.test(s[k])) k++;
        out.push({ t: 'num', v: Number(raw + s.slice(j, k).replace(/^[eE]/, 'e')) });
        i = k;
        continue;
      }
      out.push({ t: 'num', v: Number(raw) });
      i = j;
      continue;
    }
    if (/[a-zа-яπ]/i.test(c)) {
      let j = i;
      while (j < s.length && /[a-zа-яπ]/i.test(s[j])) j++;
      // Слитные «2πt», «tsin» разбираем жадно по известным словам.
      let word = s.slice(i, j).toLowerCase();
      while (word.length) {
        const known = ['arcsin', 'arccos', 'arctg', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'sin', 'cos', 'tan', 'ctg', 'cot', 'exp', 'abs', 'tg', 'ln', 'sh', 'ch', 'th', 'pi', 'π', 't', ...vars].find((w) => word.startsWith(w));
        if (!known) return `неизвестное обозначение «${word}»`;
        out.push({ t: 'id', v: known });
        word = word.slice(known.length);
      }
      i = j;
      continue;
    }
    if ('+-*/^()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    return `неожиданный символ «${c}»`;
  }
  return out;
}

export function parseExpr(src: string, opts: { vars?: string[] } = {}): ParseResult {
  if (!src.trim()) return { ok: true, e: { k: 'num', v: 0 } };
  // Длинные имена — раньше коротких: «vx» — не «v·x».
  const vars = [...(opts.vars ?? [])].map((v) => v.toLowerCase()).sort((a, b) => b.length - a.length);
  const raw = tokenize(src, vars);
  if (typeof raw === 'string') return { ok: false, error: raw };
  const toks: Tok[] = raw;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const startsPrimary = () => {
    const x = peek();
    return !!x && (x.t === 'num' || x.t === 'id' || (x.t === 'op' && x.v === '('));
  };
  function expr(): Expr {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v;
      a = { k: op === '+' ? 'add' : 'sub', a, b: term() };
    }
    return a;
  }
  function term(): Expr {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: string }).v;
        a = { k: op === '*' ? 'mul' : 'div', a, b: unary() };
      } else if (startsPrimary()) a = { k: 'mul', a, b: power() }; // неявное умножение
      else return a;
    }
  }
  function unary(): Expr {
    if (isOp('-')) {
      p++;
      return { k: 'neg', a: unary() };
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Expr {
    const a = primary();
    if (isOp('^')) {
      p++;
      return { k: 'pow', a, b: unary() };
    }
    return a;
  }
  function primary(): Expr {
    const x = toks[p++];
    if (!x) throw new Error('формула оборвана');
    if (x.t === 'num') return { k: 'num', v: x.v };
    if (x.t === 'op' && x.v === '(') {
      const e = expr();
      if (!isOp(')')) throw new Error('не хватает закрывающей скобки');
      p++;
      return e;
    }
    if (x.t === 'id') {
      if (x.v === 't') return { k: 't' };
      if (vars.includes(x.v)) return { k: 'var', n: x.v };
      if (x.v === 'pi' || x.v === 'π') return { k: 'num', v: Math.PI };
      const f = FN_ALIAS[x.v];
      // Аргумент функции: в скобках или следующий множитель («sin 2t» = sin(2t)).
      let arg: Expr;
      if (isOp('(')) arg = primary();
      else {
        arg = power();
        while (startsPrimary() && !(peek()?.t === 'id' && FN_ALIAS[(peek() as { v: string }).v])) arg = { k: 'mul', a: arg, b: power() };
      }
      if (isOp('^')) {
        // sin(t)^2
        p++;
        return { k: 'pow', a: { k: 'fn', f, a: arg }, b: unary() };
      }
      return { k: 'fn', f, a: arg };
    }
    throw new Error(`неожиданный «${(x as { v: string }).v}»`);
  }
  try {
    const e = expr();
    if (p < toks.length) return { ok: false, error: `лишнее «${(toks[p] as { v: string | number }).v}»` };
    return { ok: true, e };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function evalExpr(e: Expr, t: number, vars?: Record<string, number>): number {
  switch (e.k) {
    case 'num':
      return e.v;
    case 't':
      return t;
    case 'var':
      return vars?.[e.n] ?? NaN;
    case 'neg':
      return -evalExpr(e.a, t, vars);
    case 'add':
      return evalExpr(e.a, t, vars) + evalExpr(e.b, t, vars);
    case 'sub':
      return evalExpr(e.a, t, vars) - evalExpr(e.b, t, vars);
    case 'mul':
      return evalExpr(e.a, t, vars) * evalExpr(e.b, t, vars);
    case 'div':
      return evalExpr(e.a, t, vars) / evalExpr(e.b, t, vars);
    case 'pow':
      return Math.pow(evalExpr(e.a, t, vars), evalExpr(e.b, t, vars));
    case 'fn': {
      const x = evalExpr(e.a, t, vars);
      switch (e.f) {
        case 'sin':
          return Math.sin(x);
        case 'cos':
          return Math.cos(x);
        case 'tg':
          return Math.tan(x);
        case 'ctg':
          return 1 / Math.tan(x);
        case 'arctg':
          return Math.atan(x);
        case 'arcsin':
          return Math.asin(x);
        case 'arccos':
          return Math.acos(x);
        case 'exp':
          return Math.exp(x);
        case 'ln':
          return Math.log(x);
        case 'sqrt':
          return Math.sqrt(x);
        case 'abs':
          return Math.abs(x);
        case 'sh':
          return Math.sinh(x);
        case 'ch':
          return Math.cosh(x);
        case 'th':
          return Math.tanh(x);
      }
    }
  }
}

/* ---------- упрощение и производная ---------- */

const N = (v: number): Expr => ({ k: 'num', v });
const isN = (e: Expr, v?: number) => e.k === 'num' && (v === undefined || Math.abs(e.v - v) < 1e-15);
const hasT = (e: Expr): boolean => (e.k === 't' ? true : e.k === 'num' || e.k === 'var' ? false : e.k === 'fn' || e.k === 'neg' ? hasT(e.a) : hasT(e.a) || hasT(e.b));

export function simplify(e: Expr): Expr {
  switch (e.k) {
    case 'num':
    case 't':
    case 'var':
      return e;
    case 'neg': {
      const a = simplify(e.a);
      if (a.k === 'num') return N(-a.v);
      if (a.k === 'neg') return a.a;
      return { k: 'neg', a };
    }
    case 'fn': {
      const a = simplify(e.a);
      return a.k === 'num' ? N(evalExpr({ k: 'fn', f: e.f, a }, 0)) : { k: 'fn', f: e.f, a };
    }
    default: {
      const a = simplify(e.a),
        b = simplify(e.b);
      if (a.k === 'num' && b.k === 'num') return N(evalExpr({ k: e.k, a, b } as Expr, 0));
      switch (e.k) {
        case 'add':
          if (isN(a, 0)) return b;
          if (isN(b, 0)) return a;
          if (b.k === 'neg') return simplify({ k: 'sub', a, b: b.a });
          if (b.k === 'num' && b.v < 0) return { k: 'sub', a, b: N(-b.v) };
          return { k: 'add', a, b };
        case 'sub':
          if (isN(b, 0)) return a;
          if (isN(a, 0)) return simplify({ k: 'neg', a: b });
          if (b.k === 'neg') return { k: 'add', a, b: b.a };
          if (b.k === 'num' && b.v < 0) return { k: 'add', a, b: N(-b.v) };
          return { k: 'sub', a, b };
        case 'mul': {
          if (isN(a, 0) || isN(b, 0)) return N(0);
          if (isN(a, 1)) return b;
          if (isN(b, 1)) return a;
          if (isN(a, -1)) return simplify({ k: 'neg', a: b });
          if (isN(b, -1)) return simplify({ k: 'neg', a });
          if (a.k === 'neg') return simplify({ k: 'neg', a: { k: 'mul', a: a.a, b } });
          if (b.k === 'neg') return simplify({ k: 'neg', a: { k: 'mul', a, b: b.a } });
          // Число вперёд и свёртка чисел: 2·(3·x) = 6x, x·2 = 2x.
          if (b.k === 'num' && a.k !== 'num') return simplify({ k: 'mul', a: b, b: a });
          if (a.k === 'num' && b.k === 'mul' && b.a.k === 'num') return simplify({ k: 'mul', a: N(a.v * b.a.v), b: b.b });
          if (a.k === 'num' && a.v < 0) return { k: 'neg', a: simplify({ k: 'mul', a: N(-a.v), b }) };
          return { k: 'mul', a, b };
        }
        case 'div':
          if (isN(a, 0)) return N(0);
          if (isN(b, 1)) return a;
          if (b.k === 'num') return simplify({ k: 'mul', a: N(1 / b.v), b: a });
          if (a.k === 'neg') return simplify({ k: 'neg', a: { k: 'div', a: a.a, b } });
          return { k: 'div', a, b };
        case 'pow':
          if (isN(b, 0)) return N(1);
          if (isN(b, 1)) return a;
          return { k: 'pow', a, b };
      }
    }
  }
  return e;
}

/** Производная по t. */
export function diff(e: Expr): Expr {
  const d = (x: Expr): Expr => {
    if (!hasT(x)) return N(0);
    switch (x.k) {
      case 'num':
      case 'var':
        return N(0);
      case 't':
        return N(1);
      case 'neg':
        return { k: 'neg', a: d(x.a) };
      case 'add':
        return { k: 'add', a: d(x.a), b: d(x.b) };
      case 'sub':
        return { k: 'sub', a: d(x.a), b: d(x.b) };
      case 'mul':
        if (!hasT(x.a)) return { k: 'mul', a: x.a, b: d(x.b) };
        if (!hasT(x.b)) return { k: 'mul', a: x.b, b: d(x.a) };
        return { k: 'add', a: { k: 'mul', a: d(x.a), b: x.b }, b: { k: 'mul', a: x.a, b: d(x.b) } };
      case 'div':
        if (!hasT(x.b)) return { k: 'div', a: d(x.a), b: x.b };
        return { k: 'div', a: { k: 'sub', a: { k: 'mul', a: d(x.a), b: x.b }, b: { k: 'mul', a: x.a, b: d(x.b) } }, b: { k: 'pow', a: x.b, b: N(2) } };
      case 'pow':
        if (!hasT(x.b)) return { k: 'mul', a: { k: 'mul', a: x.b, b: { k: 'pow', a: x.a, b: { k: 'sub', a: x.b, b: N(1) } } }, b: d(x.a) };
        // a^b = exp(b ln a)
        return { k: 'mul', a: x, b: d({ k: 'mul', a: x.b, b: { k: 'fn', f: 'ln', a: x.a } }) };
      case 'fn': {
        const u = x.a,
          du = d(u);
        const outer: Record<Fn, Expr> = {
          sin: { k: 'fn', f: 'cos', a: u },
          cos: { k: 'neg', a: { k: 'fn', f: 'sin', a: u } },
          tg: { k: 'div', a: N(1), b: { k: 'pow', a: { k: 'fn', f: 'cos', a: u }, b: N(2) } },
          ctg: { k: 'neg', a: { k: 'div', a: N(1), b: { k: 'pow', a: { k: 'fn', f: 'sin', a: u }, b: N(2) } } },
          arctg: { k: 'div', a: N(1), b: { k: 'add', a: N(1), b: { k: 'pow', a: u, b: N(2) } } },
          arcsin: { k: 'div', a: N(1), b: { k: 'fn', f: 'sqrt', a: { k: 'sub', a: N(1), b: { k: 'pow', a: u, b: N(2) } } } },
          arccos: { k: 'neg', a: { k: 'div', a: N(1), b: { k: 'fn', f: 'sqrt', a: { k: 'sub', a: N(1), b: { k: 'pow', a: u, b: N(2) } } } } },
          exp: { k: 'fn', f: 'exp', a: u },
          ln: { k: 'div', a: N(1), b: u },
          sqrt: { k: 'div', a: N(1), b: { k: 'mul', a: N(2), b: { k: 'fn', f: 'sqrt', a: u } } },
          abs: { k: 'div', a: u, b: { k: 'fn', f: 'abs', a: u } },
          sh: { k: 'fn', f: 'ch', a: u },
          ch: { k: 'fn', f: 'sh', a: u },
          th: { k: 'div', a: N(1), b: { k: 'pow', a: { k: 'fn', f: 'ch', a: u }, b: N(2) } },
        };
        return { k: 'mul', a: outer[x.f], b: du };
      }
    }
  };
  return simplify(d(e));
}

/* ---------- запись ---------- */

const fmtNum = (v: number) => {
  if (Math.abs(v - Math.PI) < 1e-12) return 'π';
  const r = Math.round(v * 1e4) / 1e4;
  return (Math.abs(r - Math.round(r)) < 1e-12 ? String(Math.round(r)) : String(r)).replace('.', ',').replace('-', '−');
};

/** Запись формулы: «−0,3π²·sin(πt/2)» и т. п. (π не сворачивается — числа печатаются до 4 знаков). */
export function printExpr(e: Expr, parent = 0): string {
  const wrap = (s: string, p: number) => (p < parent ? `(${s})` : s);
  switch (e.k) {
    case 'num':
      return e.v < 0 ? wrap(fmtNum(e.v), 2) : fmtNum(e.v);
    case 't':
      return 't';
    case 'var':
      return e.n;
    case 'neg':
      return wrap(`−${printExpr(e.a, 3)}`, 2);
    case 'add':
      return wrap(`${printExpr(e.a, 1)} + ${printExpr(e.b, 1)}`, 1);
    case 'sub':
      return wrap(`${printExpr(e.a, 1)} − ${printExpr(e.b, 2)}`, 1);
    case 'mul': {
      const l = printExpr(e.a, 3),
        r = printExpr(e.b, 3);
      // Число перед буквой или функцией — без знака умножения: 2t, 3sin(t).
      const tight = e.a.k === 'num' && (e.b.k === 't' || e.b.k === 'var' || e.b.k === 'fn' || e.b.k === 'pow');
      return wrap(tight ? `${l}${r}` : `${l}·${r}`, 3);
    }
    case 'div':
      return wrap(`${printExpr(e.a, 3)}/${printExpr(e.b, 4)}`, 3);
    case 'pow': {
      const b = e.b.k === 'num' && e.b.v === 2 ? '²' : e.b.k === 'num' && e.b.v === 3 ? '³' : `^${printExpr(e.b, 6)}`;
      return wrap(`${printExpr(e.a, 6)}${b}`, 5);
    }
    case 'fn':
      return `${e.f}(${printExpr(e.a, 0)})`;
  }
}


/** Входит ли переменная (или t) в формулу. */
export function usesVar(e: Expr, n: string): boolean {
  if (e.k === 'num') return false;
  if (e.k === 't') return n === 't';
  if (e.k === 'var') return e.n === n;
  if (e.k === 'neg' || e.k === 'fn') return usesVar(e.a, n);
  return usesVar(e.a, n) || usesVar(e.b, n);
}
