/* ============ ACTIVE RECALL · SPACED REPETITION (FSRS) · ANKI EXPORT · SOCRATIC TUTOR ============ */
let MODE = 'lesson';
const SRS = store.get('srs', {});                 // cardId -> {s, d, due, reps, lapses, last, first}
const TUT = store.get('tut', {msgs:[], topic:'', updatedAt:0});
let RDB = null;
const useCap = async name => (window.claude && window.claude.use ? window.claude.use(name) : null);
(async () => {
  try {
    RDB = await useCap('db'); if (!RDB) return;
    const [a, b] = await Promise.all([RDB.collection('srs').get(), RDB.doc('tutor/chat').get()]);
    a.docs.forEach(d => { const v = d.data(); if (v && (!SRS[d.id] || (v.last || 0) > (SRS[d.id].last || 0))) SRS[d.id] = v; });
    if (b.exists){ const v = b.data(); if (v && (v.updatedAt || 0) > (TUT.updatedAt || 0)) Object.assign(TUT, v); }
    store.set('srs', SRS); store.set('tut', TUT); updateDue(); if (MODE !== 'lesson') renderMode();
  } catch(e){ RDB = null; }
})();
function saveCard(id){ store.set('srs', SRS); if (RDB) RDB.doc('srs/' + id).set(SRS[id]).catch(() => {}); }
function saveTutor(){ TUT.msgs = TUT.msgs.slice(-40); TUT.updatedAt = Date.now(); store.set('tut', TUT); if (RDB) RDB.doc('tutor/chat').set({msgs:TUT.msgs, topic:TUT.topic, updatedAt:TUT.updatedAt}).catch(() => {}); }

/* ---- FSRS-4.5 with its published default parameters (desired retention 90%) ---- */
const FW = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RETAIN = 0.9, DAY = 864e5;
const clampD = d => Math.min(10, Math.max(1, d));
const retrievability = (days, s) => Math.pow(1 + FACTOR * days / s, DECAY);
const intervalDays = s => Math.max(1, Math.round(s / FACTOR * (Math.pow(RETAIN, 1 / DECAY) - 1)));
const d0 = g => clampD(FW[4] - (g - 3) * FW[5]);
function fsrs(c, g, now){                          // g: 1 Again · 2 Hard · 3 Good · 4 Easy
  const n = c ? {...c} : {reps:0, lapses:0, first:now};
  if (!c || !c.reps){ n.s = FW[g - 1]; n.d = d0(g); }
  else {
    const r = retrievability(Math.max(0, (now - c.last) / DAY), c.s);
    n.d = clampD(FW[7] * d0(3) + (1 - FW[7]) * (c.d - FW[6] * (g - 3)));
    if (g === 1){ n.s = Math.min(c.s, FW[11] * Math.pow(n.d, -FW[12]) * (Math.pow(c.s + 1, FW[13]) - 1) * Math.exp(FW[14] * (1 - r))); n.lapses++; }
    else n.s = c.s * (1 + Math.exp(FW[8]) * (11 - n.d) * Math.pow(c.s, -FW[9]) * (Math.exp(FW[10] * (1 - r)) - 1) * (g === 2 ? FW[15] : 1) * (g === 4 ? FW[16] : 1));
  }
  n.reps++; n.last = now;
  n.due = g === 1 ? now + 10 * 60e3 : now + intervalDays(n.s) * DAY;
  return n;
}
const fmtIvl = ms => ms < 36e5 ? Math.round(ms / 6e4) + 'm' : ms < DAY ? Math.round(ms / 36e5) + 'h' : ms < 30 * DAY ? Math.round(ms / DAY) + 'd' : ms < 365 * DAY ? (ms / (30 * DAY)).toFixed(1) + 'mo' : (ms / (365 * DAY)).toFixed(1) + 'y';

