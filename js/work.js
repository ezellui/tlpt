/* work.js — своя работа читателя (как «Моё» в читалке HWPh): цветные пометки с комментарием,
   заметки к положениям, выборки положений, цветные фильтры. Всё хранится в браузере
   (localStorage) и выгружается/загружается одним файлом JSON. */
"use strict";
const WORK = Object.assign({marks: [], notes: {}, sets: [], filters: ['', '', '', '']}, store.json('work', {}));
function saveWork() { store.set('work', JSON.stringify(WORK)); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
const CTX = 40;

/* ---------- текст узла и обёртка диапазона ---------- */
function textNodes(root) {
  const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest('.katex,.katex-display') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  let n, pos = 0;
  while ((n = w.nextNode())) { out.push({node: n, start: pos}); pos += n.nodeValue.length; }
  return out;
}
const bodyText = nodes => nodes.map(x => x.node.nodeValue).join('');
function wrapRange(nodes, s, e, make) {
  // идём с конца, чтобы не сбивать смещения уже обработанных узлов
  for (let i = nodes.length - 1; i >= 0; i--) {
    const {node, start} = nodes[i], len = node.nodeValue.length, end = start + len;
    if (end <= s || start >= e) continue;
    const a = Math.max(s, start) - start, b = Math.min(e, end) - start;
    const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b);
    const el = make(); r.surroundContents(el);
  }
}
function textOffset(nodes, node, off) {
  const x = nodes.find(y => y.node === node);
  return x ? x.start + off : -1;
}

/* ---------- пометки ---------- */
function findMark(text, m) {
  // сначала с контекстом, затем — сам текст (контекст мог измениться после правки данных)
  let i = text.indexOf(m.before + m.text + m.after);
  if (i >= 0) return i + m.before.length;
  i = text.indexOf(m.text);
  return i;
}
function paintMarks(cell) {
  const n = cell.dataset.n, ed = cell.dataset.ed, body = cell.querySelector('.body');
  if (!body) return;
  WORK.marks.filter(m => m.n === n && m.ed === ed).forEach(m => {
    const nodes = textNodes(body), text = bodyText(nodes), i = findMark(text, m);
    if (i < 0) return;
    wrapRange(nodes, i, i + m.text.length, () => { const s = document.createElement('span'); s.className = 'mk mk' + m.color; s.dataset.mid = m.id; if (m.note) s.title = m.note; return s; });
  });
}
function paintFilters(root) {
  WORK.filters.forEach((q, k) => {
    if (!q.trim()) return;
    const cq = compileQuery(q); if (!cq.all) return;
    root.querySelectorAll('.cell .body, .comment').forEach(body => {
      const nodes = textNodes(body), text = bodyText(nodes), [f, idx] = foldMap(text);
      const spans = []; cq.all.lastIndex = 0; let r;
      while ((r = cq.all.exec(f))) { if (!r[0].length) { cq.all.lastIndex++; continue; } spans.push([idx[r.index], idx[r.index + r[0].length]]); }
      spans.reverse().forEach(([a, b]) => wrapRange(textNodes(body), a, b, () => { const s = document.createElement('span'); s.className = 'cf cf' + (k + 1); return s; }));
    });
  });
}
function decorate(root) {
  root.querySelectorAll('.cell[data-n][data-ed]').forEach(paintMarks);
  paintFilters(root);
  updateCfCounts(root);
}

