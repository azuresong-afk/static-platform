/**
 * Экран «Уравнения Лагранжа»: координаты, параметры, T, Π, непотенциальные силы; уравнения движения по шагам,
 * графики q(t) и интеграла энергии, малые колебания.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { parseSym, varName, prettyName, normName, type SymContext } from '../../../shared/sym';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { solveLagrange } from '../model/lagrange';
import { findEquilibria } from '../model/equil';
import { equilSteps } from '../text/equil';
import type { Doc } from '../../../shared/doc';
import { renderPlots } from '../draw/plots';
import { LAGRANGE_PRESETS, type LagrangePresetKey } from '../presets';
import { lagrangeDoc } from '../text/solution';
import { solveReact } from '../model/react';
import { reactSteps } from '../text/react';
import type { LagrangeStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

/** Поле формулы: ошибка разбора подсвечивается, неверная формула не применяется. */
function SymField({ id, label, value, ctx, onType, onEnd, err, wide = true }: { id: string; label: string; value: string; ctx: SymContext; onType: (s: string) => void; onEnd: () => void; err?: string; wide?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const r = parseSym(shown, ctx);
  const msg = !r.ok ? r.error : err;
  return (
    <label className={wide ? 'sfield lg-formula' : 'sfield'}>
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          className={msg ? 'bad' : undefined}
          title={msg}
          value={shown}
          placeholder={wide ? 'пусто — 0' : '0'}
          onChange={(e) => {
            setText(e.target.value);
            if (parseSym(e.target.value, ctx).ok) onType(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
      </span>
      {msg && <small className="lg-err">{msg}</small>}
    </label>
  );
}

export function LagrangeView({ chrome, store }: { chrome: Chrome; store: LagrangeStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveLagrange(pr), [pr]);
  const ok = r.ok ? r : null;
  const eqr = useMemo(() => findEquilibria(pr), [pr]);
  const rr = useMemo(() => (ok && (pr.body || pr.stop != null || pr.program) ? solveReact(pr, ok) : null), [pr, ok]);
  const rok = rr && rr.ok ? rr : null;
  // Без T — только статика: положения равновесия и устойчивость по Π.
  const statOnly = !r.ok && r.field === 'T' && !pr.T.trim() && !!eqr;
  const doc = useMemo((): Doc | null => {
    const es = eqr?.ok ? equilSteps(eqr, { explain: st.explain, hasT: !!pr.T.trim() }) : null;
    const eqErr = eqr && !eqr.ok ? [{ title: 'Положения равновесия', blocks: [{ k: 'badge' as const, tone: 'bad' as const, text: 'проверьте данные' }, { k: 'p' as const, c: [eqr.error] }] }] : [];
    if (ok) {
      const base = lagrangeDoc(pr, ok, { explain: st.explain });
      const rs = rok ? reactSteps(pr, ok, rok, { explain: st.explain }) : null;
      const rErr = rr && !rr.ok ? [{ title: 'Реакция и программное движение', blocks: [{ k: 'badge' as const, tone: 'bad' as const, text: 'проверьте данные' }, { k: 'p' as const, c: [rr.error] }] }] : [];
      const ans = base.steps[base.steps.length - 1];
      const blk = ans.blocks[0];
      const rows = blk.k === 'answer' ? [...blk.rows, ...(rs?.rows ?? []), ...(es?.rows ?? [])] : null;
      return { steps: [...base.steps.slice(0, -1), ...(rs?.steps ?? []), ...rErr, ...(es?.steps ?? []), ...eqErr, rows && blk.k === 'answer' ? { ...ans, blocks: [{ ...blk, rows }] } : ans] };
    }
    if (statOnly) return { steps: [...(es?.steps ?? []), ...eqErr, ...(es ? [{ title: 'Ответ', blocks: [{ k: 'answer' as const, rows: es.rows }] }] : [])] };
    return null;
  }, [pr, ok, rr, rok, eqr, statOnly, st.explain]);
  const plots = useMemo(() => (ok ? renderPlots(ok, rok) : null), [ok, rok]);
  const rerr = (field: string) => (rr && !rr.ok && rr.field === field ? rr.error : undefined);
  const pctx: SymContext = { coords: [], params: pr.params.map((p) => normName(p.name.trim())) };
  const bd = pr.body;
  const ctx: SymContext = { coords: pr.coords.map((c) => normName(c.name.trim())), params: pr.params.map((p) => normName(p.name.trim())) };
  const err = (field: string) => (!r.ok && r.field === field ? r.error : undefined);
  const note = st.preset !== 'custom' ? LAGRANGE_PRESETS[st.preset].note : null;
  const dotted = (n: string, o: number) => varName(prettyName(normName(n.trim()) || 'q'), o);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Уравнения Лагранжа второго рода</h1>
            <p className="lede">По кинетической и потенциальной энергии системы — уравнения движения в обобщённых координатах: производные по шагам, ускорения, интегрирование движения, частоты малых колебаний; реакция связей на тело и отрыв, обобщённые силы программного движения (Мещерский, §43, 48; Яблонский, Д.20).</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="lgpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as LagrangePresetKey)}>
                <PresetOptions items={taskEntries(LAGRANGE_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Движение">
          <div className="bar">
            <span className="hint">{note ?? 'Формулы: скорость — штрихом (x′, φ′), греческие буквы можно писать латиницей (phi, theta), умножение — пробелом или «*».'}</span>
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
          {plots ? (
            <div className="canvas lg-canvas">
              <svg id="lgplot" viewBox={plots.viewBox} role="img" aria-label="Графики" dangerouslySetInnerHTML={{ __html: plots.svg }} />
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>{statOnly ? 'Кинетическая энергия не задана — только положения равновесия и их устойчивость (движение не интегрируется).' : !r.ok ? r.error : 'Задайте время интегрирования, чтобы увидеть графики движения.'}</p>
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Система">
            <h2>Система</h2>
            <div className="sub">Обобщённые координаты</div>
            <div className="lg-table lg-coords">
              <div className="ahead">
                <span>q</span>
                <span>
                  Q<sup>н</sup> (непотенц.)
                </span>
                <span>
                  q<sub>0</sub>
                </span>
                <span>
                  q̇<sub>0</sub>
                </span>
                <span>q* (равнов.)</span>
                <span />
              </div>
              {pr.coords.map((c, i) => (
                <div className="arow" key={i}>
                  <input id={`lg-cn${i}`} className={err('names') || err('coords') ? 'bad lg-name' : 'lg-name'} value={c.name} spellCheck={false} aria-label={`Координата ${i + 1}`} onChange={(e) => store.typeCoord(i, 'name', e.target.value)} onBlur={() => store.endSession(`coord:${i}:name`)} />
                  <SymField id={`lg-q${i}`} label="" wide={false} value={c.Q} ctx={ctx} err={err('Q' + i)} onType={(v) => store.typeCoord(i, 'Q', v)} onEnd={() => store.endSession(`coord:${i}:Q`)} />
                  <Num id={`lg-q0${i}`} label="" value={c.q0} neg zero onType={(v) => store.typeCoord(i, 'q0', v)} onEnd={() => store.endSession(`coord:${i}:q0`)} />
                  <Num id={`lg-v0${i}`} label="" value={c.v0} neg zero onType={(v) => store.typeCoord(i, 'v0', v)} onEnd={() => store.endSession(`coord:${i}:v0`)} />
                  <Num id={`lg-eq${i}`} label="" value={c.eq} neg zero onType={(v) => store.typeCoord(i, 'eq', v)} onEnd={() => store.endSession(`coord:${i}:eq`)} />
                  <button type="button" className="del" aria-label={`Убрать координату ${c.name}`} disabled={pr.coords.length <= 1} onClick={() => store.removeCoord(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="lgaddq" disabled={pr.coords.length >= 3} onClick={store.addCoord}>
                + координата
              </button>
            </div>
            <label className="toggle">
              <input type="checkbox" id="lgeq" checked={!!pr.eqSearch} onChange={(e) => store.setEqSearch(e.target.checked)} />
              найти положения равновесия и исследовать их устойчивость
            </label>
            {pr.eqSearch && pr.coords.length === 1 && (
              <div className="sgrid">
                <Num id="lg-eqfrom" label={`поиск: ${dotted(pr.coords[0].name, 0)} от`} value={pr.eqSearch.from} neg zero onType={(v) => store.typeEqRange('from', v)} onEnd={() => store.endSession('eq:from')} />
                <Num id="lg-eqto" label="до" value={pr.eqSearch.to} neg zero onType={(v) => store.typeEqRange('to', v)} onEnd={() => store.endSession('eq:to')} />
              </div>
            )}
            {pr.eqSearch && (
              <p className="empty">
                {pr.coords.length === 1
                  ? 'Углы — в радианах (−3,1415 … 3,1416 — один оборот). Кинетическую энергию T для равновесия можно не задавать; если она задана, найдутся и частоты малых колебаний.'
                  : 'Для нескольких координат положение равновесия уточняется методом Ньютона от приближения q* в таблице.'}
              </p>
            )}
            <div className="sub">Энергия</div>
            <div className="sgrid">
              <SymField id="lg-T" label={`T(q, ${pr.coords.map((c) => dotted(c.name, 1)).join(', ')})`} value={pr.T} ctx={ctx} err={err('T')} onType={(v) => store.typeText('T', v)} onEnd={() => store.endSession('T')} />
              <SymField id="lg-P" label="Π(q)" value={pr.P} ctx={ctx} err={err('P')} onType={(v) => store.typeText('P', v)} onEnd={() => store.endSession('P')} />
            </div>
            <div className="sub">Параметры</div>
            <div className="lg-table lg-params">
              {pr.params.map((p, i) => (
                <div className="arow" key={i}>
                  <input id={`lg-pn${i}`} className={err('names') ? 'bad lg-name' : 'lg-name'} value={p.name} spellCheck={false} aria-label={`Параметр ${i + 1}`} onChange={(e) => store.typeParam(i, 'name', e.target.value)} onBlur={() => store.endSession(`param:${i}:name`)} />
                  <span className="lg-eqs">=</span>
                  <Num id={`lg-pv${i}`} label="" value={p.value} neg zero onType={(v) => store.typeParam(i, 'value', v)} onEnd={() => store.endSession(`param:${i}:value`)} />
                  <button type="button" className="del" aria-label={`Убрать параметр ${p.name}`} onClick={() => store.removeParam(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="lgaddp" onClick={store.addParam}>
                + параметр
              </button>
            </div>
            <div className="sgrid">
              <Num id="lg-tend" label="Время интегрирования" unit="с" value={pr.tEnd} zero onType={store.typeTime} onEnd={() => store.endSession('tEnd')} />
            </div>
            <div className="sub">Реакции, отрыв, программное движение</div>
            <label className="toggle">
              <input type="checkbox" id="lgbody" checked={!!bd} onChange={(e) => store.setBody(e.target.checked)} />
              реакция связей на тело и отрыв (нужен параметр g)
            </label>
            {bd && (
              <>
                <div className="sgrid">
                  <SymField
                    id="lg-bm"
                    label="m — масса тела"
                    wide={false}
                    value={bd.m}
                    ctx={pctx}
                    err={rerr('bm')}
                    onType={(v) => store.typeBody('m', v)}
                    onEnd={() => store.endSession('body:m')}
                  />
                  <SymField
                    id="lg-bx"
                    label="x_C(q)"
                    wide={false}
                    value={bd.x}
                    ctx={ctx}
                    err={rerr('bx')}
                    onType={(v) => store.typeBody('x', v)}
                    onEnd={() => store.endSession('body:x')}
                  />
                  <SymField
                    id="lg-by"
                    label="y_C(q), ось вверх"
                    wide={false}
                    value={bd.y}
                    ctx={ctx}
                    err={rerr('by')}
                    onType={(v) => store.typeBody('y', v)}
                    onEnd={() => store.endSession('body:y')}
                  />
                  <SymField
                    id="lg-bdir"
                    label="β — угол оси e с осью x (пусто — оси x, y)"
                    wide={false}
                    value={bd.dir}
                    ctx={ctx}
                    err={rerr('bdir')}
                    onType={(v) => store.typeBody('dir', v)}
                    onEnd={() => store.endSession('body:dir')}
                  />
                  <SymField
                    id="lg-bangle"
                    label="угол поворота тела (для ω)"
                    wide={false}
                    value={bd.angle}
                    ctx={ctx}
                    err={rerr('bangle')}
                    onType={(v) => store.typeBody('angle', v)}
                    onEnd={() => store.endSession('body:angle')}
                  />
                  <SymField
                    id="lg-bfrom"
                    label="q₀ в буквах — движение из покоя (для R(q))"
                    wide={false}
                    value={bd.from}
                    ctx={pctx}
                    err={rerr('bfrom')}
                    onType={(v) => store.typeBody('from', v)}
                    onEnd={() => store.endSession('body:from')}
                  />
                  <label className="field">
                    <span>Отрыв</span>
                    <select id="lg-bsep" value={bd.sep} onChange={(e) => store.setBodyChoice('sep', e.target.value as 'none' | 'e' | 'n')}>
                      <option value="none">не искать</option>
                      <option value="e">{bd.dir.trim() ? 'R_e = 0' : 'R_x = 0'}</option>
                      <option value="n">{bd.dir.trim() ? 'R_n = 0' : 'R_y = 0'}</option>
                    </select>
                  </label>
                </div>
                <label className="toggle">
                  <input type="checkbox" id="lg-bflight" checked={bd.flight} onChange={(e) => store.setBodyChoice('flight', e.target.checked)} />
                  после отрыва (или заданного положения) тело свободно — траектория центра масс
                </label>
              </>
            )}
            <label className="toggle">
              <input type="checkbox" id="lgstop" checked={pr.stop != null} onChange={(e) => store.setStop(e.target.checked)} />
              состояние в момент, когда {dotted(pr.coords[0]?.name ?? 'q', 0)} достигает значения
            </label>
            {pr.stop != null && (
              <div className="sgrid">
                <SymField
                  id="lg-stop"
                  label={`${dotted(pr.coords[0]?.name ?? 'q', 0)} =`}
                  wide={false}
                  value={pr.stop}
                  ctx={pctx}
                  err={rerr('stop')}
                  onType={store.typeStop}
                  onEnd={() => store.endSession('stop')}
                />
              </div>
            )}
            <label className="toggle">
              <input type="checkbox" id="lgprog" checked={!!pr.program} onChange={(e) => store.setProgram(e.target.checked)} />
              программное движение: найти обобщённые силы по законам qⱼ(t)
            </label>
            {pr.program && (
              <div className="sgrid">
                {pr.coords.map((c, i) => (
                  <SymField
                    key={i}
                    id={`lg-law${i}`}
                    label={`${dotted(c.name, 0)}(t)`}
                    value={pr.program!.laws[i] ?? ''}
                    ctx={pctx}
                    err={rerr('law' + i)}
                    onType={(v) => store.typeLaw(i, v)}
                    onEnd={() => store.endSession(`law:${i}`)}
                  />
                ))}
                <SymField
                  id="lg-at"
                  label="момент t*"
                  wide={false}
                  value={pr.program.at}
                  ctx={pctx}
                  err={rerr('at')}
                  onType={store.typeAt}
                  onEnd={() => store.endSession('law:at')}
                />
              </div>
            )}
            {err('names') && <p className="lg-err">{err('names')}</p>}
            {err('coords') && <p className="lg-err">{err('coords')}</p>}
            <p className="empty">Параметры остаются в формулах буквами; числа нужны для ускорений, графиков и частот. Единицы — СИ.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="lgsolution">{doc ? <DocView doc={doc} /> : <p className="empty">{!r.ok ? r.error : ''}</p>}</div>
          </section>
        </div>
      </div>
      {doc && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Уравнения Лагранжа второго рода · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          {plots && (
            <section className="pr-sec pr-figs">
              <figure>
                <svg viewBox={plots.viewBox} role="img" aria-label="Графики" dangerouslySetInnerHTML={{ __html: plots.svg }} />
                <figcaption>Движение системы</figcaption>
              </figure>
            </section>
          )}
          <section className="pr-sec">
            <h2>Решение</h2>
            <DocView doc={doc} />
          </section>
        </article>
      )}
    </>
  );
}
