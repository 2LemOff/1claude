/* ============ SIMULATIONS: dots & flow ============ */
const SIMS = {};

/* M2: icon array (natural frequencies) */
SIMS['icon-array'] = {
  title: 'Blight test on 1,000 plants',
  controls: s => [
    {id:'baseRate', label:'infected', min:.5, max:30, step:.5, value:s.baseRate*100, fmt:v => v + '%'},
    {id:'sensitivity', label:'test catches', min:50, max:100, step:1, value:s.sensitivity*100, fmt:v => v + '%'},
    {id:'falsePositiveRate', label:'false alarms', min:0, max:20, step:.5, value:s.falsePositiveRate*100, fmt:v => v + '%'}
  ],
  init(s){ return {b:s.baseRate, se:s.sensitivity, fp:s.falsePositiveRate, t:0}; },
  param(st, id, v){ ({baseRate:() => st.b = v/100, sensitivity:() => st.se = v/100, falsePositiveRate:() => st.fp = v/100})[id](); },
  draw(st, r, dt){
    st.t += dt;
    const I = Math.round(1000 * st.b), TP = Math.round(I * st.se), FN = I - TP, FP = Math.round((1000 - I) * st.fp);
    const [a, b] = split(r, .64);
    const cols = 40, rows = 25, cell = Math.min(a.w / cols, a.h / rows), ox = a.x + (a.w - cell*cols)/2, oy = a.y + (a.h - cell*rows)/2;
    const shown = reduceMotion ? 1000 : Math.min(1000, Math.floor(st.t * 900));
    for (let i = 0; i < shown; i++){
      const cx = ox + (i % cols + .5) * cell, cy = oy + (Math.floor(i / cols) + .5) * cell, rr = cell * .36;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2);
      if (i < TP){ ctx.fillStyle = T.accent; ctx.fill(); }
      else if (i < I){ ctx.strokeStyle = T.accent; ctx.lineWidth = 1.2; ctx.stroke(); }
      else if (i < I + FP){ ctx.fillStyle = T.warn; ctx.fill(); }
      else { ctx.fillStyle = rgba(T.muted, .22); ctx.fill(); }
    }
    const flagged = TP + FP, ppv = flagged ? TP / flagged : 0;
    let y = b.y + 18;
    txt('A PLANT TESTS POSITIVE.', b.x, y, {size:11}); y += 16;
    txt('CHANCE IT IS REALLY SICK', b.x, y, {size:11}); y += Math.min(52, b.w * .22) + 4;
    txt(pct(ppv), b.x, y, {size:Math.min(52, b.w * .22), f:'disp', w:700, c:T.ink}); y += 22;
    txt(`${TP} of ${flagged} flagged plants`, b.x, y, {size:12, c:T.ink}); y += 26;
    legend([[T.accent, `sick, caught (${TP})`], [T.accent, `sick, missed (${FN})`, true], [T.warn, `healthy, false alarm (${FP})`], [rgba(T.muted, .4), `healthy, cleared (${1000 - I - FP})`]], b.x, y);
  }
};

