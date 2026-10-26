/** Пункт 31, «Центроиды»: своё движение — формулы x(φ), y(φ), θ(φ) и проверяемые уравнения центроид. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { centrodes } from '../src/modules/centrodes/model/centrodes';
import { OWN_DEFAULT, ownErrors, ownPreset, ownResiduals, ownSource, type OwnMotion } from '../src/modules/centrodes/model/own';
import { centrodesDoc } from '../src/modules/centrodes/text/solution';
import { poseAt } from '../src/modules/centrodes/model/centrodes';
import { CentrodesStore } from '../src/modules/centrodes/ui/store';

const run = (o: OwnMotion) => {
  const src = ownSource(o);
  const cen = centrodes(src, 721);
  return { src, cen, res: ownResiduals(o, cen) };
};

describe('своё движение', () => {
  it('колесо катится по прямой: неподвижная центроида — прямая, подвижная — обод', () => {
    const { cen, res } = run(OWN_DEFAULT);
    expect(cen.ok).toBe(true);
    expect(res.fixed).toBeLessThan(1e-9);
    expect(res.moving).toBeLessThan(1e-9);
  });
  it('неверное уравнение даёт заметную невязку, а пустое не проверяется', () => {
    const { res } = run({ ...OWN_DEFAULT, eqM: 'xi^2 + eta^2 − 4', eqF: '' });
    expect(res.moving).toBeGreaterThan(0.1);
    expect(res.fixed).toBeNaN();
  });
  it('17.12 по формулам: шатун AB (l = 10, r = 1) — уравнения книги приближённые, невязка порядка (r/l)²', () => {
    // B = (r cos φ + √(l² − r² sin²φ), 0), ξ — от A к B: угол −α, sin α = (r/l) sin φ.
    const o: OwnMotion = {
      x: 'cos(t*pi/180) + sqrt(100 − sin(t*pi/180)^2)',
      y: '0',
      theta: '−arcsin(sin(t*pi/180)/10)*180/pi',
      from: -80,
      to: 80,
      rot: 0,
      eqF: '(x − 10)^2 (x^2 + y^2) − x^2',
      eqM: '100 xi^2 (100 + eta^2) − eta^4',
    };
    expect(ownErrors(o)).toEqual([]);
    const { cen, res } = run(o);
    expect(cen.ok).toBe(true);
    expect(res.fixed).toBeLessThan(0.02);
    expect(res.fixed).toBeGreaterThan(1e-5);
    // Точный мгновенный центр — пересечение OA с вертикалью через B.
    const p = poseAt(ownSource(o), 30);
    const phi = Math.PI / 6;
    const xB = Math.cos(phi) + Math.sqrt(100 - Math.sin(phi) ** 2);
    expect(p.ic![0]).toBeCloseTo(xB, 9);
    expect(p.ic![1]).toBeCloseTo(xB * Math.tan(phi), 9);
  });
  it('ошибки формул и диапазона', () => {
    expect(ownErrors({ ...OWN_DEFAULT, x: 't*(' }).length).toBe(1);
    expect(ownErrors({ ...OWN_DEFAULT, to: -1 }).length).toBe(1);
  });
  it('текст решения: проверяемое уравнение вместо ответа книги', () => {
    const { src, cen, res } = run(OWN_DEFAULT);
    const html = docHTML(centrodesDoc({ preset: ownPreset(OWN_DEFAULT), values: {}, src, cen, pose: poseAt(src, 90), phi: 90, explain: true, own: { res } }));
    expect(html).toContain('Проверяемое уравнение');
    expect(html).not.toContain('NaN');
  });
  it('состояние: своё движение, отмена, файл проекта', () => {
    const st = new CentrodesStore();
    st.loadPreset('own');
    st.typeOwn('y', '2');
    st.endSession('own:y');
    expect(st.get().own.y).toBe('2');
    st.undo();
    expect(st.get().own.y).toBe('1');
    st.typeOwn('eqF', 'y − 0');
    const f = st.exportProject();
    const st2 = new CentrodesStore();
    expect(st2.importProject(f.text)).toBe(true);
    expect(st2.get().preset).toBe('own');
    expect(st2.get().own.eqF).toBe('y − 0');
  });
});