/* ---------- панель у выделения ---------- */
const selTool = $('#seltool');
function selectionInCell() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  const body = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer.closest('.body') : r.commonAncestorContainer.parentElement.closest('.body');
  const cell = body && body.closest('.cell[data-n][data-ed]');
  if (!cell) return null;
  const nodes = textNodes(body), text = bodyText(nodes);
  const s = textOffset(nodes, r.startContainer, r.startOffset), e = textOffset(nodes, r.endContainer, r.endOffset);
  if (s < 0 || e <= s) return null;
  return {cell, n: cell.dataset.n, ed: cell.dataset.ed, s, e, text, rect: r.getBoundingClientRect()};
}
function showSelTool() {
  const x = selectionInCell();
  if (!x) { selTool.style.display = 'none'; return; }
  selTool.innerHTML = [1, 2, 3, 4].map(c => `<button class="c mk${c}" data-c="${c}" title="${t('work.mark_color')}"></button>`).join('') +
    `<button data-a="note" title="${t('work.to_note')}">✎</button><button data-a="find" title="${t('work.find_sel')}">⌕</button><button data-a="cite" title="${t('prop.copy')}">❝</button>`;
  selTool.style.display = 'flex';
  selTool.style.left = Math.max(6, Math.min(innerWidth - 190, x.rect.left)) + 'px';
  selTool.style.top = Math.max(50, x.rect.top - 32) + 'px';
  selTool._sel = x;
}
document.addEventListener('mouseup', e => { if (!selTool.contains(e.target)) setTimeout(showSelTool, 0); });
selTool.addEventListener('mousedown', e => e.preventDefault());
selTool.addEventListener('click', e => {
  const b = e.target.closest('button'), x = selTool._sel;
  if (!b || !x) return;
  const piece = x.text.slice(x.s, x.e);
  if (b.dataset.c) {
    WORK.marks.push({id: uid(), n: x.n, ed: x.ed, text: piece, before: x.text.slice(Math.max(0, x.s - CTX), x.s), after: x.text.slice(x.e, x.e + CTX), color: +b.dataset.c, note: '', date: today()});
    saveWork(); getSelection().removeAllRanges(); selTool.style.display = 'none'; route();
  } else if (b.dataset.a === 'note') {
    WORK.notes[x.n] = ((WORK.notes[x.n] || '') + (WORK.notes[x.n] ? '\n' : '') + `«${piece}» (${D.editions[x.ed].short})`).trim();
    saveWork(); selTool.style.display = 'none'; toast(t('work.noted')); route();
  } else if (b.dataset.a === 'find') {
    location.hash = '#/search?q=' + encodeURIComponent('"' + piece.trim() + '"');
  } else if (b.dataset.a === 'cite') {
    copyText(`«${piece.trim()}»\n— ЛФТ ${x.n}; ${cite(x.n, x.ed)}`);
  }
});

/* карточка пометки */
let card = null;
document.addEventListener('click', e => {
  const sp = e.target.closest('span.mk');
  if (card && !card.contains(e.target)) { card.remove(); card = null; }
  if (!sp || getSelection().toString()) return;
  const m = WORK.marks.find(x => x.id === sp.dataset.mid);
  if (!m) return;
  card = document.createElement('div'); card.className = 'markcard';
  card.innerHTML = `<div><b>${m.n}</b> · ${esc(D.editions[m.ed].short)} · ${m.date}</div>
    <textarea placeholder="${t('work.mark_note_ph')}">${esc(m.note || '')}</textarea>
    <div class="row2">${[1, 2, 3, 4].map(c => `<button class="mk${c}" data-c="${c}" style="width:22px;height:20px">${m.color === c ? '✓' : ''}</button>`).join('')}
    <span style="flex:1"></span><button data-del="1">${t('work.mark_delete')}</button></div>`;
  const r = sp.getBoundingClientRect();
  card.style.left = Math.min(innerWidth - 320, r.left) + 'px'; card.style.top = Math.min(innerHeight - 170, r.bottom + 6) + 'px';
  document.body.appendChild(card);
  card.querySelector('textarea').oninput = ev => { m.note = ev.target.value; saveWork(); };
  card.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.c) { m.color = +b.dataset.c; saveWork(); card.remove(); card = null; route(); }
    if (b.dataset.del) { WORK.marks = WORK.marks.filter(x => x !== m); saveWork(); card.remove(); card = null; route(); }
  });
  e.stopPropagation();
});

