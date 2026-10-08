/** Экран «Фермы»: чертёж, узлы, стержни, опоры и силы, решение методом вырезания узлов и сечений. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderTruss } from '../draw/truss';
import { nodeName, solveTruss } from '../model/truss';
import { TRUSS_PRESETS, type TrussPresetKey } from '../presets';
import { trussDoc } from '../text/solution';
import type { TrussStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const DIRS: [number, string, string][] = [
  [270, '↓', 'вниз'],
  [90, '↑', 'вверх'],
  [0, '→', 'вправо'],
  [180, '←', 'влево'],
];

export function TrussView({ chrome, store }: { chrome: Chrome; store: TrussStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const t = st.truss;
  const res = useMemo(() => solveTruss(t), [t]);
  const fig = useMemo(() => renderTruss(t, res, { ritter: st.ritter }), [t, res, st.ritter]);
  const doc = useMemo(() => trussDoc(t, res, { explain: st.explain, ritter: st.ritter }), [t, res, st.explain, st.ritter]);
  const n = t.nodes.length;
  const nodeSel = (value: number, onChange: (v: number) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(+e.target.value)}>
      {t.nodes.map((_, i) => (
        <option key={i} value={i}>
          {nodeName(i)}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Фермы</h1>
            <p className="lede">Плоская ферма с шарнирами в узлах: реакции опор, нулевые стержни, усилия методом вырезания узлов и проверка методом сечений (Риттера).</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="tpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as TrussPresetKey)}>
                <PresetOptions items={taskEntries(TRUSS_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Ферма">
          <div className="bar">
            <span className="hint">Нагрузка — только в узлах. Растяжение — «+», сжатие — «−».</span>
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
            <svg id="tsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Ферма" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Ферма: данные">
            <h2>Ферма</h2>
            <div className="sub">Узлы, м</div>
            <div className="asteps" id="tnodes">
              {t.nodes.map((p, i) => (
                <div className="trow" key={i}>
                  <span className="segname">{nodeName(i)}</span>
                  <Num id={`t-x${i}`} label="" unit="x" value={p.x} neg onType={(v) => store.typeNode(i, 'x', v)} onEnd={() => store.endSession(`node:${i}:x`)} />
                  <Num id={`t-y${i}`} label="" unit="y" value={p.y} neg onType={(v) => store.typeNode(i, 'y', v)} onEnd={() => store.endSession(`node:${i}:y`)} />
                  <button type="button" className="del" aria-label={`Убрать узел ${nodeName(i)}`} disabled={n <= 2} onClick={() => store.removeNode(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="taddnode" onClick={store.addNode}>
                + узел
              </button>
            </div>

            <div className="sub">Стержни</div>
            <div className="asteps" id="tbars">
              {t.bars.map((q, k) => (
                <div className="trow" key={k}>
                  <span className="segname">{k + 1}</span>
                  {nodeSel(q.a, (v) => store.setBar(k, 'a', v), `Начало стержня ${k + 1}`)}
                  {nodeSel(q.b, (v) => store.setBar(k, 'b', v), `Конец стержня ${k + 1}`)}
                  <button type="button" className="del" aria-label={`Убрать стержень ${k + 1}`} onClick={() => store.removeBar(k)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="taddbar" onClick={store.addBar}>
                + стержень
              </button>
            </div>

            <div className="sub">Опоры</div>
            <div className="asteps" id="tsups">
              {t.supports.map((s, j) => (
                <div className="trow trow4" key={j}>
                  {nodeSel(s.node, (v) => store.setSupport(j, { node: v }), `Узел опоры ${j + 1}`)}
                  <select aria-label="Вид опоры" value={s.kind} onChange={(e) => store.setSupport(j, { kind: e.target.value as 'pin' | 'roller' })}>
                    <option value="pin">шарнир</option>
                    <option value="roller">каток</option>
                  </select>
                  {s.kind === 'roller' ? (
                    <Num id={`t-sa${j}`} label="" unit="°" value={s.angle} neg onType={(v) => store.typeSupportAngle(j, v)} onEnd={() => store.endSession(`sup:${j}`)} />
                  ) : (
                    <span className="hint">X, Y</span>
                  )}
                  <button type="button" className="del" aria-label="Убрать опору" onClick={() => store.removeSupport(j)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="taddsup" onClick={store.addSupport}>
                + опора
              </button>
            </div>
            <p className="empty">У катка — угол реакции к оси x: 90° — опора снизу, 0° — стена слева.</p>

            <div className="sub">Силы в узлах</div>
            <div className="asteps" id="tloads">
              {t.loads.map((l, j) => (
                <div className="tload" key={j}>
                  {nodeSel(l.node, (v) => store.setLoad(j, { node: v }), `Узел силы ${j + 1}`)}
                  <Num id={`t-F${j}`} label="" unit="кН" value={l.F} neg onType={(v) => store.typeLoad(j, 'F', v)} onEnd={() => store.endSession(`load:${j}:F`)} />
                  <Num id={`t-a${j}`} label="" unit="°" value={l.angle} neg onType={(v) => store.typeLoad(j, 'angle', v)} onEnd={() => store.endSession(`load:${j}:angle`)} />
                  <span className="quick">
                    {DIRS.map(([a, g, name]) => (
                      <button key={a} type="button" aria-label={name} aria-pressed={l.angle === a ? 'true' : 'false'} onClick={() => store.setLoad(j, { angle: a })}>
                        {g}
                      </button>
                    ))}
                  </span>
                  <button type="button" className="del" aria-label="Убрать силу" onClick={() => store.removeLoad(j)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="taddload" onClick={store.addLoad}>
                + сила
              </button>
            </div>

            <div className="sub">Проверка методом сечений</div>
            <label className="field">
              <span>Стержень для метода Риттера</span>
              <select id="tritter" value={st.ritter ?? ''} onChange={(e) => store.setRitter(e.target.value === '' ? null : +e.target.value)}>
                <option value="">не проверять</option>
                {t.bars.map((q, k) => (
                  <option key={k} value={k}>
                    {k + 1} ({nodeName(q.a)}–{nodeName(q.b)})
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="tsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Ферма · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Схема фермы и усилия в стержнях</figcaption>
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