/* ---- cards: five per model ---- */
function cardsFor(m){
  const rc = m.realCase;
  return [
    {id:m.id + '-rule', m, type:'Recall the rule', front:m.name, prompt:'State its rule in one sentence and give one example.', back:m.rule, extra:m.plain},
    {id:m.id + '-name', m, type:'Name the model', front:m.rule, prompt:'Which model is this? Who is it linked to?', back:m.name, extra:m.originator + (m.year && m.year !== '—' ? ' · ' + m.year : '')},
    {id:m.id + '-case', m, type:'Failure museum', front:`${rc.title} (${rc.year})`, prompt:'Which model does this real case teach, and how?', back:m.name, extra:rc.text},
    {id:m.id + '-misuse', m, type:'How it misleads', front:m.name, prompt:'How can this model itself lead you astray?', back:m.misuse, extra:''},
    {id:m.id + '-spot', m, type:'Spot the model', mcq:m.quiz.whichModel}
  ];
}
const ALLCARDS = TRAIL.flatMap(id => cardsFor(MODELS[id]));
const CARD = Object.fromEntries(ALLCARDS.map(c => [c.id, c]));
const unlocked = () => TRAIL.filter(id => (PROG[id] && (PROG[id].seen || 0) >= 3) || isDone(id));
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return +d; };
const NEW_PER_DAY = 10, REVIEW_CAP = 30;
function dueCards(now = Date.now()){
  const pool = ALLCARDS.filter(c => unlocked().includes(c.m.id));
  const reviews = pool.filter(c => SRS[c.id] && SRS[c.id].due <= now).sort((a, b) => SRS[a.id].due - SRS[b.id].due);
  const newToday = Object.values(SRS).filter(v => v.first >= startOfDay()).length;
  const fresh = pool.filter(c => !SRS[c.id]).slice(0, Math.max(0, NEW_PER_DAY - newToday));
  return interleave([...reviews, ...fresh].slice(0, REVIEW_CAP));
}
function interleave(list){                         // shuffle, then avoid two cards from one model in a row
  const a = list.slice().sort(() => Math.random() - .5);
  for (let i = 1; i < a.length; i++) if (a[i].m.id === a[i - 1].m.id){ const j = a.findIndex((c, k) => k > i && c.m.id !== a[i - 1].m.id); if (j > 0) [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function updateDue(){
  const n = dueCards().length;
  const b = $('#dueBadge'); if (b) b.textContent = n ? n : '';
  const h = $('#dueCount'); if (h) h.innerHTML = `due <b>${n}</b>`;
}

/* ---- modes ---- */
let RS = {view:'menu'};                             // recall state
function modeUI(){
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === MODE ? 'true' : 'false'));
  $('#steps').hidden = MODE !== 'lesson';
  document.querySelector('.nav').hidden = MODE !== 'lesson';
  document.body.classList.toggle('nonav', MODE !== 'lesson');
}
function setMode(m){
  MODE = m; modeUI();
  if (m === 'lesson'){ goStep(step, true); return; }
  closeSim(); renderMode();
  if (isMobile()) scrollTo({top:0});
}
function renderMode(){ if (MODE === 'recall') renderRecall(); else if (MODE === 'tutor') renderTutor(); }

/* ---- recall menu ---- */
function renderRecall(){
  const v = RS.view, B = $('#body');
  if (v === 'session' || v === 'cram' || v === 'drill') return renderCard();
  if (v === 'blurt') return renderBlurt();
  if (v === 'anki') return renderAnki();
  if (v === 'methods') return renderMethods();
  const un = unlocked(), due = dueCards(), reviewed = Object.keys(SRS).length;
  const now = Date.now();
  const forecast = Array.from({length:7}, (_, i) => ALLCARDS.filter(c => SRS[c.id] && SRS[c.id].due > now + (i - 1) * DAY && SRS[c.id].due <= now + i * DAY && i > 0).length);
  const rs = Object.values(SRS).filter(x => x.reps).map(x => retrievability(Math.max(0, (now - x.last) / DAY), x.s));
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  const weak = un.map(id => { const cs = cardsFor(MODELS[id]).map(c => SRS[c.id]).filter(Boolean); return [id, cs.length ? cs.reduce((a, c) => a + c.s, 0) / cs.length : 0, cs.reduce((a, c) => a + c.lapses, 0)]; })
                 .filter(x => x[1] > 0).sort((a, b) => a[1] - b[1]).slice(0, 3);
  const maxF = Math.max(1, ...forecast);
  B.innerHTML = `
    <p class="stepname">Active recall</p>
    <p class="lead">Pull it out of your head before you look. Every card you answer here is scheduled by FSRS, so it comes back just before you'd forget it.</p>
    <div class="menu">
      <button type="button" class="tile primary" data-go="session" ${due.length ? '' : 'disabled'}><b>Review due cards</b><span>${due.length ? `${due.length} ready · mixed across ${new Set(due.map(c => c.m.id)).size} models` : un.length ? 'Nothing due. Come back tomorrow.' : 'Reach “Name it” in a lesson to unlock cards.'}</span></button>
      <button type="button" class="tile" data-go="blurt" ${un.length ? '' : 'disabled'}><b>Blurt</b><span>Blank page: write everything you remember about one model, then check.</span></button>
      <button type="button" class="tile" data-go="drill"><b>Which model is this?</b><span>10 mixed scenarios from all 20 models. Trains telling them apart.</span></button>
      <button type="button" class="tile" data-go="cram" ${un.length ? '' : 'disabled'}><b>Cram one stop</b><span>All 5 cards for one model, outside the schedule.</span></button>
      <button type="button" class="tile" data-go="anki"><b>Export to Anki</b><span>All 100 cards as an Anki deck file.</span></button>
      <button type="button" class="tile" data-go="methods"><b>How this works</b><span>Active recall, FSRS, SM-2, Leitner, interleaving.</span></button>
    </div>
    ${RS.pickCram ? `<div class="sec"><h4>Cram which stop?</h4><div class="rel">${un.map(id => `<button class="chip" type="button" data-cram="${id}"><i>${MODELS[id].story.trail}</i>${esc(MODELS[id].name)}</button>`).join('')}</div></div>` : ''}
    <div class="sec"><h4>Your memory</h4>
      <div class="stats">
        <div><b>${un.length}/20</b><span>models unlocked</span></div>
        <div><b>${reviewed}/${un.length * 5}</b><span>cards started</span></div>
        <div><b>${avgR == null ? '—' : Math.round(avgR * 100) + '%'}</b><span>est. recall right now</span></div>
      </div>
      <div class="forecast" aria-label="Reviews due over the next 7 days">${forecast.slice(1).map((n, i) => `<div><span style="height:${Math.round(n / maxF * 100)}%"></span><em>${n}</em><small>${i === 0 ? 'tmrw' : '+' + (i + 1) + 'd'}</small></div>`).join('')}</div>
      ${weak.length ? `<p class="small">Weakest so far: ${weak.map(([id]) => `<button class="linkish" type="button" data-weak="${id}">${esc(MODELS[id].name)}</button>`).join(' · ')}. Tap one to blurt it.</p>` : ''}
      ${calibration() ? `<p class="calib">${esc(calibration())}</p>` : ''}
    </div>`;
  B.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'session') startSession(dueCards(), 'session');
    else if (g === 'drill') startSession(interleave(TRAIL.map(id => CARD[id + '-spot'])).slice(0, 10), 'drill');
    else if (g === 'cram'){ RS.pickCram = !RS.pickCram; renderRecall(); }
    else if (g === 'blurt'){ RS = {view:'blurt', model:(weak[0] || [])[0] || un[un.length - 1]}; renderRecall(); }
    else { RS = {view:g}; renderRecall(); }
  });
  B.querySelectorAll('[data-cram]').forEach(b => b.onclick = () => startSession(cardsFor(MODELS[b.dataset.cram]), 'cram'));
  B.querySelectorAll('[data-weak]').forEach(b => b.onclick = () => { RS = {view:'blurt', model:b.dataset.weak}; renderRecall(); });
}
function backToMenu(){ RS = {view:'menu'}; updateDue(); renderRecall(); }
function startSession(queue, view){ RS = {view, queue, i:0, shown:false, typed:'', tally:{again:0, hard:0, good:0, easy:0, right:0}}; renderRecall(); }

