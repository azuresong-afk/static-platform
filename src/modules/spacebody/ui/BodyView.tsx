/** Экран «Пространственное тело»: точки, опоры, силы; аксонометрия и решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderBody } from '../draw/body';
import { buildModel, solveBody, type Axis, type SupportKind } from '../model/body';
import { BODY_PRESETS, type BodyPresetKey } from '../presets';
import { bodyDoc } from '../text/solution';
import type { BodyStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const KINDS: [SupportKind, string][] = [
  ['ball', 'сферический шарнир'],
  ['thrust', 'подпятник'],
  ['bearing', 'подшипник / петля'],
  ['rod', 'стержень / нить'],
  ['normal', 'гладкая опора'],
];

export function BodyView({ chrome, store }: { chrome: Chrome; store: BodyStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const b = st.body;
  const model = useMemo(() => buildModel(b), [b]);
  const sol = useMemo(() => solveBody(model), [model]);
  const fig = useMemo(() => renderBody(b, model, sol), [b, model, sol]);
  const doc = useMemo(() => bodyDoc(b, model, sol, { explain: st.explain }), [b, model, sol, st.explain]);
  const pointSel = (value: number, onChange: (v: number) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(+e.target.value)}>
      {b.points.map((p, i) => (
        <option key={i} value={i}>
          {p.name}
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
            <h1>Пространственное тело</h1>
            <p className="lede">Тело в пространстве на шарнирах, подшипниках, подпятниках и стержнях: шесть уравнений равновесия — проекции и моменты относительно осей, проведённых через опоры.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="bpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as BodyPresetKey)}>
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
        <section className="sheet" aria-label="Тело">
          <div className="bar">
            <span className="hint">Оси: x — к наблюдателю, y — вправо, z — вверх. Координаты в метрах.</span>
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
            <svg id="bsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Тело в аксонометрии" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Тело: данные">
            <h2>Тело</h2>
            <div className="sub">Точки: x, y, z</div>
            <div className="asteps" id="bpoints">
              {b.points.map((p, i) => (
                <div className="sbrow" key={i}>
                  <span className="segname">{p.name}</span>
                  {(['x', 'y', 'z'] as const).map((a) => (
                    <Num key={a} id={`b-${a}${i}`} label="" unit={a} value={p[a]} neg onType={(v) => store.typePoint(i, a, v)} onEnd={() => store.endSession(`pt:${i}:${a}`)} />
                  ))}
                  <button type="button" className="del" aria-label={`Убрать точку ${p.name}`} disabled={b.points.length <= 1} onClick={() => store.removePoint(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="baddpt" onClick={store.addPoint}>
                + точка
              </button>
            </div>

            <div className="sub">Опоры</div>
            <div className="asteps" id="bsups">
              {b.supports.map((s, j) => (
                <div key={j}>
                  <div className="sbsup">
                    <select aria-label="Вид опоры" value={s.kind} onChange={(e) => store.setSupport(j, { kind: e.target.value as SupportKind })}>
                      {KINDS.map(([k, t]) => (
                        <option key={k} value={k}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {pointSel(s.at, (v) => store.setSupport(j, { at: v }), 'Точка опоры')}
                    {s.kind === 'bearing' ? (
                      <select aria-label="Ось подшипника" value={s.axis} onChange={(e) => store.setSupport(j, { axis: e.target.value as Axis })}>
                        {(['x', 'y', 'z'] as Axis[]).map((a) => (
                          <option key={a} value={a}>
                            ось {a}
                          </option>
                        ))}
                      </select>
                    ) : s.kind === 'rod' ? (
                      pointSel(s.to ?? 0, (v) => store.setSupport(j, { to: v }), 'Неподвижный конец стержня')
                    ) : (
                      <span className="hint">{s.kind === 'normal' ? 'нормаль ниже' : 'X, Y, Z'}</span>
                    )}
                    <button type="button" className="del" aria-label="Убрать опору" onClick={() => store.removeSupport(j)}>
                      ×
                    </button>
                  </div>
                  {s.kind === 'normal' && (
                    <div className="sbrow">
                      <span className="hint">n</span>
                      {[0, 1, 2].map((i) => (
                        <Num key={i} id={`b-n${j}${i}`} label="" unit={'xyz'[i]} value={(s.n ?? [0, 0, 1])[i]} neg onType={(v) => store.typeSupportN(j, i, v)} onEnd={() => store.endSession(`sup:${j}:${i}`)} />
                      ))}
                      <span />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="baddsup" onClick={store.addSupport}>
                + опора
              </button>
            </div>
            <p className="empty">У стержня второй конец закреплён неподвижно; у подшипника реакции поперёк его оси.</p>

            <div className="sub">Силы</div>
            <div className="asteps" id="bforces">
              {b.forces.map((f, j) => (
                <div className="sbload" key={j}>
                  {pointSel(f.at, (v) => store.setForce(j, { at: v }), 'Точка приложения')}
                  <select aria-label="Как задана сила" value={f.mode} onChange={(e) => store.setForce(j, { mode: e.target.value as 'comp' | 'toward' })}>
                    <option value="comp">Fx, Fy, Fz</option>
                    <option value="toward">к точке</option>
                  </select>
                  {f.mode === 'comp' ? (
                    [0, 1, 2].map((i) => <Num key={i} id={`b-f${j}${i}`} label="" unit={'xyz'[i]} value={(f.c ?? [0, 0, 0])[i]} neg zero onType={(v) => store.typeForce(j, i as 0 | 1 | 2, v)} onEnd={() => store.endSession(`f:${j}:${i}`)} />)
                  ) : (
                    <>
                      {pointSel(f.to ?? 0, (v) => store.setForce(j, { to: v }), 'Сила направлена к точке')}
                      <Num id={`b-F${j}`} label="" unit="кН" value={f.F} onType={(v) => store.typeForce(j, 'F', v)} onEnd={() => store.endSession(`f:${j}:F`)} />
                      <span />
                    </>
                  )}
                  <button type="button" className="del" aria-label="Убрать силу" onClick={() => store.removeForce(j)}>
                    ×
                  </button>
                  {f.link == null && (
                    <label className="chk" style={{ gridColumn: '1 / -1' }}>
                      <input type="checkbox" checked={!!f.unknown} onChange={(e) => store.setForce(j, { unknown: e.target.checked || undefined })} /> Модуль неизвестен — найти (направление задано)
                    </label>
                  )}
                  {b.forces.length > 1 && b.forces.some((g) => g.link === j) ? (
                    <p className="empty" style={{ gridColumn: '1 / -1', margin: 0 }}>
                      С модулем этой силы связаны: {b.forces.flatMap((g, i) => (g.link === j ? [`№${i + 1}`] : [])).join(', ')}
                    </p>
                  ) : b.forces.length > 1 && (
                    <div className="sb-link" style={{ gridColumn: '1 / -1' }}>
                      <label>
                        Модуль{' '}
                        <select aria-label="Модуль связан с силой" id={`b-link${j}`} value={f.link ?? ''} onChange={(e) => store.setLink(j, e.target.value === '' ? null : +e.target.value)}>
                          <option value="">задан сам по себе</option>
                          {b.forces.map((g, i) =>
                            i === j || g.link != null ? null : (
                              <option key={i} value={i}>
                                = k · сила №{i + 1}
                                {g.unknown ? ' (неизвестная)' : ''}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      {f.link != null && <Num id={`b-k${j}`} label="k" value={f.k ?? 1} onType={(v) => store.typeForce(j, 'k', v)} onEnd={() => store.endSession(`f:${j}:k`)} />}
                      {f.link != null && <span className="hint">{f.mode === 'comp' ? 'Fx, Fy, Fz задают только направление' : 'модуль F не используется'}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="baddforce" onClick={store.addForce}>
                + сила
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
            <div id="bsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Пространственное тело · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Тело, опоры и силы</figcaption>
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
