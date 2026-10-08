/** Экран «Сходящиеся силы»: равновесие узла и приведение системы сил; чертёж, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderNode, renderReduce } from '../draw/converging';
import { reduceSystem, solveNode, type NodeForce } from '../model/forces';
import { CONV_PRESETS, type ConvPresetKey } from '../presets';
import { nodeDoc, reduceDoc } from '../text/solution';
import type { ConvStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const KIND: [NodeForce['kind'], string][] = [
  ['known', 'известная сила'],
  ['rope', 'нить'],
  ['rod', 'стержень'],
  ['normal', 'гладкая опора'],
];
const AX = ['x', 'y', 'z'];

function NameField({ value, onType, onEnd }: { value: string; onType: (s: string) => void; onEnd: () => void }) {
  return (
    <span className="inp cv-name">
      <input type="text" aria-label="Обозначение" value={value} onChange={(e) => onType(e.target.value)} onBlur={onEnd} />
    </span>
  );
}

export function ConvView({ chrome, store }: { chrome: Chrome; store: ConvStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const out = useMemo(() => {
    if (pr.mode === 'node') {
      const r = solveNode(pr.node);
      return { fig: renderNode(pr.node, r), doc: nodeDoc(pr.node, r, { explain: st.explain }) };
    }
    const r = reduceSystem(pr.reduce);
    return { fig: renderReduce(pr.reduce, r), doc: reduceDoc(pr.reduce, r, { explain: st.explain }) };
  }, [pr, st.explain]);
  const { fig, doc } = out;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Сходящиеся силы</h1>
            <p className="lede">Равновесие узла с нитями, стержнями и гладкими опорами на плоскости и в пространстве; приведение произвольной системы сил к главному вектору и главному моменту, равнодействующей или динаме.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="vpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as ConvPresetKey)}>
                <PresetOptions items={taskEntries(CONV_PRESETS)} />
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
            <span className="hint">{pr.mode === 'node' ? 'Угол — от оси x против часовой стрелки; вектор — к другому концу нити или стержня.' : 'Сила задаётся точкой приложения и составляющими; пара — вектором момента.'}</span>
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
            <svg id="vsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Схема сил" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Силы">
            <h2>Силы</h2>
            <label className="field">
              <span>Задача</span>
              <select id="vmode" value={pr.mode} onChange={(e) => store.setMode(e.target.value as 'node' | 'reduce')}>
                <option value="node">равновесие узла</option>
                <option value="reduce">приведение системы сил</option>
              </select>
            </label>
            {pr.mode === 'node' ? (
              <>
                <div className="asteps" id="vforces">
                  {pr.node.forces.map((F, i) => (
                    <div key={i}>
                      <div className="cvrow">
                        <NameField value={F.name} onType={(s) => store.typeNodeName(i, s)} onEnd={() => store.endSession(`n:${i}:name`)} />
                        <select aria-label="Вид силы" value={F.kind} onChange={(e) => store.setForceKind(i, e.target.value as NodeForce['kind'])}>
                          {KIND.map(([k, t]) => (
                            <option key={k} value={k}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <select aria-label="Направление" value={F.dirMode} onChange={(e) => store.setDirMode(i, e.target.value as NodeForce['dirMode'])}>
                          <option value="ang">угол</option>
                          <option value="vec">вектор</option>
                        </select>
                        <button type="button" className="del" aria-label="Убрать силу" disabled={pr.node.forces.length <= 2} onClick={() => store.removeNodeForce(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {F.kind === 'known' && <Num id={`v-F${i}`} label="F, кН" value={F.F} onType={(x) => store.typeNode(i, 'F', x)} onEnd={() => store.endSession(`n:${i}:F`)} />}
                        {F.dirMode === 'ang' ? (
                          <Num id={`v-a${i}`} label="угол, °" value={F.ang} neg zero onType={(x) => store.typeNode(i, 'ang', x)} onEnd={() => store.endSession(`n:${i}:ang`)} />
                        ) : (
                          [0, 1, 2].map((a) => <Num key={a} id={`v-v${a}${i}`} label={AX[a]} value={F.v[a]} neg zero onType={(x) => store.typeNode(i, `v${a}`, x)} onEnd={() => store.endSession(`n:${i}:v${a}`)} />)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="vadd" onClick={store.addNodeForce}>
                    + сила
                  </button>
                </div>
                <p className="empty">У нити и стержня «+» — растяжение (усилие направлено от узла), у гладкой опоры — давление на узел.</p>
              </>
            ) : (
              <>
                <div className="asteps" id="vsys">
                  {pr.reduce.forces.map((F, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <NameField value={F.name} onType={(s) => store.typeReduceName('F', i, s)} onEnd={() => store.endSession(`r:name:F:${i}`)} />
                        <span className="hint">сила</span>
                        <button type="button" className="del" aria-label="Убрать силу" onClick={() => store.removeSysForce(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {[0, 1, 2].map((a) => (
                          <Num key={'r' + a} id={`v-r${a}${i}`} label={AX[a]} value={F.r[a]} neg zero onType={(x) => store.typeReduce('r', i, a, x)} onEnd={() => store.endSession(`r:r:${i}:${a}`)} />
                        ))}
                        {[0, 1, 2].map((a) => (
                          <Num key={'F' + a} id={`v-F${a}${i}`} label={`F${AX[a]}`} value={F.F[a]} neg zero onType={(x) => store.typeReduce('F', i, a, x)} onEnd={() => store.endSession(`r:F:${i}:${a}`)} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {pr.reduce.pairs.map((P, i) => (
                    <div key={'p' + i}>
                      <div className="cvrow cvrow2">
                        <NameField value={P.name} onType={(s) => store.typeReduceName('M', i, s)} onEnd={() => store.endSession(`r:name:M:${i}`)} />
                        <span className="hint">пара</span>
                        <button type="button" className="del" aria-label="Убрать пару" onClick={() => store.removePair(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {[0, 1, 2].map((a) => (
                          <Num key={a} id={`v-M${a}${i}`} label={`M${AX[a]}`} value={P.M[a]} neg zero onType={(x) => store.typeReduce('M', i, a, x)} onEnd={() => store.endSession(`r:M:${i}:${a}`)} />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <div className="cvrow cvrow2">
                      <span className="segname">O</span>
                      <span className="hint">центр приведения</span>
                    </div>
                    <div className="cgpar">
                      {[0, 1, 2].map((a) => (
                        <Num key={a} id={`v-O${a}`} label={AX[a]} value={pr.reduce.O[a]} neg zero onType={(x) => store.typeReduce('O', 0, a, x)} onEnd={() => store.endSession(`r:O:0:${a}`)} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="segbtns">
                  <button type="button" id="vaddf" onClick={store.addSysForce}>
                    + сила
                  </button>
                  <button type="button" id="vaddp" onClick={store.addPair}>
                    + пара
                  </button>
                </div>
                <p className="empty">x, y, z — точка приложения, м; Fx, Fy, Fz — составляющие силы, кН; момент пары — кН·м, «+» по правилу правого винта.</p>
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
            <div id="vsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Сходящиеся силы · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Схема сил</figcaption>
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