/* M7: patterns in pure noise */
SIMS['random-clusters'] = {
  title: '20 factors vs. oxygen dips — all pure noise',
  buttons: [{label:'Reshuffle all', fn:st => SIMS['random-clusters'].reset(st)}, {label:'Retest flagged on new data', fn:st => SIMS['random-clusters'].retest(st)}],
  init(s){ const st = {n:s.pointsPerPanel, k:s.panels, seed:1}; this.reset(st); return st; },
  gen(n, r){ const p = Array.from({length:n}, () => [r(), r()]); const mx = p.reduce((a, q) => a + q[0], 0)/n, my = p.reduce((a, q) => a + q[1], 0)/n;
    let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of p){ sxy += (x-mx)*(y-my); sxx += (x-mx)**2; syy += (y-my)**2; }
    return {p, r:sxy / Math.sqrt(sxx*syy), mx, my, slope:sxy/sxx}; },
  reset(st){ const r = rng(Date.now() & 0xffff); st.panels = Array.from({length:st.k}, () => ({...this.gen(st.n, r), status:null})); st.t = 0; },
  retest(st){ const r = rng((Date.now() >> 3) & 0xffff); for (const p of st.panels){ if (Math.abs(p.r) > .361 && !p.status){ const f = this.gen(st.n, r); p.status = Math.abs(f.r) > .361 && Math.sign(f.r) === Math.sign(p.r) ? 'held' : 'vanished'; } } },
  draw(st, r, dt){
    st.t += dt;
    const narrow = r.w < 560, cols = narrow ? 4 : 5, rows = Math.ceil(st.k / cols);
    const head = 30, gw = r.w / cols, gh = (r.h - head) / rows;
    const hits = st.panels.filter(p => Math.abs(p.r) > .361).length;
    txt(`“Patterns” found: ${hits} of ${st.k}`, r.x, r.y + 14, {size:14, f:'disp', w:600, c:hits ? T.warn : T.ink});
    txt('threshold: p < 0.05 (|r| > 0.36 for 30 points)', r.x + r.w, r.y + 14, {a:'right', size:10});
    st.panels.forEach((p, i) => {
      const x = r.x + (i % cols) * gw + 4, y = r.y + head + Math.floor(i / cols) * gh + 4, w = gw - 8, h = gh - 8;
      const hit = Math.abs(p.r) > .361;
      ctx.strokeStyle = hit ? T.warn : rgba(T.muted, .3); ctx.lineWidth = hit ? 1.6 : 1; ctx.strokeRect(x, y, w, h);
      const shown = reduceMotion ? p.p.length : Math.min(p.p.length, Math.floor(st.t * 60));
      for (let j = 0; j < shown; j++){ const [px, py] = p.p[j]; ctx.fillStyle = hit ? T.warn : rgba(T.ink, .5); ctx.fillRect(x + 4 + px*(w-8) - 1.2, y + 4 + (1-py)*(h-8) - 1.2, 2.4, 2.4); }
      if (hit && shown === p.p.length){
        const f = xx => p.my + p.slope * (xx - p.mx);
        polyline([[x + 4, y + 4 + (1 - f(0))*(h-8)], [x + w - 4, y + 4 + (1 - f(1))*(h-8)]], T.warn, 1.5);
      }
      txt(p.status ? (p.status === 'held' ? 'held up' : 'vanished') : hit ? `r=${p.r.toFixed(2)}` : '', x + 4, y + h - 4, {size:9, c:p.status === 'vanished' ? T.accent : T.warn});
    });
  }
};

/* M17: normal vs fat tails */
SIMS['distribution-compare'] = {
  title: 'Colonist heights vs. micrometeoroid impact sizes',
  buttons: [{label:'Draw 1,000 new samples', fn:st => { st.a = []; st.b = []; st.r = rng(Date.now() & 0xffff); }}],
  init(s){ return {a:[], b:[], r:rng(11), alpha:s.right.alpha, max:s.samples}; },
  draw(st, r, dt){
    const add = reduceMotion ? st.max : Math.ceil(dt * 160);
    for (let i = 0; i < add && st.a.length < st.max; i++){
      st.a.push(170 + 8 * gauss(st.r));
      st.b.push(Math.pow(1 - st.r(), -1 / st.alpha));
    }
    const [L, Rt] = split(r, .5, 22);
    this.column(L, st.a, 'HEIGHTS (cm) — normal', {xmin:140, xmax:200, xlog:false, xt:[150, 170, 190]}, v => v.toFixed(1));
    this.column(Rt, st.b, 'IMPACT SIZE — power law (log scale)', {xmin:1, xmax:10000, xlog:true, xt:[1, 10, 100, 1000, 10000], xf:v => v >= 1000 ? v/1000 + 'k' : v}, v => v.toFixed(1));
  },
  column(r, arr, label, xo, f){
    txt(label, r.x, r.y + 12, {size:11, c:T.ink});
    const top = {x:r.x, y:r.y + 18, w:r.w, h:r.h * .38};
    const p = plot(top, {...xo, ymin:0, ymax:1, padL:10, padB:18});
    const rr = rng(3);
    for (const v of arr){ const x = p.X(Math.min(xo.xmax, Math.max(xo.xmin, v))); ctx.fillStyle = rgba(T.accent, .45); ctx.fillRect(x - 1.2, p.T + rr() * (p.B - p.T - 4), 2.4, 2.4); }
    const n = arr.length; if (!n) return;
    let sum = 0, mx = 0; const run = [];
    arr.forEach((v, i) => { sum += v; mx = Math.max(mx, v); if (i % 4 === 0 || i === n - 1) run.push([i + 1, sum / (i + 1)]); });
    const means = run.map(q => q[1]), lo = Math.min(...means), hi = Math.max(...means);
    const pad = (hi - lo) * .15 || 1;
    const bot = {x:r.x, y:top.y + top.h + 14, w:r.w, h:r.h - top.h - 70};
    const q = plot(bot, {xmin:0, xmax:1000, ymin:lo - pad, ymax:hi + pad, xt:[0, 500, 1000], yt:[lo, hi], yf:v => v.toFixed(0), xl:'samples', yl:'running average', padL:36});
    polyline(run.map(([i, m]) => [q.X(i), q.Y(m)]), T.accent, 1.8);
    const share = mx / sum;
    txt(`largest single value = ${pct(share)} of the total`, r.x, r.y + r.h - 8, {size:11, c:share > .05 ? T.warn : T.ink});
  }
};

