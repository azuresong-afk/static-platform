/** Экран «Переменная масса»: прямолинейное движение тела переменной массы и многоступенчатая ракета. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderLine, renderStages } from '../draw/varmass';
import { solveLine, solveStages, type Particles, type StagesProblem, type StopKind, type VarLine } from '../model/varmass';
import { VAR_PRESETS, type VarMode, type VarPresetKey } from '../presets';
import { lineDoc, stagesDoc } from '../text/solution';
import type { LineNumKey, VmStore } from './store';
import { ExtraScreen } from '../../../shared/ui/ExtraScreen';
import { VARMASS_ASKS } from '../model/extra';
import { VARMASS_EXTRA_PRESETS } from '../extraPresets';

const ALL_PRESETS = { ...VAR_PRESETS, ...VARMASS_EXTRA_PRESETS };

const STOP_T: Record<StopKind, string> = {
  time: 'в момент t₁',
  mass: 'когда масса станет m₁',
  speed: 'когда скорость станет v₁',
  dist: 'после пути s₁',
  rest: 'до остановки',
};

export function VarView({ chrome, store }: { chrome: Chrome; store: VmStore }) {
  const view = useSyncExternalStore(store.subscribe, () => store.get().view);
  if (view === 'extra')
    return (
      <ExtraScreen
        chrome={chrome}
        host={store}
        asks={VARMASS_ASKS}
        presets={ALL_PRESETS}
        prefix="vm"
        heading="Переменная масса: общий вид, обратные задачи, ротор"
        lede="Уравнение Мещерского в общем виде (маятник, ракета по закону сгорания, аэростат с канатом), высота и оптимальное α, мягкая посадка, подъём вдоль наклонной прямой, реактивный запуск ротора, притяжение к центру переменной массы."
        mainLabel="прямолинейное движение и ступени ракеты"
        tabName="Переменная масса"
      />
    );
  return <VarMain chrome={chrome} store={store} />;
}

function VarMain({ chrome, store }: { chrome: Chrome; store: VmStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => {
    if (s.mode === 'line') {
      const r = solveLine(s.line);
      return { fig: renderLine(s.line, r), doc: lineDoc(s.line, r, { explain: st.explain }) };
    }
    const r = solveStages(s.stages);
    return { fig: renderStages(s.stages, r), doc: stagesDoc(s.stages, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const L = s.line;
  /** Числовое поле: любое число, положительное или неотрицательное. */
  const NL = (k: LineNumKey, label: string, kind: 'any' | 'pos' | 'nonneg' = 'any') => (
    <Num key={k} id={`vm-${k}`} label={label} value={L[k]} neg={kind === 'any'} zero={kind !== 'pos'} onType={(v) => store.typeLine(k, v)} onEnd={end(`l:${k}`)} />
  );

  const S = s.stages;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Переменная масса</h1>
            <p className="lede">
              Уравнение Мещерского: ракета, тело с реактивной силой, присоединение частиц (цепь, капля, обледенение); закон массы по заданному ускорению;
              формула Циолковского и многоступенчатые ракеты.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="vmpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as VarPresetKey)}>
                <PresetOptions items={taskEntries(ALL_PRESETS)} />
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
            <span className="hint">
              {s.mode === 'line' ? 'Графики скорости, координаты и массы по времени.' : 'Субракеты (снизу — первая ступень) и скорость после каждой ступени.'}
            </span>
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
            <svg id="vmsvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <div className="segbtns">
              <button type="button" id="vmto-extra" onClick={() => store.setView('extra')}>
                Общий вид, обратные задачи, ротор →
              </button>
            </div>
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="vmmode" value={s.mode} onChange={(e) => store.setMode(e.target.value as VarMode)}>
                <option value="line">прямолинейное движение тела переменной массы</option>
                <option value="stages">многоступенчатая ракета</option>
              </select>
            </label>
            {s.mode === 'line' && (
              <>
                <label className="field">
                  <span>Масса</span>
                  <select id="vmmass" value={L.massMode} onChange={(e) => store.setLine('massMode', e.target.value as VarLine['massMode'])}>
                    <option value="law">задан закон m(t, x)</option>
                    <option value="accel">задано ускорение — найти закон массы</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {L.massMode === 'law' ? (
                    <LawField id="vm-mLaw" label="m(t, x)" value={L.mLaw} vars={['x']} onType={(v) => store.typeLaw('mLaw', v)} onEnd={end('l:mLaw')} />
                  ) : (
                    <>
                      {NL('w', 'w, м/с²')}
                      {NL('m0', 'm₀', 'pos')}
                    </>
                  )}
                </div>
                <label className="field">
                  <span>Частицы</span>
                  <select id="vmpart" value={L.part} onChange={(e) => store.setLine('part', e.target.value as Particles)}>
                    <option value="jet">истекают со скоростью v_e (реактивная сила)</option>
                    <option value="zeroAbs">присоединяются из покоя (u = 0)</option>
                    <option value="zeroRel">отделяются без относительной скорости</option>
                  </select>
                </label>
                <div className="cgpar cg0">
                  {L.part === 'jet' && (
                    <>
                      {NL('ve', 'v_e, м/с', 'pos')}
                      {NL('beta', 'тяга к оси β, °')}
                    </>
                  )}
                  {NL('alpha', 'ось x к горизонту α, °')}
                  <label className="sfield vm-wide">
                    <span>тяготение</span>
                    <select id="vmgrav" value={L.grav} onChange={(e) => store.setLine('grav', e.target.value as VarLine['grav'])}>
                      <option value="uniform">g постоянно</option>
                      <option value="inverse">g ∝ 1/(R + h)²</option>
                      <option value="none">нет</option>
                    </select>
                  </label>
                  {L.grav !== 'none' && NL('g', 'g, м/с²', 'pos')}
                  {L.grav === 'inverse' && NL('Rg', 'R, м', 'pos')}
                  {NL('f', 'трение f', 'nonneg')}
                  {NL('k1', 'k₁ (−k₁v)', 'nonneg')}
                  {NL('k2', 'k₂ (−k₂v|v|)', 'nonneg')}
                  <LawField
                    id="vm-force"
                    label="сила F(t, x, v), Н"
                    value={L.force}
                    vars={['x', 'v']}
                    onType={(v) => store.typeLaw('force', v)}
                    onEnd={end('l:force')}
                  />
                </div>
                <h2>Начало и конец</h2>
                <div className="cgpar cg0">
                  {NL('x0', 'x₀, м')}
                  {NL('v0', 'v₀, м/с')}
                  <label className="sfield vm-wide">
                    <span>считать</span>
                    <select id="vmstop" value={L.stop} onChange={(e) => store.setLine('stop', e.target.value as StopKind)}>
                      {(Object.keys(STOP_T) as StopKind[]).map((k) => (
                        <option key={k} value={k}>
                          {STOP_T[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {L.stop === 'time' && NL('t1', 't₁, с', 'pos')}
                  {L.stop === 'mass' && NL('m1', 'm₁', 'pos')}
                  {L.stop === 'speed' && NL('v1', 'v₁, м/с')}
                  {L.stop === 'dist' && NL('s1', 's₁, м', 'pos')}
                </div>
                <label className="toggle">
                  <input type="checkbox" id="vmcoast" checked={L.coast} onChange={(e) => store.setCoast(e.target.checked)} />
                  Затем движение с постоянной массой до остановки (наибольшая высота)
                </label>
                <p className="empty">
                  Ось x — вдоль направляющей (α = 90° — вертикально вверх, −90° — вниз). Закон массы — формула от t и x (например, 1 − 0,01t, exp(−0,1t), 20 +
                  0,5x). Тяга под углом β к оси уменьшает давление на направляющие.
                </p>
              </>
            )}
            {s.mode === 'stages' && (
              <>
                <label className="field">
                  <span>Что ищем</span>
                  <select id="vmask" value={S.ask} onChange={(e) => store.setAsk(e.target.value as StagesProblem['ask'])}>
                    <option value="speeds">скорости после ступеней по z</option>
                    <option value="z">числа Циолковского по скоростям</option>
                    <option value="weights">веса ступеней по z и s (Фертрегт)</option>
                    <option value="optimal">z для наименьшего стартового веса</option>
                  </select>
                </label>
                {(S.ask === 'weights' || S.ask === 'optimal') && (
                  <div className="cgpar cg0">
                    <Num id="vm-q" label="полезный груз q" value={S.q} onType={(v) => store.typeStagesTop('q', v)} onEnd={end('s:q')} />
                    {S.ask === 'optimal' && (
                      <Num id="vm-v" label="конечная v, м/с" value={S.v} onType={(v) => store.typeStagesTop('v', v)} onEnd={end('s:v')} />
                    )}
                  </div>
                )}
                <div className="asteps" id="vmstages">
                  {S.stages.map((g, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="hint">ступень {i + 1}</span>
                        <span />
                        <button type="button" className="del" aria-label="Убрать ступень" disabled={S.stages.length <= 1} onClick={() => store.removeStage(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        <Num id={`vm-ve${i}`} label="v_e, м/с" value={g.ve} onType={(v) => store.typeStage(i, 've', v)} onEnd={end(`st:${i}:ve`)} />
                        {(S.ask === 'speeds' || S.ask === 'weights') && (
                          <Num id={`vm-z${i}`} label="z" value={g.z} onType={(v) => store.typeStage(i, 'z', v)} onEnd={end(`st:${i}:z`)} />
                        )}
                        {(S.ask === 'weights' || S.ask === 'optimal') && (
                          <Num id={`vm-s${i}`} label="s" value={g.s} onType={(v) => store.typeStage(i, 's', v)} onEnd={end(`st:${i}:s`)} />
                        )}
                        {S.ask === 'z' && (
                          <Num id={`vm-vt${i}`} label="v после, м/с" value={g.vt} onType={(v) => store.typeStage(i, 'vt', v)} onEnd={end(`st:${i}:vt`)} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="vmaddst" onClick={store.addStage}>
                    + ступень
                  </button>
                </div>
                <p className="empty">
                  z — число Циолковского субракеты (начальный вес субракеты к весу после сгорания топлива ступени), s — конструктивная характеристика ступени
                  (полный вес к сухому). Вне поля тяготения и атмосферы.
                </p>
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
            <div id="vmsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Переменная масса · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>{s.mode === 'line' ? 'Графики' : 'Ступени'}</figcaption>
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