function renderCard(){
  const B = $('#body');
  if (RS.i >= RS.queue.length){
    const t = RS.tally, sched = RS.view === 'session';
    B.innerHTML = `<p class="stepname">${sched ? 'Session done' : RS.view === 'drill' ? 'Drill done' : 'Cram done'}</p>
      <p class="lead">${RS.view === 'drill' ? `${t.right} of ${RS.queue.length} spotted correctly.` : `${RS.queue.length} cards. Again ${t.again} · Hard ${t.hard} · Good ${t.good} · Easy ${t.easy}.`}</p>
      ${sched ? `<p class="small">${dueCards().length ? dueCards().length + ' cards are still due (the ones you missed come back in 10 minutes).' : 'Nothing else is due today.'}</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="rMenu" type="button">Recall menu</button><button class="btn" id="rTutor" type="button">Discuss with the tutor</button></div>`;
    $('#rMenu').onclick = backToMenu;
    $('#rTutor').onclick = () => { TUT.topic = ''; setMode('tutor'); };
    return;
  }
  const c = RS.queue[RS.i], sched = RS.view === 'session', now = Date.now();
  const head = `<div class="eyebrow"><span>${RS.view === 'session' ? 'Review' : RS.view === 'drill' ? 'Mixed drill' : 'Cram'} · card ${RS.i + 1} of ${RS.queue.length}</span><span>${esc(c.type)}</span>${sched && !SRS[c.id] ? '<span style="color:var(--accent)">new</span>' : ''}</div>`;
  let h;
  if (c.mcq){
    const q = c.mcq, a = RS.answer;
    h = `${head}<div class="q"><p class="prompt">${esc(q.prompt)}</p><div class="opts">${q.options.map((o, i) => `<button type="button" class="opt ${a != null ? (i === q.answer ? 'right' : i === a ? 'wrong' : '') : ''}" data-mc="${i}" ${a != null ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
      ${a != null ? `<p class="why"><b style="color:${a === q.answer ? 'var(--accent)' : 'var(--warn)'}">${a === q.answer ? 'Right' : 'Not quite'}</b><br>${esc(q.why)}</p>` : ''}</div>`;
  } else {
    h = `${head}<div class="card"><p class="front">${esc(c.front)}</p><p class="small">${esc(c.prompt)}</p></div>
      ${RS.shown ? '' : `<label class="small" for="rType">Type your answer first. Writing it beats just thinking it.</label><textarea id="rType" style="min-height:90px" placeholder="From memory…">${esc(RS.typed)}</textarea>`}
      ${RS.shown ? `${RS.typed ? `<div class="msg me"><span class="who">you wrote</span>${esc(RS.typed)}</div>` : ''}<div class="card answer"><p class="front" style="font-size:19px">${esc(c.back)}</p>${c.extra ? `<p class="small">${esc(c.extra)}</p>` : ''}</div>` : ''}`;
  }
  const answered = c.mcq ? RS.answer != null : RS.shown;
  if (!answered && !c.mcq) h += `<button class="btn primary" id="rShow" type="button" style="align-self:flex-start">Show answer</button>`;
  if (answered){
    if (sched){
      const wrongMcq = c.mcq && RS.answer !== c.mcq.answer;
      h += `<div class="grades">${[[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']].map(([g, l]) => `<button type="button" class="btn ${g === 3 ? 'primary' : ''}" data-g="${g}" ${wrongMcq && g > 1 ? 'disabled' : ''}>${l}<small>${fmtIvl(fsrs(SRS[c.id], g, now).due - now)}</small></button>`).join('')}</div>
        <p class="small">Grade how hard it was to recall. The time under each button is when you'll see it next.</p>`;
    } else h += `<button class="btn primary" id="rNext" type="button" style="align-self:flex-start">Next card</button>`;
  }
  h += `<button class="btn ghost" id="rQuit" type="button" style="align-self:flex-start">End session</button>`;
  B.innerHTML = h;
  const ta = $('#rType'); if (ta){ ta.oninput = () => RS.typed = ta.value; if (!isMobile()) ta.focus(); }
  const sh = $('#rShow'); if (sh) sh.onclick = () => { RS.shown = true; focusModel(c.m); renderCard(); };
  B.querySelectorAll('[data-mc]').forEach(b => b.onclick = () => { RS.answer = +b.dataset.mc; if (RS.answer === c.mcq.answer) RS.tally.right++; focusModel(c.m); renderCard(); });
  B.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const g = +b.dataset.g; SRS[c.id] = fsrs(SRS[c.id], g, Date.now()); saveCard(c.id);
    RS.tally[['', 'again', 'hard', 'good', 'easy'][g]]++;
    if (g === 1) RS.queue.push(c);                    // see it again this session
    nextCard();
  });
  const nx = $('#rNext'); if (nx) nx.onclick = nextCard;
  $('#rQuit').onclick = backToMenu;
}
function nextCard(){ RS.i++; RS.shown = false; RS.typed = ''; RS.answer = null; updateDue(); renderCard(); if (isMobile()) scrollTo({top:0}); }
function focusModel(m){
  activeLoc = m.story.location; focus(activeLoc, 1.5);
  stageCast(activeLoc, m.story.cast); const c = who(m.story.cast.find(x => x !== 'you') || 'you'); c.pulse = 1.2; c.hop = .5;
  $('#where').textContent = `${LOC[activeLoc].label.toLowerCase()} · ${m.name}`;
}

