/**
 * Экран «Сложное движение точки»: точка на движущемся теле, движение относительно вращающейся Земли, треугольник
 * скоростей (обратные задачи); чертёж с векторами, решение по шагам.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderKin } from '../../pointkin/draw/kin';
import { renderEarth } from '../draw/earth';
import { renderRel } from '../draw/rel';
import { renderTri } from '../draw/tri';
import { solveEarthKin, type EarthKin } from '../model/earth';
import { solveEq, type EqProblem, type EqStrKey } from '../model/eq';
import { solveRel, type Plane, type RelProblem } from '../model/rel';
import { solveTri, TRI_VECS, type TriProblem, type TriVec } from '../model/tri';
import { EARTH_PRESETS, EQ_PRESETS, REL_PRESETS, TRI_PRESETS } from '../presets';
import { earthDoc } from '../text/earth';
import { eqDoc } from '../text/eq';
import { relDoc } from '../text/solution';
import { triDoc } from '../text/tri';
import type { AnyRelKey, EarthNumKey, EqNumKey, RelMode, RelStore, RelStrKey, TriKey } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

export function RelView({ chrome, store }: { chrome: Chrome; store: RelStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const out = useMemo(() => {
    const o = { explain: st.explain };
    if (st.mode === 'earth') {
      const r = solveEarthKin(st.earth);
      return { draw: (sh: 'v' | 'a') => renderEarth(st.earth, r, sh), doc: earthDoc(st.earth, r, o) };
    }
    if (st.mode === 'eq') {
      const r = solveEq(st.eq);
      return {
        draw: () => (r.ok ? renderKin(r.kp, r.kin) : { svg: '<text class="tb-note" x="16" y="240">Проверьте формулы.</text>', viewBox: '0 0 1000 480' }),
        doc: eqDoc(st.eq, r, o),
      };
    }
    if (st.mode === 'tri') {
      const r = solveTri(st.tri);
      return { draw: () => renderTri(st.tri, r), doc: triDoc(st.tri, r, o) };
    }
    const r = solveRel(pr);
    return { draw: (sh: 'v' | 'a') => renderRel(pr, r, sh), doc: relDoc(pr, r, o) };
  }, [st.mode, st.earth, st.tri, st.eq, pr, st.explain]);
  const fig = out.draw(st.show),
    figA = out.draw('a'),
    figV = out.draw('v'),
    doc = out.doc;
  const tasks = [...taskEntries(REL_PRESETS), ...taskEntries(EARTH_PRESETS), ...taskEntries(TRI_PRESETS), ...taskEntries(EQ_PRESETS)];

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Сложное движение точки</h1>
            <p className="lede">Точка движется по телу, тело вращается вокруг неподвижной оси или движется поступательно: переносные, относительные и абсолютные скорость и ускорение, кориолисово ускорение; движение относительно вращающейся Земли; обратные задачи — треугольник скоростей.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="rpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as AnyRelKey)}>
                <PresetOptions items={tasks} />
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
            <div className="seg" role="group" aria-label="Что показать" hidden={st.mode === 'tri' || st.mode === 'eq'}>
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
            <label className="field">
              <span>Что решаем</span>
              <select id="rmode" value={st.mode} onChange={(e) => store.setMode(e.target.value as RelMode)}>
                <option value="body">точка на движущемся теле</option>
                <option value="earth">движение относительно вращающейся Земли</option>
                <option value="tri">треугольник скоростей: обратная задача</option>
                <option value="eq">уравнения сложного движения и траектория</option>
              </select>
            </label>
            {st.mode === 'body' ? <Editor store={store} pr={pr} /> : st.mode === 'eq' ? <EqEditor store={store} p={st.eq} /> : st.mode === 'earth' ? <EarthEditor store={store} p={st.earth} /> : <TriEditor store={store} p={st.tri} />}
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
            <svg viewBox={figV.viewBox} dangerouslySetInnerHTML={{ __html: figV.svg }} />
            <figcaption>
              {st.mode === 'eq' ? 'Траектория' : st.mode === 'tri' ? (st.tri.what === 'v' ? 'Треугольник скоростей' : 'Сложение ускорений') : 'Скорости'}
            </figcaption>
          </figure>
          {st.mode !== 'tri' && st.mode !== 'eq' && (
            <figure>
              <svg viewBox={figA.viewBox} dangerouslySetInnerHTML={{ __html: figA.svg }} />
              <figcaption>Ускорения</figcaption>
            </figure>
          )}
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

function EqEditor({ store, p }: { store: RelStore; p: EqProblem }) {
  const L = (k: EqStrKey, label: string, wide = false) => (
    <LawField key={k} id={`q-${k}`} label={label} value={p[k]} wide={wide} onType={(s) => store.typeEqStr(k, s)} onEnd={() => store.endSession(`q:${k}`)} />
  );
  const N = (k: EqNumKey, label: string) => (
    <Num key={k} id={`q-${k}`} label={label} value={p[k]} neg zero onType={(v) => store.typeEqNum(k, v)} onEnd={() => store.endSession(`q:${k}`)} />
  );
  const abs = p.dir === 'abs';
  return (
    <>
      <h2>Что задано</h2>
      <label className="field">
        <span>Известно движение</span>
        <select id="qdir" value={p.dir} onChange={(e) => store.setEqDir(e.target.value as EqProblem['dir'])}>
          <option value="abs">относительное (по подвижным осям) — найти абсолютное</option>
          <option value="rel">абсолютное — найти относительное</option>
        </select>
      </label>
      <div className="cgpar cg0">
        {abs ? [L('u', 'ξ(t)'), L('v', 'η(t)'), L('w', 'ζ(t) — пусто: 0')] : [L('u', 'x(t)'), L('v', 'y(t)'), L('w', 'z(t) — пусто: 0')]}
      </div>
      <h2>Переносное движение (подвижные оси)</h2>
      <div className="cgpar cg0">
        {L('X0', 'начало осей: x₀(t)')}
        {L('Y0', 'начало осей: y₀(t)')}
        {L('Z0', 'начало осей: z₀(t) — пусто: 0')}
        {L('phi', 'угол поворота φ(t), рад — пусто: поступательно')}
      </div>
      <div className="cgpar cg0">
        {N('t', 'момент t')}
        {N('t1', 'траектория: от t₁')}
        {N('t2', 'до t₂')}
      </div>
      <p className="empty">
        Оси ξηζ подвижные, ζ ∥ z, повёрнуты на φ от осей xyz. Формулы от t: sin, cos, arctg, exp, sqrt, π; «0,5t^2». Траектория — уравнение, из которого
        исключено t; если его нет (синусоида, спираль), показывается явная запись или полярная форма.
      </p>
    </>
  );
}

function EarthEditor({ store, p }: { store: RelStore; p: EarthKin }) {
  const N = (k: EarthNumKey, label: string, neg = true) => <Num key={k} id={`re-${k}`} label={label} value={p[k]} neg={neg} zero onType={(v) => store.typeEarth(k, v)} onEnd={() => store.endSession(`e:${k}`)} />;
  return (
    <>
      <h2>Земля и место</h2>
      <div className="cgpar cg0">
        {N('lat', 'широта φ, ° (южная — «−»)')}
        {N('h', 'высота h над поверхностью')}
        {N('R', 'радиус Земли R', false)}
        {N('omega', 'ω Земли, рад/с')}
      </div>
      <h2>Скорость относительно Земли</h2>
      <label className="field">
        <span>Задана</span>
        <select id="rvin" value={p.vin} onChange={(e) => store.setEarthVin(e.target.value as EarthKin['vin'])}>
          <option value="enu">составляющими: на восток, на север, вверх</option>
          <option value="course">модулем и курсом</option>
        </select>
      </label>
      <div className="cgpar cg0">
        {p.vin === 'enu' ? [N('vE', 'v_E, на восток'), N('vN', 'v_N, на север')] : [N('v', 'горизонтальная v', false), N('k', 'курс k, ° (от севера к востоку)')]}
        {N('vh', 'v_h, вверх')}
      </div>
      <h2>Изменение составляющих скорости (по осям места)</h2>
      <div className="cgpar cg0">
        {N('dE', 'v̇_E')}
        {N('dN', 'v̇_N')}
        {N('dh', 'v̇_h')}
      </div>
      <p className="empty">Оси места: x — на восток, y — на север, z — вверх. Единицы — согласованные (например, м, м/с, м/с²). ω = 2π/86 400 = 7,272·10⁻⁵ рад/с (сутки) — с этим значением решены задачи книги; по звёздным суткам — 7,292·10⁻⁵. Курс — угол от севера по часовой стрелке: 90° — на восток. Если составляющие скорости постоянны, v̇ = 0 (например, корабль идёт постоянным курсом).</p>
    </>
  );
}

const TRI_NAME: Record<TriVec, string> = { v: 'абсолютная', e: 'переносная', r: 'относительная' };
function TriEditor({ store, p }: { store: RelStore; p: TriProblem }) {
  const L = p.what === 'v' ? 'v' : 'a';
  const row = (k: TriKey, base: TriVec, two = false) => {
    const it = p[k];
    return (
      <div className="cgpar cg0" key={k}>
        <Num id={`rt-${k}-m`} label={`${L}${base === 'v' ? '' : base === 'e' ? 'ₑ' : 'ᵣ'}${two ? '₂' : ''} — ${TRI_NAME[base]}: модуль`} value={it.mod} zero onType={(v) => store.typeTri(k, 'mod', v)} onEnd={() => store.endSession(`t:${k}:mod`)} />
        <label className="toggle">
          <input type="checkbox" id={`rt-${k}-qm`} checked={it.qm} onChange={(e) => store.setTriUnknown(k, 'qm', e.target.checked)} />
          неизвестен
        </label>
        <Num id={`rt-${k}-d`} label="направление, °" value={it.dir} neg zero onType={(v) => store.typeTri(k, 'dir', v)} onEnd={() => store.endSession(`t:${k}:dir`)} />
        <label className="toggle">
          <input type="checkbox" id={`rt-${k}-qd`} checked={it.qd} onChange={(e) => store.setTriUnknown(k, 'qd', e.target.checked)} />
          неизвестно
        </label>
      </div>
    );
  };
  return (
    <>
      <h2>Векторы</h2>
      <label className="field">
        <span>Складываем</span>
        <select id="rtwhat" value={p.what} onChange={(e) => store.setTriOpt({ what: e.target.value as TriProblem['what'] })}>
          <option value="v">скорости: v = vₑ + vᵣ</option>
          <option value="a">ускорения: a = aₑ + aᵣ + a_c</option>
        </select>
      </label>
      <label className="toggle">
        <input type="checkbox" id="rtcompass" checked={p.compass} onChange={(e) => store.setTriOpt({ compass: e.target.checked })} />
        Направления — курсом (от севера по часовой стрелке)
      </label>
      {TRI_VECS.map((k) => row(k, k))}
      {p.what === 'a' && (
        <div className="cgpar cg0">
          <Num id="rt-c-m" label="a_c — кориолисово (известно): модуль" value={p.c.mod} zero onType={(v) => store.typeTriC('mod', v)} onEnd={() => store.endSession('t:c:mod')} />
          <Num id="rt-c-d" label="направление, °" value={p.c.dir} neg zero onType={(v) => store.typeTriC('dir', v)} onEnd={() => store.endSession('t:c:dir')} />
        </div>
      )}
      <label className="toggle">
        <input type="checkbox" id="rttwo" checked={p.two} onChange={(e) => store.setTriOpt({ two: e.target.checked })} />
        Второе наблюдение с общим вектором (ветер, течение)
      </label>
      {p.two && (
        <>
          <label className="field">
            <span>Общий вектор</span>
            <select id="rtshared" value={p.shared} onChange={(e) => store.setTriOpt({ shared: e.target.value as TriVec })}>
              {TRI_VECS.map((k) => (
                <option key={k} value={k}>
                  {TRI_NAME[k]}
                </option>
              ))}
            </select>
          </label>
          {TRI_VECS.filter((k) => k !== p.shared).map((k) => row(`${k}2` as TriKey, k, true))}
        </>
      )}
      <p className="empty">Отметьте неизвестные: два из шести чисел (во втором наблюдении — четыре: модули векторов с известными направлениями и общий вектор). Направление — {p.compass ? 'курс: 0° — на север, 90° — на восток' : 'угол от оси x против часовой стрелки'}. Ветер: абсолютная скорость воздуха = скорость судна (переносная) + ветер, который видит флюгер (относительная); флюгер показывает, откуда дует ветер.</p>
    </>
  );
}
