/** Экран «Центр масс и плоское движение»: система точек, сохранение положения центра масс, колесо, количество движения, давление струи, работа и мощность. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderJet, renderMomentum, renderPower } from '../draw/dynamics';
import { renderPoints, renderShift, renderWheel } from '../draw/mc';
import { solveJet, solveMomentum, solvePower, type LoadSpeed, type PowerProblem, type PowerUnit, type WorkLoad } from '../model/dynamics';
import { solvePoints, solveShift } from '../model/system';
import { solveWheel, type WheelProblem } from '../model/wheel';
import { MC_PRESETS, type McPresetKey } from '../presets';
import { jetDoc, momentumDoc, powerDoc, powerUnitNames } from '../text/dynamics';
import { pointsDoc, shiftDoc, wheelDoc } from '../text/solution';
import type { LoadNumKey, McMode, McStore, WheelNumKey } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const MODES: [McMode, string][] = [
  ['points', 'система точек: центр масс и внешние силы'],
  ['shift', 'сохранение положения центра масс'],
  ['wheel', 'плоское движение колеса'],
  ['momentum', 'сохранение количества движения'],
  ['jet', 'давление струи'],
  ['power', 'работа и мощность'],
];
const HINT: Record<McMode, string> = {
  points: 'Законы движения — формулы от t; ось y — вверх.',
  shift: 'Угол перемещения части — от оси x против часовой стрелки.',
  wheel: 'Ось x — вниз по уклону; «+» момента и плеча e — в сторону качения вперёд.',
  momentum: 'Скорости — проекции на ось x (вправо); относительная скорость 0 — тела движутся вместе.',
  jet: 'Ось x — вправо, y — вверх; угол скорости — от оси x против часовой стрелки.',
  power: 'Движение равномерное; нагрузка — сила вдоль движения или вес на наклоне с трением.',
};

export function McView({ chrome, store }: { chrome: Chrome; store: McStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => {
    if (s.mode === 'points') {
      const r = solvePoints(s.points);
      return { fig: renderPoints(s.points, r), doc: pointsDoc(s.points, r, { explain: st.explain }) };
    }
    if (s.mode === 'shift') {
      const r = solveShift(s.shift);
      return { fig: renderShift(s.shift, r), doc: shiftDoc(s.shift, r, { explain: st.explain }) };
    }
    if (s.mode === 'momentum') {
      const r = solveMomentum(s.momentum);
      return { fig: renderMomentum(s.momentum, r), doc: momentumDoc(s.momentum, r, { explain: st.explain }) };
    }
    if (s.mode === 'jet') {
      const r = solveJet(s.jet);
      return { fig: renderJet(s.jet, r), doc: jetDoc(s.jet, r, { explain: st.explain }) };
    }
    if (s.mode === 'power') {
      const r = solvePower(s.power);
      return { fig: renderPower(s.power, r), doc: powerDoc(s.power, r, { explain: st.explain }) };
    }
    const r = solveWheel(s.wheel);
    return { fig: renderWheel(s.wheel, r), doc: wheelDoc(s.wheel, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const w = s.wheel;
  const NW = (k: WheelNumKey, label: string, neg = true) => <Num key={k} id={`mw-${k}`} label={label} value={w[k]} neg={neg} zero onType={(v) => store.typeWheel(k, v)} onEnd={end(`w:${k}`)} />;
  const mo = s.momentum,
    jt = s.jet,
    pw = s.power;
  const PU = powerUnitNames(pw);
  const NL = (i: number, l: WorkLoad, k: LoadNumKey, label: string, neg = true) => <Num key={k} id={`mwl-${k}${i}`} label={label} value={l[k]} neg={neg} zero onType={(v) => store.typeLoad(i, k, v)} onEnd={end(`wl:${i}:${k}`)} />;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Центр масс и плоское движение</h1>
            <p className="lede">Теоремы о движении центра масс и об изменении количества движения; смещение основания при сохранении положения центра масс; качение колеса со скольжением и без; сохранение количества движения, давление струи; работа и мощность.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="mpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as McPresetKey)}>
                <PresetOptions items={taskEntries(MC_PRESETS)} />
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
            <svg id="msvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="mmode" value={s.mode} onChange={(e) => store.setMode(e.target.value as McMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {s.mode === 'points' && (
              <>
                <label className="toggle">
                  <input type="checkbox" checked={s.points.byWeight} onChange={(e) => store.setPointsFlag('byWeight', e.target.checked)} />
                  Заданы веса (m = P/g)
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={s.points.gravity} onChange={(e) => store.setPointsFlag('gravity', e.target.checked)} />
                  Учитывать силу тяжести (вдоль −y)
                </label>
                <div className="asteps" id="mpts">
                  {s.points.pts.map((p, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="inp cv-name">
                          <input type="text" aria-label="Название" placeholder={`точка ${i + 1}`} value={p.name} onChange={(e) => store.typePt(i, 'name', e.target.value)} onBlur={end(`pt:${i}:name`)} />
                        </span>
                        <span className="hint">точка {i + 1}</span>
                        <button type="button" className="del" aria-label="Убрать точку" disabled={s.points.pts.length <= 1} onClick={() => store.removePt(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        <Num id={`mp-m${i}`} label={s.points.byWeight ? 'вес' : 'масса'} value={p.m} onType={(v) => store.typePtMass(i, v)} onEnd={end(`pt:${i}:m`)} />
                        <LawField id={`mp-x${i}`} label="x(t), м" value={p.x} onType={(v) => store.typePt(i, 'x', v)} onEnd={end(`pt:${i}:x`)} />
                        <LawField id={`mp-y${i}`} label="y(t), м" value={p.y} onType={(v) => store.typePt(i, 'y', v)} onEnd={end(`pt:${i}:y`)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="maddpt" onClick={store.addPt}>
                    + точка
                  </button>
                </div>
                <div className="cgpar cg0">
                  <Num id="mp-t" label="t, с" value={s.points.t} neg zero onType={(v) => store.typePointsNum('t', v)} onEnd={end('p:t')} />
                  <Num id="mp-t1" label="отрезок: от t₁" value={s.points.t1} neg zero onType={(v) => store.typePointsNum('t1', v)} onEnd={end('p:t1')} />
                  <Num id="mp-t2" label="до t₂" value={s.points.t2} neg zero onType={(v) => store.typePointsNum('t2', v)} onEnd={end('p:t2')} />
                  <Num id="mp-g" label="g, м/с²" value={s.points.g} onType={(v) => store.typePointsNum('g', v)} onEnd={end('p:g')} />
                </div>
                <p className="empty">Неподвижные тела — пустые формулы (координата 0). Пределы реакции считаются на отрезке t₁ &lt; t₂.</p>
              </>
            )}
            {s.mode === 'shift' && (
              <>
                <div className="cgpar cg0">
                  <Num id="ms-M0" label="масса основания" value={s.shift.M0} zero onType={store.typeShiftM0} onEnd={end('s:M0')} />
                  <label className="sfield">
                    <span>найти</span>
                    <select id="msunk" value={s.shift.unknown} onChange={(e) => store.setUnknown(+e.target.value)}>
                      <option value={-1}>смещение основания</option>
                      {s.shift.parts.map((_, i) => (
                        <option key={i} value={i}>
                          s части {i + 1} (основание стоит)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="asteps" id="msparts">
                  {s.shift.parts.map((p, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="inp cv-name">
                          <input type="text" aria-label="Название" placeholder={`часть ${i + 1}`} value={p.name} onChange={(e) => store.typePartName(i, e.target.value)} onBlur={end(`sp:${i}:name`)} />
                        </span>
                        <span className="hint">часть {i + 1}</span>
                        <button type="button" className="del" aria-label="Убрать часть" disabled={s.shift.parts.length <= 1} onClick={() => store.removePart(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        <Num id={`ms-m${i}`} label="масса (вес)" value={p.m} onType={(v) => store.typePart(i, 'm', v)} onEnd={end(`sp:${i}:m`)} />
                        {s.shift.unknown !== i && <Num id={`ms-s${i}`} label="s отн." value={p.s} neg zero onType={(v) => store.typePart(i, 's', v)} onEnd={end(`sp:${i}:s`)} />}
                        <Num id={`ms-th${i}`} label="угол θ, °" value={p.theta} neg zero onType={(v) => store.typePart(i, 'theta', v)} onEnd={end(`sp:${i}:theta`)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="maddpart" onClick={store.addPart}>
                    + часть
                  </button>
                </div>
                <p className="empty">Внешних горизонтальных сил нет, вначале всё покоилось. s — перемещение части относительно основания, θ — его направление.</p>
              </>
            )}
            {s.mode === 'wheel' && (
              <>
                <label className="toggle">
                  <input type="checkbox" checked={w.byWeight} onChange={(e) => store.setWheelByWeight(e.target.checked)} />
                  Задан вес P (m = P/g)
                </label>
                <div className="cgpar cg0">
                  {NW('m', w.byWeight ? 'вес P' : 'масса m', false)}
                  {NW('r', 'радиус r', false)}
                  <label className="sfield">
                    <span>момент инерции</span>
                    <select id="mwin" value={w.inertia} onChange={(e) => store.setWheelInertia(e.target.value as WheelProblem['inertia'])}>
                      <option value="disk">сплошной диск</option>
                      <option value="ring">масса на ободе</option>
                      <option value="rho">радиус инерции ρ</option>
                    </select>
                  </label>
                  {w.inertia === 'rho' && NW('rho', 'ρ, м', false)}
                  {NW('alpha', 'наклон α, °')}
                  {NW('f', 'трение f', false)}
                  {NW('fk', 'качение δ, м', false)}
                  {NW('g', 'g, м/с²', false)}
                </div>
                <h2>Силы</h2>
                <div className="cgpar cg0">
                  {NW('M', 'момент M')}
                  {NW('F', 'сила F в центре')}
                  {NW('T', 'сила T')}
                  {NW('beta', 'угол T, β°')}
                  {NW('e', 'плечо T, e')}
                  {NW('t', 't, с', false)}
                </div>
                <p className="empty">T — сила под углом β к оси x (вверх от опоры) с плечом e относительно оси колеса: e &gt; 0 — помогает качению (нить сверху), e &lt; 0 — мешает (снизу).</p>
              </>
            )}
            {s.mode === 'momentum' && (
              <>
                <label className="toggle">
                  <input type="checkbox" checked={mo.byWeight} onChange={(e) => store.setMomFlag(e.target.checked)} />
                  Заданы веса (m = P/g)
                </label>
                <label className="field">
                  <span>Неизвестная скорость</span>
                  <select id="mounk" value={`${mo.unknown.i}:${mo.unknown.when}`} onChange={(e) => store.setMomUnknown(+e.target.value.split(':')[0], +e.target.value.split(':')[1] as 0 | 1)}>
                    {mo.bodies.flatMap((_, i) => [
                      <option key={`${i}:0`} value={`${i}:0`}>
                        тело {i + 1} — до
                      </option>,
                      <option key={`${i}:1`} value={`${i}:1`}>
                        тело {i + 1} — после
                      </option>,
                    ])}
                  </select>
                </label>
                <div className="asteps" id="mobodies">
                  {mo.bodies.map((bd, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="inp cv-name">
                          <input type="text" aria-label="Название" placeholder={`тело ${i + 1}`} value={bd.name} onChange={(e) => store.typeBodyName(i, e.target.value)} onBlur={end(`mb:${i}:name`)} />
                        </span>
                        <span className="hint">тело {i + 1}</span>
                        <button type="button" className="del" aria-label="Убрать тело" disabled={mo.bodies.length <= 1} onClick={() => store.removeBody(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        <Num id={`mo-m${i}`} label={mo.byWeight ? 'вес' : 'масса'} value={bd.m} onType={(v) => store.typeBody(i, 'm', v)} onEnd={end(`mb:${i}:m`)} />
                        {([0, 1] as const).map((w2) => {
                          const key = w2 ? 'v1' : 'v0',
                            rk = w2 ? 'ref1' : 'ref0';
                          const unk = mo.unknown.i === i && mo.unknown.when === w2;
                          return [
                            unk ? (
                              <span key={key} className="sfield">
                                <span>{w2 ? 'после, u' : 'до, v'}</span>
                                <span className="hint">ищем</span>
                              </span>
                            ) : (
                              <Num key={key} id={`mo-${key}${i}`} label={w2 ? 'после, u' : 'до, v'} value={bd[key]} neg zero onType={(v) => store.typeBody(i, key, v)} onEnd={end(`mb:${i}:${key}`)} />
                            ),
                            <label key={rk} className="sfield">
                              <span>{w2 ? 'u' : 'v'} относительно</span>
                              <select id={`mo-${rk}${i}`} value={bd[rk]} onChange={(e) => store.setBodyRef(i, rk, +e.target.value)}>
                                <option value={-1}>абсолютная</option>
                                {mo.bodies.map((_, j) =>
                                  j === i ? null : (
                                    <option key={j} value={j}>
                                      тела {j + 1}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>,
                          ];
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="maddbody" onClick={store.addBody}>
                    + тело
                  </button>
                </div>
                <div className="cgpar cg0">
                  <Num id="mo-F" label="сила торможения F" value={mo.F} zero onType={(v) => store.typeMomNum('F', v)} onEnd={end('mo:F')} />
                  <Num id="mo-g" label="g, м/с²" value={mo.g} onType={(v) => store.typeMomNum('g', v)} onEnd={end('mo:g')} />
                </div>
                <p className="empty">Внешних сил вдоль x нет (или их импульс мал). F — постоянная сила взаимодействия двух тел: путь тела 2 по телу 1 и время торможения (0 — не считать).</p>
              </>
            )}
            {s.mode === 'jet' && (
              <>
                <label className="toggle">
                  <input type="checkbox" checked={jt.byWeight} onChange={(e) => store.setJetFlag(e.target.checked)} />
                  Задан удельный вес γ (силы в кГ)
                </label>
                <div className="cgpar cg0">
                  <Num id="mj-rho" label={jt.byWeight ? 'γ, кГ/м³' : 'ρ, кг/м³'} value={jt.rho} onType={(v) => store.typeJetNum('rho', v)} onEnd={end('j:rho')} />
                  <Num id="mj-W" label="вес сосуда" value={jt.W} zero onType={(v) => store.typeJetNum('W', v)} onEnd={end('j:W')} />
                  <Num id="mj-g" label="g, м/с²" value={jt.g} onType={(v) => store.typeJetNum('g', v)} onEnd={end('j:g')} />
                </div>
                <div className="asteps" id="mjstreams">
                  {jt.streams.map((x, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="inp cv-name">
                          <input type="text" aria-label="Название" placeholder={`сечение ${i + 1}`} value={x.name} onChange={(e) => store.typeStreamName(i, e.target.value)} onBlur={end(`js:${i}:name`)} />
                        </span>
                        <select aria-label="Вход или выход" id={`mj-out${i}`} value={x.out ? 'out' : 'in'} onChange={(e) => store.setStreamOut(i, e.target.value === 'out')}>
                          <option value="in">вход</option>
                          <option value="out">выход</option>
                        </select>
                        <button type="button" className="del" aria-label="Убрать сечение" disabled={jt.streams.length <= 1} onClick={() => store.removeStream(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        <Num id={`mj-A${i}`} label="площадь A, м²" value={x.A} zero onType={(v) => store.typeStream(i, 'A', v)} onEnd={end(`js:${i}:A`)} />
                        <Num id={`mj-v${i}`} label="скорость v, м/с" value={x.v} zero onType={(v) => store.typeStream(i, 'v', v)} onEnd={end(`js:${i}:v`)} />
                        <Num id={`mj-ang${i}`} label="угол, °" value={x.ang} neg zero onType={(v) => store.typeStream(i, 'ang', v)} onEnd={end(`js:${i}:ang`)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="maddstream" onClick={store.addStream}>
                    + сечение
                  </button>
                </div>
                <p className="empty">Расход ṁ = ρAv; у одного сечения площадь 0 — расход по неразрывности. Вес сосуда с жидкостью (0 — не считать) — для давления на опоры.</p>
              </>
            )}
            {s.mode === 'power' && (
              <>
                <div className="cgpar cg0">
                  <label className="sfield">
                    <span>единицы</span>
                    <select id="mwunits" value={pw.units} onChange={(e) => store.setPower('units', e.target.value as PowerProblem['units'])}>
                      <option value="tech">техн. (кГ)</option>
                      <option value="si">СИ (Н)</option>
                    </select>
                  </label>
                  <label className="sfield">
                    <span>найти</span>
                    <select id="mwunk" value={String(pw.unknown)} onChange={(e) => store.setPower('unknown', e.target.value === 'N' || e.target.value === 't' ? e.target.value : +e.target.value)}>
                      <option value="N">N и работу</option>
                      <option value="t">время t</option>
                      {pw.loads.map((l, i) => (
                        <option key={i} value={i}>
                          {l.kind === 'weight' ? 'P' : 'F'} нагрузки {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Num id="mw-eta" label="КПД η" value={pw.eta} onType={(v) => store.typePowerNum('eta', v)} onEnd={end('w:eta')} />
                  {pw.unknown !== 't' && <Num id="mw-t" label="время t, с" value={pw.t} zero onType={(v) => store.typePowerNum('t', v)} onEnd={end('w:t')} />}
                  {pw.unknown !== 'N' && <Num id="mw-N" label="мощность N" value={pw.N} onType={(v) => store.typePowerNum('N', v)} onEnd={end('w:N')} />}
                  {pw.unknown !== 'N' && (
                    <label className="sfield">
                      <span>единица N</span>
                      <select id="mwNunit" value={pw.Nunit} onChange={(e) => store.setPower('Nunit', e.target.value as PowerUnit)}>
                        <option value="hp">л. с.</option>
                        <option value="kW">кВт</option>
                        <option value="base">{PU.N}</option>
                      </select>
                    </label>
                  )}
                  <Num id="mw-g" label="g, м/с²" value={pw.g} onType={(v) => store.typePowerNum('g', v)} onEnd={end('w:g')} />
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={pw.driving} onChange={(e) => store.setPower('driving', e.target.checked)} />
                  Заданы движущие силы (ищем полезную мощность ηN)
                </label>
                <div className="asteps" id="mwloads">
                  {pw.loads.map((l, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="inp cv-name">
                          <input type="text" aria-label="Название" placeholder={`нагрузка ${i + 1}`} value={l.name} onChange={(e) => store.typeLoadName(i, e.target.value)} onBlur={end(`wl:${i}:name`)} />
                        </span>
                        <select aria-label="Вид нагрузки" id={`mwl-kind${i}`} value={l.kind} onChange={(e) => store.setLoad(i, 'kind', e.target.value as WorkLoad['kind'])}>
                          <option value="force">сила F</option>
                          <option value="weight">вес P на наклоне</option>
                        </select>
                        <button type="button" className="del" aria-label="Убрать нагрузку" disabled={pw.loads.length <= 1} onClick={() => store.removeLoad(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {pw.unknown !== i && NL(i, l, 'F', l.kind === 'weight' ? `вес P, ${PU.F}` : `сила F, ${PU.F}`)}
                        {l.kind === 'weight' && NL(i, l, 'alpha', 'наклон α, °')}
                        {l.kind === 'weight' && NL(i, l, 'f', 'трение f', false)}
                        <label className="sfield">
                          <span>скорость</span>
                          <select id={`mwl-speed${i}`} value={l.speed} onChange={(e) => store.setLoad(i, 'speed', e.target.value as LoadSpeed)}>
                            <option value="v">задана v</option>
                            <option value="path">k раз путь s за t</option>
                            <option value="rot">шкив d, n об/мин</option>
                          </select>
                        </label>
                        {l.speed === 'v' && NL(i, l, 'v', 'v, м/с')}
                        {l.speed === 'path' && NL(i, l, 's', 'путь s, м')}
                        {l.speed === 'path' && NL(i, l, 'k', 'раз k', false)}
                        {l.speed === 'rot' && NL(i, l, 'd', 'диаметр d, м', false)}
                        {l.speed === 'rot' && NL(i, l, 'n', 'n, об/мин')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="maddload" onClick={store.addLoad}>
                    + нагрузка
                  </button>
                </div>
                <p className="empty">Вес на наклоне α с трением f требует силы P(sin α + f cos α): α = 90° — подъём, α = 0 — трение fP. Работа путевой нагрузки — k·F·s и без времени.</p>
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
            <div id="msolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Центр масс и плоское движение · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>Схема</figcaption>
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