/* ---- blurting: free recall on a blank page ---- */
function renderBlurt(){
  const m = MODELS[RS.model], un = unlocked(), B = $('#body');
  const points = [['Its name and rule', m.rule], ['What it means in plain words', m.plain], ['An example', m.examples[0].text], ['A real case', `${m.realCase.title}: ${m.realCase.text}`], ['How it misleads', m.misuse]];
  RS.got = RS.got || points.map(() => false);
  B.innerHTML = `<p class="stepname">Blurt</p>
    <label class="small" for="blurtPick">Model</label>
    <select id="blurtPick" class="select">${un.map(id => `<option value="${id}" ${id === m.id ? 'selected' : ''}>${MODELS[id].story.trail}. ${esc(MODELS[id].name)}</option>`).join('')}</select>
    <p class="lead">Write everything you remember about <b>${esc(m.name)}</b>: the rule, an example, a real case, how it misleads. Don't look anything up.</p>
    <textarea id="blurtBox" placeholder="Everything I remember…" ${RS.checked ? 'readonly' : ''}>${esc(RS.text || '')}</textarea>
    ${RS.checked ? `<div class="sec"><h4>Now compare. Tick what you got.</h4>${points.map(([k, v], i) => `<label class="tick"><input type="checkbox" data-pt="${i}" ${RS.got[i] ? 'checked' : ''}><span><b>${esc(k)}</b><br>${esc(v)}</span></label>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="blurtSave" type="button">Save to schedule (${RS.got.filter(Boolean).length}/5)</button><button class="btn" id="blurtTutor" type="button">Ask the tutor to probe it</button></div>`
      : `<button class="btn primary" id="blurtCheck" type="button" style="align-self:flex-start">Check against the lesson</button>`}
    <button class="btn ghost" id="rQuit" type="button" style="align-self:flex-start">Recall menu</button>`;
  $('#blurtPick').onchange = e => { RS = {view:'blurt', model:e.target.value}; renderBlurt(); };
  $('#blurtBox').oninput = e => RS.text = e.target.value;
  const ck = $('#blurtCheck'); if (ck) ck.onclick = () => { if ((RS.text || '').trim().length < 10) return; RS.checked = true; focusModel(m); renderBlurt(); };
  B.querySelectorAll('[data-pt]').forEach(x => x.onchange = () => { RS.got[+x.dataset.pt] = x.checked; renderBlurt(); });
  const sv = $('#blurtSave'); if (sv) sv.onclick = () => {
    const n = RS.got.filter(Boolean).length, g = n <= 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
    SRS[m.id + '-rule'] = fsrs(SRS[m.id + '-rule'], g, Date.now()); saveCard(m.id + '-rule');
    sv.textContent = `Saved · next review in ${fmtIvl(SRS[m.id + '-rule'].due - Date.now())}`; sv.disabled = true; updateDue();
  };
  const bt = $('#blurtTutor'); if (bt) bt.onclick = () => { TUT.topic = m.id; TUT.draft = `Here is everything I remembered about ${m.name}, without looking:\n\n${RS.text}\n\nProbe the gaps.`; setMode('tutor'); };
  $('#rQuit').onclick = backToMenu;
}

/* ---- Anki export ---- */
function ankiText(){
  const clean = s => esc(String(s)).replace(/[\t\r\n]+/g, ' ');
  const rows = ALLCARDS.map(c => {
    const tags = `kepler act${c.m.story.act} ${c.m.id} ${c.m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
    if (c.mcq) return [`<b>Which model?</b><br>${clean(c.mcq.prompt)}<br><br>${c.mcq.options.map((o, i) => `${'ABCD'[i]}. ${clean(o)}`).join('<br>')}`, `${'ABCD'[c.mcq.answer]}. ${clean(c.mcq.options[c.mcq.answer])}<br><br>${clean(c.mcq.why)}`, tags];
    return [`<small>${clean(c.type)}</small><br><b>${clean(c.front)}</b><br><i>${clean(c.prompt)}</i>`, `<b>${clean(c.back)}</b>${c.extra ? '<br><br>' + clean(c.extra) : ''}`, tags];
  });
  return ['#separator:tab', '#html:true', '#notetype:Basic', '#deck:Kepler Station::Mental Models', '#tags column:3', ...rows.map(r => r.join('\t'))].join('\n') + '\n';
}
function renderAnki(){
  const B = $('#body');
  B.innerHTML = `<p class="stepname">Export to Anki</p>
    <p class="lead">One file with 100 cards: 5 per model, tagged by act and model. Anki imports it as a Basic deck called <b>Kepler Station::Mental Models</b>.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="ankiSave" type="button">Save deck file (.txt)</button><button class="btn" id="ankiCopy" type="button">Copy deck text</button></div>
    <p class="small" id="ankiNote"></p>
    <div class="sec"><h4>Import it</h4><ol class="checklist">
      <li>Anki desktop: <b>File → Import</b>, pick the file. The header lines set the separator, note type, deck and tags for you.</li>
      <li>AnkiMobile or AnkiDroid: import the file the same way from the app's import menu, or import on desktop and sync.</li>
      <li>Deck options → <b>FSRS</b> on (Anki 23.10 or later), desired retention <b>0.90</b>, new cards/day <b>10</b>.</li>
      <li>Keep reviewing in one place. Reviews done in Anki don't sync back to this app.</li></ol></div>
    <textarea id="ankiText" readonly hidden style="font-family:var(--f-mono);font-size:11px;min-height:160px"></textarea>
    <button class="btn ghost" id="rQuit" type="button" style="align-self:flex-start">Recall menu</button>`;
  const note = $('#ankiNote'), text = ankiText();
  $('#ankiSave').onclick = async () => {
    const dl = await useCap('downloads');
    if (!dl){ note.textContent = 'Saving files isn\'t available in this view. Use "Copy deck text", paste it into a file named kepler-station-anki.txt, and import that.'; return; }
    try { const r = await dl.save({filename:'kepler-station-anki.txt', data:text}); note.textContent = r.status === 'saved' ? 'Saved: kepler-station-anki.txt' : 'Sent to your device.'; }
    catch(e){ note.textContent = e && e.code === 'declined' ? 'Save cancelled.' : 'The file could not be saved. Use "Copy deck text" instead.'; }
  };
  $('#ankiCopy').onclick = () => {
    const ta = $('#ankiText'); ta.value = text; ta.hidden = false;
    const fallback = () => { ta.focus(); ta.select(); note.textContent = 'Copying is blocked here. The text is selected below: copy it, save it as a .txt file, and import that.'; };
    try { navigator.clipboard.writeText(text).then(() => note.textContent = 'Copied. Paste into a text file (kepler-station-anki.txt) and import it in Anki.', fallback); } catch(e){ fallback(); }
  };
  $('#rQuit').onclick = backToMenu;
}

