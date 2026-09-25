/* ============ DIAGRAM SCREENS (tap targets live in SIM.hits) ============ */
function wrap(s, maxW, size, f = 'ui', w = 400){
  ctx.font = `${w} ${size}px ${getFont(f)}`;
  const out = []; let lineS = '';
  for (const word of String(s).split(' ')){
    const t = lineS ? lineS + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && lineS){ out.push(lineS); lineS = word; } else lineS = t;
  }
  if (lineS) out.push(lineS);
  return out;
}
function para(lines, x, y, size, o = {}){ lines.forEach((l, i) => txt(l, x, y + i * size * 1.3, {size, f:o.f || 'ui', c:o.c || T.ink, w:o.w, a:o.a})); return y + lines.length * size * 1.3; }
function hit(x, y, w, h, fn){ SIM.hits.push({x, y, w, h, fn}); }
function pill(x, y, w, h, label, on, col){
  rrect(x, y, w, h, h/2); ctx.fillStyle = on ? col : 'transparent'; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  txt(label, x + w/2, y + h/2 + .5, {a:'center', b:'middle', size:10, c:on ? T.bg : col, w:500});
}
function box(x, y, w, h, col, fill){ rrect(x, y, w, h, 4); if (fill){ ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke(); }

/* M1: sort facts from habits */
SIMS['sort-cards'] = {
  title: 'Must be true, or just habit?',
  buttons: [{label:'Shuffle and restart', fn:st => { st.pick = st.cards.map(() => null); st.cards.sort(() => Math.random() - .5); }}],
  init(s){ const cards = s.cards.map(c => ({...c})); cards.sort((a, b) => (a.text.length * 7 % 5) - (b.text.length * 7 % 5)); return {goal:s.goal, cards, pick:cards.map(() => null)}; },
  draw(st, r){
    const sorted = st.pick.filter(p => p !== null).length, right = st.pick.filter((p, i) => p !== null && p === st.cards[i].must).length;
    txt('GOAL · ' + st.goal, r.x, r.y + 10, {size:10});
    txt(sorted ? `${right} of ${sorted} sorted correctly` : 'Tap FACT or HABIT on each card', r.x, r.y + 26, {size:10, c:sorted === st.cards.length ? T.accent : sorted ? T.ink : T.muted});
    const narrow = r.w < 460, bw = narrow ? 58 : 64, gap = 5;
    let y = r.y + 36, fs = narrow ? 12.5 : 13.5, rows, total;
    const avail = r.h - 38;
    do {
      rows = st.cards.map((c, i) => {
        const lines = wrap(c.text, r.w - bw - 26, fs);
        const why = st.pick[i] !== null ? wrap((st.pick[i] === c.must ? '✓ ' : '✗ ') + c.why, r.w - bw - 26, fs - 1.5) : [];
        return {lines, why, h:Math.max(fs * 3.4, 12 + lines.length * fs * 1.3 + why.length * (fs - 1.5) * 1.3)};
      });
      total = rows.reduce((a, q) => a + q.h + gap, 0);
      if (total <= avail || fs <= 9.5) break;
      fs -= .5;
    } while (true);
    const scale = Math.min(1, avail / total);
    st.cards.forEach((c, i) => {
      const rw = rows[i], h = rw.h * scale, p = st.pick[i];
      const col = p === null ? T.line : p === c.must ? T.accent : T.warn;
      box(r.x, y, r.w, h, col, p === null ? null : rgba(p === c.must ? T.accent : T.warn, .07));
      const ty = para(rw.lines, r.x + 10, y + 6 + fs, fs);
      if (rw.why.length) para(rw.why, r.x + 10, ty, fs - 1.5, {c:p === c.must ? T.accent : T.warn});
      const bx = r.x + r.w - bw - 8, bh = Math.min(20, h / 2 - 5);
      pill(bx, y + h/2 - bh - 2, bw, bh, 'FACT', p === true, T.accent);
      pill(bx, y + h/2 + 2, bw, bh, 'HABIT', p === false, T.warn);
      hit(bx - 6, y, bw + 12, h/2, () => st.pick[i] = true);
      hit(bx - 6, y + h/2, bw + 12, h/2, () => st.pick[i] = false);
      y += h + gap * scale;
    });
  }
};

/* M13: Fermi chain */
SIMS['estimate-chain'] = {
  title: 'How long does the oxygen last?',
  controls: s => [
    {id:'colonists', label:'people', min:50, max:500, step:10, value:s.colonists, fmt:v => v},
    {id:'kgPerPerson', label:'kg O₂/person/day', min:.4, max:1.4, step:.02, value:s.kgPerPerson, fmt:v => v.toFixed(2)},
    {id:'greenhouseShare', label:'greenhouse covers', min:0, max:100, step:5, value:s.greenhouseShare * 100, fmt:v => v + '%'},
    {id:'storageKg', label:'O₂ stored', min:1000, max:12000, step:500, value:s.storageKg, fmt:v => (v/1000).toFixed(1) + ' t'}
  ],
  init(s){ return {...s}; },
  param(st, id, v){ st[id] = id === 'greenhouseShare' ? v / 100 : v; },
  draw(st, r){
    const need = st.colonists * st.kgPerPerson, short = need * (1 - st.greenhouseShare), days = short > 0 ? st.storageKg / short : Infinity;
    const narrow = r.w < 520, fs = narrow ? 11 : 12, bh = narrow ? 50 : 56;
    const rowsY = [r.y + 6, r.y + 6 + bh + 18, r.y + 6 + (bh + 18) * 2];
    const eq = (y, items) => {
      const ops = items.filter((_, i) => i % 2).length, bxw = (r.w - ops * 22) / (items.length - ops);
      let x = r.x;
      items.forEach((it, i) => {
        if (i % 2){ txt(it, x + 11, y + bh/2 + 5, {a:'center', size:16, c:T.muted, f:'ui', w:600}); x += 22; return; }
        const [val, lab, col] = it;
        box(x, y, bxw, bh, col || T.line, col ? rgba(col, .08) : null);
        txt(val, x + bxw/2, y + bh * .48, {a:'center', size:narrow ? 17 : 20, f:'disp', w:700, c:col || T.ink});
        txt(lab, x + bxw/2, y + bh - 9, {a:'center', size:fs - 2});
        x += bxw;
      });
    };
    const f0 = v => v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(v < 10 ? 2 : 0);
    eq(rowsY[0], [[f0(st.colonists), 'people'], '×', [st.kgPerPerson.toFixed(2), 'kg/person/day'], '=', [f0(need), 'kg needed/day']]);
    eq(rowsY[1], [[f0(need), 'kg needed/day'], '×', [Math.round((1 - st.greenhouseShare) * 100) + '%', 'not covered'], '=', [f0(short), 'kg short/day', T.warn]]);
    eq(rowsY[2], [[f0(st.storageKg), 'kg stored'], '÷', [f0(short), 'kg short/day'], '=', [isFinite(days) ? Math.round(days) + ' d' : '∞', 'until empty', days >= st.shipDays ? T.accent : T.warn]]);
    // timeline
    const ty = rowsY[2] + bh + 34, max = Math.max(150, Math.min(400, isFinite(days) ? days * 1.2 : 150));
    const p = plot({x:r.x, y:ty - 10, w:r.w, h:Math.min(80, r.y + r.h - ty + 10)}, {xmin:0, xmax:max, ymin:0, ymax:1, xt:[0, 30, 60, 90, 120].filter(v => v <= max), xl:'days from now', padL:6, padB:22});
    const barY = p.B - 22;
    ctx.fillStyle = rgba(days >= st.shipDays ? T.accent : T.warn, .5); ctx.fillRect(p.L, barY, p.X(Math.min(max, days)) - p.L, 14);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.X(st.shipDays), barY - 12); ctx.lineTo(p.X(st.shipDays), barY + 20); ctx.stroke();
    txt('ship', p.X(st.shipDays) + 4, barY - 4, {size:10, c:T.ink});
    const verdict = days >= st.shipDays ? `Survivable: ${Math.round(days - st.shipDays)} days of margin` : `Short by ${Math.round(st.shipDays - days)} days before the ship`;
    txt(verdict, r.x + r.w, ty - 14, {a:'right', size:12, c:days >= st.shipDays ? T.accent : T.warn, w:500});
  }
};

