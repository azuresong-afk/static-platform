/**
 * Экран «Динамика точки»: прямолинейное движение (вторая задача), силы по заданному движению (первая задача),
 * криволинейное движение в плоскости, движение по окружности (реакция связи, отрыв), относительное движение в трубке
 * подвижного тела (давление на стенку), движение вблизи вращающейся Земли, равновесие при вращении, поверхности и кривые,
 * составные задачи, теорема об импульсе; графики, траектория или схема, решение по шагам.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderEq } from '../../rotation/draw/rotation';
import { renderCircle } from '../draw/circle';
import { renderEarthDyn } from '../draw/earth';
import { renderFirst, renderPlane } from '../draw/extra';
import { renderRel } from '../draw/rel';
import { renderImpulse, renderSpin, renderStages, renderSurf } from '../draw/constrained';
import { solveSpin } from '../model/spin';
import { solveSurf } from '../model/surf';
import { solveStages } from '../model/stages';
import { solveImpulse } from '../model/impulse';
import { spinDoc } from '../text/spin';
import { surfDoc } from '../text/surf';
import { stagesDoc } from '../text/stages';
import { impulseDoc } from '../text/impulse';
import { ImpulsePanel, SpinPanel, StagesPanel, SurfPanel } from './SubPanels';
import { solveCircle, type CircleProblem } from '../model/circle';
import { solveEarthDyn, type EarthDyn } from '../model/earth';
import { solveFirst, type FirstProblem } from '../model/first';
import { solvePlane, type PlaneProblem } from '../model/plane';
import { solvePoint, type PointProblem } from '../model/point';
import { solveRel, type RelProblem } from '../model/rel';
import { CIRCLE_PRESETS, EARTH_PRESETS, FIRST_PRESETS, IMPULSE_PRESETS, PLANE_PRESETS, POINT_PRESETS, REL_PRESETS, SPIN_PRESETS, STAGE_PRESETS, SURF_PRESETS } from '../presets';
import { circleDoc } from '../text/circle';
import { earthDoc } from '../text/earth';
import { firstDoc, planeDoc } from '../text/extra';
import { relDoc } from '../text/rel';
import { pointDoc } from '../text/solution';
import type { AnyPresetKey, CircleNumKey, EarthNumKey, FirstNumKey, PlaneNumKey, PointMode, PointNumKey, PointStore, RelNumKey } from './store';
import { taskInfo } from '../../../shared/tasks';
import { ExtraScreen, type ExtraHost } from '../../../shared/ui/ExtraScreen';
import { POINT_EXTRA_ASKS } from '../model/extra';
import { POINT_EXTRA_PRESETS } from '../extraPresets';

const LABELS = { w: ['v', 'м/с'] as [string, string], phi: ['x', 'м'] as [string, string], note: 'Скорость и координата точки по времени; точка — искомое состояние (наведите, чтобы увидеть значения).' };
const FORCES: [PointNumKey, string, boolean][] = [
  ['F0', 'сила F₀', true],
  ['at', 'a в силе a·t', true],
  ['F1', 'F₁ в F₁ sin pt', true],
  ['p', 'p в F₁ sin pt', true],
  ['c', 'c в −cx', false],
  ['kv', 'k₁ в −k₁v', false],
  ['kq', 'k₂ в −k₂v|v|', false],
];
const MODES: [PointMode, string][] = [
  ['line', 'прямолинейное движение'],
  ['first', 'сила по закону движения'],
  ['plane', 'движение в плоскости'],
  ['circle', 'движение по окружности'],
  ['rel', 'относительное движение в трубке'],
  ['earth', 'движение вблизи вращающейся Земли'],
  ['spin', 'равновесие при вращении (вираж, конический маятник)'],
  ['surf', 'движение по поверхности и кривой'],
  ['stages', 'составные задачи (несколько этапов)'],
  ['impulse', 'теорема об импульсе, закон площадей'],
];

export function PointView({ chrome, store }: { chrome: Chrome; store: PointStore }) {
  const view = useSyncExternalStore(store.subscribe, () => store.get().view);
  if (view === 'extra') {
    const host: ExtraHost = {
      get: store.get,
      subscribe: store.subscribe,
      setXAsk: store.setXAsk,
      typeNum: store.typeXNum,
      typeText: store.typeXText,
      pick: store.pick,
      endSession: store.endSession,
      undo: store.undo,
      redo: store.redo,
      loadPreset: (k) => store.loadPreset(k as AnyPresetKey),
      setView: store.setView,
      closeNotice: store.closeNotice,
      setExplain: store.setExplain,
    };
    return (
      <ExtraScreen
        chrome={chrome}
        host={host}
        asks={POINT_EXTRA_ASKS}
        presets={POINT_EXTRA_PRESETS}
        prefix="p"
        heading="Динамика точки: сила по пути, несколько центров, баллистика"
        lede="Сила по зависимости пути от скорости, притяжение к нескольким (в том числе движущимся) центрам и постоянная сила, баллистика с табличным законом сопротивления, установившееся движение по наклонной плоскости."
        mainLabel="движение точки: все режимы"
        tabName="Динамика точки"
      />
    );
  }
  return <PointMain chrome={chrome} store={store} />;
}

function PointMain({ chrome, store }: { chrome: Chrome; store: PointStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const task = st.problem;
  const out = useMemo(() => {
    if (task.mode === 'spin') {
      const r = solveSpin(task.spin);
      return { fig: renderSpin(task.spin, r), doc: spinDoc(task.spin, r, { explain: st.explain }) };
    }
    if (task.mode === 'surf') {
      const r = solveSurf(task.surf);
      return { fig: renderSurf(task.surf, r), doc: surfDoc(task.surf, r, { explain: st.explain }) };
    }
    if (task.mode === 'stages') {
      const r = solveStages(task.stages);
      return { fig: renderStages(task.stages, r), doc: stagesDoc(task.stages, r, { explain: st.explain }) };
    }
    if (task.mode === 'impulse') {
      const r = solveImpulse(task.impulse);
      return { fig: renderImpulse(task.impulse, r), doc: impulseDoc(task.impulse, r, { explain: st.explain }) };
    }
    if (task.mode === 'first') {
      const r = solveFirst(task.first);
      return { fig: renderFirst(task.first, r), doc: firstDoc(task.first, r, { explain: st.explain }) };
    }
    if (task.mode === 'rel') {
      const r = solveRel(task.rel);
      return { fig: renderRel(task.rel, r), doc: relDoc(task.rel, r, { explain: st.explain }) };
    }
    if (task.mode === 'earth') {
      const r = solveEarthDyn(task.earth);
      return { fig: renderEarthDyn(task.earth, r), doc: earthDoc(task.earth, r, { explain: st.explain }) };
    }
    if (task.mode === 'circle') {
      const r = solveCircle(task.circle);
      return { fig: renderCircle(task.circle, r), doc: circleDoc(task.circle, r, { explain: st.explain }) };
    }
    if (task.mode === 'plane') {
      const r = solvePlane(task.plane);
      return { fig: renderPlane(task.plane, r), doc: planeDoc(task.plane, r, { explain: st.explain }) };
    }
    const r = solvePoint(task.line);
    return { fig: renderEq(r.eq, LABELS), doc: pointDoc(task.line, r, { explain: st.explain }) };
  }, [task, st.explain]);
  const pr: PointProblem = task.line,
    fp: FirstProblem = task.first,
    pp: PlaneProblem = task.plane,
    cp: CircleProblem = task.circle,
    rp: RelProblem = task.rel,
    ep: EarthDyn = task.earth;
  const N = (k: PointNumKey, label: string, neg = true) => <Num key={k} id={`p-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;
  const NF = (k: FirstNumKey, label: string, neg = true) => <Num key={k} id={`pf-${k}`} label={label} value={fp[k]} neg={neg} zero onType={(v) => store.typeFirst(k, v)} onEnd={() => store.endSession(`f:${k}`)} />;
  const NP = (k: PlaneNumKey, label: string, neg = true) => <Num key={k} id={`pp-${k}`} label={label} value={pp[k]} neg={neg} zero onType={(v) => store.typePlane(k, v)} onEnd={() => store.endSession(`q:${k}`)} />;
  const NC = (k: CircleNumKey, label: string, neg = true) => <Num key={k} id={`pc-${k}`} label={label} value={cp[k]} neg={neg} zero onType={(v) => store.typeCircle(k, v)} onEnd={() => store.endSession(`o:${k}`)} />;
  const NR = (k: RelNumKey, label: string, neg = true) => <Num key={k} id={`pr-${k}`} label={label} value={rp[k]} neg={neg} zero onType={(v) => store.typeRel(k, v)} onEnd={() => store.endSession(`r:${k}`)} />;
  const NE = (k: EarthNumKey, label: string, neg = true) => <Num key={k} id={`pe-${k}`} label={label} value={ep[k]} neg={neg} zero onType={(v) => store.typeEarth(k, v)} onEnd={() => store.endSession(`e:${k}`)} />;
  const byWeight = task[task.mode].byWeight;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Динамика точки</h1>
            <p className="lede">Обе основные задачи динамики точки: по силам — движение (по прямой и в плоскости, с сопротивлением среды и трением), по закону движения — сила; движение по окружности — натяжение нити, давление на связь, отрыв; относительное движение в трубке вращающегося или движущегося тела — закон движения и давление на стенку; влияние вращения Земли — отклонение падающей точки, давление поезда на рельс, маятник Фуко, g по широте; равновесие при вращении (вираж, конический маятник, регулятор, тахометр), движение по поверхностям и кривым, составные задачи, теорема об импульсе.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="ppreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as AnyPresetKey)}>
                {(
                  [
                    ['Мещерский, § 26. Определение сил по заданному движению', FIRST_PRESETS],
                    ['Мещерский, § 27 а) Прямолинейное движение', POINT_PRESETS],
                    ['Мещерский, § 27 б) Криволинейное движение', PLANE_PRESETS],
                    ['Движение по окружности: Мещерский § 26, 31; Яблонский Д.6', CIRCLE_PRESETS],
                    ['Относительное движение: Мещерский § 33; Яблонский Д.4', REL_PRESETS],
                    ['Вращение Земли: Мещерский § 23, 33', EARTH_PRESETS],
                    ['Равновесие при вращении: Мещерский § 26, 31, 41', SPIN_PRESETS],
                    ['Поверхности и кривые: Мещерский § 31', SURF_PRESETS],
                    ['Составные задачи: Мещерский § 31', STAGE_PRESETS],
                    ['Теорема об импульсе: Мещерский § 28', IMPULSE_PRESETS],
                    ['Сила по пути, несколько центров, баллистика: Мещерский § 27', POINT_EXTRA_PRESETS],
                  ] as [string, Record<string, { title: string }>][]
                ).map(([label, rec]) => (
                  <optgroup key={label} label={label}>
                    {Object.entries(rec)
                      .map(([k, p]) => [k, p, taskInfo(p.title)] as const)
                      .sort((x, y) => x[2].order[0] - y[2].order[0] || x[2].order[1] - y[2].order[1])
                      .map(([k, , info]) => (
                        <option key={k} value={k}>
                          {info.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Графики">
          <div className="bar">
            <span className="hint">{task.mode === 'line' ? 'Силы «+» — в сторону оси x. Сила трения и сопротивление направлены против скорости.' : task.mode === 'first' ? 'Закон движения — формулы от t: sin, cos, tg, exp, ln, sqrt, sh, ch, π; десятичная запятая.' : task.mode === 'circle' ? 'φ — от нижней точки окружности против часовой стрелки; v₀ «+» — в сторону роста φ.' : task.mode === 'rel' ? 'Ось x — вдоль трубки от точки O; θ — угол трубки с горизонталью; ω > 0 — против часовой стрелки.' : task.mode === 'earth' ? 'Оси места: x — на восток, y — на север, z — вверх; курс — от севера по часовой стрелке.' : task.mode === 'spin' ? 'Относительный покой при равномерном вращении: к силам добавлена центробежная сила инерции.' : task.mode === 'surf' ? 'Несвободная точка: реакция — из проекции на нормаль, закон движения — из касательной проекции.' : task.mode === 'stages' ? 'Конец одного этапа — начало следующего.' : task.mode === 'impulse' ? 'm·v₁ − m·v₀ = S — импульс равнодействующей; для центральной силы r²φ̇ = const.' : 'Ось y — вверх; угол начальной скорости — от оси x против часовой стрелки.'}</span>
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
            <svg id="psvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Графики и траектория" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <div className="segbtns">
              <button type="button" id="pto-extra" onClick={() => store.setView('extra')}>
                Сила по пути, несколько центров, баллистика →
              </button>
            </div>
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="pmode" value={task.mode} onChange={(e) => store.setMode(e.target.value as PointMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" id="pweight" checked={byWeight} onChange={(e) => store.setByWeight(e.target.checked)} />
              Задан вес P (m = P/g)
            </label>
            {task.mode === 'line' && (
              <>
                <div className="cgpar cg0">
                  {N('m', pr.byWeight ? 'вес P' : 'масса m', false)}
                  {N('alpha', 'наклон α, °', false)}
                  <label className="sfield">
                    <span>ось x</span>
                    <select id="pdir" value={pr.up ? 'up' : 'down'} onChange={(e) => store.setUp(e.target.value === 'up')}>
                      <option value="down">вниз</option>
                      <option value="up">вверх</option>
                    </select>
                  </label>
                  {N('f', 'трение f', false)}
                </div>
                <h2>Силы</h2>
                <div className="cgpar cg0">
                  {FORCES.map(([k, label, neg]) => N(k, label, neg))}
                  <LawField id="p-form" label={`ещё сила F(t, x, v), ${pr.byWeight ? 'кГ' : 'Н'}`} vars={['x', 'v']} value={pr.form ?? ''} onType={store.typeForm} onEnd={() => store.endSession('n:form')} />
                </div>
                <h2>Начальные условия и вопрос</h2>
                <div className="cgpar cg0">
                  {N('x0', 'x₀, м')}
                  {N('v0', 'v₀, м/с')}
                  <label className="sfield">
                    <span>найти</span>
                    <select id="pask" value={pr.ask} onChange={(e) => store.setAsk(e.target.value as PointProblem['ask'])}>
                      <option value="t">в момент t</option>
                      <option value="v">когда v =</option>
                      <option value="x">когда x =</option>
                    </select>
                  </label>
                  {pr.ask === 't' ? N('t', 't, с', false) : pr.ask === 'v' ? N('v1', 'v, м/с') : N('x1', 'x, м')}
                </div>
                <p className="empty">α = 0 — горизонталь, 90° — вертикаль. Нормальная реакция N = P cos α. Предельная скорость считается, если силы зависят только от скорости. В формуле силы: t — время, x — координата, v — скорость (со знаком), например −2v^2/(3 + x) или −3sqrt(v).</p>
              </>
            )}
            {task.mode === 'first' && (
              <>
                <div className="cgpar cg0">
                  <LawField id="pf-x" label="x(t), м" value={fp.x} onType={(s) => store.typeLaw('x', s)} onEnd={() => store.endSession('f:x')} />
                  <LawField id="pf-y" label="y(t), м" value={fp.y} onType={(s) => store.typeLaw('y', s)} onEnd={() => store.endSession('f:y')} />
                  <LawField id="pf-z" label="z(t), м" value={fp.z} onType={(s) => store.typeLaw('z', s)} onEnd={() => store.endSession('f:z')} />
                  {NF('m', fp.byWeight ? 'вес P' : 'масса m', false)}
                  {NF('g', 'g, м/с²', false)}
                  <label className="sfield">
                    <span>сила тяжести</span>
                    <select id="pfgrav" value={fp.gravity} onChange={(e) => store.setGravityDir(e.target.value as FirstProblem['gravity'])}>
                      <option value="none">нет</option>
                      <option value="-y">−y</option>
                      <option value="+y">+y</option>
                      <option value="-z">−z</option>
                      <option value="+x">+x</option>
                      <option value="-x">−x</option>
                    </select>
                  </label>
                  {NF('t', 't, с')}
                  {NF('t1', 'Fmax: от t₁')}
                  {NF('t2', 'до t₂')}
                </div>
                <p className="empty">Искомая сила F = m·a − m·g (сила тяжести вычитается, если учтена). Для наибольшей силы задайте отрезок t₁ &lt; t₂.</p>
              </>
            )}
            {task.mode === 'plane' && (
              <>
                <div className="cgpar cg0">
                  {NP('m', pp.byWeight ? 'вес P' : 'масса m', false)}
                  {NP('g', 'g, м/с²', false)}
                  <label className="sfield">
                    <span>сила тяжести</span>
                    <select id="ppgrav" value={pp.gravity ? 'on' : 'off'} onChange={(e) => store.setPlaneGravity(e.target.value === 'on')}>
                      <option value="on">вдоль −y</option>
                      <option value="off">нет</option>
                    </select>
                  </label>
                </div>
                <h2>Силы</h2>
                <div className="cgpar cg0">
                  {NP('Fx', 'F_x постоянная')}
                  {NP('Fy', 'F_y постоянная')}
                  {NP('kv', 'k₁ в −k₁v', false)}
                  {NP('kq', 'k₂ в −k₂|v|v', false)}
                  {NP('c', 'c к центру (−c·r)')}
                  {NP('cx', 'центр: x')}
                  {NP('cy', 'центр: y')}
                  {NP('q', 'q в q(ẏ; −ẋ)')}
                  <LawField id="pp-formX" label="ещё F_x(t, x, y, vx, vy, v)" vars={['x', 'y', 'vx', 'vy', 'v']} value={pp.formX ?? ''} onType={(s) => store.typePlaneForm('formX', s)} onEnd={() => store.endSession('q:formX')} />
                  <LawField id="pp-formY" label="ещё F_y(t, x, y, vx, vy, v)" vars={['x', 'y', 'vx', 'vy', 'v']} value={pp.formY ?? ''} onType={(s) => store.typePlaneForm('formY', s)} onEnd={() => store.endSession('q:formY')} />
                </div>
                <h2>Начальные условия и вопрос</h2>
                <div className="cgpar cg0">
                  {NP('x0', 'x₀, м')}
                  {NP('y0', 'y₀, м')}
                  {NP('v0', 'v₀, м/с', false)}
                  {NP('ang', 'угол α, °')}
                  <label className="sfield">
                    <span>найти</span>
                    <select id="ppask" value={pp.ask} onChange={(e) => store.setPlaneAsk(e.target.value as PlaneProblem['ask'])}>
                      <option value="land">падение до y =</option>
                      <option value="apex">высшую точку</option>
                      <option value="x">когда x =</option>
                      <option value="t">в момент t</option>
                    </select>
                  </label>
                  {pp.ask === 'land' ? NP('y1', 'уровень y, м') : pp.ask === 'x' ? NP('x1', 'x, м') : pp.ask === 't' ? NP('t', 't, с', false) : null}
                </div>
                <p className="empty">c &gt; 0 — притяжение к центру, c &lt; 0 — отталкивание; q — сила, перпендикулярная скорости (магнитное поле). В формулах: vx = ẋ, vy = ẏ, v — модуль скорости.</p>
              </>
            )}
            {task.mode === 'circle' && (
              <>
                <label className="field">
                  <span>Связь</span>
                  <select id="pclink" value={cp.link} onChange={(e) => store.setCircleLink(e.target.value as CircleProblem['link'])}>
                    <option value="thread">нить</option>
                    <option value="inner">внутренняя поверхность (петля, желоб)</option>
                    <option value="outer">внешняя поверхность (купол, выпуклый мост)</option>
                    <option value="rod">двусторонняя: стержень, трубка, колечко</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {NC('m', cp.byWeight ? 'вес P' : 'масса m', false)}
                  {NC('g', 'g, м/с²', false)}
                  {NC('R', 'радиус R, м', false)}
                </div>
                <h2>Начальные условия и вопрос</h2>
                <label className="field">
                  <span>Найти</span>
                  <select id="pcask" value={cp.ask} onChange={(e) => store.setCircleAsk(e.target.value as CircleProblem['ask'])}>
                    <option value="at">скорость и реакцию в положении φ₁</option>
                    <option value="detach">где точка остановится или сойдёт со связи (N = 0)</option>
                    <option value="full">наименьшую v₀ для полного оборота</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {NC('phi0', 'φ₀, °')}
                  {NC('v0', 'v₀, м/с')}
                  {cp.ask === 'at' ? NC('phi1', 'φ₁, °') : null}
                </div>
                <label className="toggle">
                  <input type="checkbox" id="pcspring" checked={cp.spring} onChange={(e) => store.setCircleSpring(e.target.checked)} />
                  Пружина (упругая нить) от неподвижной точки A
                </label>
                {cp.spring && (
                  <div className="cgpar cg0">
                    {NC('ax', 'A: x от центра, м')}
                    {NC('ay', 'A: y от центра, м')}
                    {NC('c', `жёсткость c, ${cp.byWeight ? 'кГ' : 'Н'}/м`, false)}
                    {NC('L0', 'длина без натяжения L₀, м', false)}
                  </div>
                )}
                <p className="empty">φ = 0 — нижняя точка, 90° — справа на уровне центра, 180° — верхняя. N — проекция реакции на направление к центру: у нити это натяжение, у внутренней поверхности — давление; у внешней поверхности давление равно −N. При v₀ = 0 в положении неустойчивого равновесия (вершина купола, стержень вверху) движение начинается от ничтожно малого толчка.</p>
              </>
            )}
            {task.mode === 'spin' && <SpinPanel store={store} p={task.spin} />}
            {task.mode === 'surf' && <SurfPanel store={store} p={task.surf} />}
            {task.mode === 'stages' && <StagesPanel store={store} p={task.stages} />}
            {task.mode === 'impulse' && <ImpulsePanel store={store} p={task.impulse} />}
            {task.mode === 'earth' && (
              <>
                <label className="field">
                  <span>Найти</span>
                  <select id="peask" value={ep.ask} onChange={(e) => store.setEarthAsk(e.target.value as EarthDyn['ask'])}>
                    <option value="fall">падение (полёт) с высоты — отклонение</option>
                    <option value="line">движение по горизонтали — давление на рельс, отклонение, перекос воды</option>
                    <option value="pend">маятник Фуко — поворот плоскости качаний</option>
                    <option value="g">ускорение силы тяжести по широте</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {NE('m', ep.byWeight ? 'вес P' : 'масса m', false)}
                  {NE('g', ep.ask === 'g' ? 'g₀ на полюсе, м/с²' : 'g, м/с²', false)}
                  {NE('lat', 'широта φ, °')}
                  {NE('omega', 'ω Земли, рад/с')}
                  {ep.ask === 'g' && NE('R', 'радиус Земли R, м', false)}
                </div>
                {ep.ask === 'fall' && (
                  <div className="cgpar cg0">
                    {NE('h', 'высота h, м', false)}
                    {NE('vE', 'v₀ на восток, м/с')}
                    {NE('vN', 'v₀ на север, м/с')}
                    {NE('vh', 'v₀ вверх, м/с')}
                  </div>
                )}
                {ep.ask === 'line' && (
                  <div className="cgpar cg0">
                    {NE('v', 'скорость v, м/с', false)}
                    {NE('k', 'курс k, ° (от севера к востоку)')}
                    {NE('L', 'путь L, м (для отклонения)', false)}
                    {NE('b', 'ширина b, м (перекос воды)', false)}
                  </div>
                )}
                {ep.ask === 'pend' && <div className="cgpar cg0">{NE('psi', 'поворот плоскости ψ, °')}</div>}
                <p className="empty">ω = 2π/86 400 = 7,272·10⁻⁵ рад/с (сутки) — с этим значением решены задачи книги; по звёздным суткам — 7,292·10⁻⁵. g — ускорение силы тяжести на месте (по отвесу, вместе с центробежной силой); в вопросе «g по широте» — ускорение притяжения на полюсе. Падение интегрируется численно без сопротивления воздуха; L = 0 и b = 0 — не считать отклонение и перекос.</p>
              </>
            )}
            {task.mode === 'rel' && (
              <>
                <label className="field">
                  <span>Переносное движение тела (равномерное вращение или поступательное)</span>
                  <select id="prframe" value={rp.frame} onChange={(e) => store.setRelFrame(e.target.value as RelProblem['frame'])}>
                    <option value="vert">вращение вокруг вертикальной оси</option>
                    <option value="horz">вращение вокруг горизонтальной оси</option>
                    <option value="trans">поступательное движение по закону</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {NR('m', rp.byWeight ? 'вес P' : 'масса m', false)}
                  {NR('g', 'g, м/с²', false)}
                  {NR('theta', rp.frame === 'horz' ? 'θ₀, °' : 'θ, °')}
                  {rp.frame !== 'trans' && NR('omega', 'ω, рад/с')}
                  {rp.frame === 'vert' && NR('r', 'r, м')}
                  {rp.frame === 'vert' && NR('d', 'd, м')}
                  {rp.frame === 'horz' && NR('h', 'h, м')}
                  {rp.frame === 'trans' && <LawField id="pr-y1" label="y₁(t), м — вправо" value={rp.y1} onType={(s) => store.typeRelLaw('y1', s)} onEnd={() => store.endSession('r:y1')} />}
                  {rp.frame === 'trans' && <LawField id="pr-z1" label="z₁(t), м — вверх" value={rp.z1} onType={(s) => store.typeRelLaw('z1', s)} onEnd={() => store.endSession('r:z1')} />}
                </div>
                <h2>Пружина, трение, сила</h2>
                <div className="cgpar cg0">
                  {NR('c', `c, ${rp.byWeight ? 'кГ' : 'Н'}/м`, false)}
                  {NR('l0', 'l₀, м')}
                  {NR('f', 'трение f', false)}
                  <LawField id="pr-form" label={`ещё сила F(t, x, v), ${rp.byWeight ? 'кГ' : 'Н'}`} vars={['x', 'v']} value={rp.form ?? ''} onType={(s) => store.typeRelLaw('form', s)} onEnd={() => store.endSession('r:form')} />
                </div>
                <h2>Начальные условия и вопрос</h2>
                <label className="field">
                  <span>Найти</span>
                  <select id="prask" value={rp.ask} onChange={(e) => store.setRelAsk(e.target.value as RelProblem['ask'])}>
                    <option value="t">положение и давление в момент t₁</option>
                    <option value="x">когда x = x₁ (вылет из трубки)</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {NR('x0', 'x₀, м')}
                  {NR('v0', 'ẋ₀, м/с')}
                  {rp.ask === 't' ? NR('t1', 't₁, с', false) : NR('x1', 'x₁, м')}
                </div>
                <p className="empty">θ — угол оси x с горизонталью (вправо), против часовой стрелки: 0 — горизонтальная трубка, 90° — вертикальная, вверх. Вертикальная ось: O — на расстоянии r от оси (вправо «+»), d — смещение плоскости трубки от оси (за чертёж «+»), ω &gt; 0 — против часовой стрелки при взгляде сверху. Горизонтальная ось перпендикулярна чертежу: h — расстояние от оси до трубки, x — от основания перпендикуляра. Пружина −c(x − l₀) закреплена в точке O; трение f — о стенку трубки.</p>
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
            <div id="psolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Динамика точки · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>{task.mode === 'plane' ? 'Траектория' : task.mode === 'circle' ? 'Схема и реакция связи N(φ)' : task.mode === 'rel' ? 'Схема и графики x(t), N(t)' : task.mode === 'earth' || task.mode === 'spin' || task.mode === 'surf' || task.mode === 'stages' || task.mode === 'impulse' ? 'Схема' : 'Графики'}</figcaption>
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
