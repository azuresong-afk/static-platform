/** Экран «Реакции при плоском движении»: тело, точки, связи, нагрузки и скорости; решение и чертёж. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderBody } from '../draw/body';
import { solveBody, type BodyProblem, type ConstrKind, type Shape } from '../model/body';
import { BODY_PRESETS, type BodyPresetKey } from '../presets';
import { bodyDoc } from '../text/solution';
import type { BodyNumKey, BodyStore } from './store';

const SHAPES: [Shape, string][] = [
  ['rod', 'однородный стержень'],
  ['disk', 'сплошной диск (цилиндр)'],
  ['ring', 'кольцо (масса на ободе)'],
  ['rect', 'прямоугольная пластина'],
  ['rho', 'радиус инерции ρ'],
  ['J', 'момент инерции J_C'],
];
const KINDS: [ConstrKind, string][] = [
  ['pin', 'шарнир'],
  ['roller', 'опора (ролик)'],
  ['rope', 'нить к точке'],
  ['unwind', 'нить сходит с тела'],
  ['roll', 'качение без скольжения'],
];

export function BodyView({ chrome, store }: { chrome: Chrome; store: BodyStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => {
    const r = solveBody(s);
    return { fig: renderBody(s, r), doc: bodyDoc(s, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const N = (k: BodyNumKey, label: string, neg = true) => (
    <Num key={k} id={`pb-${k}`} label={label} value={s[k]} neg={neg} zero={neg} onType={(v) => store.typeNum(k, v)} onEnd={end(`n:${k}`)} />
  );
  const given = s.mode === 'given';

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Реакции при плоском движении</h1>
            <p className="lede">
              Тело со связями в данный момент: ускорение центра масс, угловое ускорение и реакции из уравнений плоского движения; отрыв от опоры и ослабление
              нити; силы инерции и метод кинетостатики.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="pbpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as BodyPresetKey)}>
                <PresetOptions items={taskEntries(BODY_PRESETS)} />
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
            <span className="hint">Координаты — от центра масс C, ось y вверх; углы — от оси x против часовой стрелки.</span>
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
            <svg id="pbsvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="pbmode" value={s.mode} onChange={(e) => store.setMode(e.target.value as BodyProblem['mode'])}>
                <option value="dyn">по силам: a_C, ε и реакции</option>
                <option value="given">движение задано: кинетостатика</option>
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={s.byWeight} onChange={(e) => store.setFlag('byWeight', e.target.checked)} />
              Задан вес P (m = P/g)
            </label>
            <label className="toggle">
              <input type="checkbox" checked={s.gravity} onChange={(e) => store.setFlag('gravity', e.target.checked)} />
              Учитывать силу тяжести (вдоль −y)
            </label>
            <div className="cgpar cg0">
              {N('m', s.byWeight ? 'вес P' : 'масса m', false)}
              <label className="sfield">
                <span>тело</span>
                <select id="pbshape" value={s.shape} onChange={(e) => store.setShape(e.target.value as Shape)}>
                  {SHAPES.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {s.shape === 'rod' && (
                <>
                  {N('L', 'длина L, м', false)}
                  {N('theta', 'угол оси AB, °')}
                </>
              )}
              {(s.shape === 'disk' || s.shape === 'ring') && N('R', 'радиус R, м', false)}
              {s.shape === 'rect' && (
                <>
                  {N('a', 'ширина a, м', false)}
                  {N('b', 'высота b, м', false)}
                </>
              )}
              {s.shape === 'rho' && N('rho', 'ρ, м', false)}
              {s.shape === 'J' && N('J', 'J_C', false)}
              {N('g', 'g, м/с²', false)}
            </div>
            <h2>Движение в данный момент</h2>
            <div className="cgpar cg0">
              {N('omega', 'ω, рад/с')}
              {N('vx', 'v_Cx, м/с')}
              {N('vy', 'v_Cy, м/с')}
              {given && (
                <>
                  {N('ax', 'a_Cx, м/с²')}
                  {N('ay', 'a_Cy, м/с²')}
                  {N('eps', 'ε, рад/с²')}
                </>
              )}
            </div>
            <h2>Точки тела</h2>
            <p className="empty">
              {s.shape === 'rod' ? 'C — центр масс; концы стержня A и B заданы длиной и углом. ' : 'C — центр масс. '}Координаты точек — от C, м.
            </p>
            <div className="asteps" id="pbpoints">
              {s.points.map((p, i) => (
                <div key={i}>
                  <div className="cvrow cvrow2">
                    <span className="inp cv-name">
                      <input
                        type="text"
                        aria-label="Имя точки"
                        value={p.name}
                        onChange={(e) => store.typePointName(i, e.target.value)}
                        onBlur={end(`pt:${i}:name`)}
                      />
                    </span>
                    <span className="hint">точка {i + 1}</span>
                    <button type="button" className="del" aria-label="Убрать точку" onClick={() => store.removePoint(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    <Num id={`pb-px${i}`} label="x, м" value={p.x} neg zero onType={(v) => store.typePoint(i, 'x', v)} onEnd={end(`pt:${i}:x`)} />
                    <Num id={`pb-py${i}`} label="y, м" value={p.y} neg zero onType={(v) => store.typePoint(i, 'y', v)} onEnd={end(`pt:${i}:y`)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="pbaddpt" onClick={store.addPoint}>
                + точка
              </button>
            </div>
            <h2>Связи</h2>
            <div className="asteps" id="pbconstr">
              {s.constr.map((c, i) => (
                <div key={i}>
                  <div className="cvrow cvrow2">
                    <span className="inp cv-name">
                      <input
                        type="text"
                        aria-label="Точка связи"
                        title="Точка тела"
                        value={c.at}
                        onChange={(e) => store.typeConstrAt(i, e.target.value)}
                        onBlur={end(`c:${i}:at`)}
                      />
                    </span>
                    <select aria-label="Вид связи" value={c.kind} onChange={(e) => store.setConstrKind(i, e.target.value as ConstrKind)}>
                      {KINDS.map(([k, t]) => (
                        <option key={k} value={k}>
                          {i + 1}. {t}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="del" aria-label="Убрать связь" onClick={() => store.removeConstr(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    {(c.kind === 'roller' || c.kind === 'roll') && (
                      <Num id={`pb-ca${i}`} label="нормаль, °" value={c.ang} neg zero onType={(v) => store.typeConstr(i, 'ang', v)} onEnd={end(`c:${i}:ang`)} />
                    )}
                    {c.kind === 'unwind' && (
                      <Num id={`pb-ca${i}`} label="нить к, °" value={c.ang} neg zero onType={(v) => store.typeConstr(i, 'ang', v)} onEnd={end(`c:${i}:ang`)} />
                    )}
                    {c.kind === 'roller' && (
                      <Num id={`pb-cf${i}`} label="трение f" value={c.f} zero onType={(v) => store.typeConstr(i, 'f', v)} onEnd={end(`c:${i}:f`)} />
                    )}
                    {c.kind === 'rope' && (
                      <>
                        <Num id={`pb-cqx${i}`} label="Q: x" value={c.qx} neg zero onType={(v) => store.typeConstr(i, 'qx', v)} onEnd={end(`c:${i}:qx`)} />
                        <Num id={`pb-cqy${i}`} label="Q: y" value={c.qy} neg zero onType={(v) => store.typeConstr(i, 'qy', v)} onEnd={end(`c:${i}:qy`)} />
                      </>
                    )}
                  </div>
                  {c.kind === 'roller' && (
                    <label className="toggle">
                      <input type="checkbox" checked={c.one} onChange={(e) => store.setConstrOne(i, e.target.checked)} />
                      односторонняя опора (может оторваться)
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="pbaddc" onClick={store.addConstr}>
                + связь
              </button>
            </div>
            <p className="empty">
              Слева — точка тела, к которой приложена связь. Нормаль опоры — направление её реакции на тело; у нити, сходящей с тела, — направление к
              закреплённому концу; Q — неподвижная точка крепления нити (от C).
            </p>
            <h2>Нагрузки</h2>
            <div className="asteps" id="pbloads">
              {s.loads.map((l, i) => (
                <div key={i}>
                  <div className="cvrow cvrow2">
                    {l.kind === 'force' ? (
                      <span className="inp cv-name">
                        <input
                          type="text"
                          aria-label="Точка приложения"
                          title="Точка приложения"
                          value={l.at}
                          onChange={(e) => store.typeLoadAt(i, e.target.value)}
                          onBlur={end(`l:${i}:at`)}
                        />
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="hint">{l.kind === 'force' ? `сила ${i + 1}` : `пара сил ${i + 1}`}</span>
                    <button type="button" className="del" aria-label="Убрать нагрузку" onClick={() => store.removeLoad(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    {l.kind === 'force' ? (
                      <>
                        <Num id={`pb-lfx${i}`} label="F_x" value={l.fx} neg zero onType={(v) => store.typeLoad(i, 'fx', v)} onEnd={end(`l:${i}:fx`)} />
                        <Num id={`pb-lfy${i}`} label="F_y" value={l.fy} neg zero onType={(v) => store.typeLoad(i, 'fy', v)} onEnd={end(`l:${i}:fy`)} />
                      </>
                    ) : (
                      <Num id={`pb-lm${i}`} label="M (+ против ч. с.)" value={l.m} neg zero onType={(v) => store.typeLoad(i, 'm', v)} onEnd={end(`l:${i}:m`)} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="pbaddf" onClick={() => store.addLoad('force')}>
                + сила
              </button>
              <button type="button" id="pbaddm" onClick={() => store.addLoad('moment')}>
                + пара
              </button>
            </div>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="pbsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Реакции при плоском движении · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
