/** Решение: формулы Кеплера и Бине — аномалии и время полёта, средние радиусы, граница падения, обратные задачи, сила по траектории, трасса спутника. */
import { b, type AnswerRow, type Block, type Doc, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { LM } from '../model/orbit';
import type { TrajProblem, TrajResult, TrajPoint } from '../model/traj';
import { LEN, bad, dur, exf, num, pw, type Line } from './solution';

const deg = (a: number) => (a * 180) / Math.PI;
const rad = (a: number) => (a * Math.PI) / 180;
const A = (x: number, d = 6) => `${num(deg(x), d)}°`;
/** Формула r(φ) в записи книги: переменная t разбора — угол φ. */
const phiText = (s: string) => s.replace(/(?<![a-zа-я])t(?![a-zа-я])/g, 'φ');

function orbitStep(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Step {
  const L = LEN[pr.unit];
  const lines: Line[] = [
    { c: [pr.muMode === 'planet' ? `μ = gR² = ${num(pr.g)}·${pw(pr.R)}²·10⁻³ = ` : 'гравитационный параметр μ = ', b(`${num(r.mu)} ${L}³/с²`)] },
    { c: [`эллипс: a = ${num(r.a)} ${L}, e = ${num(r.e)}`] },
    { num: true, c: [`b = a√(1 − e²) = ${num(r.b)} ${L}; p = a(1 − e²) = ${num(r.p)} ${L}`] },
    { num: true, c: [`r_п = a(1 − e) = ${num(r.rp)} ${L}; r_а = a(1 + e) = ${num(r.ra)} ${L}; v_п = ${num(r.vp)} ${L}/с, v_а = ${num(r.va)} ${L}/с`] },
    { num: true, c: [`среднее движение n = √(μ/a³) = ${num(r.n, 6)} 1/с; период T = 2π/n = `, b(dur(r.T))] },
  ];
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Радиус-вектор из фокуса: r = p/(1 + e cos ν) = a(1 − e cos E), где ν — истинная, E — эксцентрическая аномалия точки; средняя аномалия M = n·t растёт равномерно со временем.',
  );
  for (const t of r.notes) bl.push({ k: 'badge', tone: 'warn', text: t });
  return { title: 'Орбита', blocks: bl };
}

function pointLines(pr: TrajProblem, r: TrajResult, q: TrajPoint, nm: string, L: string): Line[] {
  const lines: Line[] = [];
  const how: Record<string, string> = {
    nu: `точка задана истинной аномалией ν${nm} = ${num(pr.kind === 'time' ? (nm === '₁' ? pr.x1 : pr.x2) : pr.x1)}°; E = 2·arctg(√((1 − e)/(1 + e))·tg(ν/2))`,
    E: `точка задана эксцентрической аномалией E${nm} = ${num(pr.kind === 'time' ? (nm === '₁' ? pr.x1 : pr.x2) : pr.x1)}°; ν = 2·arctg(√((1 + e)/(1 − e))·tg(E/2))`,
    M: `задана средняя аномалия M${nm} = ${num(pr.kind === 'time' ? (nm === '₁' ? pr.x1 : pr.x2) : pr.x1)}°; E найдена из уравнения Кеплера E − e sin E = M методом Ньютона (${q.iters} шагов)`,
    t: `задано время от перицентра t = ${dur(pr.x1)}: M = n·t = ${A(q.M)}; E из уравнения Кеплера E − e sin E = M (${q.iters} шагов)`,
  };
  lines.push({ c: [how[pr.anom]] });
  lines.push({ num: true, c: [`E${nm} = ${A(q.E)}; ν${nm} = ${A(q.nu)}; M${nm} = E − e sin E = ${A(q.M)}`] });
  lines.push({
    num: true,
    c: [`r${nm} = a(1 − e cos E) = ${num(r.a)}·(1 − ${num(r.e)}·cos ${A(q.E, 5)}) = `, b(`${num(q.r)} ${L}`), `; t${nm} = M/n = ${dur(q.t)}`],
  });
  return lines;
}

function pointDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const q = r.pts[0];
  const steps: Step[] = [orbitStep(pr, r, ex)];
  const lines = pointLines(pr, r, q, '', L);
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Эксцентрическая аномалия — угол на вспомогательной окружности радиуса a, проведённой из центра эллипса: точка этой окружности лежит на одной перпендикулярной оси орбиты с точкой орбиты. Связь с истинной аномалией (50.30): tg(ν/2) = √((1 + e)/(1 − e))·tg(E/2).',
  );
  steps.push({ title: 'Положение точки', blocks: bl });
  const vl: Line[] = [
    { c: ['скорость через E (50.31): v = √(μ/a)·√((1 + e cos E)/(1 − e cos E))'] },
    { num: true, c: [`v = √${pw(r.mu / r.a)}·√((1 + ${num(r.e)}·cos ${A(q.E, 5)})/(1 − ${num(r.e)}·cos ${A(q.E, 5)})) = `, b(`${num(q.v)} ${L}/с`)] },
    { c: ['орбитальная система (50.33): v_r = √(μ/p)·e sin ν; v_φ = √(μ/p)·(1 + e cos ν); угол с горизонтом tg γ = v_r/v_φ'] },
    { num: true, c: [`v_r = ${num(q.vr)} ${L}/с; v_φ = ${num(q.vt)} ${L}/с; γ = `, b(`${num(q.gamma, 6)}°`)] },
    {
      c: [
        'инерциальная система (ось x — в перицентр): v_x = −√(μ/p)·sin ν = −√(μ/a)·sin E/(1 − e cos E); v_y = √(μ/p)·(e + cos ν) = √(μ/a)·√(1 − e²)·cos E/(1 − e cos E)',
      ],
    },
    { num: true, c: [`v_x = ${num(q.vx)} ${L}/с; v_y = ${num(q.vy)} ${L}/с; координаты x = r cos ν = ${num(q.x)} ${L}, y = r sin ν = ${num(q.y)} ${L}`] },
  ];
  const vb: Block[] = [{ k: 'eq', lines: vl }];
  const sp = r.special!;
  vb.push({
    k: 'eq',
    lines: [
      { c: ['особые точки: v² = v_п·v_а при E = ±90° (концы малой оси, 50.32); наибольший угол с горизонтом — там же (50.34, cos ν = −e): sin γ_max = e'] },
      { num: true, c: [`√(v_п·v_а) = ${num(sp.vgeo)} ${L}/с = √(μ/a); γ_max = arcsin e = `, b(`${num(sp.gammaMax, 6)}°`)] },
    ],
  });
  ex(
    vb,
    'Скорость в любой точке следует из интеграла энергии v² = μ(2/r − 1/a); радиальная составляющая обращается в нуль в апсидах, а угол траектории с местным горизонтом наибольший там, где cos ν = −e.',
  );
  steps.push({ title: 'Скорость', blocks: vb });
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`E = ${A(q.E)}, ν = ${A(q.nu)}`], note: 'эксцентрическая и истинная аномалии' },
    { kind: 'main', val: [`r = ${num(q.r)} ${L}`], note: 'расстояние от фокуса' },
    { kind: 'main', val: [`v = ${num(q.v)} ${L}/с`], note: `v_r = ${num(q.vr)}, v_φ = ${num(q.vt)} ${L}/с` },
    { kind: 'aux', val: [`t = ${dur(q.t)}`], note: 'время от перицентра' },
    { kind: 'aux', val: [`γ = ${num(q.gamma, 5)}°`], note: `наибольший γ_max = ${num(sp.gammaMax, 5)}° при E = ±90°` },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function timeDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const steps: Step[] = [orbitStep(pr, r, ex)];
  const [p1, p2] = r.pts;
  const bl: Block[] = [{ k: 'eq', lines: [...pointLines(pr, r, p1, '₁', L), ...pointLines(pr, r, p2, '₂', L)] }];
  ex(
    bl,
    'Каждая точка орбиты переводится в эксцентрическую аномалию E, затем — в среднюю M = E − e sin E; средняя аномалия пропорциональна времени, так что разность M₂ − M₁ даёт время пролёта.',
  );
  steps.push({ title: 'Аномалии точек', blocks: bl });
  const tl: Line[] = [
    { c: ['уравнение Кеплера: M = E − e sin E = n·t; время полёта вперёд по движению Δt = (M₂ − M₁)/n (разность берётся по модулю 2π)'] },
    { num: true, c: [`ΔM = ${A((((p2.M - p1.M) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))}; Δt = ΔM/n = `, b(dur(r.dt!))] },
    { num: true, c: [`остальная часть периода: T − Δt = ${dur(r.dtRest!)}; доля оборота ${num(r.dt! / r.T, 5)}`] },
  ];
  const tb: Block[] = [{ k: 'eq', lines: tl }];
  ex(
    tb,
    'По второму закону Кеплера радиус-вектор ометает равные площади за равные времена, поэтому штрихованный сектор на чертеже составляет долю Δt/T от площади эллипса πab, а время — не пропорционально углу ν: в районе перицентра точка движется быстрее.',
  );
  steps.push({ title: 'Время полёта', blocks: tb });
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`Δt = ${dur(r.dt!)}`], note: 'от точки 1 к точке 2 по движению' },
    { kind: 'aux', val: [`T − Δt = ${dur(r.dtRest!)}`], note: 'обратный путь по той же орбите' },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function meanDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const m = r.mean!;
  const steps: Step[] = [orbitStep(pr, r, ex)];
  const lines: Line[] = [
    { c: ['среднее по времени: [r] = (1/T)∫₀ᵀ r dt; dt = (1 − e cos E) dE/n, r = a(1 − e cos E)'] },
    { num: true, c: [`[r] = (a/2π)∫₀²ᵖ (1 − e cos E)² dE = a(1 + e²/2) = ${num(r.a)}·(1 + ${num(r.e)}²/2) = `, b(`${num(m.t, 8)} ${L}`)] },
    { c: ['среднее по эксцентрической аномалии: (1/2π)∫ r dE = a; по истинной (по углу φ): (1/2π)∫ r dφ = p/√(1 − e²) = b'] },
    { num: true, c: [`[r]_E = ${num(m.E, 8)} ${L}; [r]_φ = ${num(m.phi, 8)} ${L}; среднее 1/r по времени 1/a = ${num(m.inv, 6)} 1/${L}`] },
  ];
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Среднее по времени больше большой полуоси, потому что вблизи апоцентра точка находится дольше, чем вблизи перицентра; среднее по углу φ меньше a и равно малой полуоси b.',
  );
  steps.push({ title: 'Среднее значение радиус-вектора', blocks: bl });
  steps.push({
    title: 'Ответ',
    blocks: [
      {
        k: 'answer',
        rows: [
          { kind: 'main', val: [`[r] = a(1 + e²/2) = ${num(m.t, 8)} ${L}`], note: 'по времени (задача 50.28)' },
          { kind: 'aux', val: [`[r]_φ = b = ${num(m.phi, 8)} ${L}`], note: 'по истинной аномалии' },
          { kind: 'aux', val: [`[r]_E = a = ${num(m.E, 8)} ${L}`], note: 'по эксцентрической аномалии' },
        ],
      },
    ],
  });
  return { steps };
}

function fallDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const f = r.fall!;
  const steps: Step[] = [];
  const lines: Line[] = [
    { c: [`планета радиуса R = ${num(f.R)} ${L}; точка на расстоянии r₀ = ${num(f.r0)} ${L} (высота ${num(f.r0 - f.R)} ${L}); μ = ${num(r.mu)} ${L}³/с²`] },
    { c: ['конус касательных из начальной точки: sin δ = R/r₀ — полуугол от направления на центр; граничный угол к горизонту cos θ_к = R/r₀'] },
    {
      num: true,
      c: [
        `δ = ${num(f.delta, 5)}°; θ_к = ±`,
        b(`${num(f.thCone, 5)}°`),
        ` (от горизонта вниз); круговая v₁ = ${num(f.vc)} ${L}/с, параболическая ${num(f.vpar)} ${L}/с`,
      ],
    },
  ];
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Если скорость направлена внутрь конуса (под горизонтом круче θ_к), прямая вдоль скорости пересекает планету, и точка падает на неё при любой величине скорости (50.24).',
  );
  steps.push({ title: 'Конус падения', blocks: bl });
  const cl: Line[] = [];
  if (f.inside) cl.push({ c: [`θ₀ = ${num(pr.th0)}° — направление внутри конуса: падение на планету при любой v₀`] });
  else if (f.vcrit != null) {
    cl.push({
      c: [
        'направление вне конуса: траектория не пересечёт поверхность, если перицентр r_п ≥ R. Из r₀v₀cos θ₀ = c, c = R·v_п и v₀² − 2μ/r₀ = v_п² − 2μ/R получается',
      ],
    });
    cl.push({ c: ['v₀² ≥ v₁²·2RH/((R + H)²cos²θ₀ − R²), v₁ = √(μ/(R + H)) — круговая скорость на высоте H (50.25)'] });
    cl.push({
      num: true,
      c: [`v_кр = ${num(f.vc)}·√(2·${num(f.R)}·${num(f.r0 - f.R)}/((${num(f.r0)})²·cos²(${num(pr.th0)}°) − ${pw(f.R)}²)) = `, b(`${num(f.vcrit)} ${L}/с`)],
    });
  } else cl.push({ c: ['θ₀ на границе конуса: траектория касается поверхности только при v₀ → ∞'] });
  if (f.el && f.hits != null)
    cl.push(
      {
        c: [
          `проверка заданной скорости v₀ = ${num(pr.v0)} ${L}/с: e = ${num(f.el.e)}, r_п = ${num(f.el.rp)} ${L}${f.el.type === 'hyperbola' || f.el.type === 'parabola' ? ' (траектория незамкнутая)' : ''}`,
        ],
      },
      {
        num: true,
        c: [
          f.hits ? 'r_п < R и перицентр впереди: ' : 'поверхность не пересекается: ',
          b(f.hits ? 'точка падает на планету' : 'траектория проходит над поверхностью'),
        ],
      },
    );
  const cb: Block[] = [{ k: 'eq', lines: cl }];
  if (f.vcrit != null && f.vcrit > f.vpar && pr.th0 >= 0)
    cb.push({ k: 'badge', tone: 'warn', text: 'v_кр больше параболической: при подъёме и v₀ ≥ параболической точка всё равно уходит от планеты' });
  ex(
    cb,
    'При v₀ меньше v_кр траектория — эллипс, перицентр которого лежит под поверхностью: точка падает. При v₀ = v_кр траектория касается поверхности в перицентре.',
  );
  steps.push({ title: 'Граничная скорость', blocks: cb });
  const rows: AnswerRow[] = [{ kind: 'main', val: [`θ_к = −${num(f.thCone, 5)}°`], note: 'граница конуса падения (к горизонту)' }];
  if (f.vcrit != null) rows.push({ kind: 'main', val: [`v_кр = ${num(f.vcrit)} ${L}/с`], note: 'траектория не пересечёт поверхность при v₀ ≥ v_кр' });
  else if (f.inside) rows.push({ kind: 'main', val: ['падение при любой v₀'], note: 'направление внутри конуса' });
  if (f.hits != null) rows.push({ kind: 'aux', val: [f.hits ? 'падает' : 'не падает'], note: `при v₀ = ${num(pr.v0)} ${L}/с` });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function inverseDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const i = r.inverse!;
  const lines: Line[] = [];
  const rows: AnswerRow[] = [];
  const bl: Block[] = [];
  let title = 'Элементы орбиты';
  if (pr.inv === 'axes') {
    title = 'Полуоси и период (50.15)';
    lines.push(
      { c: [`p = ${num(pr.p)} ${L}, e = ${num(pr.e)}, c = ${num(pr.c)} ${L}²/с; μ = c²/p`] },
      { num: true, c: [`μ = ${pw(pr.c)}²/${num(pr.p)} = ${num(i.mu!)} ${L}³/с²`] },
      { c: ['a = p/(1 − e²), b = p/√(1 − e²); площадь эллипса πab, секторная скорость c/2 → T = 2πab/c'] },
      { num: true, c: [`a = `, b(`${num(i.a!)} ${L}`), `; b = `, b(`${num(i.b!)} ${L}`), `; T = 2π·${num(i.a!)}·${num(i.b!)}/${num(pr.c)} = `, b(dur(i.T!))] },
    );
    rows.push(
      { kind: 'main', val: [`a = ${num(i.a!)} ${L}, b = ${num(i.b!)} ${L}`], note: 'полуоси' },
      { kind: 'main', val: [`T = ${dur(i.T!)}`], note: 'период обращения' },
      { kind: 'aux', val: [`μ = ${num(i.mu!)} ${L}³/с²`], note: 'гравитационный параметр c²/p' },
    );
  } else if (pr.inv === 'ecc') {
    title = 'Эксцентриситет по периоду (50.17)';
    lines.push(
      { c: [`T = ${dur(pr.T)}; H = r_а − r_п = ${num(pr.Hd)} ${L}; μ = ${num(r.mu)} ${L}³/с²`] },
      { c: ['период задаёт полуось: a = ∛(μT²/(4π²)); разность апсид H = 2ae → e = H/(2a) = (H/2)·∛(4π²/(μT²))'] },
      { num: true, c: [`a = `, b(`${num(i.aNeed!)} ${L}`), `; e = ${num(pr.Hd)}/(2·${num(i.aNeed!)}) = `, b(num(i.e!, 6))] },
    );
    rows.push(
      { kind: 'main', val: [`e = ${num(i.e!, 6)}`], note: 'эксцентриситет' },
      { kind: 'aux', val: [`a = ${num(i.aNeed!)} ${L}`], note: 'большая полуось' },
    );
  } else if (pr.inv === 'sma') {
    title = 'Большая полуось по отношению высот (50.18)';
    lines.push(
      { c: [`R = ${num(pr.R)} ${L}, e = ${num(pr.e)}, γ = H_п/H_а = ${num(pr.gam, 6)}`] },
      { c: ['H_п = a(1 − e) − R, H_а = a(1 + e) − R; H_п = γH_а → a(1 − e − γ(1 + e)) = R(1 − γ)'] },
      { num: true, c: [`a = R(1 − γ)/(1 − e − γ(1 + e)) = `, b(`${num(i.aNeed!)} ${L}`)] },
      {
        num: true,
        c: [
          `r_п = a(1 − e) = ${num(i.rpNeed!)} ${L} (высота ${num(i.rpNeed! - pr.R)} ${L}); r_а = a(1 + e) = ${num(i.raNeed!)} ${L} (высота ${num(i.raNeed! - pr.R)} ${L})`,
        ],
      },
    );
    rows.push(
      { kind: 'main', val: [`a = ${num(i.aNeed!)} ${L}`], note: 'большая полуось' },
      { kind: 'aux', val: [`H_п = ${num(i.rpNeed! - pr.R)}, H_а = ${num(i.raNeed! - pr.R)} ${L}`], note: 'высоты перигея и апогея' },
    );
  } else {
    title = 'Отношение масс по третьему закону Кеплера (50.27)';
    lines.push(
      { c: [`спутник: a₁ = ${num(pr.a1)} ${L}, T₁ = ${dur(pr.T1)}; сам центр обращается вокруг другого тела: a₂ = ${num(pr.a2)} ${L}, T₂ = ${dur(pr.T2)}`] },
      { c: ['T²/a³ = 4π²/(f·M): для спутника M₁ — масса притягивающего тела (планеты), для планеты M₂ — масса Солнца; массами спутников пренебрегаем'] },
      { num: true, c: [`M₁/M₂ = (a₁/a₂)³·(T₂/T₁)² = (${num(pr.a1 / pr.a2, 6)})³·(${num(pr.T2 / pr.T1, 6)})² = `, b(num(i.ratio!, 5))] },
      { num: true, c: ['M₂/M₁ = ', b(num(1 / i.ratio!, 5))] },
    );
    rows.push({ kind: 'main', val: [`M₁ : M₂ = 1 : ${num(1 / i.ratio!, 4)}`], note: 'масса планеты к массе Солнца' });
  }
  bl.push({ k: 'eq', lines });
  ex(
    bl,
    'Из интеграла площадей c = r²φ̇ следует, что за период радиус-вектор ометает всю площадь эллипса πab с секторной скоростью c/2; остальное — формулы эллипса.',
  );
  return {
    steps: [
      { title, blocks: bl },
      { title: 'Ответ', blocks: [{ k: 'answer', rows }] },
    ],
  };
}

function binetDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const bn = r.binet!;
  const a = bn.at;
  const steps: Step[] = [];
  const lines: Line[] = [
    { c: ['траектория: r(φ) = ', b(phiText(printExpr(bn.expr))), `; секторная скорость c = r²φ̇ = ${num(pr.cb)} ${L}²/с`] },
    { c: ['формула Бине: u = 1/r, v² = c²(u² + u′²), F_r/m = −c²u²(u″ + u), F_φ = 0 (производные по φ)'] },
    { num: true, c: [`в точке φ₁ = ${num(a.phi, 5)}°: r = ${num(a.r)} ${L}; u = ${num(a.u)}; u′ = ${num(a.du)}; u″ = ${num(a.ddu)}`] },
    {
      num: true,
      c: [
        `a_r = −${pw(pr.cb)}²·${pw(a.u)}²·(${num(a.ddu)} + ${num(a.u)}) = `,
        b(`${num(a.ar)} ${L}/с²`),
        `; a_φ = 0; v = ${num(a.v)} ${L}/с (v_r = ${num(a.vr)}, v_φ = ${num(a.vt)})`,
      ],
    },
  ];
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Сила центральная, поэтому момент количества движения постоянен (c = const), а закон силы восстанавливается по форме траектории: сначала подставляем u = 1/r(φ), затем u″ + u. Знак a_r: «−» — притяжение к центру, «+» — отталкивание.',
  );
  steps.push({ title: 'Формула Бине', blocks: bl });
  const ll: Line[] = [];
  if (bn.inverseSquare) {
    ll.push({ c: ['вдоль всей траектории a_r·r² = const — сила обратно пропорциональна квадрату расстояния (всемирное тяготение):'] });
    ll.push({ num: true, c: [`a_r = −μ/r², μ = −a_r·r² = `, b(`${num(bn.mu!)} ${L}³/с²`), `; для конического сечения r = p/(1 + e cos φ): μ = c²/p`] });
  } else if (bn.power != null) {
    ll.push({ c: ['вдоль траектории ускорение подчиняется степенному закону:'] });
    ll.push({ num: true, c: [`a_r = K·r^${num(bn.power)}; в точке φ₁: K = a_r/r^${num(bn.power)} = ${num(a.ar / a.r ** bn.power)}`] });
  } else ll.push({ c: ['закон силы по таблице: a_r·r² не постоянно, и степенного закона по всем проверенным точкам нет — зависимость a_r(r) в таблице ниже'] });
  const lb: Block[] = [{ k: 'eq', lines: ll }];
  lb.push({
    k: 'ul',
    items: bn.rows
      .filter((_, k) => k % 2 === 0)
      .map((q) => [`φ = ${num(q.phi, 5)}°: r = ${num(q.r)} ${L}, a_r = ${num(q.ar)} ${L}/с², v = ${num(q.v)} ${L}/с, a_r·r² = ${num(q.k)}`]),
  });
  steps.push({ title: 'Закон силы', blocks: lb });
  const rows: AnswerRow[] = [{ kind: 'main', val: [`F_r = m·a_r, a_r = ${num(a.ar)} ${L}/с²`], note: `в точке φ₁ = ${num(a.phi, 5)}° (F_φ = 0)` }];
  if (bn.inverseSquare) rows.push({ kind: 'main', val: [`F = −mμ/r², μ = ${num(bn.mu!)} ${L}³/с²`], note: 'закон всемирного тяготения (50.13)' });
  else if (bn.power != null) rows.push({ kind: 'main', val: [`F ∝ r^${num(bn.power)}`], note: 'степенной закон' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function trackDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const t = r.track!;
  const lines: Line[] = [
    {
      c: [
        pr.muMode === 'planet' ? `μ = gR² = ${num(r.mu)} ${L}³/с²` : `μ = ${num(r.mu)} ${L}³/с²`,
        `; радиус орбиты r = R + H = ${num(pr.R)} + ${num(pr.H)} = ${num(t.r)} ${L}`,
      ],
    },
    { num: true, c: [`движение по орбите: n = √(μ/r³) = ${num(t.n, 6)} 1/с; T = 2π/n = `, b(dur(t.T))] },
    { num: true, c: [`вращение тела: Ω = 2π/T_вр = 2π/${num(pr.Trot)} = ${num(t.Om, 6)} 1/с; Ω/n = Ω√(r³/μ) = `, b(num(t.k, 6))] },
  ];
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Трасса — проекция орбиты на вращающуюся поверхность. В инерциальном пространстве точка орбиты наклонением α движется с угловой скоростью n; относительно тела её долгота дополнительно убывает со скоростью Ω.',
  );
  const steps: Step[] = [{ title: 'Движение по орбите и вращение тела', blocks: bl }];
  const tl: Line[] = [
    { c: ['на экваторе (восходящий узел): скорость точки на север — n sin α, на восток — n cos α − Ω (вращение тела вычитается)'] },
    { c: ['tg β = sin α/(cos α − Ω√(r³/μ)) — формула 50.6 для направления α (α < 90° — по вращению тела, α > 90° — против)'] },
    {
      num: true,
      c: [
        `tg β = sin ${num(pr.alpha)}°/(cos ${num(pr.alpha)}° − ${num(t.k, 6)})`,
        t.geo ? ' — неопределён: орбита синхронная, точка неподвижна' : ' → β = ',
        ...(t.geo ? [] : [b(`${num(t.beta, 6)}°`)]),
      ],
    },
  ];
  if (t.betaBook != null) {
    if (Math.abs(t.betaBook - t.beta) > 1e-9)
      tl.push({
        c: [
          `формула книги со знаком «+» дала бы β′ = ${num(t.betaBook, 6)}°: для движения по вращению тела она не годится — вращение вычитается из восточной скорости (расхождение с книгой, см. README)`,
        ],
      });
    else
      tl.push({
        c: [
          `формула книги с «+» (для α′ = 180° − α = ${num(180 - pr.alpha)}°, орбита против вращения тела) даёт β = 180° − β′ = ${num(t.betaBook, 6)}° — совпадает`,
        ],
      });
  }
  tl.push({
    num: true,
    c: [
      `смещение трассы за виток: ΩT = ${num(t.shift, 6)}° к западу; наибольшая широта ${num(t.lat, 5)}°; скорость точки трассы по поверхности ${num(t.vTrack)} ${L}/с`,
    ],
  });
  const tb: Block[] = [{ k: 'eq', lines: tl }];
  for (const n of r.notes) tb.push({ k: 'badge', tone: 'warn', text: n });
  ex(
    tb,
    'Широта подспутниковой точки: sin φ = sin α·sin(nt); долгота: λ = arctg(cos α·tg(nt)) − Ωt (счёт от долготы восходящего узла в момент t = 0). Влияние сжатия Земли и прецессии орбиты не учитывается.',
  );
  steps.push({ title: 'Угол трассы с экватором', blocks: tb });
  const rows: AnswerRow[] = t.geo
    ? [{ kind: 'main', val: ['подспутниковая точка неподвижна'], note: 'стационарная орбита' }]
    : [
        { kind: 'main', val: [`β = ${num(t.beta, 6)}°`], note: 'угол пересечения трассы с экватором (tg β = sin α/(cos α − Ω√(r³/μ)))' },
        { kind: 'aux', val: [`T = ${dur(t.T)}`], note: 'период обращения' },
        { kind: 'aux', val: [`Δλ = ${num(t.shift, 5)}° на запад`], note: 'смещение трассы за виток' },
      ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

function twoDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const L = LEN[pr.unit];
  const t = r.two!;
  const lines: Line[] = [
    { c: [`m₁ = ${num(pr.m1)} кг, m₂ = ${num(pr.m2)} кг, f = ${num(pr.fG)} м³/(кг·с²); относительная орбита a = ${num(pr.a)} ${L}, e = ${num(pr.e)}`] },
    { c: ['относительное движение (51.1): r̈ = −f(m₁ + m₂)·r/r³ — как абсолютное, но с μ = f(m₁ + m₂)'] },
    {
      num: true,
      c: [
        `μ = ${num(pr.fG)}·${num(pr.m1 + pr.m2)}${LM[pr.unit] === 1 ? '' : `/${pw(LM[pr.unit] ** 3)}`} = `,
        b(`${num(t.mu)} ${L}³/с²`),
        `; T = 2π√(a³/μ) = `,
        b(dur(t.T)),
      ],
    },
    { c: ['около центра масс (51.5): r₁ = −m₂r/(m₁ + m₂), r₂ = m₁r/(m₁ + m₂): тот же закон с μ₁ = f·m₂³/(m₁ + m₂)² и μ₂ = f·m₁³/(m₁ + m₂)²'] },
    {
      num: true,
      c: [`μ₁ = ${num(t.mu1)} ${L}³/с²; μ₂ = ${num(t.mu2)} ${L}³/с²; a₁ = a·m₂/(m₁ + m₂) = ${num(t.a1)} ${L}; a₂ = a·m₁/(m₁ + m₂) = ${num(t.a2)} ${L}`],
    },
    { num: true, c: [`проверка: T₁ = 2π√(a₁³/μ₁) = ${dur(t.T1)}`] },
    { c: ['третий закон Кеплера с учётом движения центра (51.2): T² = 4π²a³/(f(M + m)) — период короче периода при μ = fM в √(M/(M + m)) раз'] },
    { num: true, c: [`T/T_(μ=fm₁) = ${num(t.ratio, 8)}; для двух планет T₁²/T₂² = (a₁³/a₂³)·(M + m₂)/(M + m₁)`] },
  ];
  const bl: Block[] = [{ k: 'eq', lines }];
  ex(
    bl,
    'Две свободные точки взаимно притягиваются: их центр масс движется равномерно, а положение одной точки относительно другой подчиняется тому же закону, что и движение в поле неподвижного центра, но с суммой масс.',
  );
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`μ = f(m₁ + m₂) = ${num(t.mu)} ${L}³/с²`], note: 'относительное движение (51.1)' },
    { kind: 'main', val: [`μ₁ = ${num(t.mu1)}, μ₂ = ${num(t.mu2)} ${L}³/с²`], note: 'движение около центра масс (51.5)' },
    { kind: 'aux', val: [`T = ${dur(t.T)}`], note: `отношение к периоду при μ = fm₁: ${num(t.ratio, 8)}` },
  ];
  return {
    steps: [
      { title: 'Задача двух тел', blocks: bl },
      { title: 'Ответ', blocks: [{ k: 'answer', rows }] },
    ],
  };
}