/* M6: SIR, three skins, one simulation */
SIMS['same-sim-three-skins'] = {
  title: 'One equation, three colony events',
  controls: s => [
    {id:'beta', label:'spread chance', min:.05, max:.6, step:.01, value:s.beta, fmt:v => v.toFixed(2)},
    {id:'gamma', label:'removal chance', min:.02, max:.4, step:.01, value:s.gamma, fmt:v => v.toFixed(2)}
  ],
  buttons: [{label:'Restart', fn:st => SIMS['same-sim-three-skins'].reset(st)}],
  init(s){ const st = {beta:s.beta, gamma:s.gamma, W:14, H:10}; this.reset(st); return st; },
  param(st, id, v){ st[id] = v; this.reset(st); },
  reset(st){ st.g = new Array(st.W * st.H).fill(0); st.r = rng(21); st.g[Math.floor(st.H/2) * st.W + 3] = 1; st.g[Math.floor(st.H/2) * st.W + 4] = 1; st.hist = [[st.W*st.H - 2, 2, 0]]; st.acc = 0; },
  tick(st){
    const n = st.g.slice(), W = st.W, H = st.H;
    for (let i = 0; i < n.length; i++) if (st.g[i] === 1){
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (st.g[j] === 0 && st.r() < st.beta * .5) n[j] = 1;
      }
      if (st.r() < st.gamma) n[i] = 2;
    }
    st.g = n; const c = [0, 0, 0]; n.forEach(v => c[v]++); st.hist.push(c);
  },
  draw(st, r, dt){
    st.acc += dt; const last = st.hist[st.hist.length - 1];
    if (last[1] > 0 && st.acc > (reduceMotion ? .05 : .22)){ st.acc = 0; this.tick(st); }
    const skins = [
      {name:'Blight on racks', lab:['healthy', 'infected', 'removed'], shape:'square'},
      {name:'Flu in the clinic', lab:['well', 'sick', 'recovered'], shape:'circle'},
      {name:'Rumour in the Ring', lab:['unaware', 'spreading', 'bored'], shape:'triangle'}
    ];
    const narrow = r.w < 560, topH = r.h * (narrow ? .52 : .58);
    const gw = r.w / 3;
    skins.forEach((sk, k) => {
      const x0 = r.x + k * gw + 6, y0 = r.y + 18, w = gw - 12, h = topH - 24;
      txt(sk.name, x0, r.y + 10, {size:narrow ? 9 : 11, c:T.ink});
      const cell = Math.min(w / st.W, h / st.H);
      st.g.forEach((v, i) => {
        const cx = x0 + (i % st.W + .5) * cell, cy = y0 + (((i / st.W) | 0) + .5) * cell, rr = cell * .36;
        ctx.save(); ctx.translate(cx, cy); shapePath(sk.shape, rr);
        ctx.fillStyle = v === 1 ? T.warn : v === 2 ? rgba(T.accent, .8) : rgba(T.muted, .3); ctx.fill(); ctx.restore();
      });
      if (!narrow) txt(`${sk.lab[0]} · ${sk.lab[1]} · ${sk.lab[2]}`, x0, y0 + cell * st.H + 12, {size:9});
    });
    const N = st.W * st.H, b = {x:r.x, y:r.y + topH + 4, w:r.w, h:r.h - topH - 4};
    const p = plot(b, {xmin:0, xmax:Math.max(40, st.hist.length), ymin:0, ymax:N, yt:[0, N/2, N], yf:v => Math.round(v / N * 100) + '%', xl:'time steps', yl:'same curve for all three', padL:36});
    polyline(st.hist.map((c, i) => [p.X(i), p.Y(c[1])]), T.warn, 2);
    polyline(st.hist.map((c, i) => [p.X(i), p.Y(c[2])]), T.accent, 2);
    polyline(st.hist.map((c, i) => [p.X(i), p.Y(c[0])]), rgba(T.muted, .7), 1.5, [4, 3]);
  }
};

