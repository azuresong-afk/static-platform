/** Экран «Плоский механизм»: точки, звенья, связи, ведущие; чертёж со скоростями или ускорениями, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderMech, renderPlot } from '../draw/mech';
import { type MCons, type MDrive, type MechProblem, type MLoad, type MMass, type PtDef } from '../model/mech';
import { plotKeys, solveMech } from '../model/solve';
import { MECH_PRESETS, type MechPresetKey } from '../presets';
import { mechDoc } from '../text/solution';
import { MAX_ITEMS, type MechStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

export function MechView({ chrome, store }: { chrome: Chrome; store: MechStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveMech(pr), [pr]);
  const fig = useMemo(() => renderMech(pr, r, pr.acc === false ? 'v' : st.show), [pr, r, st.show]);
  const figA = useMemo(() => renderMech(pr, r, 'a'), [pr, r]);
  const doc = useMemo(() => mechDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const plot = useMemo(() => (r.plot ? renderPlot(r.plot) : null), [r]);
  const keys = useMemo(() => (pr.param ? plotKeys(pr) : []), [pr]);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Плоский механизм</h1>
            <p className="lede">
              Скорости и ускорения точек и звеньев (МЦС, метод полюса, кулисы — теорема Кориолиса), равновесие механизма по принципу возможных перемещений, кинетическая энергия и теорема об её изменении, график по
              положению механизма. Механизм собирается из точек, звеньев, опор, ползунов, кулис и колёс.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="mpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as MechPresetKey)}>
                <PresetOptions items={taskEntries(MECH_PRESETS)} />
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
              <button type="button" id="mshow-a" aria-pressed={st.show === 'a'} disabled={pr.acc === false} onClick={() => store.setShow('a')}>
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
        {pr.param && (
          <section className="sheet" aria-label="График по φ">
            <div className="bar">
              <label className="field mc-plotsel">
                <span>График по φ</span>
                <select id="mplot" value={keys.some((k) => k[0] === pr.plot) ? pr.plot : ''} onChange={(e) => store.setPlot(e.target.value)}>
                  <option value="">— выберите величину —</option>
                  {keys.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {plot && (
              <div className="canvas">
                <svg id="mplotsvg" className="sketch" viewBox={plot.viewBox} role="img" aria-label="График величины по параметру φ" dangerouslySetInnerHTML={{ __html: plot.svg }} />
              </div>
            )}
          </section>
        )}
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
          {pr.acc !== false && (
            <figure>
              <svg viewBox={figA.viewBox} dangerouslySetInnerHTML={{ __html: figA.svg }} />
              <figcaption>Ускорения</figcaption>
            </figure>
          )}
          {plot && (
            <figure>
              <svg viewBox={plot.viewBox} dangerouslySetInnerHTML={{ __html: plot.svg }} />
              <figcaption>{r.plot!.label}</figcaption>
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

const KINDS: [PtDef['k'], string][] = [
  ['xy', 'координаты x, y'],
  ['polar', 'от точки: длина и угол'],
  ['two', 'на расстояниях от двух точек'],
  ['line', 'на прямой, на расстоянии от точки'],
  ['seg', 'на отрезке (доля длины)'],
  ['cross', 'пересечение двух прямых'],
];
const CONS: [MCons['k'], string][] = [
  ['fixed', 'неподвижный шарнир'],
  ['slider', 'ползун на прямой направляющей'],
  ['roll', 'колесо катится по неподвижной прямой'],
  ['gear', 'зацепление (качение) двух колёс'],
  ['guide', 'кулисный камень: точка скользит по звену'],
  ['trans', 'звено движется поступательно'],
];
const LOADS: [MLoad['k'], string][] = [
  ['force', 'сила'],
  ['couple', 'пара сил'],
  ['hinge', 'момент сопротивления в шарнире'],
];
const MASSES: [MMass['k'], string][] = [
  ['point', 'точечная масса'],
  ['rod', 'однородный стержень'],
  ['body', 'тело: диск, обод, J'],
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
  // φ допустим в числовых полях, когда задан параметр положения (кроме полей самого параметра).
  const prep = (path: (string | number)[]) => (pr.param && path[0] !== 'param' ? (s: string) => s.replace(/φ|phi/g, '(1)') : undefined);
  const T = (path: (string | number)[], label: string, value: string) => (
    <LawField key={path.join('.')} id={`m-${path.join('-')}`} label={label} value={value} wide={false} prep={prep(path)} onType={(v) => store.type(path, v)} onEnd={end(path.join('.'))} />
  );
  const ptOpts = (upto?: number): [string, string][] => pr.points.slice(0, upto).map((q) => [q.name, q.name]);
  const bodyOpts: [string, string][] = pr.bodies.map((b) => [b.name, b.name]);
  const segOpts: [string, string][] = pr.bodies.flatMap((b) => b.pts.flatMap((a, i) => b.pts.slice(i + 1).flatMap((c) => [[`${a}>${c}`, `направления ${a}→${c}`], [`${c}>${a}`, `направления ${c}→${a}`]] as [string, string][])));
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
                {d.k === 'polar' && [
                  P([...base, 'from'], 'от точки', d.from, i),
                  T([...base, 'L'], 'длина', d.L),
                  <Sel key="to" id={`m-points-${i}-def-to`} label="угол отсчитан от" value={d.to ?? ''} opts={[['', 'оси x'], ...ptOpts(i).map(([v]) => [v, `направления на ${v}`] as [string, string])]} onPick={(v) => store.pick([...base, 'to'], v)} />,
                  T([...base, 'ang'], 'угол, °', d.ang),
                ]}
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
                {d.k === 'cross' &&
                  ([1, 2] as const).flatMap((j) => {
                    const pk = `p${j}` as 'p1' | 'p2',
                      qk = `q${j}` as 'q1' | 'q2',
                      ak = `a${j}` as 'a1' | 'a2';
                    return [
                      P([...base, pk], `прямая ${j} через`, d[pk], i),
                      <Sel key={qk} id={`m-points-${i}-def-${qk}`} label="и" value={d[qk]} opts={[['', 'под углом'], ...ptOpts(i).map(([v]) => [v, `через ${v}`] as [string, string])]} onPick={(v) => store.pick([...base, qk], v)} />,
                      ...(d[qk] ? [] : [T([...base, ak], 'угол, °', d[ak])]),
                    ];
                  })}
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
                {c.k === 'guide' && [P([...base, 'p'], 'камень (точка)', c.p), B([...base, 'b'], 'скользит по звену', c.b), P([...base, 'g1'], 'вдоль прямой от', c.g1), P([...base, 'g2'], 'к', c.g2)]}
                {c.k === 'trans' && B([...base, 'b'], 'звено', c.b)}
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
      <label className="toggle">
        <input type="checkbox" id="macc" checked={pr.acc !== false} onChange={(e) => store.setAcc(e.target.checked)} />
        считать ускорения
      </label>

      <h2>Положение механизма</h2>
      <label className="toggle">
        <input type="checkbox" id="mparam" checked={!!pr.param} onChange={(e) => store.setParam(e.target.checked)} />
        параметр положения φ (график, теорема об энергии)
      </label>
      {pr.param && (
        <>
          <div className="cgpar">
            {T(['param', 'val'], 'φ, °', pr.param.val)}
            {T(['param', 'from'], 'график: от, °', pr.param.from)}
            {T(['param', 'to'], 'до, °', pr.param.to)}
          </div>
          <p className="empty">φ — число градусов; пишите его в любом числовом поле: угол кривошипа «φ», «90−φ». В тригонометрических функциях переводите в радианы: cos(φ·π/180).</p>
        </>
      )}

      <h2>Силы</h2>
      <div className="asteps" id="mloads">
        {(pr.loads ?? []).map((l, i) => {
          const base = ['loads', i];
          return (
            <div key={i}>
              <div className="cvrow cvrow2">
                <span className="hint">{i + 1}</span>
                <select aria-label="Вид нагрузки" value={l.k} onChange={(e) => store.setLoadKind(i, e.target.value as MLoad['k'])}>
                  {LOADS.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
                <button type="button" className="del" aria-label="Убрать нагрузку" onClick={() => store.removeLoad(i)}>
                  ×
                </button>
              </div>
              <div className="cgpar">
                {l.k === 'force' && [
                  P([...base, 'p'], 'точка', l.p),
                  ...(l.unknown ? [] : [T([...base, 'F'], 'F', l.F)]),
                  T([...base, 'ang'], 'угол, °', l.ang),
                  <Sel key="ref" id={`m-loads-${i}-ref`} label="угол отсчитан от" value={l.ref ? `${l.ref}>${l.ref2}` : ''} opts={[['', 'оси x'], ...segOpts]} onPick={(v) => store.setLoadRef(i, v.split('>')[0] ?? '', v.split('>')[1] ?? '')} />,
                ]}
                {l.k === 'couple' && [B([...base, 'b'], 'звено', l.b), ...(l.unknown ? [] : [T([...base, 'M'], 'M (+ против часовой)', l.M)])]}
                {l.k === 'hinge' && [B([...base, 'b1'], 'звено 1', l.b1), B([...base, 'b2'], 'звено 2', l.b2, true), T([...base, 'M'], 'момент сопротивления', l.M)]}
                {l.k !== 'hinge' && (
                  <label className="toggle">
                    <input type="checkbox" id={`m-loads-${i}-unknown`} checked={l.unknown} onChange={(e) => store.setUnknown(i, e.target.checked)} />
                    неизвестная (из условия равновесия)
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="segbtns">
        {LOADS.map(([k, t]) => (
          <button key={k} type="button" id={`maddl-${k}`} onClick={() => store.addLoad(k)}>
            + {t}
          </button>
        ))}
      </div>
      <p className="empty">Отметьте одну силу или пару как неизвестную — она найдётся из принципа возможных перемещений. Без неизвестной считаются мощность сил и приведённый момент.</p>

      <h2>Массы</h2>
      <div className="asteps" id="mmasses">
        {(pr.masses ?? []).map((m, i) => {
          const base = ['masses', i];
          return (
            <div key={i}>
              <div className="cvrow cvrow2">
                <span className="hint">{i + 1}</span>
                <select aria-label="Вид массы" value={m.k} onChange={(e) => store.setMassKind(i, e.target.value as MMass['k'])}>
                  {MASSES.map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
                <button type="button" className="del" aria-label="Убрать массу" onClick={() => store.removeMass(i)}>
                  ×
                </button>
              </div>
              <div className="cgpar">
                {m.k === 'point' && [P([...base, 'p'], 'точка', m.p), T([...base, 'm'], 'm', m.m)]}
                {m.k === 'rod' && [P([...base, 'p1'], 'от точки', m.p1), P([...base, 'p2'], 'до точки', m.p2), T([...base, 'm'], 'm', m.m)]}
                {m.k === 'body' && [
                  B([...base, 'b'], 'звено', m.b),
                  P([...base, 'c'], 'центр масс', m.c),
                  T([...base, 'm'], 'm', m.m),
                  <Sel key="shape" id={`m-masses-${i}-shape`} label="момент инерции" value={m.shape} opts={[['disk', 'диск: m r²/2'], ['ring', 'обод: m r²'], ['J', 'задан J_C']]} onPick={(v) => store.pick([...base, 'shape'], v)} />,
                  m.shape === 'J' ? T([...base, 'J'], 'J_C', m.J) : T([...base, 'r'], 'радиус r', m.r),
                ]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="segbtns">
        {MASSES.map(([k, t]) => (
          <button key={k} type="button" id={`maddm-${k}`} onClick={() => store.addMass(k)}>
            + {t}
          </button>
        ))}
      </div>
      <label className="toggle">
        <input type="checkbox" id="mgrav" checked={!!pr.g} onChange={(e) => store.setGravity(e.target.checked)} />
        учитывать вес масс (ось y — вверх)
      </label>
      {pr.g ? <div className="cgpar">{T(['g'], 'g', pr.g)}</div> : null}
      <label className="toggle">
        <input type="checkbox" id="menergy" checked={!!pr.energy} onChange={(e) => store.setEnergy(e.target.checked)} />
        теорема об изменении кинетической энергии: скорость в положении φ
      </label>
      {pr.energy && (
        <div className="cgpar">
          {T(['energy', 'phi0'], 'начальное φ₀, °', pr.energy.phi0)}
          {T(['energy', 'w0'], 'скорость ведущего при φ₀', pr.energy.w0)}
        </div>
      )}
      <p className="empty">Единицы — согласованные (например, кг, м, Н, рад/с). Скорость в теореме об энергии — величина ведущего условия (ω кривошипа или скорость точки).</p>
    </>
  );
}
