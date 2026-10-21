/**
 * Код, выполняемый на странице прототипа (подключается как есть, без сборки).
 * Снимает решение готовой задачи или случайной конструкции и результат операций редактирования.
 */
window.__capture = function (args) {
  const P = window.__P;
  const st = P.state;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const $ = (s) => document.querySelector(s);

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(seed) {
    const rnd = mulberry32(seed);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    let nid = 1,
      sid = 1,
      uid = 1;
    const nodes = [{ id: 'n' + nid++ }],
      segs = [];
    const nSeg = 1 + Math.floor(rnd() * 5);
    const lens = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 1.25];
    for (let tries = 0; segs.length < nSeg && tries < 60; tries++) {
      const a = pick(nodes).id,
        dir = pick(['r', 'r', 'r', 'l', 'u', 'u', 'd']);
      const n = { id: 'n' + nid },
        s = { id: 's' + sid, a, b: n.id, dir, len: pick(lens) };
      st.nodes = [...nodes, n];
      st.segs = [...segs, s];
      if (P.geomOK()) {
        nodes.push(n);
        segs.push(s);
        nid++;
        sid++;
      }
    }
    st.nodes = nodes;
    st.segs = segs;
    const ids = nodes.map((n) => n.id);
    const node = () => (rnd() < 0.02 ? 'n999' : pick(ids));
    const items = [];
    const nSup = pick([0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3]);
    for (let i = 0; i < nSup; i++) {
      const type = pick(['fixed', 'pin', 'pin', 'pin', 'roller', 'roller', 'roller', 'rod', 'rod']);
      const it = { id: 'e' + uid++, type, at: node() };
      if (type === 'rod') it.angle = pick([0, 30, 45, 60, 90, 90, 120, 135, 150, 180, 225, 270, 300]);
      else it.side = pick(['below', 'below', 'above', 'left', 'right']);
      if (type === 'roller') {
        it.angle = 90;
        if (rnd() < 0.25) {
          it.side = 'tilt';
          it.angle = pick([30, 45, 60, 120, 135, 150, 210, 315]);
        }
      }
      items.push(it);
    }
    const nLoads = Math.floor(rnd() * 5);
    for (let i = 0; i < nLoads; i++) {
      const type = pick(['force', 'force', 'force', 'weight', 'moment', 'moment', 'dist', 'dist']);
      const id = 'e' + uid++;
      if (type === 'force')
        items.push({
          id,
          type,
          at: node(),
          F: pick([2, 4, 5, 6, 8, 10, 12.5, -3]),
          ref: pick(['right', 'left', 'up', 'down', 'down']),
          rot: pick(['cw', 'ccw']),
          alpha: pick([0, 0, 0, 30, 45, 60, 90, 120, 150, 200]),
          unknown: rnd() < 0.12,
        });
      else if (type === 'weight') items.push({ id, type, at: node(), G: pick([3, 5, 10, 12]) });
      else if (type === 'moment')
        items.push({ id, type, at: node(), M: pick([2, 4, 6, 8, 10]), dir: pick(['cw', 'ccw']), unknown: rnd() < 0.12 });
      else {
        let from, to;
        if (rnd() < 0.7) {
          const s = pick(segs);
          from = s.a;
          to = s.b;
          if (rnd() < 0.3) [from, to] = [to, from];
        } else {
          from = pick(ids);
          to = pick(ids);
        }
        items.push({ id, type, from, to, q1: pick([0, 1, 2, 2, 3, 4, -2]), q2: pick([0, 1, 2, 2, 3, 4, -2]), dir: pick(['down', 'up', 'left', 'right']) });
      }
    }
    // buildModel() прототипа правит элементы на месте, поэтому ему отдаётся копия.
    st.items = clone(items);
    st.notTarget = new Set();
    // «Что найти»: иногда часть неизвестных помечается промежуточными.
    const m0 = P.buildModel();
    const nt = m0.unknowns.map((u) => u.key).filter(() => rnd() < 0.3);
    return { nodes: clone(nodes), segs: clone(segs), items: clone(items), notTarget: nt, rnd };
  }

  let input, rnd = null;
  if (args.mode === 'preset') {
    // Счётчики идентификаторов с 1 — как у свежезагруженной задачи в порте.
    P.resetIds();
    P.loadPreset(args.key);
    input = null;
  } else {
    // Новые точки и участки при «разделить» не должны совпасть с идентификаторами случайной конструкции.
    P.setIds(1000);
    const g = generate(args.seed);
    rnd = g.rnd;
    input = { nodes: g.nodes, segs: g.segs, items: g.items, notTarget: g.notTarget };
    st.nodes = clone(g.nodes);
    st.segs = clone(g.segs);
    st.items = clone(g.items);
    st.notTarget = new Set(g.notTarget);
    P.renderAll();
  }
  const m = P.buildModel(),
    sol = P.solve(m);
  const out = {
    input,
    html: $('#solution').innerHTML,
    status: sol.status,
    n: sol.n,
    rank: sol.rank ?? null,
    vals: sol.vals,
    steps: sol.steps.map((s) => [s.e.id, s.key]),
    joint: sol.joint ? { eqs: sol.joint.eqs.map((e) => e.id), keys: sol.joint.keys } : null,
    check: sol.check ? { e: sol.check.e.id, r: sol.check.r } : null,
    cands: m.cands.map((e) => ({ id: e.id, coeffs: e.coeffs, cst: e.cst })),
    titles: m.titles,
    total: $('#total').textContent,
    // Состояние после resolve(): поправки, которые прототип записывает в элементы.
    normItems: st.items.map((it) => {
      const { x, y, ...r } = it;
      if (r.type === 'force' || r.type === 'weight' || r.type === 'moment') delete r.angle;
      return r;
    }),
  };
  // Чертёж в обоих видах; для случайных конструкций иногда с выделенным элементом.
  st.sel = rnd && st.items.length && rnd() < 0.5 ? st.items[Math.floor(rnd() * st.items.length)].id : null;
  out.sel = st.sel;
  out.svg = {};
  for (const view of ['construct', 'schema']) {
    st.view = view;
    const mm = P.buildModel(),
      ss = P.solve(mm);
    P.renderSVG(mm, ss);
    out.svg[view] = { viewBox: $('#svg').getAttribute('viewBox'), html: $('#svg').innerHTML };
  }
  st.view = 'construct';
  st.sel = null;
  // Операции редактирования на копии состояния.
  if (rnd && st.segs.length) {
    const saved = JSON.stringify({ nodes: st.nodes, segs: st.segs, items: st.items });
    const strip = () => ({
      nodes: clone(st.nodes),
      segs: clone(st.segs),
      items: st.items.map((it) => {
        const { x, y, ...r } = it;
        return r;
      }),
    });
    const restore = () => {
      const o = JSON.parse(saved);
      st.nodes = o.nodes;
      st.segs = o.segs;
      st.items = o.items;
    };
    const sRem = st.segs[Math.floor(rnd() * st.segs.length)].id;
    $('#segmsg').textContent = '';
    const okRem = P.removeSeg(sRem);
    out.remove = { seg: sRem, ok: okRem, msg: okRem ? '' : $('#segmsg').textContent, result: okRem ? strip() : null };
    restore();
    const sSplit = st.segs[Math.floor(rnd() * st.segs.length)];
    const t = [0.5, 1, 0.25 * sSplit.len, sSplit.len / 2, sSplit.len][Math.floor(rnd() * 5)];
    const okSplit = P.splitSeg(sSplit.id, t);
    out.split = { seg: sSplit.id, t, ok: okSplit, result: okSplit ? strip() : null };
    restore();
    P.resolve();
  }
  return out;
};