/* ---------- заметка к положению ---------- */
function noteBox(n) {
  return `<div class="pnote"><div class="lbl">${t('work.note_label')}</div><textarea id="pnote" placeholder="${t('work.note_ph')}">${esc(WORK.notes[n] || '')}</textarea></div>`;
}
function wireNoteBox(n) {
  const ta = $('#pnote'); if (!ta) return;
  ta.oninput = () => { if (ta.value.trim()) WORK.notes[n] = ta.value; else delete WORK.notes[n]; saveWork(); };
}

/* ---------- выборки ---------- */
const setById = id => WORK.sets.find(s => s.id === id);
function setsOf(n) {
  const ss = WORK.sets.filter(s => s.nums.includes(n));
  if (!ss.length) return '';
  return `<div><h4>${t('work.sets')}</h4><ul>${ss.map(s => `<li><a href="#/work/set/${s.id}">${esc(s.name)}</a></li>`).join('')}</ul></div>`;
}
let menu = null;
function setMenu(anchor, nums) {
  if (menu) menu.remove();
  menu = document.createElement('div'); menu.className = 'setmenu';
  menu.innerHTML = WORK.sets.map(s => `<div data-id="${s.id}">${esc(s.name)} <small>(${s.nums.length})</small></div>`).join('') +
    `<input placeholder="${t('work.set_new_ph')}">`;
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.min(innerWidth - 230, r.left) + 'px'; menu.style.top = (r.bottom + 4) + 'px';
  document.body.appendChild(menu);
  const add = s => { nums.forEach(n => { if (!s.nums.includes(n)) s.nums.push(n); }); s.nums.sort(cmpNum); saveWork(); toast(t('work.added', {name: s.name, n: nums.length})); menu.remove(); menu = null; route(); };
  menu.addEventListener('click', e => { const d = e.target.closest('[data-id]'); if (d) add(setById(d.dataset.id)); });
  const inp = menu.querySelector('input'); inp.focus();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inp.value.trim()) { const s = {id: uid(), name: inp.value.trim(), nums: [], date: today()}; WORK.sets.push(s); add(s); }
    if (e.key === 'Escape') { menu.remove(); menu = null; }
  });
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (menu && !menu.contains(e.target)) { menu.remove(); menu = null; document.removeEventListener('mousedown', off); } }), 0);
}

/* ---------- цветные фильтры ---------- */
function cfBar() {
  return `<div class="cfbar"><span>${t('cf.title')}</span>${WORK.filters.map((q, k) =>
    `<span class="cf cf${k + 1}"><input data-cf="${k}" value="${esc(q)}" placeholder="${t('cf.ph')}"></span><span class="cnt" data-cfn="${k}"></span>`).join('')}
    <button id="cfclear">${t('cf.clear')}</button></div>`;
}
function wireCfBar() {
  view.querySelectorAll('[data-cf]').forEach(inp => inp.addEventListener('change', () => { WORK.filters[+inp.dataset.cf] = inp.value; saveWork(); route(); }));
  const c = $('#cfclear'); if (c) c.onclick = () => { WORK.filters = ['', '', '', '']; saveWork(); route(); };
}
function updateCfCounts(root) {
  root.querySelectorAll('[data-cfn]').forEach(el => { const k = +el.dataset.cfn; const n = root.querySelectorAll('span.cf' + (k + 1) + ':not(.cfbar span)').length; el.textContent = WORK.filters[k].trim() ? n : ''; });
}

