/** Экран «Тяготение и орбиты»: небесное тело, орбита в поле тяготения (или центральная сила-формула), движение по прямой. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderOrbit, renderPlanet, renderRadial } from '../draw/orbit';
import { renderTraj } from '../draw/traj';
import { solveTraj, type TrajProblem } from '../model/traj';
import { BODIES, solveOrbit, solvePlanet, solveRadial, type OrbitProblem, type PlanetProblem, type RadialProblem, type Unit } from '../model/orbit';
import { ORB_PRESETS, type OrbMode, type OrbPresetKey } from '../presets';
import { LEN, orbitDoc, planetDoc, radialDoc } from '../text/solution';
import { trajDoc } from '../text/traj';
import type { OrbitNumKey, OrbStore, PlanetNumKey, RadialNumKey, TrajNumKey } from './store';

type Kind = 'any' | 'pos' | 'nonneg';
const HINT: Record<OrbMode, string> = {
  planet: 'Тело и круговые орбиты в одном масштабе.',
  orbit: 'Орбита с телом в фокусе: начальная точка, скорость, перицентр и апоцентр.',
  radial: 'Ось x по линии центров; графики движения или потенциал U(x) с уровнем энергии.',
  traj: 'Аномалии и время полёта, средние радиусы, граница падения, сила по траектории (Бине), трасса спутника.',
};

export function OrbitView({ chrome, store }: { chrome: Chrome; store: OrbStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => {
    if (s.mode === 'planet') {
      const r = solvePlanet(s.planet);
      return { fig: renderPlanet(s.planet, r), doc: planetDoc(s.planet, r, { explain: st.explain }) };
    }
    if (s.mode === 'orbit') {
      const r = solveOrbit(s.orbit);
      return { fig: renderOrbit(s.orbit, r), doc: orbitDoc(s.orbit, r, { explain: st.explain }) };
    }
    if (s.mode === 'traj') {
      const r = solveTraj(s.traj);
      return { fig: renderTraj(s.traj, r), doc: trajDoc(s.traj, r, { explain: st.explain }) };
    }
    const r = solveRadial(s.radial);
    return { fig: renderRadial(s.radial, r), doc: radialDoc(s.radial, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const P = s.planet,
    O = s.orbit,
    X = s.radial,
    K = s.traj;
  const NP = (k: PlanetNumKey, label: string, kind: Kind = 'pos') => (
    <Num
      key={k}
      id={`orb-p-${k}`}
      label={label}
      value={P[k]}
      neg={kind === 'any'}
      zero={kind !== 'pos'}
      onType={(v) => store.typePlanet(k, v)}
      onEnd={end(`p:${k}`)}
    />
  );
  const NO = (k: OrbitNumKey, label: string, kind: Kind = 'pos') => (
    <Num
      key={k}
      id={`orb-o-${k}`}
      label={label}
      value={O[k]}
      neg={kind === 'any'}
      zero={kind !== 'pos'}
      onType={(v) => store.typeOrbit(k, v)}
      onEnd={end(`o:${k}`)}
    />
  );
  const NX = (k: RadialNumKey, label: string, kind: Kind = 'pos') => (
    <Num
      key={k}
      id={`orb-x-${k}`}
      label={label}
      value={X[k]}
      neg={kind === 'any'}
      zero={kind !== 'pos'}
      onType={(v) => store.typeRadial(k, v)}
      onEnd={end(`x:${k}`)}
    />
  );
  const NK = (k: TrajNumKey, label: string, kind: Kind = 'pos') => (
    <Num
      key={k}
      id={`orb-k-${k}`}
      label={label}
      value={K[k]}
      neg={kind === 'any'}
      zero={kind !== 'pos'}
      onType={(v) => store.typeTraj(k, v)}
      onEnd={end(`k:${k}`)}
    />
  );
  const KSEL = <T extends 'kind' | 'unit' | 'muMode' | 'anom' | 'inv' | 'fw'>(id: string, label: string, key: T, opts: [TrajProblem[T], string][]) => (
    <label className="sfield ob-wide">
      <span>{label}</span>
      <select id={id} value={K[key] as string} onChange={(e) => store.setTraj(key, e.target.value as TrajProblem[T])}>
        {opts.map(([v, t]) => (
          <option key={v as string} value={v as string}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  const unitSel = (id: string, value: Unit, on: (u: Unit) => void) => (
    <label className="sfield ob-wide">
      <span>единица длины</span>
      <select id={id} value={value} onChange={(e) => on(e.target.value as Unit)}>
        <option value="km">километр (μ в км³/с²)</option>
        <option value="m">метр</option>
        <option value="cm">сантиметр</option>
      </select>
    </label>
  );
  const Lo = LEN[O.unit],
    Lx = LEN[X.unit],
    Lk = LEN[K.unit];
  const needMuK =
    K.kind === 'point' ||
    K.kind === 'time' ||
    K.kind === 'mean' ||
    K.kind === 'fall' ||
    K.kind === 'track' ||
    (K.kind === 'inverse' && (K.inv === 'ecc' || K.inv === 'sma'));
  const anomUnit = K.anom === 't' ? 'с' : '°';
  const needMu = O.def === 'state' || O.scale === 'mu';
  const SHAPE: Record<OrbitProblem['shape'], [string, string, Kind]> = {
    apsides: [`r_п, ${Lo}`, `r_а, ${Lo}`, 'pos'],
    ae: [`a, ${Lo}`, 'e', 'nonneg'],
    ab: [`a, ${Lo}`, `b, ${Lo}`, 'pos'],
    pe: [`p, ${Lo}`, 'e', 'nonneg'],
  };

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Тяготение и орбиты</h1>
            <p className="lede">
              Сила ∝ 1/r²: гравитационный параметр и космические скорости, орбита по начальным условиям или элементам, импульс скорости и переход между
              орбитами, центральная сила по формуле; движение по линии центров — высота подъёма, скорость падения, время.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="orbpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as OrbPresetKey)}>
                <PresetOptions items={taskEntries(ORB_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Схема">
          <div className="bar">
            <span className="hint">{HINT[s.mode]}</span>
            <div className="hist">
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={store.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={store.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          <div className="canvas">
            <svg id="orbsvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="orbmode" value={s.mode} onChange={(e) => store.setMode(e.target.value as OrbMode)}>
                <option value="planet">небесное тело: μ, космические скорости</option>
                <option value="orbit">орбита в центральном поле</option>
                <option value="radial">движение по прямой (линия центров)</option>
                <option value="traj">формулы Кеплера и Бине, трасса спутника</option>
              </select>
            </label>
            {s.mode === 'planet' && (
              <>
                <label className="field">
                  <span>Тело</span>
                  <select id="orbbody" value={P.body} onChange={(e) => store.setBody(e.target.value as PlanetProblem['body'])}>
                    {(Object.keys(BODIES) as (keyof typeof BODIES)[]).map((k) => (
                      <option key={k} value={k}>
                        {BODIES[k].name}
                      </option>
                    ))}
                    <option value="ratio">задано отношениями к Земле</option>
                    <option value="custom">задано g и R</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {P.body === 'ratio' && (
                    <>
                      {NP('mRatio', 'M : M_З')}
                      {NP('rRatio', 'R : R_З')}
                    </>
                  )}
                  {P.body === 'custom' && (
                    <>
                      {NP('g', 'g, м/с²')}
                      {NP('R', 'R, км')}
                    </>
                  )}
                  {NP('H', 'высота орбиты H, км', 'nonneg')}
                  {NP('Trot', 'период вращения тела, с', 'nonneg')}
                  {NP('G', 'вес аппарата G', 'nonneg')}
                </div>
                <p className="empty">
                  Отношения к Земле — как в таблице задачи 50.2 (R_З = 6370 км, g_З = 9,81 м/с²). Период вращения задаёт стационарную орбиту (для Земли — 86 164
                  с), вес G — работу двигателя (задача 51.8); нуль — не считать.
                </p>
              </>
            )}
            {s.mode === 'orbit' && (
              <>
                <label className="field">
                  <span>Сила</span>
                  <select id="orbforce" value={O.force} onChange={(e) => store.setOrbit('force', e.target.value as OrbitProblem['force'])}>
                    <option value="newton">всемирного тяготения F = mμ/r²</option>
                    <option value="formula">центральная, a(r) по формуле</option>
                  </select>
                </label>
                <div className="cgpar cg0">{unitSel('orbunit', O.unit, (u) => store.setOrbit('unit', u))}</div>
                {O.force === 'formula' ? (
                  <>
                    <div className="cgpar cg0">
                      <LawField id="orb-ar" label={`a(r), ${Lo}/с² (+ от центра)`} value={O.ar} vars={['r']} onType={store.typeAr} onEnd={end('o:ar')} />
                      {NO('r0', `r₀, ${Lo}`)}
                      {NO('v0', `v₀, ${Lo}/с`, 'nonneg')}
                      {NO('th0', 'θ₀ к горизонту, °', 'any')}
                      {NO('ph0', 'φ₀, °', 'any')}
                      {NO('t1', 'до времени t, с')}
                    </div>
                    <p className="empty">
                      Ускорение — проекция силы на радиус, делённая на массу: притяжение со знаком минус (например, −1/r^3 или −(1/r^2 + 0,5/r^3)). Угол θ₀ — от
                      местного горизонта в сторону от центра.
                    </p>
                  </>
                ) : (
                  <>
                    <label className="field">
                      <span>Орбита задана</span>
                      <select id="orbdef" value={O.def} onChange={(e) => store.setOrbit('def', e.target.value as OrbitProblem['def'])}>
                        <option value="state">начальным положением и скоростью</option>
                        <option value="elements">формой и размерами (элементами)</option>
                      </select>
                    </label>
                    {O.def === 'elements' && (
                      <div className="cgpar cg0">
                        <label className="sfield ob-wide">
                          <span>форма</span>
                          <select id="orbshape" value={O.shape} onChange={(e) => store.setOrbit('shape', e.target.value as OrbitProblem['shape'])}>
                            <option value="apsides">перицентр и апоцентр</option>
                            <option value="ae">большая полуось и эксцентриситет</option>
                            <option value="ab">полуоси a и b</option>
                            <option value="pe">параметр и эксцентриситет</option>
                          </select>
                        </label>
                        {NO('e1', SHAPE[O.shape][0])}
                        {NO('e2', SHAPE[O.shape][1], SHAPE[O.shape][2])}
                        <label className="sfield ob-wide">
                          <span>масштаб движения</span>
                          <select id="orbscale" value={O.scale} onChange={(e) => store.setOrbit('scale', e.target.value as OrbitProblem['scale'])}>
                            <option value="mu">гравитационный параметр μ</option>
                            <option value="T">период обращения T</option>
                            <option value="vp">скорость в перицентре</option>
                          </select>
                        </label>
                        {O.scale === 'T' && NO('T', 'T, с')}
                        {O.scale === 'vp' && NO('vp', `v_п, ${Lo}/с`)}
                      </div>
                    )}
                    <div className="cgpar cg0">
                      {needMu && (
                        <label className="sfield ob-wide">
                          <span>μ притягивающего центра</span>
                          <select id="orbmumode" value={O.muMode} onChange={(e) => store.setOrbit('muMode', e.target.value as OrbitProblem['muMode'])}>
                            <option value="mu">задано числом</option>
                            <option value="planet">μ = gR² (тело радиуса R)</option>
                          </select>
                        </label>
                      )}
                      {needMu && O.muMode === 'mu' && NO('mu', `μ, ${Lo}³/с²`)}
                      {needMu && O.muMode === 'planet' && NO('g', 'g, м/с²')}
                      {NO('R', `R тела, ${Lo}`, needMu && O.muMode === 'planet' ? 'pos' : 'nonneg')}
                      {O.def === 'state' && (
                        <>
                          {NO('r0', `r₀, ${Lo}`)}
                          {NO('v0', `v₀, ${Lo}/с`, 'nonneg')}
                          {NO('th0', 'θ₀ к горизонту, °', 'any')}
                          {NO('ph0', 'φ₀, °', 'any')}
                        </>
                      )}
                      {NO('m', 'масса m (для силы)', 'nonneg')}
                      {NO('r1', `v на расстоянии r₁, ${Lo}`, 'nonneg')}
                    </div>
                    <label className="field">
                      <span>Импульс скорости</span>
                      <select id="orbman" value={O.man} onChange={(e) => store.setOrbit('man', e.target.value as OrbitProblem['man'])}>
                        <option value="none">нет</option>
                        <option value="impulse">задан — новая орбита</option>
                        <option value="target">найти по новой орбите</option>
                      </select>
                    </label>
                    {O.man === 'impulse' && (
                      <div className="cgpar cg0">
                        {NO('dvt', `вдоль скорости, ${Lo}/с`, 'any')}
                        {NO('dvr', `по радиусу, ${Lo}/с`, 'any')}
                      </div>
                    )}
                    {O.man === 'target' && (
                      <div className="cgpar cg0">
                        <label className="sfield ob-wide">
                          <span>импульс</span>
                          <select id="orbtgtkind" value={O.tgtKind} onChange={(e) => store.setOrbit('tgtKind', e.target.value as OrbitProblem['tgtKind'])}>
                            <option value="tang">касательный</option>
                            <option value="rad">радиальный</option>
                          </select>
                        </label>
                        <label className="sfield ob-wide">
                          <span>нужно найти</span>
                          <select id="orbtgt" value={O.tgt} onChange={(e) => store.setOrbit('tgt', e.target.value as OrbitProblem['tgt'])}>
                            <option value="apo">апоцентр</option>
                            <option value="peri">перицентр</option>
                            <option value="vinf">скорость v∞</option>
                          </select>
                        </label>
                        {NO('tgtVal', O.tgt === 'vinf' ? `v∞, ${Lo}/с` : `r, ${Lo}`)}
                      </div>
                    )}
                    <p className="empty">
                      Начальная точка — на расстоянии r₀ от центра, угол θ₀ скорости — от местного горизонта (перпендикуляра к радиусу) в сторону от центра. При
                      задании элементами начальная точка — перицентр. Импульс — в начальной точке; знак минус у касательного — торможение.
                    </p>
                  </>
                )}
              </>
            )}
            {s.mode === 'traj' && (
              <>
                <label className="field">
                  <span>Что найти</span>
                  <select id="orbkind" value={K.kind} onChange={(e) => store.setTraj('kind', e.target.value as TrajProblem['kind'])}>
                    <option value="point">точка эллипса: аномалии E, ν, M, скорость (50.30–50.34)</option>
                    <option value="time">время полёта между двумя точками (уравнение Кеплера)</option>
                    <option value="mean">среднее значение радиус-вектора (50.28)</option>
                    <option value="fall">граница падения на планету (50.24–50.25)</option>
                    <option value="inverse">обратные задачи по элементам (50.15, 50.17, 50.18, 50.27)</option>
                    <option value="binet">сила по траектории — формула Бине (50.12–50.13)</option>
                    <option value="track">трасса спутника на вращающейся Земле (50.6)</option>
                    <option value="two">задача двух тел: относительное движение и центр масс (51.1, 51.2, 51.5)</option>
                    <option value="flywheel">вращение аппарата маховиком (51.9–51.12)</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {K.kind !== 'flywheel' && unitSel('orbkunit', K.unit, (u) => store.setTraj('unit', u))}
                  {needMuK &&
                    KSEL('orbkmumode', 'μ притягивающего центра', 'muMode', [
                      ['mu', 'задано числом'],
                      ['planet', 'μ = gR² (тело радиуса R)'],
                    ])}
                  {needMuK && K.muMode === 'mu' && NK('mu', `μ, ${Lk}³/с²`)}
                  {needMuK && K.muMode === 'planet' && NK('g', 'g, м/с²')}
                </div>
                {(K.kind === 'point' || K.kind === 'time' || K.kind === 'mean') && (
                  <div className="cgpar cg0">
                    {NK('a', `большая полуось a, ${Lk}`)}
                    {NK('e', 'эксцентриситет e (0 ≤ e < 1)', 'nonneg')}
                    {K.kind !== 'mean' &&
                      KSEL(
                        'orbkanom',
                        K.kind === 'time' ? 'точки заданы' : 'точка задана',
                        'anom',
                        K.kind === 'time'
                          ? [
                              ['nu', 'истинной аномалией ν'],
                              ['E', 'эксцентрической E'],
                              ['M', 'средней M'],
                            ]
                          : [
                              ['nu', 'истинной аномалией ν'],
                              ['E', 'эксцентрической E'],
                              ['M', 'средней M'],
                              ['t', 'временем от перицентра t'],
                            ],
                      )}
                    {K.kind === 'point' && NK('x1', `${K.anom === 'nu' ? 'ν' : K.anom === 'E' ? 'E' : K.anom === 'M' ? 'M' : 't'}, ${anomUnit}`, 'any')}
                    {K.kind === 'time' && NK('x1', `${K.anom === 'nu' ? 'ν₁' : K.anom === 'E' ? 'E₁' : 'M₁'}, °`, 'any')}
                    {K.kind === 'time' && NK('x2', `${K.anom === 'nu' ? 'ν₂' : K.anom === 'E' ? 'E₂' : 'M₂'}, °`, 'any')}
                    {K.muMode === 'planet' && needMuK && NK('R', `R тела, ${Lk}`, 'nonneg')}
                  </div>
                )}
                {K.kind === 'fall' && (
                  <div className="cgpar cg0">
                    {NK('R', `радиус планеты R, ${Lk}`)}
                    {NK('r0', `r₀ от центра, ${Lk}`)}
                    {NK('th0', 'θ₀ к горизонту, °', 'any')}
                    {NK('v0', `v₀, ${Lk}/с (0 — не задана)`, 'nonneg')}
                  </div>
                )}
                {K.kind === 'inverse' && (
                  <>
                    <div className="cgpar cg0">
                      {KSEL('orbkinv', 'задача', 'inv', [
                        ['axes', 'полуоси и период по p, e, c (50.15)'],
                        ['ecc', 'e по периоду и H = r_а − r_п (50.17)'],
                        ['sma', 'a по e и отношению высот (50.18)'],
                        ['mass', 'масса по периодам и радиусам орбит (50.27)'],
                      ])}
                      {K.inv === 'axes' && (
                        <>
                          {NK('p', `p, ${Lk}`)}
                          {NK('e', 'e', 'nonneg')}
                          {NK('c', `c, ${Lk}²/с`)}
                        </>
                      )}
                      {K.inv === 'ecc' && (
                        <>
                          {NK('T', 'T, с')}
                          {NK('Hd', `H, ${Lk}`, 'nonneg')}
                        </>
                      )}
                      {K.inv === 'sma' && (
                        <>
                          {NK('R', `R планеты, ${Lk}`)}
                          {NK('e', 'e', 'nonneg')}
                          {NK('gam', 'γ = H_п : H_а', 'nonneg')}
                        </>
                      )}
                      {K.inv === 'mass' && (
                        <>
                          {NK('a1', `a₁ спутника, ${Lk}`)}
                          {NK('T1', 'T₁, с')}
                          {NK('a2', `a₂ планеты, ${Lk}`)}
                          {NK('T2', 'T₂, с')}
                        </>
                      )}
                    </div>
                  </>
                )}
                {K.kind === 'binet' && (
                  <div className="cgpar cg0">
                    <LawField
                      id="orb-k-rphi"
                      label="r(φ), φ — угол в радианах"
                      value={K.rphi}
                      vars={[]}
                      prep={(x) => x.replace(/φ|phi/gi, 't')}
                      onType={store.typeRphi}
                      onEnd={end('k:rphi')}
                    />
                    {NK('cb', `c = r²φ̇, ${Lk}²/с`, 'any')}
                    {NK('phi1', 'φ₁, °', 'any')}
                  </div>
                )}
                {K.kind === 'two' && (
                  <div className="cgpar cg0">
                    {NK('m1', 'масса m₁, кг')}
                    {NK('m2', 'масса m₂, кг')}
                    {NK('fG', 'f, м³/(кг·с²)')}
                    {NK('a', `большая полуось относительной орбиты, ${Lk}`)}
                    {NK('e', 'эксцентриситет e', 'nonneg')}
                  </div>
                )}
                {K.kind === 'flywheel' && (
                  <div className="cgpar cg0">
                    {KSEL('orbkfw', 'вопрос', 'fw', [
                      ['stop', 'работа двигателя при остановке вращения (51.9)'],
                      ['motor', 'торможение моментом M₀ − κω: время и угол (51.10–51.11)'],
                      ['turn', 'поворот корпуса: разгон и торможение маховика (51.12)'],
                    ])}
                    {NK('Jf', 'J маховика, кг·м²')}
                    {NK('J0', 'J₀ аппарата с маховиком, кг·м²')}
                    {K.fw !== 'turn' && NK('Om0', 'Ω₀, рад/с')}
                    {K.fw === 'motor' && NK('M0', 'M₀, Н·м')}
                    {K.fw === 'motor' && NK('kap', 'κ, Н·м·с')}
                    {K.fw === 'turn' && NK('Tc', 'постоянная времени T, с')}
                    {K.fw === 'turn' && NK('u0', 'u₀, рад/с²')}
                    {K.fw === 'turn' && NK('psi', 'угол поворота ψ, °')}
                  </div>
                )}
                {K.kind === 'track' && (
                  <div className="cgpar cg0">
                    {NK('R', `радиус тела R, ${Lk}`)}
                    {NK('H', `высота орбиты H, ${Lk}`, 'nonneg')}
                    {NK('alpha', 'наклонение α, °', 'nonneg')}
                    {NK('Trot', 'период вращения тела, с')}
                    {NK('turns', 'число витков')}
                  </div>
                )}
                <p className="empty">
                  {K.kind === 'point' &&
                    'Эллипс с телом в фокусе; углы отсчитываются от перицентра. Эксцентрическая аномалия E — угол на вспомогательной окружности радиуса a, средняя M = E − e·sin E = n·t.'}
                  {K.kind === 'time' &&
                    'Время идёт по движению от точки 1 к точке 2 (разность средних аномалий по модулю 2π); остаток периода — путь в обратную сторону.'}
                  {K.kind === 'mean' && 'Среднее по времени [r] = a(1 + e²/2); для сравнения — средние по углу φ и по эксцентрической аномалии E.'}
                  {K.kind === 'fall' &&
                    'Угол θ₀ отсчитывается от местного горизонта, вверх — плюс. Скорость v₀ необязательна: при v₀ > 0 проверяется, падает ли точка.'}
                  {K.kind === 'inverse' && 'Формулы эллипса и третий закон Кеплера; в 50.27 массы планеты и Солнца находятся по периодам и радиусам орбит.'}
                  {K.kind === 'binet' &&
                    'Формула в обозначениях φ (радианы) и стандартных функциях: sin, cos, exp, sqrt… Например: 7002/(1 + 0,0649 cos φ) или 2 exp(φ). Постоянная c = r²·dφ/dt — удвоенная секторная скорость.'}
                  {K.kind === 'two' &&
                    'Единицы длины — выбранные выше; массы — в килограммах, f — в системе СИ. Центр масс движется равномерно и в задаче не участвует.'}
                  {K.kind === 'flywheel' &&
                    'Ось вращения маховика совпадает с осью аппарата и проходит через центр масс; J₀ — момент инерции аппарата вместе с маховиком.'}
                  {K.kind === 'track' &&
                    'Наклонение α — от 0° (восточный) до 180° (орбита против вращения). По умолчанию период вращения — звёздные сутки (86 164 с); μ = gR² для тела радиуса R.'}
                </p>
              </>
            )}
            {s.mode === 'radial' && (
              <>
                <div className="cgpar cg0">
                  {unitSel('orbxunit', X.unit, (u) => store.setRadial('unit', u))}
                  <label className="sfield ob-wide">
                    <span>центр 1</span>
                    <select id="orbxmu" value={X.muMode} onChange={(e) => store.setRadial('muMode', e.target.value as RadialProblem['muMode'])}>
                      <option value="planet">тело радиуса R: μ₁ = gR²</option>
                      <option value="mu">μ₁ задано числом</option>
                    </select>
                  </label>
                  {X.muMode === 'mu' ? NX('mu1', `μ₁, ${Lx}³/с²`) : NX('g', 'g, м/с²')}
                  {NX('R', `R, ${Lx}`, X.muMode === 'planet' ? 'pos' : 'nonneg')}
                  {NX('acc', `доп. ускорение a, ${Lx}/с²`, 'any')}
                </div>
                <label className="toggle">
                  <input type="checkbox" id="orbxrepel" checked={X.repel} onChange={(e) => store.setRadial('repel', e.target.checked)} />
                  Отталкивание от центра 1 (заряды одного знака: μ₁ = q₁q₂/m)
                </label>
                <label className="toggle">
                  <input type="checkbox" id="orbxtwo" checked={X.two} onChange={(e) => store.setRadial('two', e.target.checked)} />
                  Второй притягивающий центр на оси (Луна)
                </label>
                {X.two && (
                  <div className="cgpar cg0">
                    {NX('k2', 'μ₂ : μ₁ (m : M)')}
                    {NX('d', `расстояние d, ${Lx}`)}
                  </div>
                )}
                <label className="toggle">
                  <input type="checkbox" id="orbxinf" checked={X.fromInf} onChange={(e) => store.setRadial('fromInf', e.target.checked)} />
                  Точка приходит из бесконечности
                </label>
                <div className="cgpar cg0">
                  {X.fromInf ? NX('vinf', `v∞, ${Lx}/с`, 'nonneg') : X.ask !== 'x0' && NX('x0', `x₀, ${Lx}`)}
                  {!X.fromInf && X.ask !== 'v0' && NX('v0', `v₀, ${Lx}/с (+ от центра)`, 'any')}
                  <label className="sfield ob-wide">
                    <span>найти</span>
                    <select id="orbxask" value={X.ask} onChange={(e) => store.setRadial('ask', e.target.value as RadialProblem['ask'])}>
                      <option value="top" disabled={X.fromInf}>
                        где точка остановится (или v∞)
                      </option>
                      <option value="at">скорость и время в точке x₁</option>
                      <option value="v0" disabled={X.fromInf}>
                        начальную скорость, чтобы дойти до x₁
                      </option>
                      <option value="x0" disabled={X.fromInf}>
                        откуда начать, чтобы остановиться в x₁
                      </option>
                    </select>
                  </label>
                  {X.ask !== 'top' && NX('x1', X.ask === 'v0' && X.two ? `x₁, ${Lx} (0 — точка равного притяжения)` : `x₁, ${Lx}`, 'nonneg')}
                </div>
                <p className="empty">
                  Ось x — от центра 1 по линии центров, скорость положительна при удалении. Постоянное добавочное ускорение — тяга или торможение двигателя
                  (задача 51.7). Расстояния — от центра, не от поверхности.
                </p>
              </>
            )}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="orbsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Тяготение и орбиты · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>{s.mode === 'radial' ? 'Движение по прямой' : s.mode === 'traj' ? 'Построение' : 'Орбита'}</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={out.doc} />
        </section>
      </article>
    </>
  );
}
