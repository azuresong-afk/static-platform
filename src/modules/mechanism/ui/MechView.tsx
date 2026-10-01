/** Экран «Плоский механизм»: точки, звенья, связи, ведущие; чертёж со скоростями или ускорениями, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderMech } from '../draw/mech';
import { solveMech, type MCons, type MDrive, type MechProblem, type PtDef } from '../model/mech';
import { MECH_PRESETS, type MechPresetKey } from '../presets';
import { mechDoc } from '../text/solution';
import { MAX_ITEMS, type MechStore } from './store';

export function MechView({ chrome, store }: { chrome: Chrome; store: MechStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveMech(pr), [pr]);
  const fig = useMemo(() => renderMech(pr, r, st.show), [pr, r, st.show]);
  const figA = useMemo(() => renderMech(pr, r, 'a'), [pr, r]);
  const doc = useMemo(() => mechDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Плоский механизм</h1>
            <p className="lede">Скорости точек и угловые скорости звеньев через мгновенные центры скоростей, ускорения методом полюса, мгновенные центры ускорений. Механизм собирается из точек, звеньев, опор, ползунов и колёс.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="mpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as MechPresetKey)}>
                {(Object.keys(MECH_PRESETS) as MechPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {MECH_PRESETS[k].title}
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
        <section className="sheet" aria-label="Механизм">
          <div className="bar">
            <div className="seg" role="group" aria-label="Что показать">
              <button type="button" id="mshow-v" aria-pressed={st.show === 'v'} onClick={() => store.setShow('v')}>
                Скорости и МЦС
              </button>
              <button type="button" id="mshow-a" aria-pressed={st.show === 'a'} onClick={() => store.setShow('a')}>
                Ускорения и МЦУ
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
            <svg id="msvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Механизм со скоростями или ускорениями точек" dangerouslySetInnerHTML={{ __html: fig.svg }} />
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
            <div id="msolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Плоский механизм · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: renderMech(pr, r, 'v').svg }} />
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

const KINDS: [PtDef['k'], string][] = [
  ['xy', 'координаты x, y'],
  ['polar', 'от точки: длина и угол'],
  ['two', 'на расстояниях от двух точек'],
  ['line', 'на прямой, на расстоянии от точки'],
  ['seg', 'на отрезке (доля длины)'],
];
const CONS: [MCons['k'], string][] = [
  ['fixed', 'неподвижный шарнир'],
  ['slider', 'ползун на прямой направляющей'],
  ['roll', 'колесо катится по неподвижной прямой'],
  ['gear', 'зацепление (качение) двух колёс'],
];
const DRIVES: [MDrive['k'], string][] = [
  ['omega', 'угловая скорость звена'],
  ['proj', 'скорость точки вдоль направления'],
  ['vec', 'вектор скорости точки'],
];

function Sel({ id, label, value, opts, onPick }: { id: string; label: string; value: string; opts: [string, string][]; onPick: (v: string) => void }) {
  return (
    <label className="sfield">
      <span>{label}</span>
      <span className="inp">
        <select id={id} value={value} onChange={(e) => onPick(e.target.value)}>
          {!opts.some((o) => o[0] === value) && <option value={value}>{value || '—'}</option>}
          {opts.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function Editor({ store, pr }: { store: MechStore; pr: MechProblem }) {
  const end = (k: string) => () => store.endSession(k);
  const T = (path: (string | number)[], label: string, value: string) => <LawField key={path.join('.')} id={`m-${path.join('-')}`} label={label} value={value} wide={false} onType={(v) => store.type(path, v)} onEnd={end(path.join('.'))} />;
  const ptOpts = (upto?: number): [string, string][] => pr.points.slice(0, upto).map((q) => [q.name, q.name]);
  const bodyOpts: [string, string][] = pr.bodies.map((b) => [b.name, b.name]);
  const P = (path: (string | number)[], label: string, value: string, upto?: number) => <Sel key={path.join('.')} id={`m-${path.join('-')}`} label={label} value={value} opts={ptOpts(upto)} onPick={(v) => store.pick(path, v)} />;
  const B = (path: (string | number)[], label: string, value: string, ground = false) => <Sel key={path.join('.')} id={`m-${path.join('-')}`} label={label} value={value} opts={ground ? [['', 'неподвижное'], ...bodyOpts] : bodyOpts} onPick={(v) => store.pick(path, v)} />;
  return (
    <>
      <h2>Точки</h2>
      <p className="empty">Числа — формулы без t: 15/cos(π/6), 30sqrt(3); углы — в градусах от оси x против часовой стрелки. Ссылаться можно на точки выше.</p>
      <div className="asteps" id="mpoints">
        {pr.points.map((q, i) => {
          const d = q.def;
          const base = ['points', i, 'def'];
          return (
            <div key={i}>
              <div className="cvrow cvrow2">
                <span className="inp cv-name">
                  <input type="text" aria-label="Имя точки" value={q.name} onChange={(e) => store.renamePoint(i, e.target.value)} onBlur={end(`pn:${i}`)} />
                </span>
                <select aria-label={`Построение точки ${q.name}`} value={d.k} onChange={(e) => store.setPointKind(i, e.target.value as PtDef['k'])}>
                  {KINDS.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
                <button type="button" className="del" aria-label="Убрать точку" onClick={() => store.removePoint(i)}>
                  ×
                </button>
              </div>
              <div className="cgpar">
                {d.k === 'xy' && [T([...base, 'x'], 'x', d.x), T([...base, 'y'], 'y', d.y)]}
                {d.k === 'polar' && [P([...base, 'from'], 'от точки', d.from, i), T([...base, 'L'], 'длина', d.L), T([...base, 'ang'], 'угол, °', d.ang)]}
                {d.k === 'two' && [
                  P([...base, 'p1'], 'точка 1', d.p1, i),
                  T([...base, 'L1'], 'расстояние 1', d.L1),
                  P([...base, 'p2'], 'точка 2', d.p2, i),
                  T([...base, 'L2'], 'расстояние 2', d.L2),
                  <Sel key="side" id={`m-side-${i}`} label="сторона" value={String(d.side)} opts={[['1', 'слева от 1→2'], ['-1', 'справа от 1→2']]} onPick={(v) => store.pick([...base, 'side'], +v)} />,
                ]}
                {d.k === 'line' && [
                  P([...base, 'through'], 'прямая через', d.through, i),
                  T([...base, 'ang'], 'её угол, °', d.ang),
                  P([...base, 'from'], 'расстояние от', d.from, i),
                  T([...base, 'L'], 'расстояние', d.L),
                  <Sel key="side" id={`m-side-${i}`} label="решение" value={String(d.side)} opts={[['1', 'дальше по направлению'], ['-1', 'ближе по направлению']]} onPick={(v) => store.pick([...base, 'side'], +v)} />,
                ]}
                {d.k === 'seg' && [P([...base, 'p1'], 'от', d.p1, i), P([...base, 'p2'], 'до', d.p2, i), T([...base, 't'], 'доля (1/2 — середина)', d.t)]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="segbtns">
        <button type="button" id="maddpt" disabled={pr.points.length >= MAX_ITEMS} onClick={store.addPoint}>
          + точка
        </button>
      </div>
      <h2>Звенья</h2>
      <div className="asteps" id="mbodies">
        {pr.bodies.map((b, i) => (
          <div key={i}>
            <div className="cvrow cvrow2">
              <span className="inp cv-name">
                <input type="text" aria-label="Имя звена" value={b.name} onChange={(e) => store.renameBody(i, e.target.value)} onBlur={end(`bn:${i}`)} />
              </span>
              <span className="mc-chips">
                {pr.points.map((q) => (
                  <label key={q.name} className="toggle">
                    <input type="checkbox" checked={b.pts.includes(q.name)} onChange={() => store.toggleBodyPt(i, q.name)} />
                    {q.name}
                  </label>
                ))}
              </span>
              <button type="button" className="del" aria-label="Убрать звено" onClick={() => store.removeBody(i)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="segbtns">
        <button type="button" id="maddbody" disabled={pr.bodies.length >= MAX_ITEMS} onClick={store.addBody}>
          + звено
        </button>
      </div>
      <p className="empty">Звено — жёсткое тело из отмеченных точек (стержень, треугольник, колесо). Точка, не входящая ни в одно звено, — вспомогательная для построения.</p>
      <h2>Связи</h2>
      <div className="asteps" id="mcons">
        {pr.cons.map((c, i) => {
          const base = ['cons', i];
          return (
            <div key={i}>
              <div className="cvrow cvrow2">
                <span className="hint">{i + 1}</span>
                <select aria-label="Вид связи" value={c.k} onChange={(e) => store.setConsKind(i, e.target.value as MCons['k'])}>
                  {CONS.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
                <button type="button" className="del" aria-label="Убрать связь" onClick={() => store.removeCons(i)}>
                  ×
                </button>
              </div>
              <div className="cgpar">
                {c.k === 'fixed' && P([...base, 'p'], 'точка', c.p)}
                {c.k === 'slider' && [P([...base, 'p'], 'точка', c.p), T([...base, 'ang'], 'угол направляющей, °', c.ang)]}
                {c.k === 'roll' && [B([...base, 'b'], 'колесо (звено)', c.b), P([...base, 'c'], 'центр', c.c), T([...base, 'r'], 'радиус', c.r), T([...base, 'ang'], 'угол прямой, ° (колесо слева)', c.ang)]}
                {c.k === 'gear' && [
                  B([...base, 'b1'], 'колесо 1', c.b1),
                  P([...base, 'c1'], 'его центр', c.c1),
                  T([...base, 'r1'], 'радиус 1', c.r1),
                  B([...base, 'b2'], 'колесо 2', c.b2, true),
                  P([...base, 'c2'], 'его центр', c.c2),
                  T([...base, 'r2'], 'радиус 2', c.r2),
                  <label key="int" className="toggle">
                    <input type="checkbox" checked={c.int} onChange={(e) => store.pick([...base, 'int'], e.target.checked)} />
                    внутреннее зацепление
                  </label>,
                ]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="segbtns">
        {CONS.map(([k, t]) => (
          <button key={k} type="button" id={`maddc-${k}`} disabled={pr.cons.length >= MAX_ITEMS} onClick={() => store.addCons(k)}>
            + {t}
          </button>
        ))}
      </div>
      <h2>Ведущие</h2>
      <div className="asteps" id="mdrives">
        {pr.drives.map((d, i) => {
          const base = ['drives', i];
          return (
            <div key={i}>
              <div className="cvrow cvrow2">
                <span className="hint">{i + 1}</span>
                <select aria-label="Что задано" value={d.k} onChange={(e) => store.setDriveKind(i, e.target.value as MDrive['k'])}>
                  {DRIVES.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
                <button type="button" className="del" aria-label="Убрать ведущее" onClick={() => store.removeDrive(i)}>
                  ×
                </button>
              </div>
              <div className="cgpar">
                {d.k === 'omega' && [B([...base, 'b'], 'звено', d.b), T([...base, 'w'], 'ω, рад/с (+ против часовой)', d.w), T([...base, 'e'], 'ε, рад/с²', d.e)]}
                {d.k === 'proj' && [P([...base, 'p'], 'точка', d.p), T([...base, 'ang'], 'направление, °', d.ang), T([...base, 'v'], 'v вдоль него', d.v), T([...base, 'a'], 'a вдоль него', d.a)]}
                {d.k === 'vec' && [P([...base, 'p'], 'точка', d.p), T([...base, 'v'], '|v|', d.v), T([...base, 'vang'], 'угол v, °', d.vang), T([...base, 'a'], '|a|', d.a), T([...base, 'aang'], 'угол a, °', d.aang)]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="segbtns">
        {DRIVES.map(([k, t]) => (
          <button key={k} type="button" id={`maddd-${k}`} disabled={pr.drives.length >= 4} onClick={() => store.addDrive(k)}>
            + {t}
          </button>
        ))}
      </div>
      <p className="empty">Ведущих условий нужно столько, какова подвижность механизма (обычно одно — угловая скорость кривошипа).</p>
    </>
  );
}