/* M5: decompose, rule out */
SIMS['decomposition-tree'] = {
  title: 'Where is the oxygen going?',
  buttons: [{label:'Reset checks', fn:st => st.done = st.branches.map(() => false)}],
  init(s){ return {...s, done:s.branches.map(() => false)}; },
  draw(st, r){
    const narrow = r.w < 520, cols = narrow ? 2 : 4, fs = narrow ? 11 : 12;
    const rw = Math.min(260, r.w * .6), rootY = r.y + 4;
    box(r.x + (r.w - rw)/2, rootY, rw, 38, T.warn, rgba(T.warn, .08));
    txt(st.root, r.x + r.w/2, rootY + 24, {a:'center', size:16, f:'disp', w:700, c:T.warn});
    const gy = rootY + 62, gw = (r.w - (cols - 1) * 10) / cols, gh = narrow ? 72 : 80;
    st.branches.forEach((b, i) => {
      const x = r.x + (i % cols) * (gw + 10), y = gy + Math.floor(i / cols) * (gh + 10), on = st.done[i];
      polyline([[r.x + r.w/2, rootY + 38], [x + gw/2, y]], rgba(T.muted, .5), 1);
      const col = !on ? T.ink : b.culprit ? T.warn : T.muted;
      box(x, y, gw, gh, on ? col : T.line, on ? rgba(col, b.culprit ? .1 : .05) : T.panel);
      txt(b.label.toUpperCase(), x + 10, y + 18, {size:13, f:'disp', w:700, c:col});
      if (on){
        para(wrap(b.check, gw - 20, fs), x + 10, y + 36, fs, {c:col});
        txt(b.culprit ? 'PROBLEM IS HERE' : 'RULED OUT', x + 10, y + gh - 8, {size:9, c:col});
        if (!b.culprit){ ctx.strokeStyle = rgba(T.muted, .6); ctx.beginPath(); ctx.moveTo(x + 10, y + 13); ctx.lineTo(x + 10 + ctx.measureText(b.label.toUpperCase()).width, y + 13); ctx.stroke(); }
      } else txt('tap to run the check', x + 10, y + gh - 10, {size:10, c:T.accent});
      hit(x, y, gw, gh, () => st.done[i] = true);
    });
    const culp = st.branches.findIndex(b => b.culprit);
    if (st.done[culp]){
      const rowsN = Math.ceil(st.branches.length / cols), cy = gy + rowsN * (gh + 10) + 18;
      const px = r.x + (culp % cols) * (gw + 10) + gw/2, py = gy + Math.floor(culp / cols) * (gh + 10) + gh;
      const cw = (r.w - 3 * 8) / 4;
      st.children.forEach((c, k) => {
        const x = r.x + k * (cw + 8);
        polyline([[px, py], [x + cw/2, cy]], rgba(T.warn, .5), 1, [3, 3]);
        box(x, cy, cw, 34, T.line, T.panel);
        txt(c, x + cw/2, cy + 21, {a:'center', size:fs, c:T.ink});
      });
      const left = st.done.filter((d, i) => d && !st.branches[i].culprit).length;
      txt(`${left} of 3 other parts ruled out. ${st.next}`, r.x, cy + 56, {size:11, c:T.muted});
    }
  }
};