/* M8: when to trust intuition */
SIMS['feedback-quality-grid'] = {
  title: 'Whose gut feeling has been trained?',
  init(){ return {t:0}; },
  draw(st, r, dt){
    st.t += dt; const e = reduceMotion ? 1 : Math.min(1, st.t / 1.2), ease = 1 - (1 - e) ** 3;
    const p = plot(r, {xmin:0, xmax:1, ymin:0, ymax:1, xt:[0, 1], yt:[0, 1], xf:v => v ? 'lots' : 'little', yf:v => v ? 'fast, clear' : 'slow, noisy', xl:'amount of practice →', yl:'feedback ↑', padL:80, padB:30});
    ctx.fillStyle = rgba(T.accent, .1); ctx.fillRect(p.X(.6), p.Y(1), p.X(1) - p.X(.6), p.Y(.6) - p.Y(1));
    txt('INTUITION CAN BE TRUSTED', p.X(.62), p.Y(1) + 16, {size:10, c:T.accent});
    const pts = [
      [.9, .9, 'Mira · leaf blight', T.cast.mira, false], [.78, .82, 'Ada · failing bearings', T.cast.ada, false],
      [.8, .14, 'Trader · prices', T.warn, false], [.12, .1, 'Mira · the economy', T.cast.mira, true], [.72, .5, 'Dox · 5-year outcomes', T.cast.dox, true]
    ];
    for (const [x, y, lab, col, hollow] of pts){
      const sx = p.X(x * ease), sy = p.Y(y * ease);
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2);
      if (hollow){ ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); }
      txt(lab, sx + (x > .6 ? -12 : 12), sy + 4, {size:11, c:T.ink, a:x > .6 ? 'right' : 'left'});
    }
  }
};