/* ---- methods ---- */
function renderMethods(){
  const rows = [
    ['Active recall', 'Pulling an answer from memory strengthens it far more than rereading. Every card here asks before it shows.', 'Roediger & Karpicke, Psychological Science (2006)'],
    ['Spaced repetition', 'Reviewing just as you start to forget beats cramming. Forgetting curves were first measured by Ebbinghaus.', 'Ebbinghaus (1885); Cepeda et al., Psychological Bulletin (2006)'],
    ['Leitner boxes', 'Paper flashcards move up a box when right and back to box 1 when wrong; higher boxes are reviewed less often. The simplest spaced system.', 'Sebastian Leitner, So lernt man lernen (1972)'],
    ['SM-2', 'SuperMemo\'s 1987 algorithm: each card gets an ease factor that multiplies its interval. Anki\'s default for years.', 'Piotr Woźniak (1987)'],
    ['FSRS (used here)', 'Tracks each card\'s difficulty, stability (days until recall falls to 90%) and current recall probability, fitted on millions of real reviews. Built into Anki since version 23.10. This app runs FSRS-4.5 with its default parameters.', 'Jarrett Ye et al., open-spaced-repetition (2022–)'],
    ['Interleaving', 'Mixing models in one session is harder but trains you to tell them apart, which is the skill of spotting which model a situation needs.', 'Rohrer & Taylor (2007); Brunmair & Richter, Psychological Bulletin (2019)'],
    ['Blurting and self-explanation', 'Writing everything you remember, then checking, shows the gaps. Explaining why deepens it; that is what the tutor pushes on.', 'Dunlosky et al., Psychological Science in the Public Interest (2013); Bisra et al. (2018)'],
    ['Calibration', 'Rating your confidence and checking it against results trains you to know what you know.', 'Tetlock & Gardner, Superforecasting (2015)']
  ];
  $('#body').innerHTML = `<p class="stepname">How the recall system works</p>
    <p class="lead">Order of the day: review what's due, blurt your weakest model, then learn something new.</p>
    ${rows.map(([t, d, s]) => `<div class="sec method"><h4>${esc(t)}</h4><p style="margin:0">${esc(d)}</p><p class="small">${esc(s)}</p></div>`).join('')}
    <div class="sec method"><h4>Grades</h4><p style="margin:0"><b>Again</b>: couldn't recall, comes back in 10 minutes. <b>Hard</b>: got it with real effort. <b>Good</b>: got it after a moment. <b>Easy</b>: instant. Be honest; the schedule is only as good as your grades.</p></div>
    <button class="btn ghost" id="rQuit" type="button" style="align-self:flex-start">Recall menu</button>`;
  $('#rQuit').onclick = backToMenu;
}

