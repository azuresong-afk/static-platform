/** Экран «Вращение тела и передачи»: закон ведущего звена, цепочка колёс, точка и искомое; схема, график ω(t), решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderGears } from '../draw/gears';
import { LINKS, solveGears, type Link } from '../model/gears';
import { GEAR_PRESETS, type GearPresetKey } from '../presets';
import { gearDoc } from '../text/solution';
import { MAX_WHEELS, type GearNumKey, type GearStore } from './store';

export function GearView({ chrome, store }: { chrome: Chrome; store: GearStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveGears(pr), [pr]);
  const fig = useMemo(() => renderGears(pr, r), [pr, r]);
  const doc = useMemo(() => gearDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const N = (k: GearNumKey, label: string, neg = false) => <Num key={k} id={`g-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;
  const end = (key: string) => () => store.endSession(key);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Вращение тела и передачи</h1>
            <p className="lede">Вращение тела вокруг неподвижной оси по закону φ(t) или по движению нити; зубчатые, ремённые и конические передачи: передаточные отношения, угловые скорости колёс, скорость и ускорение точки, момент достижения заданных оборотов.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="gpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as GearPresetKey)}>
                {(Object.keys(GEAR_PRESETS) as GearPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {GEAR_PRESETS[k].title}
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
        <section className="sheet" aria-label="Схема передачи">
          <div className="bar">
            <span className="hint">Закон — формула от t: sin, cos, exp, ln, sqrt, π; десятичная запятая; «2πt» — без знака умножения. Против часовой стрелки ω {">"} 0.</span>
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
            <svg id="gsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Схема передачи и график угловой скорости" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Ведущее звено</h2>
            <label className="field">
              <span>Задано</span>
              <select id="gdrive" value={pr.drive} onChange={(e) => store.setDrive(e.target.value as 'phi' | 'x')}>
                <option value="phi">закон поворота колеса 1: φ₁(t), рад</option>
                <option value="x">закон движения нити (рейки) на колесе 1: x(t)</option>
              </select>
            </label>
            <div className="cgpar cg0">
              <LawField id="g-law" label={pr.drive === 'phi' ? 'φ₁(t), рад' : 'x(t) — вдоль нити'} value={pr.law} onType={store.typeLaw} onEnd={end('law')} />
            </div>
            <h2>Колёса</h2>
            <div className="asteps" id="gwheels">
              {pr.wheels.map((w, j) => (
                <div key={j}>
                  <div className="cvrow cvrow2">
                    <span className="hint">колесо {j + 1}</span>
                    {j === 0 ? (
                      <span className="hint">ведущее</span>
                    ) : (
                      <select aria-label={`Связь колеса ${j + 1} с колесом ${j}`} value={w.link} onChange={(e) => store.setLink(j, e.target.value as Link)}>
                        {LINKS.map(([l, t]) => (
                          <option key={l} value={l}>
                            {t}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="button" className="del" aria-label="Убрать колесо" disabled={pr.wheels.length <= 1} onClick={() => store.removeWheel(j)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    <Num id={`g-r${j}`} label={`радиус r${j + 1}`} value={w.r} zero onType={(v) => store.typeWheel(j, 'r', v)} onEnd={end(`w:${j}:r`)} />
                    <Num id={`g-z${j}`} label={`зубьев z${j + 1}`} value={w.z} zero onType={(v) => store.typeWheel(j, 'z', v)} onEnd={end(`w:${j}:z`)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="gaddw" disabled={pr.wheels.length >= MAX_WHEELS} onClick={store.addWheel}>
                + колесо
              </button>
            </div>
            <h2>Что найти</h2>
            <label className="field">
              <span>Колесо для ответа и точки</span>
              <select id="gk" value={pr.k} onChange={(e) => store.setK(+e.target.value)}>
                {pr.wheels.map((_, j) => (
                  <option key={j} value={j}>
                    колесо {j + 1}
                  </option>
                ))}
              </select>
            </label>
            <div className="cgpar cg0">
              {N('rho', 'точка: ρ от оси (0 — обод)')}
              {!pr.find && N('t', 'момент t, с', true)}
              {N('tMax', 'график (и поиск) до t, с')}
            </div>
            <label className="toggle">
              <input type="checkbox" id="gfind" checked={pr.find} onChange={(e) => store.setFind(e.target.checked)} />
              Найти момент, когда угловая скорость колеса достигнет значения
            </label>
            {pr.find && (
              <div className="cgpar cg0">
                {N('target', 'значение')}
                <label className="field">
                  <span>единицы</span>
                  <select id="gunit" value={pr.unit} onChange={(e) => store.setUnit(e.target.value as 'rad' | 'rpm')}>
                    <option value="rpm">об/мин</option>
                    <option value="rad">рад/с</option>
                  </select>
                </label>
              </div>
            )}
            <p className="empty">Радиусы и зубья: 0 — не задано. Отношение в паре считается по числам зубьев, если они заданы у обоих колёс, иначе по радиусам. Для нити и точки нужен радиус. Единицы длины — как в условии, время — в секундах.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="gsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Вращение тела и передачи · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Схема передачи</figcaption>
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
