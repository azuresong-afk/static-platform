/** Пункт 29, «Кинетическая энергия»: 38.8, 38.27, 38.28 и Яблонский Д.18 — независимые проверки. */
import { describe, expect, it } from 'vitest';
import { rk4 } from '../src/shared/extra';
import { cam, epiPhi, runners, yd18, type Yd18P } from '../src/modules/energy/model/extra29';

const G = 9.81;

describe('38.8: бегуны', () => {
  it('T совпадает с суммой ½v² по точкам тонкого диска', () => {
    const P = 200,
      r = 0.5,
      l = 0.5,
      nrev = 20;
    const W = (Math.PI * nrev) / 30;
    const w1 = (W * l) / r;
    // Начало — на оси CD над точкой O; диск в плоскости yz с центром (l, 0, 0), дно — z = −r. Ω по z, ω₁ по −x.
    const N = 200;
    let sum = 0;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const rho = (r * (i + 0.5)) / N,
          th = (2 * Math.PI * (j + 0.5)) / N;
        const dm = (rho * (r / N) * ((2 * Math.PI) / N)) / (Math.PI * r * r);
        const p = [l, rho * Math.cos(th), rho * Math.sin(th)];
        const om = [-w1, 0, W];
        const v = [om[1] * p[2] - om[2] * p[1], om[2] * p[0] - om[0] * p[2], om[0] * p[1] - om[1] * p[0]];
        sum += dm * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
      }
    const T = 2 * 0.5 * (P / G) * sum;
    expect(runners(2, P, r, l, nrev).T).toBeCloseTo(T, 2);
    // Точка касания (l, 0, −r) неподвижна.
    expect(Math.abs(W * l - w1 * r)).toBeLessThan(1e-12);
  });
});

describe('38.27, 38.28', () => {
  it('эпициклический механизм: J·ω²/2 = M·φ', () => {
    const { J, w } = epiPhi(2, 4, 0.3, 0.1, 1, 2);
    expect((J * w * w) / 2).toBeCloseTo(2, 10);
  });
  it('эксцентрик: при R = 2e ответ не зависит от e', () => {
    expect(cam(2, 50, 0.05, 0.1).w).toBeCloseTo(cam(2, 50, 0.2, 0.4).w, 10);
  });
});

describe('Д.18', () => {
  const p: Yd18P = {
    mA: 20,
    mB: 100,
    r: 0.5,
    i: 0.4,
    f: 0.35,
    a: 1.4,
    h: 0.4,
    b: 2,
    c: 0.7,
    bb: 2,
    cb: 0.7,
    housing: true,
    alpha: 2,
    b1: 0.025,
    b2: 0.25,
    b3: 50,
    q: 0.9,
    g: 9.8,
  };
  it('с d = 1,735 (как в книге) — все числа примера', () => {
    const c = (2 - 1.735) / 0.35;
    const r = yd18({ ...p, c, cb: c });
    const near = (x: number, y: number, rel = 0.004) => expect(Math.abs(x - y), `${x} против ${y}`).toBeLessThanOrEqual(rel * Math.abs(y));
    near(r.a1, 3.82);
    near(r.a2, 96.04);
    near(r.a3, 316.44);
    near(r.Mn, 25.14);
    near(r.tau, 0.0134);
    near(r.k, 1.39);
    near(r.D, 21.11);
    near(r.ks, 4.8);
    near(r.A, -3.38);
    near(r.beta, 1.89);
    near(r.vs, 10.93);
    near(r.s, 3.43);
    near(r.l, 37.39);
  });
  it('v(t) — решение системы для M и v (Рунге — Кутта)', () => {
    const r = yd18(p);
    const sol = rk4((_t, [M, v]) => [(p.b3 - p.b2 * M - (p.alpha * v) / p.r) / p.b1, (r.a1 * M - r.a2) / r.a3], [r.Mn, 0], r.tau, r.tau + 2, 20000);
    for (const k of [2000, 8000, 20000]) expect(sol[k].y[1]).toBeCloseTo(r.v(sol[k].t), 6);
  });
  it('торможение двигателем: путь до 0,9v* по интегрированию', () => {
    const r = yd18(p);
    // x″ = (a₁M − a₂)/a₃, M = M* − αx/(r·b₁)
    let x = 0,
      v = r.vs;
    const h = 1e-5;
    while (v > 0.9 * r.vs) {
      const acc = (x: number) => (r.a1 * (r.Ms - (p.alpha * x) / (p.r * p.b1)) - r.a2) / r.a3;
      const k1v = acc(x),
        k1x = v;
      const k2v = acc(x + (h / 2) * k1x),
        k2x = v + (h / 2) * k1v;
      x += h * k2x;
      v += h * k2v;
    }
    expect(x).toBeCloseTo(r.s, 3);
  });
  it('опора при торможении в другой точке: путь из квадратного уравнения', () => {
    const r = yd18({ ...p, bb: 2.4, cb: 0.5 });
    const kb = r.kb;
    let x = 0,
      v = r.vs;
    const h = 1e-5;
    while (v > 0.9 * r.vs) {
      const acc = (kb.a1 * (r.Ms - (p.alpha * x) / (p.r * p.b1)) - kb.a2) / kb.a3;
      x += h * (v + (h / 2) * acc);
      v += h * acc;
    }
    expect(x).toBeCloseTo(r.s, 3);
  });
});
