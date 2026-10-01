/**
 * Экран «Динамика точки»: прямолинейное движение (вторая задача), силы по заданному движению (первая задача),
 * криволинейное движение в плоскости; графики или траектория, решение по шагам.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { parseExpr } from '../../../shared/expr';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderEq } from '../../rotation/draw/rotation';
import { renderFirst, renderPlane } from '../draw/extra';
import { solveFirst, type FirstProblem } from '../model/first';
import { solvePlane, type PlaneProblem } from '../model/plane';
import { solvePoint, type PointProblem } from '../model/point';
import { FIRST_PRESETS, PLANE_PRESETS, POINT_PRESETS } from '../presets';
import { firstDoc, planeDoc } from '../text/extra';
import { pointDoc } from '../text/solution';
import type { AnyPresetKey, FirstNumKey, PlaneNumKey, PointMode, PointNumKey, PointStore } from './store';

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
const MODES: [PointMode, string][] = [
  ['line', 'прямолинейное движение'],
  ['first', 'сила по закону движения'],
  ['plane', 'движение в плоскости'],
];

/** Поле формулы: подсвечивает ошибку разбора. */
function LawField({ id, label, value, onType, onEnd }: { id: string; label: string; value: string; onType: (s: string) => void; onEnd: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const r = parseExpr(shown);
  return (
    <label className="sfield" style={{ gridColumn: '1 / -1' }}>
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          className={r.ok ? undefined : 'bad'}
          title={r.ok ? undefined : r.error}
          value={shown}
          placeholder="пусто — 0"
          onChange={(e) => {
            setText(e.target.value);
            if (parseExpr(e.target.value).ok) onType(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
      </span>
    </label>
  );
}

export function PointView({ chrome, store }: { chrome: Chrome; store: PointStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const task = st.problem;
  const out = useMemo(() => {
    if (task.mode === 'first') {
      const r = solveFirst(task.first);
      return { fig: renderFirst(task.first, r), doc: firstDoc(task.first, r, { explain: st.explain }) };
    }
    if (task.mode === 'plane') {
      const r = solvePlane(task.plane);
      return { fig: renderPlane(task.plane, r), doc: planeDoc(task.plane, r, { explain: st.explain }) };
    }
    const r = solvePoint(task.line);
    return { fig: renderEq(r.eq, LABELS), doc: pointDoc(task.line, r, { explain: st.explain }) };
  }, [task, st.explain]);
  const pr: PointProblem = task.line,
    fp: FirstProblem = task.first,
    pp: PlaneProblem = task.plane;
  const N = (k: PointNumKey, label: string, neg = true) => <Num key={k} id={`p-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;
  const NF = (k: FirstNumKey, label: string, neg = true) => <Num key={k} id={`pf-${k}`} label={label} value={fp[k]} neg={neg} zero onType={(v) => store.typeFirst(k, v)} onEnd={() => store.endSession(`f:${k}`)} />;
  const NP = (k: PlaneNumKey, label: string, neg = true) => <Num key={k} id={`pp-${k}`} label={label} value={pp[k]} neg={neg} zero onType={(v) => store.typePlane(k, v)} onEnd={() => store.endSession(`q:${k}`)} />;
  const byWeight = task[task.mode].byWeight;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Динамика точки</h1>
            <p className="lede">Обе основные задачи динамики точки: по силам — движение (по прямой и в плоскости, с сопротивлением среды и трением), по закону движения — сила.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="ppreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as AnyPresetKey)}>
                <optgroup label="Прямолинейное движение (§27 а)">
                  {Object.entries(POINT_PRESETS).map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Сила по закону движения (§26)">
                  {Object.entries(FIRST_PRESETS).map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Движение в плоскости (§27 б)">
                  {Object.entries(PLANE_PRESETS).map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
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
            <span className="hint">{task.mode === 'line' ? 'Силы «+» — в сторону оси x. Сила трения и сопротивление направлены против скорости.' : task.mode === 'first' ? 'Закон движения — формулы от t: sin, cos, tg, exp, ln, sqrt, sh, ch, π; десятичная запятая.' : 'Ось y — вверх; угол начальной скорости — от оси x против часовой стрелки.'}</span>
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
            <svg id="psvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Графики и траектория" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="pmode" value={task.mode} onChange={(e) => store.setMode(e.target.value as PointMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" id="pweight" checked={byWeight} onChange={(e) => store.setByWeight(e.target.checked)} />
              Задан вес P (m = P/g)
            </label>
            {task.mode === 'line' && (
              <>
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
              </>
            )}
            {task.mode === 'first' && (
              <>
                <div className="cgpar cg0">
                  <LawField id="pf-x" label="x(t), м" value={fp.x} onType={(s) => store.typeLaw('x', s)} onEnd={() => store.endSession('f:x')} />
                  <LawField id="pf-y" label="y(t), м" value={fp.y} onType={(s) => store.typeLaw('y', s)} onEnd={() => store.endSession('f:y')} />
                  <LawField id="pf-z" label="z(t), м" value={fp.z} onType={(s) => store.typeLaw('z', s)} onEnd={() => store.endSession('f:z')} />
                  {NF('m', fp.byWeight ? 'вес P' : 'масса m', false)}
                  {NF('g', 'g, м/с²', false)}
                  <label className="sfield">
                    <span>сила тяжести</span>
                    <select id="pfgrav" value={fp.gravity} onChange={(e) => store.setGravityDir(e.target.value as FirstProblem['gravity'])}>
                      <option value="none">нет</option>
                      <option value="-y">−y</option>
                      <option value="+y">+y</option>
                      <option value="-z">−z</option>
                      <option value="+x">+x</option>
                      <option value="-x">−x</option>
                    </select>
                  </label>
                  {NF('t', 't, с')}
                  {NF('t1', 'Fmax: от t₁')}
                  {NF('t2', 'до t₂')}
                </div>
                <p className="empty">Искомая сила F = m·a − m·g (сила тяжести вычитается, если учтена). Для наибольшей силы задайте отрезок t₁ &lt; t₂.</p>
              </>
            )}
            {task.mode === 'plane' && (
              <>
                <div className="cgpar cg0">
                  {NP('m', pp.byWeight ? 'вес P' : 'масса m', false)}
                  {NP('g', 'g, м/с²', false)}
                  <label className="sfield">
                    <span>сила тяжести</span>
                    <select id="ppgrav" value={pp.gravity ? 'on' : 'off'} onChange={(e) => store.setPlaneGravity(e.target.value === 'on')}>
                      <option value="on">вдоль −y</option>
                      <option value="off">нет</option>
                    </select>
                  </label>
                </div>
                <h2>Силы</h2>
                <div className="cgpar cg0">
                  {NP('Fx', 'F_x постоянная')}
                  {NP('Fy', 'F_y постоянная')}
                  {NP('kv', 'k₁ в −k₁v', false)}
                  {NP('kq', 'k₂ в −k₂|v|v', false)}
                  {NP('c', 'c к центру (−c·r)')}
                  {NP('cx', 'центр: x')}
                  {NP('cy', 'центр: y')}
                  {NP('q', 'q в q(ẏ; −ẋ)')}
                </div>
                <h2>Начальные условия и вопрос</h2>
                <div className="cgpar cg0">
                  {NP('x0', 'x₀, м')}
                  {NP('y0', 'y₀, м')}
                  {NP('v0', 'v₀, м/с', false)}
                  {NP('ang', 'угол α, °')}
                  <label className="sfield">
                    <span>найти</span>
                    <select id="ppask" value={pp.ask} onChange={(e) => store.setPlaneAsk(e.target.value as PlaneProblem['ask'])}>
                      <option value="land">падение до y =</option>
                      <option value="apex">высшую точку</option>
                      <option value="x">когда x =</option>
                      <option value="t">в момент t</option>
                    </select>
                  </label>
                  {pp.ask === 'land' ? NP('y1', 'уровень y, м') : pp.ask === 'x' ? NP('x1', 'x, м') : pp.ask === 't' ? NP('t', 't, с', false) : null}
                </div>
                <p className="empty">c &gt; 0 — притяжение к центру, c &lt; 0 — отталкивание; q — сила, перпендикулярная скорости (магнитное поле).</p>
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
            <div id="psolution">
              <DocView doc={out.doc} />
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
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>{task.mode === 'plane' ? 'Траектория' : 'Графики'}</figcaption>
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
