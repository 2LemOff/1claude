/* ---------- station screen overlay ---------- */
function simAvailable(m){ return !!SIMS[m.sim.kind]; }
function openSim(m){
  const k = SIMS[m.sim.kind]; if (!k) return;
  SIM = {model:m, kind:k, st:k.init(m.sim.settings), hits:[], rect:null};
  buildControls(k, m.sim.settings, SIM.st);
  $('#simBtn').textContent = 'Back to scene';
  document.body.classList.add('simmode'); resize();
}
function closeSim(){
  if (!SIM) return;
  SIM = null; $('#simControls').hidden = true; $('#simControls').innerHTML = '';
  $('#simBtn').textContent = 'Station screen';
  document.body.classList.remove('simmode'); resize();
}
function buildControls(k, settings, st){
  const box = $('#simControls'); box.innerHTML = '';
  for (const c of (k.controls ? k.controls(settings) : [])){
    const lab = document.createElement('label'); lab.className = 'ctl';
    lab.innerHTML = `<span>${c.label}</span><input type="range" id="sim-${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"><output>${c.fmt(c.value)}</output>`;
    const inp = lab.querySelector('input'), out = lab.querySelector('output');
    inp.addEventListener('input', () => { const v = +inp.value; out.textContent = c.fmt(v); k.param(st, c.id, v); });
    inp._fmt = c.fmt; box.appendChild(lab);
  }
  for (const tg of k.toggles || []){
    st[tg.id] = tg.on;
    const lab = document.createElement('label'); lab.className = 'ctl';
    lab.innerHTML = `<input type="checkbox" id="sim-${tg.id}" ${tg.on ? 'checked' : ''}> <span>${tg.label}</span>`;
    lab.querySelector('input').addEventListener('change', e => k.param(st, tg.id, e.target.checked));
    box.appendChild(lab);
  }
  for (const b of k.buttons || []){
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = b.label;
    btn.addEventListener('click', () => b.fn(st)); box.appendChild(btn);
  }
  box.hidden = !box.children.length;
}
function syncControls(pairs){
  for (const [id, v] of pairs){ const inp = document.getElementById('sim-' + id); if (!inp) continue; inp.value = v; inp.nextElementSibling.textContent = inp._fmt(v); }
}
function drawHolo(dt){
  ctx.fillStyle = rgba(T.bg, .6); ctx.fillRect(0, 0, VW, VH);
  const pad = isMobile() ? 6 : Math.max(8, VW * .02), r = {x:pad, y:pad, w:VW - pad*2, h:VH - pad*2};
  rrect(r.x, r.y, r.w, r.h, 6); ctx.fillStyle = T.holo; ctx.fill(); ctx.strokeStyle = rgba(T.accent, .7); ctx.lineWidth = 1.5; ctx.stroke();
  const ip = isMobile() ? 10 : 14;
  txt('STATION SCREEN · ' + LOC[SIM.model.story.location].label, r.x + ip, r.y + 18, {size:10, c:T.accent});
  const titleLines = wrap(SIM.kind.title, r.w - ip * 2, Math.min(19, Math.max(15, VW / 34)), 'disp', 600);
  para(titleLines, r.x + ip, r.y + 38, Math.min(19, Math.max(15, VW / 34)), {f:'disp', w:600});
  const top = 30 + titleLines.length * Math.min(19, Math.max(15, VW / 34)) * 1.3;
  const inner = {x:r.x + ip, y:r.y + top, w:r.w - ip * 2, h:r.h - top - ip};
  SIM.hits = [];
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  SIM.kind.draw(SIM.st, inner, dt);
  ctx.restore();
}