/* M15: exponential vs linear vs S-curve */
SIMS['growth-curve'] = {
  title: 'Blighted racks, day by day',
  controls: s => [{id:'doublingDays', label:'doubles every', min:1, max:10, step:.5, value:s.doublingDays, fmt:v => v + ' d'}],
  toggles: [{id:'lin', label:'your gut (straight line)', on:true}, {id:'exp', label:'pure exponential', on:true}, {id:'log', label:'S-curve (runs out of racks)', on:true}],
  buttons: [{label:'Replay', fn:st => st.t = 0}],
  init(s){ return {d:s.doublingDays, K:s.capacity, N0:s.initial, t:0, lin:true, exp:true, log:true}; },
  param(st, id, v){ if (id === 'doublingDays'){ st.d = v; st.t = 0; } else st[id] = v; },
  draw(st, r, dt){
    st.t += dt; const days = 30, day = reduceMotion ? days : Math.min(days, st.t * 4);
    const rr = Math.LN2 / st.d, K = st.K, N0 = st.N0;
    const lin = t => N0 + N0 / st.d * t, ex = t => N0 * Math.pow(2, t / st.d), lg = t => K / (1 + (K - N0) / N0 * Math.exp(-rr * t));
    const [a, b] = split(r, .62);
    const p = plot(a, {xmin:0, xmax:days, ymin:0, ymax:K, xt:[0, 10, 20, 30], yt:[0, 100, 200, 300, 400], xl:'day', yl:'racks with blight', padL:38});
    const series = (f, col, dash) => { const pts = []; for (let t = 0; t <= day; t += .25) pts.push([p.X(t), p.Y(f(t))]); polyline(pts, col, 2.2, dash); };
    if (st.lin) series(lin, T.muted, [5, 4]);
    if (st.exp) series(ex, rgba(T.warn, .55), [2, 3]);
    if (st.log) series(lg, T.warn);
    ctx.strokeStyle = rgba(T.ink, .4); ctx.beginPath(); ctx.moveTo(p.X(day), p.T); ctx.lineTo(p.X(day), p.B); ctx.stroke();
    const n = Math.round(lg(day));
    const cols = 20, cell = Math.min(b.w / cols, (b.h - 70) / 20), ox = b.x;
    for (let i = 0; i < K; i++){ ctx.fillStyle = i < n ? T.warn : rgba(T.cast.mira, .55); ctx.fillRect(ox + (i % cols) * cell, b.y + 56 + Math.floor(i / cols) * cell, cell * .78, cell * .78); }
    txt(`DAY ${Math.floor(day)}`, b.x, b.y + 14, {size:11});
    txt(`${n} of 400 racks`, b.x, b.y + 36, {size:20, f:'disp', w:700, c:T.ink});
    txt(`your gut says ${Math.round(Math.min(K, lin(day)))}`, b.x, b.y + 50, {size:11});
  }
};

/* M14: delayed balancing loop */
SIMS['stock-and-flow'] = {
  title: 'CO₂ injection with a delayed sensor',
  controls: s => [
    {id:'sensorDelayHours', label:'sensor delay', min:0, max:12, step:1, value:s.sensorDelayHours, fmt:v => v + ' h'},
    {id:'gain', label:'reaction strength', min:.05, max:1, step:.05, value:.4, fmt:v => v.toFixed(2)}
  ],
  buttons: [{label:'Replay', fn:st => st.t = 0}],
  init(s){ const st = {delay:s.sensorDelayHours, gain:.4, target:s.target, t:0}; this.run(st); return st; },
  param(st, id, v){ if (id === 'sensorDelayHours') st.delay = v; else st.gain = v; this.run(st); st.t = 0; },
  run(st){
    const dt = .1, steps = 960, L = [600], U = [], Sd = [];
    for (let i = 0; i < steps; i++){
      const lag = Math.round(st.delay / dt), sensed = L[Math.max(0, i - lag)];
      const u = Math.max(0, Math.min(500, 100 + st.gain * (st.target - sensed)));
      U.push(u); Sd.push(sensed);
      L.push(L[i] + (u - .1 * L[i]) * dt);
    }
    st.L = L; st.U = U; st.S = Sd;
  },
  draw(st, r, dt){
    st.t += dt; const i = reduceMotion ? 959 : Math.min(959, Math.floor(st.t * 120));
    const [a, b] = split(r, .34);
    // tank schematic
    const tw = Math.min(a.w * .45, 110), th = Math.min(a.h * .62, 190), tx = a.x + (a.w - tw) / 2, ty = a.y + 40;
    const lvl = Math.min(1, st.L[i] / 1600);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = rgba(T.accent, .35); ctx.fillRect(tx + 1, ty + th * (1 - lvl), tw - 2, th * lvl - 1);
    const tgY = ty + th * (1 - st.target / 1600);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = T.ink; ctx.beginPath(); ctx.moveTo(tx - 8, tgY); ctx.lineTo(tx + tw + 8, tgY); ctx.stroke(); ctx.setLineDash([]);
    txt('target', tx + tw + 10, tgY + 4, {size:10});
    const inW = 2 + st.U[i] / 40, outW = 2 + .1 * st.L[i] / 40;
    ctx.lineWidth = inW; ctx.strokeStyle = T.warn; ctx.beginPath(); ctx.moveTo(tx + tw/2, a.y + 6); ctx.lineTo(tx + tw/2, ty - 2); ctx.stroke();
    txt(`injection ${Math.round(st.U[i])}/h`, tx + tw/2 + 10, a.y + 20, {size:10, c:T.warn});
    ctx.lineWidth = outW; ctx.strokeStyle = T.cast.mira; ctx.beginPath(); ctx.moveTo(tx + tw, ty + th - 10); ctx.lineTo(tx + tw + 30, ty + th - 10); ctx.stroke();
    txt('plants absorb', tx + tw/2, ty + th + 16, {size:10, a:'center', c:T.cast.mira});
    txt(`reads ${Math.round(st.S[i])} ppm · actual ${Math.round(st.L[i])}`, a.x + a.w/2, ty + th + 32, {size:10, a:'center', c:T.ink});
    // chart
    const p = plot(b, {xmin:0, xmax:96, ymin:0, ymax:1800, xt:[0, 24, 48, 72, 96], yt:[0, 500, 1000, 1500], xl:'hours', yl:'CO₂ (ppm)', padL:44});
    polyline([[p.X(0), p.Y(st.target)], [p.X(96), p.Y(st.target)]], rgba(T.ink, .5), 1, [4, 3]);
    const pts = [], sp = [];
    for (let k = 0; k <= i; k += 2){ pts.push([p.X(k * .1), p.Y(st.L[k])]); sp.push([p.X(k * .1), p.Y(st.S[k])]); }
    polyline(sp, rgba(T.muted, .7), 1.2, [2, 3]);
    polyline(pts, T.accent, 2.2);
    legend([[T.accent, 'actual CO₂'], [T.muted, 'what the sensor shows'], [T.ink, 'target (dashed)', true]], p.R - 150, p.T + 12, 10);
  }
};

