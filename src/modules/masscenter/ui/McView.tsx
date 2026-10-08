/** Экран «Центр масс и плоское движение»: система точек, сохранение положения центра масс, колесо. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderPoints, renderShift, renderWheel } from '../draw/mc';
import { solvePoints, solveShift } from '../model/system';
import { solveWheel, type WheelProblem } from '../model/wheel';
import { MC_PRESETS, type McPresetKey } from '../presets';
import { pointsDoc, shiftDoc, wheelDoc } from '../text/solution';
import type { McMode, McStore, WheelNumKey } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const MODES: [McMode, string][] = [
  ['points', 'система точек: центр масс и внешние силы'],
  ['shift', 'сохранение положения центра масс'],
  ['wheel', 'плоское движение колеса'],
];

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
    const r = solveWheel(s.wheel);
    return { fig: renderWheel(s.wheel, r), doc: wheelDoc(s.wheel, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const w = s.wheel;
  const NW = (k: WheelNumKey, label: string, neg = true) => <Num key={k} id={`mw-${k}`} label={label} value={w[k]} neg={neg} zero onType={(v) => store.typeWheel(k, v)} onEnd={end(`w:${k}`)} />;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Центр масс и плоское движение</h1>
            <p className="lede">Теоремы о движении центра масс и об изменении количества движения; смещение основания при сохранении положения центра масс; качение колеса со скольжением и без.</p>
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
            <span className="hint">{s.mode === 'points' ? 'Законы движения — формулы от t; ось y — вверх.' : s.mode === 'shift' ? 'Угол перемещения части — от оси x против часовой стрелки.' : 'Ось x — вниз по уклону; «+» момента и плеча e — в сторону качения вперёд.'}</span>
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