/* ---------- progress: db (syncs across devices) with local fallback ---------- */
const PROG = store.get('prog', {});
let DB = null;
const isDone = id => !!(PROG[id] && PROG[id].done);
function P(id){ return PROG[id] || (PROG[id] = {}); }
function saveProg(id){
  PROG[id].updatedAt = Date.now();
  store.set('prog', PROG);
  if (DB) DB.doc('progress/' + id).set(PROG[id]).catch(() => {});
  updateCounts(); updateDue();
}
function updateCounts(){
  const n = TRAIL.filter(isDone).length;
  $('#doneCount').innerHTML = `learned <b>${n}/20</b>`;
}
(async () => {
  if (!window.claude || !window.claude.use) return;
  try {
    DB = await window.claude.use('db'); if (!DB) return;
    const snap = await DB.collection('progress').get();
    snap.docs.forEach(d => { const v = d.data(); if (v && (!PROG[d.id] || (v.updatedAt || 0) > (PROG[d.id].updatedAt || 0))) PROG[d.id] = v; });
    store.set('prog', PROG); updateCounts(); renderTrail(); if (cur) renderStep();
  } catch(e){ DB = null; }
})();

/* ---------- lesson: 8 steps ---------- */
const STEPS = [
  {id:'predict', label:'Predict'}, {id:'story', label:'Story'}, {id:'simulate', label:'Simulate'}, {id:'name', label:'Name it'},
  {id:'elsewhere', label:'Elsewhere'}, {id:'failure', label:'Failure'}, {id:'explain', label:'Explain'}, {id:'review', label:'Review'}
];
let cur = null, step = 0, beatIdx = 0, sentences = [];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
function splitSentences(t){ return t.match(/[^.!?]+[.!?]+['"’”]?\s*/g) || [t]; }
function speakerOf(s){
  if (/^\s*['“]?You\b/.test(s)) return 'you';
  const m = s.match(/\b(Ada|Mira|Dox|Rook)\b/); return m ? m[1].toLowerCase() : null;
}
function stageCast(loc, ids){
  cast.forEach(c => { c.stage = ids.includes(c.id); });
  ids.forEach((cid, k) => sendTo(who(cid), loc, k, ids.length));
  cast.filter(c => !ids.includes(c.id)).forEach(c => sendTo(c, HOME[c.id]));
}
function openModel(id, opts = {}){
  const m = MODELS[id]; cur = m; store.set('last', id);
  if (MODE !== 'lesson'){ MODE = 'lesson'; modeUI(); }
  closeSim(); closeTrail();
  sentences = splitSentences(m.story.beat); beatIdx = 0;
  blight = Math.min(1, (m.story.trail - 1) / 16);
  step = opts.step ?? P(id).step ?? 0;
  renderTrail();
  goStep(step, true);
}
function goStep(i, fresh){
  const m = cur; step = Math.max(0, Math.min(STEPS.length - 1, i));
  const p = P(m.id); p.step = step; p.seen = Math.max(p.seen || 0, step); store.set('prog', PROG);
  if (step === 3 && typeof updateDue === 'function') updateDue();
  if (SIM && STEPS[step].id !== 'simulate') closeSim();
  // move the scene to match the step
  const loc = m.story.location;
  if (STEPS[step].id === 'failure'){ activeLoc = 'comms'; focus('comms', 1.5); stageCast('comms', ['you']); }
  else if (STEPS[step].id === 'elsewhere'){ showExample(m, 0); }
  else {
    activeLoc = loc; focus(loc, 1.55);
    if (fresh || !cast.some(c => c.stage && c.anchor === loc)) stageCast(loc, m.story.cast);
  }
  if (STEPS[step].id === 'story') playSentence();
  if (STEPS[step].id === 'simulate' && simAvailable(m) && !SIM) openSim(m);
  $('#where').textContent = `${LOC[activeLoc].label.toLowerCase()} · stop ${m.story.trail} of 20`;
  $('#simBtn').disabled = !simAvailable(m);
  renderStep();
  if (!fresh && isMobile()) scrollTo({top:0, behavior:reduceMotion ? 'auto' : 'smooth'});
}
function playSentence(){
  const s = sentences[beatIdx] || '', sp = speakerOf(s);
  cast.forEach(c => { if (c.stage){ const k = cur.story.cast.indexOf(c.id); if (k >= 0){ const [x, y] = spotIn(activeLoc, k, cur.story.cast.length); c.tx = x; c.ty = y; } } });
  if (sp && who(sp)){
    const c = who(sp); c.pulse = 1.2; c.hop = .5;
    if (!c.stage){ c.stage = true; sendTo(c, activeLoc, 0, 1); }
    if (/!|scoff|burn|panic/i.test(s)) c.shake = .6;
  }
  document.querySelectorAll('.beat .s').forEach((el, i) => { el.classList.toggle('on', i === beatIdx); el.classList.toggle('done', i < beatIdx); });
  updateNav();
}
function showExample(m, i){
  const e = m.examples[i]; if (!e) return;
  document.querySelectorAll('[data-ex]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.ex === i ? 'true' : 'false'));
  activeLoc = e.location; focus(e.location, 1.55);
  const pair = ['you', m.story.cast.find(c => c !== 'you') || 'ada'];
  stageCast(e.location, pair); who(pair[1]).pulse = 1.2;
  $('#where').textContent = `${LOC[e.location].label.toLowerCase()} · example ${i + 1} of 3`;
}

/* questions with a confidence rating (trains calibration) */
function qHTML(q, key){
  const a = P(cur.id)[key], pend = pending[key];
  const opts = q.options.map((o, i) => {
    let cls = 'opt';
    if (a){ if (i === q.answer) cls += ' right'; else if (i === a.choice) cls += ' wrong'; }
    else if (pend === i) cls += ' picked';
    return `<button type="button" class="${cls}" data-q="${key}" data-i="${i}" ${a ? 'disabled' : ''}>${esc(o)}</button>`;
  }).join('');
  const conf = !a && pend != null ? `<div class="conf"><span>How sure are you?</span>${[50, 70, 90].map(c => `<button type="button" class="btn" data-conf="${key}" data-c="${c}">${c}%</button>`).join('')}</div>` : '';
  const why = a ? `<p class="why"><b style="color:${a.correct ? 'var(--accent)' : 'var(--warn)'}">${a.correct ? 'Right' : 'Not quite'} · you said ${a.conf}% sure</b><br>${esc(q.why)}</p>` : '';
  return `<div class="q"><p class="prompt">${esc(q.prompt)}</p><div class="opts">${opts}</div>${conf}${why}</div>`;
}
const pending = {};
function wireQuestions(){
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { pending[b.dataset.q] = +b.dataset.i; renderStep(); });
  document.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => {
    const key = b.dataset.conf, q = questionFor(key), choice = pending[key];
    P(cur.id)[key] = {choice, conf:+b.dataset.c, correct:choice === q.answer, at:Date.now()};
    delete pending[key];
    const p = P(cur.id); if (p.mcq && p.which) p.done = true;
    saveProg(cur.id); renderStep(); renderTrail();
  });
}
function questionFor(key){ const q = cur.quiz; return key === 'predict' ? q.predict : key === 'mcq' ? q.mcq[0] : q.whichModel; }
function calibration(){
  const rows = {50:[0, 0], 70:[0, 0], 90:[0, 0]};
  for (const p of Object.values(PROG)) for (const k of ['predict', 'mcq', 'which']) if (p[k]){ rows[p[k].conf][1]++; if (p[k].correct) rows[p[k].conf][0]++; }
  const parts = Object.entries(rows).filter(([, v]) => v[1]).map(([c, v]) => `said ${c}% → right ${Math.round(v[0] / v[1] * 100)}% (${v[1]})`);
  return parts.length ? 'Your calibration so far: ' + parts.join(' · ') : '';
}

function renderStep(){
  if (MODE !== 'lesson'){ renderMode(); return; }
  const m = cur, s = STEPS[step], p = P(m.id);
  $('#steps').innerHTML = STEPS.map((x, i) => `<button type="button" role="tab" data-step="${i}" class="${i <= (p.seen || 0) ? 'seen' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="lbl">${i + 1} ${x.label}</span></button>`).join('');
  $('#steps').querySelectorAll('[data-step]').forEach(b => b.onclick = () => goStep(+b.dataset.step));
  const cur_ = $('#steps').querySelector('[aria-current]'); if (cur_) cur_.scrollIntoView({block:'nearest', inline:'nearest'});
  const head = `<div class="eyebrow"><span>Stop ${m.story.trail}/20 · Act ${m.story.act}</span><span>${esc(C.story.acts.find(a => a.act === m.story.act).title)}</span>${isDone(m.id) ? '<span style="color:var(--accent)">learned ✓</span>' : ''}</div>`;
  let h = '';
  if (s.id === 'predict'){
    h = `${head}<p class="stepname">Step 1 · Predict first</p><p class="lead">Before the lesson, make a call. Guessing first makes the answer stick, even when the guess is wrong.</p>${qHTML(m.quiz.predict, 'predict')}`;
  } else if (s.id === 'story'){
    h = `${head}<p class="stepname">Step 2 · In the colony</p><p class="beat">${sentences.map((x, i) => `<span class="s" data-line="${i}">${esc(x)}</span>`).join('')}</p><p class="small">Watch the scene: whoever speaks steps forward and pulses. Tap any line to replay it.</p>`;
  } else if (s.id === 'simulate'){
    const ok = simAvailable(m);
    h = `${head}<p class="stepname">Step 3 · Try it on the station screen</p>${ok ? `<p class="try"><b>Try this</b>${esc(m.sim.try || 'Change the controls and watch what moves.')}</p><p class="small">${isMobile() ? 'The screen is above. Its controls are under it.' : 'Controls are under the screen.'}</p>${SIM ? '' : '<button class="btn primary" id="reopen" type="button">Open station screen</button>'}`
      : `<p class="lead">This model's ${m.sim.type === 'agents' ? 'agent-world' : 'diagram'} screen is being built (${m.sim.type === 'agents' ? 'build step 5' : 'next build'}). Skip ahead for now.</p>`}`;
  } else if (s.id === 'name'){
    const fx = store.get('fx', true);
    h = `${head}<p class="stepname">Step 4 · Name it</p><h2>${esc(m.name)}</h2><p class="small">${esc(m.originator)}${m.year && m.year !== '—' ? ' · ' + esc(m.year) : ''} · ${esc(m.evidenceLabel)}</p>${m.aliases.length ? `<p class="small">Also called: ${m.aliases.map(esc).join(', ')}</p>` : ''}<p class="rule">${esc(m.rule)}</p><p class="plain">${esc(m.plain)}</p>${m.formula ? (fx ? `<div class="formula">${esc(m.formula)}</div><button class="btn ghost" id="fxBtn" type="button">Hide formula</button>` : `<button class="btn ghost" id="fxBtn" type="button">Show formula</button>`) : ''}`;
  } else if (s.id === 'elsewhere'){
    h = `${head}<p class="stepname">Step 5 · Same model, elsewhere in the colony</p><p class="lead">Tap each one. The crew walks there.</p><ul class="ex">${m.examples.map((e, i) => `<li><button type="button" data-ex="${i}" aria-pressed="false"><span class="loc">${esc(LOC[e.location].label.split(' ')[0])}</span><span>${esc(e.text)}</span></button></li>`).join('')}</ul>`;
  } else if (s.id === 'failure'){
    const rc = m.realCase;
    h = `${head}<p class="stepname">Step 6 · Failure museum</p><div class="archive"><div class="hd"><span>Archive transmission from Earth · ${esc(rc.year)}</span><b class="${rc.kind === 'success' ? 'ok' : ''}">${rc.kind}</b></div><h5>${esc(rc.title)}</h5><p>${esc(rc.text)}</p><cite>${esc(rc.source)}</cite></div><div class="sec"><h4>How this model itself misleads</h4><p class="misuse">${esc(m.misuse)}</p></div>`;
  } else if (s.id === 'explain'){
    const th = p.tutor || [];
    h = `${head}<p class="stepname">Step 7 · Explain it back</p><p class="lead">In your own words: what is <b>${esc(m.name)}</b>, and where would you use it outside the colony?</p>
      <label class="small" for="explainBox">Your explanation</label><textarea id="explainBox" placeholder="It means… For example…">${esc(p.explain || '')}</textarea>
      <div class="thread" id="thread">${th.map(t => `<div class="msg ${t.role === 'user' ? 'me' : 'tutor'}"><span class="who">${t.role === 'user' ? 'you' : 'tutor'}</span>${esc(t.content)}</div>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="askTutor" type="button">${th.length ? 'Reply to tutor' : 'Ask the tutor'}</button>${th.length ? '<button class="btn ghost" id="clearTutor" type="button">Start over</button>' : ''}</div>
      <p class="small" id="tutorNote">${th.length ? 'Write your answer to the tutor\'s question in the box, then reply.' : 'The tutor checks your explanation and asks one "why?" question.'}</p>
      <p class="small"><button class="linkish" type="button" id="toTutor">Keep going in the full tutor chat</button></p>
      <div class="sec"><h4>Check yourself</h4><ul class="checklist"><li>Did you name the model and its rule?</li><li>Did you give an example that isn't from the colony?</li><li>Did you say when it misleads?</li></ul></div>`;
  } else if (s.id === 'review'){
    const cal = calibration();
    h = `${head}<p class="stepname">Step 8 · Review</p>${qHTML(m.quiz.mcq[0], 'mcq')}${qHTML(m.quiz.whichModel, 'which')}
      ${cal ? `<p class="calib">${esc(cal)}</p>` : ''}
      ${isDone(m.id) ? `<p class="lead" style="color:var(--accent)">Stop learned. A light turns on at ${esc(LOC[m.story.location].label.toLowerCase())}.</p>` : ''}
      <div class="sec"><h4>Connects to</h4><div class="rel">${m.related.map(r => `<button class="chip ${isDone(r) ? 'done' : ''}" type="button" data-go="${r}"><i>${MODELS[r].story.trail}</i>${esc(MODELS[r].name)}</button>`).join('')}</div></div>
      ${m.videos.length ? `<div class="sec"><h4>Watch</h4><ul class="src">${m.videos.map(v => `<li>${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a>` : esc(v.title)} · ${esc(v.channel)}${v.url ? '' : ' (search on YouTube)'}</li>`).join('')}</ul></div>` : ''}
      <div class="sec"><h4>Sources</h4><ul class="src">${m.sources.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }
  $('#body').innerHTML = h;
  wireQuestions();
  document.querySelectorAll('[data-line]').forEach(el => el.onclick = () => { beatIdx = +el.dataset.line; playSentence(); });
  document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => showExample(m, +b.dataset.ex));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => openModel(b.dataset.go));
  const re = $('#reopen'); if (re) re.onclick = () => { openSim(m); renderStep(); };
  const fxb = $('#fxBtn'); if (fxb) fxb.onclick = () => { store.set('fx', !store.get('fx', true)); renderStep(); };
  if (s.id === 'story') playSentence();
  if (s.id === 'explain') wireTutor();
  updateNav();
}
function updateNav(){
  const s = STEPS[step], last = step === STEPS.length - 1, inStory = s.id === 'story' && beatIdx < sentences.length - 1;
  $('#navBack').disabled = step === 0 && cur.story.trail === 1;
  $('#navBack').textContent = step === 0 ? 'Prev stop' : 'Back';
  $('#navNext').textContent = inStory ? 'Next line' : last ? (cur.story.trail < 20 ? 'Next stop' : 'Done') : 'Next';
  $('#navMid').textContent = inStory ? `line ${beatIdx + 1} of ${sentences.length}` : `${step + 1}/8 · ${s.label}`;
}
$('#navNext').onclick = () => {
  const s = STEPS[step];
  if (s.id === 'story' && beatIdx < sentences.length - 1){ beatIdx++; playSentence(); return; }
  if (step < STEPS.length - 1) goStep(step + 1);
  else if (cur.story.trail < 20) openModel(TRAIL[cur.story.trail], {step:0});
};
$('#navBack').onclick = () => {
  if (STEPS[step].id === 'story' && beatIdx > 0){ beatIdx--; playSentence(); return; }
  if (step > 0) goStep(step - 1);
  else if (cur.story.trail > 1) openModel(TRAIL[cur.story.trail - 2], {step:7});
};

/* tutor: Socratic "why?" via Claude */
let SAMPLE, tutorBusy = false;
function wireTutor(){
  const box = $('#explainBox');
  box.oninput = () => { P(cur.id).explain = box.value; store.set('prog', PROG); };
  box.onchange = () => saveProg(cur.id);
  const clr = $('#clearTutor'); if (clr) clr.onclick = () => { P(cur.id).tutor = []; saveProg(cur.id); renderStep(); };
  $('#askTutor').onclick = askTutor;
  $('#toTutor').onclick = () => { TUT.topic = cur.id; setMode('tutor'); };
}
async function askTutor(){
  if (tutorBusy) return;
  const m = cur, p = P(m.id), text = $('#explainBox').value.trim(), note = $('#tutorNote');
  if (text.length < 15){ note.textContent = 'Write at least a sentence first, then ask.'; return; }
  if (SAMPLE === undefined) SAMPLE = window.claude && window.claude.use ? await window.claude.use('sample') : null;
  if (!SAMPLE){ note.textContent = 'The tutor isn\'t available in this view. Use the self-check list below instead.'; saveProg(m.id); return; }
  p.tutor = p.tutor || [];
  const intro = `You are a Socratic tutor inside a learning app about mental models. Its story is set in a space colony, Kepler Station.
The learner is studying: ${m.name}. Rule: ${m.rule}
Colony story: ${m.story.beat}
Common misuse: ${m.misuse}
Reply in at most 90 words of plain text, no markdown. First, one concrete sentence on what is right or missing in the learner's explanation (no praise padding). Then ask exactly one question — a "why?" or "what would change your mind?" — that makes them apply the model to a new case outside the colony. If their answer to your earlier question is solid, say so briefly and ask a harder one.`;
  const turns = p.tutor.length ? [{role:'user', content:intro + '\n\nLearner\'s first explanation: ' + (p.tutor[0].content)}, ...p.tutor.slice(1), {role:'user', content:text}]
                               : [{role:'user', content:intro + '\n\nLearner\'s explanation: ' + text}];
  p.tutor.push({role:'user', content:text});
  p.explain = ''; tutorBusy = true;
  renderStep();
  const thread = $('#thread'), bubble = document.createElement('div');
  bubble.className = 'msg tutor'; bubble.innerHTML = '<span class="who">tutor</span><span class="tx">Thinking…</span>'; thread.appendChild(bubble);
  $('#askTutor').disabled = true;
  try {
    const res = await SAMPLE(turns, {cache:false, onText:u => { bubble.querySelector('.tx').textContent = u.text; }});
    p.tutor.push({role:'assistant', content:res.text});
  } catch(e){
    const msg = e && e.code === 'not_granted' ? 'The tutor needs your permission to run. Use the self-check list below instead.' : e && e.code === 'rate_limited' ? 'The tutor is busy. Try again in a minute.' : 'The tutor could not answer just now. Try again later.';
    p.tutor.pop(); p.explain = text; $('#tutorNote').textContent = msg; bubble.remove();
  }
  tutorBusy = false; saveProg(m.id); renderStep();
}

/* ---------- trail / stops sheet ---------- */
function renderTrail(){
  const nav = $('#trail');
  nav.innerHTML = `<div class="sheethead"><h2>Stops</h2><button class="btn" type="button" id="closeStops">Close</button></div>` +
    C.story.acts.map(a => `<div class="act"><h3>Act ${a.act} · ${esc(a.title)}<span class="qq"> ${esc(a.question)}</span></h3>${
      a.models.map(id => { const m = MODELS[id]; return `<button class="chip ${isDone(id) ? 'done' : ''}" type="button" data-id="${id}" aria-current="${cur && cur.id === id}"><i>${isDone(id) ? '✓' : m.story.trail}</i>${esc(m.name)}<span class="t">${m.sim.type}</span></button>`; }).join('')}</div>`).join('');
  nav.querySelectorAll('[data-id]').forEach(b => b.onclick = () => openModel(b.dataset.id, {step:0}));
  $('#closeStops').onclick = closeTrail;
}
function closeTrail(){ $('#trail').classList.remove('open'); document.body.style.overflow = ''; }
$('#stopsBtn').onclick = () => { $('#trail').classList.add('open'); document.body.style.overflow = 'hidden'; const c = $('#trail [aria-current="true"]'); if (c) c.scrollIntoView({block:'center'}); };

/* ---------- canvas input ---------- */
function ptr(ev){ const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; }
function locAt(ev){
  const [sx, sy] = ptr(ev), [wx, wy] = toWorld(sx, sy);
  for (const [id, L] of Object.entries(LOC)) if (Math.abs(wx - L.x) < L.w/2 + 8 && Math.abs(wy - L.y) < L.h/2 + 8) return id;
  return null;
}
cv.addEventListener('pointermove', ev => {
  if (SIM){ const [x, y] = ptr(ev); cv.style.cursor = SIM.hits.some(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) ? 'pointer' : 'default'; return; }
  hoverLoc = locAt(ev); cv.style.cursor = hoverLoc && byLoc[hoverLoc] ? 'pointer' : 'default';
});
cv.addEventListener('click', ev => {
  if (SIM){ const [x, y] = ptr(ev); const h = SIM.hits.find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h); if (h) h.fn(); return; }
  const id = locAt(ev); if (!id || !byLoc[id]) return;
  const list = byLoc[id], i = cur && list.includes(cur.id) ? (list.indexOf(cur.id) + 1) % list.length : 0;
  openModel(list[i]);
});
$('#simBtn').onclick = () => {
  if (SIM){ closeSim(); if (STEPS[step].id === 'simulate') renderStep(); }
  else if (cur && simAvailable(cur)){ if (STEPS[step].id !== 'simulate') goStep(2); else { openSim(cur); renderStep(); } }
};
$('#overview').onclick = () => { closeSim(); overview(); };
addEventListener('keydown', e => { if (e.key === 'Escape'){ if (SIM) closeSim(); closeTrail(); } });

/* ---------- loop ---------- */
let last = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const k = reduceMotion ? 1 : Math.min(1, dt * 3.5);
  cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  stepCast(dt);
  drawColony(now / 1000);
  drawCast(now / 1000);
  if (SIM) drawHolo(dt);
  requestAnimationFrame(frame);
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { if (b.dataset.mode === 'recall') RS = {view:'menu'}; setMode(b.dataset.mode); });
$('#dueCount').onclick = () => { RS = {view:'menu'}; setMode('recall'); };
overview(); cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz;
updateCounts(); updateDue();
const start = store.get('last', TRAIL[0]);
openModel(MODELS[start] ? start : TRAIL[0]);
requestAnimationFrame(frame);