/* M11: model vs reality (Biosphere 2 pattern) */
SIMS['model-vs-reality'] = {
  title: 'The Earth-built oxygen model vs. what the dome measured',
  toggles: [{id:'microbes', label:'add soil microbes to model', on:false}, {id:'concrete', label:'add concrete absorbing CO₂', on:false}],
  init(){ return {microbes:false, concrete:false, t:0}; },
  param(st, id, v){ st[id] = v; },
  draw(st, r, dt){
    st.t += dt;
    const drop = t => 6.4 * Math.pow(t / 16, .9), real = t => 20.9 - drop(t);
    const share = (st.microbes ? .7 : 0) + (st.concrete ? .3 : 0), model = t => 20.9 - drop(t) * share;
    const [a, b] = split(r, .4);
    // flow diagram
    const cx = a.x + a.w / 2, cy = a.y + a.h * .45, bw = Math.min(120, a.w * .42), bh = 44;
    const box = (x, y, label, col, dashed) => { ctx.setLineDash(dashed ? [4, 3] : []); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x - bw/2, y - bh/2, bw, bh); ctx.setLineDash([]); txt(label, x, y + 4, {a:'center', size:11, c:col}); };
    const arrow = (x1, y1, x2, y2, col, dashed) => { polyline([[x1, y1], [x2, y2]], col, 2, dashed ? [4, 3] : null); const an = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8*Math.cos(an - .4), y2 - 8*Math.sin(an - .4)); ctx.lineTo(x2 - 8*Math.cos(an + .4), y2 - 8*Math.sin(an + .4)); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    box(cx, cy, 'O₂ in the air', T.ink);
    box(cx, a.y + 26, 'plants + lamps', T.cast.mira); arrow(cx, a.y + 48, cx, cy - bh/2 - 2, T.cast.mira);
    box(cx, a.y + a.h - 26, 'people', T.ink); arrow(cx, cy + bh/2, cx, a.y + a.h - 50, T.ink);
    const side = Math.min(a.w * .28, 90);
    txt('soil microbes', cx - side, cy + 52, {a:'center', size:10, c:st.microbes ? T.warn : T.muted});
    arrow(cx - bw/2 + 10, cy + bh/2, cx - side, cy + 40, st.microbes ? T.warn : T.muted, !st.microbes);
    txt('concrete', cx + side, cy + 52, {a:'center', size:10, c:st.concrete ? T.warn : T.muted});
    arrow(cx + bw/2 - 10, cy + bh/2, cx + side, cy + 40, st.concrete ? T.warn : T.muted, !st.concrete);
    txt('dashed = missing from the map', a.x, a.y + a.h - 2, {size:10});
    // chart
    const p = plot(b, {xmin:0, xmax:16, ymin:12, ymax:22, xt:[0, 4, 8, 12, 16], yt:[14, 16, 18, 20, 22], yf:v => v + '%', xl:'months sealed', yl:'oxygen in the air', padL:40});
    const up = reduceMotion ? 16 : Math.min(16, st.t * 5);
    const ptsR = [], ptsM = []; for (let t = 0; t <= up; t += .2){ ptsR.push([p.X(t), p.Y(real(t))]); ptsM.push([p.X(t), p.Y(model(t))]); }
    polyline(ptsM, T.accent, 2.2, [6, 4]); polyline(ptsR, T.warn, 2.4);
    legend([[T.warn, 'measured: 20.9% → ~14.5%'], [T.accent, share === 1 ? 'model: now matches' : 'model prediction']], p.L + 12, p.B - 30, 11);
    txt('split between microbes and concrete is illustrative', p.R, p.T + 10, {a:'right', size:9});
  }
};