/* M3: guesses that could fail */
SIMS['hypothesis-branches'] = {
  title: 'Four guesses. Which survive a test that could kill them?',
  buttons: [{label:'Reset tests', fn:st => st.done = st.h.map(() => false)}],
  init(s){ return {h:s.hypotheses, done:s.hypotheses.map(() => false)}; },
  draw(st, r){
    const fs = r.w < 520 ? 11 : 12, gap = 8;
    const rows = st.h.map((h, i) => {
      const lw = r.w - 110;
      const L = [...wrap('IF ' + h.guess, lw, fs + 1, 'ui', 600).map(t => [t, 'b']), ...wrap('WE WOULD SEE: ' + h.predicts, lw, fs).map(t => [t, 'p'])];
      const R = st.done[i] ? wrap('TEST: ' + h.result, lw, fs).map(t => [t, 'r']) : [];
      return {lines:[...L, ...R], h:Math.max(58, 16 + (L.length + R.length) * fs * 1.35)};
    });
    const total = rows.reduce((a, q) => a + q.h + gap, 0), sc = Math.min(1, r.h / total);
    let y = r.y;
    st.h.forEach((h, i) => {
      const on = st.done[i], hh = rows[i].h * sc, col = !on ? T.line : h.survives ? T.accent : T.muted;
      box(r.x, y, r.w, hh, col, on ? rgba(col, .06) : null);
      let ly = y + 8 + fs;
      for (const [t, k] of rows[i].lines){
        txt(t, r.x + 10, ly, {size:k === 'b' ? fs + 1 : fs, f:'ui', w:k === 'b' ? 600 : 400, c:k === 'r' ? (h.survives ? T.accent : T.warn) : k === 'p' ? T.muted : T.ink});
        ly += fs * 1.35 * sc;
      }
      const bx = r.x + r.w - 92;
      if (on){
        txt(h.survives ? 'SURVIVES' : 'REFUTED', bx + 84, y + 20, {a:'right', size:12, f:'disp', w:700, c:h.survives ? T.accent : T.warn});
        txt(h.survives ? '(for now)' : '', bx + 84, y + 34, {a:'right', size:9});
      } else { pill(bx, y + hh/2 - 12, 84, 24, 'RUN TEST', false, T.accent); }
      hit(r.x, y, r.w, hh, () => st.done[i] = true);
      y += hh + gap * sc;
    });
  }
};
