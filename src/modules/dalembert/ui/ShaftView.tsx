/** Экран «Принцип Даламбера»: тело на оси вращения, опоры, ω и ε; чертёж, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { HAS_AXIS, KINDS, KIND_NAME, PARAMS, type PartKind } from '../../inertia/model/inertia';
import { renderShaft } from '../draw/shaft';
import { solveShaft, type ShaftProblem } from '../model/shaft';
import { SHAFT_PRESETS, type ShaftPresetKey } from '../presets';
import { shaftDoc } from '../text/solution';
import type { ShaftStore } from './store';

const AX = ['x', 'y', 'z'];

export function ShaftView({ chrome, store }: { chrome: Chrome; store: ShaftStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveShaft(pr), [pr]);
  const fig = useMemo(() => renderShaft(pr, r), [pr, r]);
  const doc = useMemo(() => shaftDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const end = (k: string) => () => store.endSession(k);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Принцип Даламбера</h1>
            <p className="lede">Динамические реакции и давления на опоры тела, вращающегося вокруг неподвижной оси: силы инерции приводятся к главному вектору и главному моменту, реакции — статические и динамические.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="dpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as ShaftPresetKey)}>
                {(Object.keys(SHAFT_PRESETS) as ShaftPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SHAFT_PRESETS[k].title}
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
        <section className="sheet" aria-label="Тело на оси">
          <div className="bar">
            <span className="hint">Оси x, y связаны с телом и взяты в рассматриваемый момент; z — ось вращения.</span>
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
            <svg id="dsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Тело на оси вращения" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Тело">
            <h2>Ось и вращение</h2>
            <div className="cgpar cg0">
              <Num id="d-zA" label="подпятник A: z" value={pr.zA} neg zero onType={(v) => store.typeTop('zA', v)} onEnd={end('t:zA')} />
              <Num id="d-zB" label="подшипник B: z" value={pr.zB} neg zero onType={(v) => store.typeTop('zB', v)} onEnd={end('t:zB')} />
              <Num id="d-omega" label="ω, рад/с" value={pr.omega} neg zero onType={(v) => store.typeTop('omega', v)} onEnd={end('t:omega')} />
              <Num id="d-eps" label="ε, рад/с²" value={pr.eps} neg zero onType={(v) => store.typeTop('eps', v)} onEnd={end('t:eps')} />
              <label className="sfield">
                <span>сила тяжести</span>
                <select id="dgrav" value={pr.gravity} onChange={(e) => store.setGravity(e.target.value as ShaftProblem['gravity'])}>
                  <option value="z">вал вертикальный (−z)</option>
                  <option value="y">вал горизонтальный (−y)</option>
                  <option value="none">не учитывать</option>
                </select>
              </label>
            </div>
            <h2>Части тела</h2>
            <label className="toggle">
              <input type="checkbox" id="dweight" checked={pr.byWeight} onChange={(e) => store.setByWeight(e.target.checked)} />
              Заданы веса P (m = P/g, g = 9,81 м/с²)
            </label>
            <div className="asteps" id="dparts">
              {pr.parts.map((q, i) => (
                <div key={i}>
                  <div className="cgrow">
                    <span className="segname">{i + 1}</span>
                    <select aria-label="Вид части" value={q.kind} onChange={(e) => store.setKind(i, e.target.value as PartKind)}>
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {KIND_NAME[k]}
                        </option>
                      ))}
                    </select>
                    <label className="chk" title="Вырез: масса вычитается">
                      <input type="checkbox" checked={q.s < 0} onChange={(e) => store.setSign(i, e.target.checked)} /> вырез
                    </label>
                    <button type="button" className="del" aria-label="Убрать часть" disabled={pr.parts.length <= 1} onClick={() => store.removePart(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    <Num id={`d-m${i}`} label={pr.byWeight ? 'вес P' : 'масса m'} value={q.m} onType={(v) => store.typePart(i, 'm', v)} onEnd={end(`p:${i}:m`)} />
                    {PARAMS[q.kind].map(([key, label]) => (
                      <Num key={key} id={`d-${key}${i}`} label={label} value={q.p[key]} zero onType={(v) => store.typePart(i, key, v)} onEnd={end(`p:${i}:${key}`)} />
                    ))}
                    {[0, 1, 2].map((a) => (
                      <Num key={'c' + a} id={`d-c${a}${i}`} label={`C: ${AX[a]}`} value={q.c[a]} neg zero onType={(v) => store.typePart(i, `c${a}`, v)} onEnd={end(`p:${i}:c${a}`)} />
                    ))}
                    {HAS_AXIS[q.kind] &&
                      [0, 1, 2].map((a) => (
                        <Num key={'u' + a} id={`d-u${a}${i}`} label={`ось части ${AX[a]}`} value={q.u[a]} neg zero onType={(v) => store.typePart(i, `u${a}`, v)} onEnd={end(`p:${i}:u${a}`)} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="dadd" onClick={store.addPart}>
                + часть
              </button>
            </div>
            <p className="empty">Положение части — её центр масс в осях x, y, z; ось части — ось симметрии (у стержня — направление). Длины — в метрах.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="dsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Принцип Даламбера · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Тело на оси вращения</figcaption>
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