function flyDoc(pr: TrajProblem, r: TrajResult, ex: ReturnType<typeof exf>): Doc {
  const f = r.fly!;
  const lines: Line[] = [
    { c: [`J = ${num(pr.Jf)} кг·м² (маховик), J₀ = ${num(pr.J0)} кг·м² (аппарат вместе с маховиком), ось общая и проходит через центр масс`] },
    { c: ['момент количества движения системы относительно оси сохраняется: J₀Ω + J·ω = const (ω — угловая скорость маховика относительно корпуса)'] },
  ];
  const rows: AnswerRow[] = [];
  const bl: Block[] = [];
  if (f.kind === 'stop') {
    lines.push(
      { c: [`в начале маховик не вращается относительно корпуса: K = J₀Ω₀ = ${num(pr.J0)}·${num(pr.Om0)} = ${num(f.K)} кг·м²/с`] },
      { num: true, c: [`корпус остановлен (Ω = 0): K = J·ω → ω = J₀Ω₀/J = `, b(`${num(f.omF)} рад/с`)] },
      { c: ['работа двигателя равна приращению кинетической энергии: A = Jω²/2 − J₀Ω₀²/2 = J₀(J₀ − J)Ω₀²/(2J)'] },
      {
        num: true,
        c: [`A = ½·${num(pr.J0)}·${num(pr.J0 - pr.Jf)}·${pw(pr.Om0)}²/${num(pr.Jf)} = `, b(`${num(f.A)} Дж`), `; начальная энергия ${num(f.E0)} Дж`],
      },
    );
    bl.push({ k: 'eq', lines });
    rows.push(
      { kind: 'main', val: [`A = ${num(f.A)} Дж`], note: 'полная работа двигателя маховика (51.9)' },
      { kind: 'aux', val: [`ω = ${num(f.omF)} рад/с`], note: 'скорость маховика относительно корпуса в конце' },
    );
  } else if (f.kind === 'motor') {
    lines.push(
      { c: [`момент статора M = M₀ − κω, M₀ = ${num(pr.M0)} Н·м, κ = ${num(pr.kap)} Н·м·с; корпус: (J₀ − J)Ω̇ = −M; из сохранения K: Ω = Ω₀ − Jω/J₀`] },
      { c: ['маховик: ω̇ = J₀M/(J(J₀ − J)) → ω̇ + αω = αM₀/κ, α = κJ₀/(J(J₀ − J)); при ω(0) = 0: ω = (M₀/κ)(1 − e^(−αt))'] },
      { num: true, c: [`α = ${num(pr.kap)}·${num(pr.J0)}/(${num(pr.Jf)}·${num(pr.J0 - pr.Jf)}) = `, b(`${num(f.alpha!, 6)} 1/с`)] },
      { c: ['корпус остановится (ω = J₀Ω₀/J), если ω достигает этого значения: M₀/κ > J₀Ω₀/J ⇔ M₀ > α(J₀ − J)Ω₀'] },
      { num: true, c: [`α(J₀ − J)Ω₀ = ${num(f.Mmin!)} Н·м; M₀ = ${num(pr.M0)} Н·м — ${f.ok ? 'условие выполнено' : 'условие не выполнено'}`] },
    );
    bl.push({ k: 'eq', lines });
    if (f.ok) {
      const l2: Line[] = [
        { c: ['время торможения: T = (1/α)·ln(M₀/(M₀ − α(J₀ − J)Ω₀))'] },
        { num: true, c: ['T = ', b(dur(f.T!))] },
        { c: ['угол поворота корпуса ψ = ∫Ω dt (51.11): ψ = Ω₀/α − [M₀ − α(J₀ − J)Ω₀]/[α²(J₀ − J)]·ln(M₀/(M₀ − α(J₀ − J)Ω₀))'] },
        { num: true, c: ['ψ = ', b(`${num(f.psi!)} рад = ${num((f.psi! * 180) / Math.PI)}°`)] },
      ];
      bl.push({ k: 'eq', lines: l2 });
      rows.push(
        { kind: 'main', val: [`T = ${dur(f.T!)}`], note: 'время торможения (51.10)' },
        { kind: 'main', val: [`ψ = ${num(f.psi!)} рад`], note: `угол поворота за время торможения (51.11) = ${num((f.psi! * 180) / Math.PI)}°` },
      );
    } else bl.push({ k: 'badge', tone: 'bad', text: 'M₀ ≤ α(J₀ − J)Ω₀: торможение за конечное время невозможно' });
    rows.unshift({ kind: 'aux', val: [`M₀ > ${num(f.Mmin!)} Н·м`], note: 'условие торможения за конечное время (51.10)' });
  } else {
    lines.push(
      {
        c: [
          `маховик: ω̇ + ω/T = u, T = ${num(pr.Tc)} с; u = +u₀ (разгон), затем −u₀ (торможение), u₀ = ${num(pr.u0)} рад/с²; корпус: Ω = −Jω/J₀, угол ψ = (J/J₀)∫ω dt`,
        ],
      },
      { c: ['разгон — t₁, торможение до ω = 0 — t₂; ∫ω dt = T·u₀·(t₁ − t₂), причём t₂ = T·ln(2 − e^(−t₁/T))'] },
      {
        num: true,
        c: [
          `τ = ψJ₀/(J·T·u₀) = ${num(rad(pr.psi))}·${num(pr.J0)}/(${num(pr.Jf)}·${num(pr.Tc)}·${num(pr.u0)}) = `,
          b(`${num(f.tau!)} с`),
          ' — разность t₁ − t₂',
        ],
      },
      { c: ['из t₁ − t₂ = τ: e^(−t₁/T) = 1 − √(1 − e^(−τ/T)) → t₁ = τ + T·ln(1 + √(1 − e^(−τ/T))), t₂ = t₁ − τ'] },
      {
        num: true,
        c: [
          `t₁ = `,
          b(`${num(f.t1!)} с`),
          `; t₂ = `,
          b(`${num(f.t2!)} с`),
          `; полное время ${num(f.tTotal!)} с; наибольшая ω маховика ${num(f.omPeak!)} рад/с`,
        ],
      },
    );
    bl.push({ k: 'eq', lines });
    rows.push(
      { kind: 'main', val: [`t₁ = ${num(f.t1!)} с`], note: 'разгон маховика (u = +u₀)' },
      { kind: 'main', val: [`t₂ = ${num(f.t2!)} с`], note: 'торможение маховика (u = −u₀)' },
      { kind: 'aux', val: [`t₁ + t₂ = ${num(f.tTotal!)} с`], note: `поворот корпуса на ${num(pr.psi)}° и остановка` },
    );
  }
  ex(
    bl,
    'Внутренние моменты не меняют момент количества движения всей системы: что получает маховик, то теряет корпус. Работа двигателя идёт на разность кинетических энергий.',
  );
  for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
  return {
    steps: [
      { title: 'Корпус и маховик', blocks: bl },
      { title: 'Ответ', blocks: [{ k: 'answer', rows }] },
    ],
  };
}

export function trajDoc(pr: TrajProblem, r: TrajResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  switch (pr.kind) {
    case 'point':
      return pointDoc(pr, r, ex);
    case 'time':
      return timeDoc(pr, r, ex);
    case 'mean':
      return meanDoc(pr, r, ex);
    case 'fall':
      return fallDoc(pr, r, ex);
    case 'inverse':
      return inverseDoc(pr, r, ex);
    case 'binet':
      return binetDoc(pr, r, ex);
    case 'track':
      return trackDoc(pr, r, ex);
    case 'two':
      return twoDoc(pr, r, ex);
    case 'flywheel':
      return flyDoc(pr, r, ex);
  }
}
