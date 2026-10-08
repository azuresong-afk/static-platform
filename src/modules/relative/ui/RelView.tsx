/** Экран «Сложное движение точки»: переносное и относительное движения; чертёж с векторами, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderRel } from '../draw/rel';
import { solveRel, type Plane, type RelProblem } from '../model/rel';
import { REL_PRESETS, type RelPresetKey } from '../presets';
import { relDoc } from '../text/solution';
import type { RelStore, RelStrKey } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

export function RelView({ chrome, store }: { chrome: Chrome; store: RelStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveRel(pr), [pr]);
  const fig = useMemo(() => renderRel(pr, r, st.show), [pr, r, st.show]);
  const figA = useMemo(() => renderRel(pr, r, 'a'), [pr, r]);
  const doc = useMemo(() => relDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Сложное движение точки</h1>
            <p className="lede">Точка движется по телу, тело вращается вокруг неподвижной оси или движется поступательно: переносные, относительные и абсолютные скорость и ускорение, кориолисово ускорение.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="rpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as RelPresetKey)}>
                <PresetOptions items={taskEntries(REL_PRESETS)} />
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
            <div className="seg" role="group" aria-label="Что показать">
              <button type="button" id="rshow-v" aria-pressed={st.show === 'v'} onClick={() => store.setShow('v')}>
                Скорости
              </button>
              <button type="button" id="rshow-a" aria-pressed={st.show === 'a'} onClick={() => store.setShow('a')}>
                Ускорения
              </button>
            </div>
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
            <svg id="rsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Точка на теле, векторы скоростей или ускорений" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <Editor store={store} pr={pr} />
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="rsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Сложное движение точки · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: renderRel(pr, r, 'v').svg }} />
            <figcaption>Скорости</figcaption>
          </figure>
          <figure>
            <svg viewBox={figA.viewBox} dangerouslySetInnerHTML={{ __html: figA.svg }} />
            <figcaption>Ускорения</figcaption>
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

function Editor({ store, pr }: { store: RelStore; pr: RelProblem }) {
  const L = (k: RelStrKey, label: string, wide = true) => <LawField key={k} id={`r-${k}`} label={label} value={pr[k]} wide={wide} onType={(s) => store.typeStr(k, s)} onEnd={() => store.endSession(`s:${k}`)} />;
  const plane: [Plane, string][] = [
    ['xy', 'ξη — перпендикулярна оси вращения'],
    ['xz', 'ξζ — содержит ось вращения'],
    ['yz', 'ηζ — содержит ось вращения'],
  ];
  return (
    <>
      <h2>Переносное движение (тело)</h2>
      <label className="field">
        <span>Тело</span>
        <select id="rcarrier" value={pr.carrier} onChange={(e) => store.setCarrier(e.target.value as RelProblem['carrier'])}>
          <option value="rot">вращается вокруг неподвижной оси ζ</option>
          <option value="trans">движется поступательно</option>
        </select>
      </label>
      <div className="cgpar cg0">
        {pr.carrier === 'rot' ? L('phi', 'φ(t), рад — против часовой стрелки') : [L('xe', 'x(t)'), L('ye', 'y(t)'), L('ze', 'z(t) — пусто: 0')]}
      </div>
      <h2>Относительное движение (по телу)</h2>
      <label className="field">
        <span>Точка движется</span>
        <select id="rpath" value={pr.path} onChange={(e) => store.setPath(e.target.value as RelProblem['path'])}>
          <option value="line">по прямой: s(t) от начальной точки</option>
          <option value="circle">по окружности</option>
          <option value="xyz">по формулам координат ξ(t), η(t), ζ(t)</option>
        </select>
      </label>
      {pr.path === 'xyz' ? (
        <div className="cgpar cg0">{[L('x', 'ξ(t)'), L('y', 'η(t)'), L('z', 'ζ(t) — пусто: 0')]}</div>
      ) : (
        <>
          <label className="field">
            <span>Плоскость {pr.path === 'line' ? 'прямой' : 'окружности'}</span>
            <select id="rplane" value={pr.plane} onChange={(e) => store.setPlane(e.target.value as Plane)}>
              {plane.map(([p, t]) => (
                <option key={p} value={p}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="cgpar cg0">
            {pr.p0.map((s, i) => (
              <LawField key={i} id={`r-p0-${i}`} label={`${pr.path === 'line' ? 'начало' : 'центр'}: ${['ξ', 'η', 'ζ'][i]}`} value={s} wide={false} onType={(v) => store.typeP0(i, v)} onEnd={() => store.endSession(`p0:${i}`)} />
            ))}
            {L('ang', pr.path === 'line' ? 'угол прямой к первой оси, °' : 'начальный угол θ₀, °', false)}
            {pr.path === 'circle' && L('R', 'радиус R', false)}
            {pr.path === 'circle' && (
              <label className="field">
                <span>закон</span>
                <select id="rlaw" value={pr.law} onChange={(e) => store.setLaw(e.target.value as RelProblem['law'])}>
                  <option value="s">дуга s(t)</option>
                  <option value="theta">угол θ(t), рад</option>
                </select>
              </label>
            )}
            {L('s', pr.path === 'circle' && pr.law === 'theta' ? 'θ(t), рад' : 's(t)')}
          </div>
        </>
      )}
      <div className="cgpar cg0">
        <Num id="r-t" label="момент t" value={pr.t} neg zero onType={store.typeT} onEnd={() => store.endSession('t')} />
      </div>
      <p className="empty">Оси ξηζ связаны с телом, ось вращения — ζ (через начало координат). Формулы от t: sin, cos, exp, sqrt, π; «0,5t^2». Мгновенные значения из условия можно задать многочленом: s = s₀ + v₀t + a₀t²/2 при t = 0.</p>
    </>
  );
}
