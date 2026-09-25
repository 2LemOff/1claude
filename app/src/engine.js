const C = /*__CONTENT__*/null;
const MODELS = Object.fromEntries(C.models.map(m => [m.id, m]));
const TRAIL = C.index.trail;
const $ = s => document.querySelector(s);
const store = {
  get(k, d){ try { const v = localStorage.getItem('ks.' + k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem('ks.' + k, JSON.stringify(v)); } catch(e){} }
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- colony layout (world units: 1000 × 640) ---------- */
const LOC = {
  docks:      {x:95,  y:478, w:110, h:56,  label:'DOCKS'},
  greenhouse: {x:320, y:440, w:230, h:150, label:'GREENHOUSE DOME'},
  lifesupport:{x:548, y:480, w:130, h:74,  label:'LIFE SUPPORT'},
  power:      {x:760, y:474, w:150, h:86,  label:'POWER PLANT'},
  clinic:     {x:470, y:330, w:116, h:60,  label:'CLINIC'},
  market:     {x:640, y:340, w:130, h:60,  label:'MARKET'},
  habitat:    {x:500, y:210, w:290, h:52,  label:'HABITAT RING'},
  council:    {x:770, y:262, w:112, h:56,  label:'COUNCIL HALL'},
  comms:      {x:905, y:210, w:44,  h:150, label:'COMMS'},
  mine:       {x:560, y:598, w:230, h:44,  label:'MINE'}
};
const HOME = {you:'habitat', ada:'power', mira:'greenhouse', dox:'clinic', rook:'mine'};
const NAMES = {ada:'Ada', mira:'Mira', dox:'Dox', rook:'Rook', you:'You'};

/* ---------- theme tokens for the canvas ---------- */
let T = {};
function readTokens(){
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  T = {bg:g('--bg'), panel:g('--panel'), ink:g('--ink'), muted:g('--muted'), line:g('--line'), accent:g('--accent'),
       warn:g('--warn'), sky1:g('--sky1'), sky2:g('--sky2'), ground:g('--ground'), ground2:g('--ground2'), module:g('--module'),
       glass:g('--glass'), holo:g('--holo'), stars:parseFloat(g('--stars')) || 0,
       cast:{you:g('--c-you'), ada:g('--c-ada'), mira:g('--c-mira'), dox:g('--c-dox'), rook:g('--c-rook')}};
}
readTokens();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTokens);
new MutationObserver(readTokens).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
function rgba(hex, a){
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;
}

/* ---------- random ---------- */
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R0 = rng(7);
const gauss = r => { let u = 0, v = 0; while(!u) u = r(); while(!v) v = r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };

/* ---------- canvas & camera ---------- */
let SIM = null;   // open station screen: {model, kind, st}
const cv = $('#scene'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, S = 1, OX = 0, OY = 0;
const cam = {x:500, y:340, z:1, tx:500, ty:340, tz:1};
const isMobile = () => innerWidth <= 960;
function resize(){
  const w = cv.parentElement.clientWidth;
  VW = w;
  if (isMobile()) VH = Math.round(SIM ? Math.min(innerHeight * .62, w * 1.3) : Math.min(innerHeight * .38, w * .9));
  else VH = Math.round(SIM ? Math.max(w * .64, Math.min(innerHeight * .7, w * .8)) : w * .64);
  VH = Math.max(VH, 200);
  DPR = window.devicePixelRatio || 1;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); cv.style.height = VH + 'px';
  S = Math.min(VW / 1000, VH / 640);
}
new ResizeObserver(() => resize()).observe(cv.parentElement);
addEventListener('resize', () => resize());
resize();
const toScreen = (x, y) => [ (x - cam.x) * S * cam.z + VW/2, (y - cam.y) * S * cam.z + VH/2 ];
const toWorld  = (sx, sy) => [ (sx - VW/2) / (S * cam.z) + cam.x, (sy - VH/2) / (S * cam.z) + cam.y ];
function focus(loc, z){
  const L = LOC[loc]; if (!L) return;
  cam.tx = L.x; cam.ty = L.y - 20; cam.tz = z || 1.5;
}
function overview(){ const z = Math.min(1.25, (VW / VH) / (1000 / 640)); cam.tx = 500; cam.ty = 350; cam.tz = isMobile() ? Math.max(.95, Math.min(1.3, 1 / z)) : 1; }

/* ---------- stars (fixed) ---------- */
const STARS = Array.from({length:140}, () => [R0()*1400 - 200, R0()*700 - 80, R0()*1.3 + .3, R0()]);

/* ---------- cast: Heider–Simmel shapes ---------- */
const cast = Object.keys(HOME).map((id, i) => {
  const L = LOC[HOME[id]];
  return {id, x:L.x + (i-2)*16, y:L.y + L.h/2 - 16, vx:0, vy:0, tx:L.x, ty:L.y + L.h/2 - 16, rot:0,
          pulse:0, hop:0, shake:0, wait:R0()*2, anchor:HOME[id], stage:false};
});
const who = id => cast.find(c => c.id === id);
function spotIn(loc, k, n){
  const L = LOC[loc];
  const floorY = loc === 'comms' ? L.y + L.h/2 - 14 : L.y + L.h/2 - 14;
  const span = Math.min(L.w - 30, 36 * n);
  const x = L.x - span/2 + (n <= 1 ? span/2 : span * k / (n - 1));
  return [x, floorY];
}
function sendTo(c, loc, k = 0, n = 1){ const [x, y] = spotIn(loc, k, n); c.anchor = loc; c.tx = x; c.ty = y; c.wait = 3 + Math.random()*3; }
function wanderTarget(c){
  const L = LOC[c.anchor];
  c.tx = L.x + (Math.random() - .5) * (L.w - 30);
  c.ty = L.y + L.h/2 - 14 - Math.random() * Math.min(20, L.h * .3);
}
function stepCast(dt){
  for (const c of cast){
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    const maxS = reduceMotion ? 900 : 190;
    const sp = Math.min(maxS, d * 2.4);
    const dvx = d > .5 ? dx / d * sp : 0, dvy = d > .5 ? dy / d * sp : 0;
    const k = Math.min(1, dt * 5);
    c.vx += (dvx - c.vx) * k; c.vy += (dvy - c.vy) * k;
    c.x += c.vx * dt; c.y += c.vy * dt;
    const v = Math.hypot(c.vx, c.vy);
    if (v > 8) c.rot = Math.atan2(c.vy, c.vx);
    c.pulse = Math.max(0, c.pulse - dt); c.hop = Math.max(0, c.hop - dt); c.shake = Math.max(0, c.shake - dt);
    if (!c.stage && d < 4 && !reduceMotion){ c.wait -= dt; if (c.wait <= 0){ wanderTarget(c); c.wait = 2 + Math.random()*4; } }
  }
}
function shapePath(kind, r){
  ctx.beginPath();
  if (kind === 'circle') ctx.arc(0, 0, r, 0, Math.PI*2);
  else if (kind === 'triangle'){ ctx.moveTo(r*1.25, 0); ctx.lineTo(-r*.8, r*.9); ctx.lineTo(-r*.8, -r*.9); ctx.closePath(); }
  else if (kind === 'square') ctx.rect(-r*.85, -r*.85, r*1.7, r*1.7);
  else if (kind === 'diamond'){ ctx.moveTo(r*1.15, 0); ctx.lineTo(0, r*.95); ctx.lineTo(-r*1.15, 0); ctx.lineTo(0, -r*.95); ctx.closePath(); }
  else if (kind === 'hexagon'){ for (let i = 0; i < 6; i++){ const a = i * Math.PI/3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); }
}
const SHAPE = Object.fromEntries(C.story.cast.map(c => [c.id, c.shape]));
function drawCast(t){
  const r = 11 * S * cam.z;
  for (const c of cast){
    let [sx, sy] = toScreen(c.x, c.y);
    if (c.hop > 0) sy -= Math.sin(c.hop / .5 * Math.PI) * r * 1.2;
    if (c.shake > 0) sx += Math.sin(t * 60) * r * .25;
    ctx.save(); ctx.translate(sx, sy);
    if (c.pulse > 0){
      const p = 1 - c.pulse / 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r * (1.4 + p * 1.6), 0, Math.PI*2);
      ctx.strokeStyle = rgba(T.cast[c.id], (1 - p) * .8); ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.rotate(SHAPE[c.id] === 'triangle' || SHAPE[c.id] === 'diamond' ? c.rot : 0);
    shapePath(SHAPE[c.id], r);
    ctx.fillStyle = T.cast[c.id]; ctx.fill();
    ctx.lineWidth = Math.max(1, r * .12); ctx.strokeStyle = rgba(T.ink, c.id === 'you' ? .85 : .35); ctx.stroke();
    ctx.restore();
    ctx.font = `500 ${Math.max(9, 9.5 * S * cam.z)}px ${getFont('mono')}`;
    ctx.fillStyle = rgba(T.ink, c.pulse > 0 ? 1 : .6); ctx.textAlign = 'center';
    ctx.fillText(NAMES[c.id], sx, sy + r + 12 * Math.max(.9, S * cam.z));
  }
}
const FONTS = {mono:'"JetBrains Mono",ui-monospace,monospace', disp:'"Barlow Condensed","Arial Narrow",sans-serif', ui:'Barlow,system-ui,sans-serif'};
const getFont = k => FONTS[k];

/* ---------- colony drawing ---------- */
let activeLoc = null, hoverLoc = null, blight = 0;
function drawColony(t){
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, T.sky1); g.addColorStop(1, T.sky2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  if (T.stars > 0){
    for (const [x, y, s, ph] of STARS){
      const [sx, sy] = toScreen(x, y);
      ctx.fillStyle = `rgba(226,234,240,${T.stars * (.35 + .35 * Math.sin(t * .8 + ph * 9))})`;
      ctx.fillRect(sx, sy, s, s);
    }
  }
  // ground
  const [, gy] = toScreen(0, 520);
  ctx.fillStyle = T.ground; ctx.fillRect(0, gy, VW, VH - gy);
  const [, gy2] = toScreen(0, 572);
  ctx.fillStyle = T.ground2; ctx.fillRect(0, gy2, VW, VH - gy2);
  // dome
  const [dcx, dcy] = toScreen(500, 520), rx = 455 * S * cam.z, ry = 420 * S * cam.z;
  ctx.beginPath(); ctx.ellipse(dcx, dcy, rx, ry, 0, Math.PI, 0);
  ctx.fillStyle = T.glass; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.accent, .45); ctx.stroke();
  for (let i = 1; i < 6; i++){ // dome ribs
    ctx.beginPath(); ctx.ellipse(dcx, dcy, rx * i / 6, ry, 0, Math.PI, 0);
    ctx.strokeStyle = rgba(T.accent, .08); ctx.lineWidth = 1; ctx.stroke();
  }
  // mine shaft
  line(560, 520, 560, 578, T.line, 3);
  // modules
  for (const [id, L] of Object.entries(LOC)) drawModule(id, L, t);
  // blight tint on racks
}
function line(x1, y1, x2, y2, col, w){
  const [a, b] = toScreen(x1, y1), [c, d] = toScreen(x2, y2);
  ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.strokeStyle = col; ctx.lineWidth = w * S * cam.z; ctx.stroke();
}
function rrect(x, y, w, h, r){ ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function drawModule(id, L, t){
  const [x, y] = toScreen(L.x - L.w/2, L.y - L.h/2), w = L.w * S * cam.z, h = L.h * S * cam.z;
  const on = id === activeLoc, hov = id === hoverLoc;
  ctx.save();
  if (id === 'greenhouse'){
    ctx.beginPath(); ctx.ellipse(x + w/2, y + h, w/2, h, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = T.module; ctx.fill();
    ctx.strokeStyle = on ? T.accent : hov ? rgba(T.accent, .6) : T.line; ctx.lineWidth = on ? 2.5 : 1.5; ctx.stroke();
    // racks
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++){
      const rx = x + w * (.14 + i * .09), ry = y + h * (.42 + row * .17);
      const sick = (i * 7 + row * 3) % 27 < blight * 27;
      ctx.fillStyle = sick ? rgba(T.warn, .9) : rgba(T.cast.mira, .75);
      ctx.fillRect(rx, ry, w * .06, h * .06);
    }
  } else if (id === 'comms'){
    ctx.strokeStyle = on ? T.accent : T.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w*.2, y + h); ctx.lineTo(x + w/2, y); ctx.lineTo(x + w*.8, y + h); ctx.stroke();
    for (let k = 1; k < 5; k++){ ctx.beginPath(); ctx.moveTo(x + w*(.2 + .06*k), y + h*(1 - k*.2)); ctx.lineTo(x + w*(.8 - .06*k), y + h*(1 - k*.2)); ctx.stroke(); }
    const pr = (t % 2.4) / 2.4;
    ctx.beginPath(); ctx.arc(x + w/2, y, 6 + pr * 30 * S * cam.z, -Math.PI*.85, -Math.PI*.15);
    ctx.strokeStyle = rgba(T.accent, 1 - pr); ctx.stroke();
  } else {
    rrect(x, y, w, h, 5 * S * cam.z);
    ctx.fillStyle = T.module; ctx.fill();
    ctx.strokeStyle = on ? T.accent : hov ? rgba(T.accent, .6) : T.line; ctx.lineWidth = on ? 2.5 : 1.5; ctx.stroke();
    if (id === 'power'){ // solar slats
      for (let i = 0; i < 5; i++){ ctx.fillStyle = rgba(T.accent, .22); ctx.fillRect(x + w*(.08 + i*.18), y - h*.28, w*.14, h*.2); }
    }
    if (id === 'habitat'){ for (let i = 0; i < 10; i++){ ctx.fillStyle = rgba(T.ink, .12); ctx.fillRect(x + w*(.05 + i*.095), y + h*.2, w*.05, h*.25); } }
  }
  const fs = Math.max(8.5, 10 * S * cam.z);
  ctx.font = `600 ${fs}px ${getFont('disp')}`; ctx.letterSpacing = '1px';
  ctx.fillStyle = on ? T.accent : T.muted; ctx.textAlign = 'center';
  const ly = id === 'comms' ? y - 10 * S * cam.z : id === 'greenhouse' ? y + h * .28 : y + fs + 4;
  ctx.fillText(L.label, id === 'comms' ? x + w/2 - 6 : x + w/2, ly);
  // stop count badge
  const n = byLoc[id] ? byLoc[id].length : 0;
  if (n){
    const bx = id === 'comms' ? x + w : x + w - 6 * S * cam.z, by = id === 'greenhouse' ? y + h*.12 : y;
    ctx.beginPath(); ctx.arc(bx, by, Math.max(7, 8 * S * cam.z), 0, Math.PI*2);
    ctx.fillStyle = on ? T.accent : T.panel; ctx.fill(); ctx.strokeStyle = on ? T.accent : T.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = `500 ${Math.max(8, 9 * S * cam.z)}px ${getFont('mono')}`; ctx.fillStyle = on ? T.bg : T.muted;
    ctx.textBaseline = 'middle'; ctx.fillText(n, bx, by + .5); ctx.textBaseline = 'alphabetic';
    // one light per learned model at this location
    const lit = byLoc[id].filter(isDone).length;
    for (let k = 0; k < lit; k++){
      const lx = (id === 'comms' ? x + w/2 : x + 10 * S * cam.z) + k * 9 * S * cam.z, lyy = id === 'greenhouse' ? y + h * .2 : id === 'comms' ? y + h * .35 : y + h - 8 * S * cam.z;
      ctx.beginPath(); ctx.arc(lx, lyy, 3 * S * cam.z + 1, 0, Math.PI*2);
      ctx.fillStyle = T.accent; ctx.shadowColor = T.accent; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}
const byLoc = {};
for (const id of TRAIL){ const l = MODELS[id].story.location; (byLoc[l] = byLoc[l] || []).push(id); }

/* ---------- plotting helpers (screen space) ---------- */
function txt(s, x, y, o = {}){
  ctx.font = `${o.w || 400} ${o.size || 11}px ${getFont(o.f || 'mono')}`;
  ctx.fillStyle = o.c || T.muted; ctx.textAlign = o.a || 'left'; ctx.textBaseline = o.b || 'alphabetic';
  ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
}
function plot(r, o){
  const L = r.x + (o.padL ?? 40), Rr = r.x + r.w - 10, Tp = r.y + 10, B = r.y + r.h - (o.padB ?? 26);
  const lx = v => o.xlog ? Math.log10(v) : v, ly = v => o.ylog ? Math.log10(v) : v;
  const X = v => L + (lx(v) - lx(o.xmin)) / (lx(o.xmax) - lx(o.xmin)) * (Rr - L);
  const Y = v => B - (ly(Math.min(o.ymax, Math.max(o.ymin, v))) - ly(o.ymin)) / (ly(o.ymax) - ly(o.ymin)) * (B - Tp);
  ctx.lineWidth = 1;
  for (const v of o.yt || []){ ctx.strokeStyle = rgba(T.muted, .15); ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(Rr, Y(v)); ctx.stroke();
    txt(o.yf ? o.yf(v) : v, L - 6, Y(v), {a:'right', b:'middle', size:10}); }
  for (const v of o.xt || []) txt(o.xf ? o.xf(v) : v, X(v), B + 14, {a:'center', size:10});
  ctx.strokeStyle = rgba(T.muted, .6); ctx.beginPath(); ctx.moveTo(L, Tp); ctx.lineTo(L, B); ctx.lineTo(Rr, B); ctx.stroke();
  if (o.xl) txt(o.xl, Rr, B + 24, {a:'right', size:10});
  if (o.yl) txt(o.yl, L + 4, Tp + 8, {size:10});
  return {X, Y, L, R:Rr, T:Tp, B};
}
function polyline(pts, col, w = 2, dash){
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.setLineDash([]);
}
function split(r, frac, gap = 14){
  if (r.w > 560) { const a = r.w * frac; return [{x:r.x, y:r.y, w:a - gap/2, h:r.h}, {x:r.x + a + gap/2, y:r.y, w:r.w - a - gap/2, h:r.h}]; }
  const a = r.h * frac; return [{x:r.x, y:r.y, w:r.w, h:a - gap/2}, {x:r.x, y:r.y + a + gap/2, w:r.w, h:r.h - a - gap/2}];
}
function legend(items, x, y, size = 11){
  let yy = y;
  for (const [col, label, hollow] of items){
    ctx.beginPath(); ctx.arc(x + 5, yy - 4, 4.5, 0, Math.PI*2);
    if (hollow){ ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); }
    txt(label, x + 16, yy, {size, c:T.ink}); yy += size + 8;
  }
  return yy;
}
const pct = v => (v * 100).toFixed(v < .1 ? 1 : 0) + '%';