/* ---------- «Моё» ---------- */
async function showWork(tab, id) {
  CUR = null; markNav();
  await ensure([...new Set(WORK.marks.map(m => m.ed))]);
  tab = tab || 'marks';
  const tabs = ['marks', 'notes', 'sets'].map(k => `<a href="#/work/${k}" class="${tab === k ? 'on' : ''}">${t('work.' + k)}</a>`).join('');
  let body = '';
  if (tab === 'marks') {
    const ms = WORK.marks.slice().sort((a, b) => cmpNum(a.n, b.n));
    body = ms.length ? `<ul class="wl">${ms.map(m => `<li><a class="no" href="#/p/${m.n}">${m.n}</a><span><span class="mk mk${m.color}">${esc(m.text)}</span>
      ${m.note ? `<br><i>${esc(m.note)}</i>` : ''}<br><span class="meta">${esc(D.editions[m.ed].short)} · ${m.date}</span></span>
      <button class="del" data-delm="${m.id}" title="${t('work.mark_delete')}">✕</button></li>`).join('')}</ul>` : `<p class="help">${t('work.marks_none')}</p>`;
  } else if (tab === 'notes') {
    const ns = Object.keys(WORK.notes).sort(cmpNum);
    body = ns.length ? `<ul class="wl">${ns.map(n => `<li><a class="no" href="#/p/${n}">${n}</a><span style="white-space:pre-wrap">${esc(WORK.notes[n])}</span></li>`).join('')}</ul>` : `<p class="help">${t('work.notes_none')}</p>`;
  } else if (id && setById(id)) {
    const s = setById(id);
    body = `<h3>${esc(s.name)} <small class="help">(${s.nums.length})</small></h3>
      <p class="opts"><a href="#" id="setren">${t('work.set_rename')}</a> <a href="#" id="setdel">${t('work.set_delete')}</a> <a href="#/search?q=&set=${s.id}">${t('work.set_search')}</a></p>
      <ul class="wl">${s.nums.map(n => `<li><a class="no" href="#/p/${n}">${n}</a><span>${esc(firstLine(n, lead()))}</span><button class="del" data-dels="${n}">✕</button></li>`).join('')}</ul>`;
  } else {
    body = WORK.sets.length ? `<ul class="wl">${WORK.sets.map(s => `<li><a href="#/work/set/${s.id}">${esc(s.name)}</a><span class="meta">${s.nums.length} · ${s.date}</span></li>`).join('')}</ul>` : `<p class="help">${t('work.sets_none')}</p>`;
  }
  view.innerHTML = `<div class="page narrow"><h2>${t('view.work')}</h2><div class="wtabs">${tabs}<span class="sp"></span>
    <button id="wexp">${t('work.export')}</button><label class="btn">${t('work.import')}<input type="file" id="wimp" accept=".json,application/json" hidden></label></div>
    <p class="help">${t('work.help')}</p>${body}</div>`;
  view.querySelectorAll('[data-delm]').forEach(b => b.onclick = () => { WORK.marks = WORK.marks.filter(m => m.id !== b.dataset.delm); saveWork(); showWork(tab); });
  view.querySelectorAll('[data-dels]').forEach(b => b.onclick = () => { const s = setById(id); s.nums = s.nums.filter(n => n !== b.dataset.dels); saveWork(); showWork(tab, id); });
  if ($('#setren')) $('#setren').onclick = e => { e.preventDefault(); const s = setById(id); const v = prompt(t('work.set_rename'), s.name); if (v) { s.name = v; saveWork(); showWork(tab, id); } };
  if ($('#setdel')) $('#setdel').onclick = e => { e.preventDefault(); WORK.sets = WORK.sets.filter(s => s.id !== id); saveWork(); location.hash = '#/work/sets'; };
  $('#wexp').onclick = () => download(`tlp-work-${today()}.json`, JSON.stringify({tlp_work: 1, ...WORK}, null, 1));
  $('#wimp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      const ids = new Set(WORK.marks.map(m => m.id));
      (x.marks || []).forEach(m => { if (!ids.has(m.id)) WORK.marks.push(m); });
      for (const n in (x.notes || {})) if (!WORK.notes[n]) WORK.notes[n] = x.notes[n];
      const sids = new Set(WORK.sets.map(s => s.id));
      (x.sets || []).forEach(s => { if (!sids.has(s.id)) WORK.sets.push(s); });
      saveWork(); toast(t('work.imported')); showWork(tab, id);
    } catch (err) { toast(t('work.import_bad')); }
  };
  view.scrollTop = 0;
}
