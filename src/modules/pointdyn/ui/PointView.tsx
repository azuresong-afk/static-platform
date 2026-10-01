/** Экран «Динамика точки»: прямолинейное движение под действием сил; графики v(t), x(t), решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderEq } from '../../rotation/draw/rotation';
import { solvePoint, type PointProblem } from '../model/point';
import { POINT_PRESETS, type PointPresetKey } from '../presets';
import { pointDoc } from '../text/solution';
import type { PointNumKey, PointStore } from './store';

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

export function PointView({ chrome, store }: { chrome: Chrome; store: PointStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solvePoint(pr), [pr]);
  const fig = useMemo(() => renderEq(r.eq, LABELS), [r]);
  const doc = useMemo(() => pointDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const N = (k: PointNumKey, label: string, neg = true) => <Num key={k} id={`p-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Динамика точки</h1>
            <p className="lede">Прямолинейное движение точки: сила тяжести на наклонной плоскости, трение, постоянные и переменные силы, упругая сила, сопротивление среды; закон движения, время и путь, предельная скорость.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="ppreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as PointPresetKey)}>
                {(Object.keys(POINT_PRESETS) as PointPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {POINT_PRESETS[k].title}
                  </option>
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
            <span className="hint">Силы «+» — в сторону оси x. Сила трения и сопротивление направлены против скорости.</span>
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
            <svg id="psvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Графики v(t) и x(t)" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Точка и прямая</h2>
            <label className="toggle">
              <input type="checkbox" id="pweight" checked={pr.byWeight} onChange={(e) => store.setByWeight(e.target.checked)} />
              Задан вес P (m = P/g, g = 9,81 м/с²)
            </label>
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
            <div className="cgpar cg0">{FORCES.map(([k, label, neg]) => N(k, label, neg))}</div>
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
            <p className="empty">α = 0 — горизонталь, 90° — вертикаль. Нормальная реакция N = P cos α. Предельная скорость считается, если силы зависят только от скорости.</p>
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
              <DocView doc={doc} />
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
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Графики v(t) и x(t)</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={doc} />
        </section>
      </article>
    </>
  );
}