/* M20: fixed power budget */
SIMS['budget-split'] = {
  title: '1,000 kW to share. Every watt moved is a watt taken.',
  controls: s => s.uses.map((u, i) => ({id:'u' + i, label:u, min:0, max:1000, step:10, value:[300, 250, 250, 200][i], fmt:v => v + ' kW'})),
  init(s){ return {kw:[300, 250, 250, 200], need:[300, 250, 250, 200], uses:s.uses, out:s.outputs}; },
  param(st, id, v){
    const i = +id.slice(1), rest = 1000 - v, others = st.kw.reduce((a, x, j) => j === i ? a : a + x, 0);
    st.kw = st.kw.map((x, j) => j === i ? v : others ? x / others * rest : rest / 3);
    syncControls(st.kw.map((x, j) => ['u' + j, Math.round(x)]));
  },
  draw(st, r){
    const cols = [T.cast.mira, T.cast.rook, T.accent, T.cast.dox];
    let x = r.x; const bh = 34;
    txt('POWER PLANT OUTPUT', r.x, r.y + 12, {size:10});
    st.kw.forEach((k, i) => { const w = k / 1000 * r.w; ctx.fillStyle = rgba(cols[i], .85); ctx.fillRect(x, r.y + 20, w, bh); if (w > 60) txt(Math.round(k) + ' kW', x + 6, r.y + 20 + bh/2 + 4, {size:11, c:T.bg}); x += w; });
    const top = r.y + 20 + bh + 30, rowH = Math.min(46, (r.h - (top - r.y)) / 4);
    st.kw.forEach((k, i) => {
      const y = top + i * rowH, ratio = k / st.need[i], w = Math.min(1.5, ratio) / 1.5 * (r.w * .6), x0 = r.x + r.w * .36;
      txt(`${st.uses[i]} → ${st.out[i]}`, r.x, y + 14, {size:12, c:T.ink});
      ctx.fillStyle = rgba(T.muted, .15); ctx.fillRect(x0, y + 2, r.w * .6, 16);
      ctx.fillStyle = ratio < .9 ? T.warn : cols[i]; ctx.fillRect(x0, y + 2, w, 16);
      const nx = x0 + (1 / 1.5) * r.w * .6; ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(nx, y - 2); ctx.lineTo(nx, y + 22); ctx.stroke();
      txt(ratio < .9 ? `short ${pct(1 - ratio)}` : ratio > 1.1 ? `surplus ${pct(ratio - 1)}` : 'meets need', x0, y + 32, {size:10, c:ratio < .9 ? T.warn : T.muted});
    });
    txt('black tick = what the colony needs', r.x + r.w, r.y + 12, {a:'right', size:10});
  }
};

