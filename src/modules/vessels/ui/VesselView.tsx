/** Экран «Тонкостенные сосуды»: участки сосуда, нагрузка, опоры; сосуд и эпюры σ_t, σ_m, толщина стенки. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderVessel } from '../draw/vessel';
import { ANT_NEEDS } from '../model/antonov';
import { solveVessel, type SegKind } from '../model/vessel';
import { taskProblem, VESSEL_PRESETS, type VesselPresetKey, type VesselTask } from '../presets';
import { vesselDoc } from '../text/solution';
import { MAX_SEGS, type AntNumKey, type VesselNumKey, type VesselStore } from './store';

const KINDS: [SegKind, string][] = [
  ['cyl', 'цилиндр'],
  ['cone', 'конус'],
  ['sph', 'сферический сегмент'],
  ['ell', 'эллиптическое днище'],
];

export function VesselView({ chrome, store }: { chrome: Chrome; store: VesselStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const task = st.problem;
  const built = useMemo(() => taskProblem(task), [task]);
  const pr = built.problem;
  const cp = task.custom;
  const r = useMemo(() => (built.errors.length ? { ...solveVessel({ ...pr, segs: [] }), errors: built.errors } : solveVessel(pr)), [built, pr]);
  const fig = useMemo(() => renderVessel(pr, r), [pr, r]);
  const doc = useMemo(() => vesselDoc(pr, r, { explain: st.explain, reading: task.mode === 'ant' ? built.reading : undefined }), [pr, r, st.explain, task.mode, built]);
  const N = (k: VesselNumKey, label: string) => <Num key={k} id={`v-${k}`} label={label} value={cp[k]} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;
  const A = (k: AntNumKey, label: string) => <Num key={k} id={`va-${k}`} label={label} value={task.ant[k]} zero onType={(v) => store.typeAnt(k, v)} onEnd={() => store.endSession(`a:${k}`)} />;
  const needs = ANT_NEEDS[task.ant.fig] ?? [];
  const end = (k: string) => () => store.endSession(k);
  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Тонкостенные сосуды</h1>
            <p className="lede">Безмоментная теория: меридиональные и окружные напряжения по высоте сосуда (уравнение Лапласа и равновесие отсечённой части), эпюры σ_t и σ_m, толщина стенки по III гипотезе прочности.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="vpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as VesselPresetKey)}>
                {(Object.keys(VESSEL_PRESETS) as VesselPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {VESSEL_PRESETS[k].title}
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
        <section className="sheet" aria-label="Сосуд и эпюры">
          <div className="bar">
            <span className="hint">Участки — снизу вверх; размеры в метрах, давление в МПа.</span>
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
            <svg id="vsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Сосуд, эпюры окружных и меридиональных напряжений" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <label className="field">
              <span>Как задан сосуд</span>
              <select id="vmode" value={task.mode} onChange={(e) => store.setMode(e.target.value as VesselTask['mode'])}>
                <option value="ant">по схеме задачи 4 Антонова (рис. 1–16)</option>
                <option value="custom">свой сосуд из участков</option>
              </select>
            </label>
            {task.mode === 'ant' && (
              <>
                <label className="field">
                  <span>Рисунок</span>
                  <select id="vfig" value={task.ant.fig} onChange={(e) => store.setFig(+e.target.value)}>
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        рис. {n}
                        {[4, 8, 10].includes(n) ? ' — с пьезометром' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cgpar cg0">
                  {needs.includes('alpha') && A('alpha', 'α, град')}
                  {needs.includes('H1') && A('H1', 'H₁, м')}
                  {needs.includes('H2') && A('H2', 'H₂, м')}
                  {needs.includes('H3') && A('H3', task.ant.fig === 12 ? 'H₃ (диаметр основания крышки), м' : 'H₃ (уровень в трубке), м')}
                  {needs.includes('D') && A('D', 'D, м')}
                  {needs.includes('R') && A('R', 'R, м')}
                  {needs.includes('Rb') && A('Rb', 'R_b (высота крышки), м')}
                  {needs.includes('p') && A('p', 'p, МПа')}
                  {A('rho3', 'ρ·10⁻³, кг/м³')}
                  {A('sigma', '[σ], МПа')}
                </div>
                {built.reading.length > 0 && (
                  <ul className="empty" id="vreading">
                    {built.reading.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}
                <div className="segbtns">
                  <button type="button" id="vtocustom" disabled={!r.ok} onClick={() => store.toCustom(pr)}>
                    Изменить как свой сосуд
                  </button>
                </div>
                <p className="empty">Числа — из строки таблицы 12.4 (стр. 171). Схему можно выбрать любую: недостающие для рисунка величины программа попросит ввести.</p>
              </>
            )}
            {task.mode === 'custom' && (
              <>
            <h2>Участки снизу вверх</h2>
            <div className="asteps" id="vsegs">
              {cp.segs.map((s, i) => (
                <div key={i}>
                  <div className="cvrow cvrow2">
                    <span className="hint">{i + 1}</span>
                    <select aria-label={`Вид участка ${i + 1}`} value={s.kind} onChange={(e) => store.setSegKind(i, e.target.value as SegKind)}>
                      {KINDS.map(([k, t]) => (
                        <option key={k} value={k}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="del" aria-label="Убрать участок" disabled={cp.segs.length <= 1} onClick={() => store.removeSeg(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    {s.kind === 'cyl' ? (
                      <>
                        <Num id={`v-r1-${i}`} label="радиус r, м" value={s.r1} onType={(v) => store.typeSeg(i, 'r1', v)} onEnd={end(`s:${i}:r1`)} />
                        <Num id={`v-h-${i}`} label="высота, м" value={s.h} onType={(v) => store.typeSeg(i, 'h', v)} onEnd={end(`s:${i}:h`)} />
                      </>
                    ) : (
                      <>
                        <Num id={`v-r1-${i}`} label="радиус внизу, м" value={s.r1} zero onType={(v) => store.typeSeg(i, 'r1', v)} onEnd={end(`s:${i}:r1`)} />
                        <Num id={`v-r2-${i}`} label="радиус вверху, м" value={s.r2} zero onType={(v) => store.typeSeg(i, 'r2', v)} onEnd={end(`s:${i}:r2`)} />
                        {s.kind === 'cone' && <Num id={`v-p-${i}`} label="половина угла при вершине, °" value={s.p} onType={(v) => store.typeSeg(i, 'p', v)} onEnd={end(`s:${i}:p`)} />}
                        {s.kind === 'sph' && <Num id={`v-p-${i}`} label="радиус сферы R, м" value={s.p} onType={(v) => store.typeSeg(i, 'p', v)} onEnd={end(`s:${i}:p`)} />}
                        {s.kind === 'ell' && <Num id={`v-h-${i}`} label="высота днища b, м" value={s.h} onType={(v) => store.typeSeg(i, 'h', v)} onEnd={end(`s:${i}:h`)} />}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              {KINDS.map(([k, t]) => (
                <button key={k} type="button" id={`vadd-${k}`} disabled={cp.segs.length >= MAX_SEGS} onClick={() => store.addSeg(k)}>
                  + {t}
                </button>
              ))}
            </div>
            <p className="empty">Конус от вершины — радиус 0. Сферический сегмент: купол — радиус уменьшается вверх, днище — растёт. Если у вершины конуса на рисунке подписан полный угол (α или 2α), введите его половину.</p>
            <h2>Нагрузка и опоры</h2>
            <div className="cgpar cg0">
              {N('pg', 'давление газа p_г, МПа')}
              {N('rho', 'плотность жидкости ρ, кг/м³')}
              {N('level', 'уровень жидкости от низа, м')}
              {N('sigma', '[σ], МПа')}
              <label className="field">
                <span>опора</span>
                <select id="vsupport" value={cp.support} onChange={(e) => store.setSupport(e.target.value as 'ground' | 'lugs')}>
                  <option value="ground">на основании (низ сосуда)</option>
                  <option value="lugs">на лапах</option>
                </select>
              </label>
              {cp.support === 'lugs' && N('zs', 'высота лап от низа, м')}
            </div>
            <p className="empty">Плотность — в кг/м³ (в таблице Антонова «ρ·10⁻³» = 1,1 означает 1100). Уровень выше крышки — сосуд полон.</p>
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
          <p>Тонкостенные сосуды · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Сосуд и эпюры напряжений</figcaption>
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