/* ---- Socratic tutor chat ---- */
let tutBusy = false;
function learnerSummary(){
  const un = unlocked();
  const weak = ALLCARDS.filter(c => SRS[c.id]).sort((a, b) => (SRS[b.id].lapses - SRS[a.id].lapses) || (SRS[a.id].s - SRS[b.id].s)).slice(0, 4).map(c => `${c.m.name} (${c.type})`);
  return `Models the learner has studied: ${un.length ? un.map(id => MODELS[id].name).join(', ') : 'none yet'}.
Weakest cards: ${weak.length ? weak.join('; ') : 'no review data yet'}.
${calibration() || 'No calibration data yet.'}`;
}
function tutorIntro(){
  const t = TUT.topic && MODELS[TUT.topic];
  return `You are Socrates as a tutor inside a learning app about mental models, set in a space colony called Kepler Station (crew: Ada the engineer, Mira the botanist, Dox the doctor, Rook the mine foreman; crisis: failing oxygen greenhouse, supply ship 90 days late).
How you teach: never lecture first. Ask one question at a time, then wait. Build on the learner's own words. When they are wrong, don't correct directly; ask a question that exposes the contradiction. When they are right, push to a harder or new case outside the colony. Use real-world cases when useful. Name models by their proper names. Keep each reply under 110 words, plain text, no markdown, no lists.
${t ? `Focus model: ${t.name}. Rule: ${t.rule}. Colony story: ${t.story.beat} Real case: ${t.realCase.title}. Misuse: ${t.misuse}` : 'No fixed topic: follow the learner, and favour their weakest models.'}
All 20 models in the app: ${TRAIL.map(id => MODELS[id].name).join(', ')}.
${learnerSummary()}`;
}
function renderTutor(){
  const B = $('#body'), un = unlocked();
  const starters = [
    ['Quiz me on my weakest model', 'Quiz me on whichever model I seem weakest at. Start with one question.'],
    ['Give me a case to diagnose', 'Describe a short real-world situation and ask me which mental models are at work. Don\'t tell me the answer.'],
    ['Challenge my understanding', `Ask me to explain ${TUT.topic ? MODELS[TUT.topic].name : 'a model I studied'}, then find the hole in my explanation.`],
    ['When does it fail?', `Help me find the conditions where ${TUT.topic ? MODELS[TUT.topic].name : 'a model I rely on'} gives the wrong answer.`]
  ];
  B.innerHTML = `<p class="stepname">Socratic tutor</p>
    <p class="small">It answers with questions. It knows which models you've studied and which cards you keep missing.</p>
    <label class="small" for="tutTopic">Topic</label>
    <select id="tutTopic" class="select"><option value="">Anything I've studied</option>${TRAIL.map(id => `<option value="${id}" ${TUT.topic === id ? 'selected' : ''}>${MODELS[id].story.trail}. ${esc(MODELS[id].name)}${un.includes(id) ? '' : ' (not studied yet)'}</option>`).join('')}</select>
    <div class="thread" id="tThread">${TUT.msgs.map(t => `<div class="msg ${t.role === 'user' ? 'me' : 'tutor'}"><span class="who">${t.role === 'user' ? 'you' : 'socrates'}</span>${esc(t.content)}</div>`).join('') || ''}</div>
    ${TUT.msgs.length ? '' : `<div class="starters">${starters.map(([l, p], i) => `<button type="button" class="opt" data-start="${i}">${esc(l)}</button>`).join('')}</div>`}
    <label class="small" for="tutBox">Your message</label>
    <textarea id="tutBox" style="min-height:80px" placeholder="Answer, ask, or push back…">${esc(TUT.draft || '')}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="tutSend" type="button">Send</button>${TUT.msgs.length ? '<button class="btn ghost" id="tutNew" type="button">New conversation</button>' : ''}</div>
    <p class="small" id="tutNote"></p>`;
  $('#tutTopic').onchange = e => { TUT.topic = e.target.value; saveTutor(); renderTutor(); };
  $('#tutBox').oninput = e => { TUT.draft = e.target.value; store.set('tut', TUT); };
  $('#tutBox').onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendTutor(); };
  B.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { $('#tutBox').value = starters[+b.dataset.start][1]; TUT.draft = $('#tutBox').value; sendTutor(); });
  $('#tutSend').onclick = sendTutor;
  const nw = $('#tutNew'); if (nw) nw.onclick = () => { TUT.msgs = []; TUT.draft = ''; saveTutor(); renderTutor(); };
  const th = $('#tThread'); if (th.lastElementChild && !isMobile()) th.lastElementChild.scrollIntoView({block:'nearest'});
}
async function sendTutor(){
  if (tutBusy) return;
  const text = ($('#tutBox').value || '').trim(), note = $('#tutNote');
  if (!text) return;
  const sample = await useCap('sample');
  if (!sample){ note.textContent = 'The tutor isn\'t available in this view. Open the app in claude.ai to use it.'; return; }
  TUT.msgs.push({role:'user', content:text}); TUT.draft = ''; tutBusy = true; saveTutor(); renderTutor();
  const turns = TUT.msgs.slice(-20).map(m => ({...m}));
  if (turns[0].role !== 'user') turns.shift();
  turns[0] = {role:'user', content:tutorIntro() + '\n\nLearner: ' + turns[0].content};
  const bubble = document.createElement('div'); bubble.className = 'msg tutor';
  bubble.innerHTML = '<span class="who">socrates</span><span class="tx">Thinking…</span>'; $('#tThread').appendChild(bubble);
  if (isMobile()) bubble.scrollIntoView({block:'nearest'});
  $('#tutSend').disabled = true;
  try {
    const res = await sample(turns, {cache:false, onText:u => { bubble.querySelector('.tx').textContent = u.text; }});
    TUT.msgs.push({role:'assistant', content:res.text});
  } catch(e){
    TUT.msgs.pop(); TUT.draft = text;
    $('#tutNote').textContent = e && e.code === 'not_granted' ? 'The tutor needs your permission to run.' : e && e.code === 'rate_limited' ? 'The tutor is busy. Try again in a minute.' : 'The tutor could not answer just now. Try again.';
    bubble.remove();
  }
  tutBusy = false; saveTutor(); renderTutor();
}
