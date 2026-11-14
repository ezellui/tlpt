/* app.js — адреса (#/…), шапка, оглавление, сноски, клавиши, запуск. */
"use strict";
const COMMENT_EDS = EDS.filter(e => D.editions[e].has_comments);

async function route() {
  const h = decodeURIComponent(location.hash.slice(1) || '/');
  const [path, qs] = h.split('?');
  const params = new URLSearchParams(qs || '');
  HL = params.get('q') ? compileQuery(params.get('q')) : null;
  if (HL && !HL.all) HL = null;
  const tab = path.startsWith('/tree') ? 'tree' : path.startsWith('/seq') ? 'seq' : path.startsWith('/map') ? 'map'
    : path.startsWith('/terms') ? 'terms' : path.startsWith('/work') ? 'work' : path.startsWith('/p/') ? 'p' : '';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  $('#tabs a[data-tab="p"]').href = '#/p/' + (CUR || '1');
  // нужные редакции: показанные (+ редакции с комментариями, если комментарии включены)
  const need = SHOWN.concat(SHOW_COMM ? COMMENT_EDS : []);
  if (need.some(e => !LOADED.has(e))) { view.innerHTML = `<div class="loading">${t('misc.loading')}</div>`; await ensure(need); drawNav($('#filter').value.trim()); }
  let m;
  if ((m = path.match(/^\/p\/([1-7](?:\.\d+)?)$/))) showProp(m[1]);
  else if ((m = path.match(/^\/p\/([1-7](?:\.\d+)?)\/(kids|branch|refs|refsin)$/))) showList(m[1], m[2]);
  else if (path === '/tree') showTree(params.get('at'));
  else if (path === '/seq') showSeq(params.get('at'));
  else if (path === '/map') showMap(params.get('at'), params.get('mode'));
  else if ((m = path.match(/^\/terms(?:\/(\d+))?$/))) await showTerms(m[1], params.get('f'));
  else if ((m = path.match(/^\/work(?:\/(marks|notes|sets))?$/))) await showWork(m[1]);
  else if ((m = path.match(/^\/work\/set\/([\w]+)$/))) await showWork('sets', m[1]);
  else if (path === '/front') showFront();
  else if ((m = path.match(/^\/app(?:\/(\w+)\/(\w+))?$/))) await showApp(m[1], m[2]);
  else if (path === '/about' || path === '/') showAbout();
  else if (path === '/search') await showSearch(params.get('q') || '', params.get('set') || '');
  else showProp(CUR || '1');
}

/* ---------- шапка ---------- */
function drawEds() {
  $('#eds').innerHTML = EDS.map(ed => `<label class="${SHOWN.includes(ed) ? 'on' : ''}" title="${esc(D.editions[ed].title)}"><input type="checkbox" value="${ed}" ${SHOWN.includes(ed) ? 'checked' : ''}>${esc(D.editions[ed].short)}</label>`).join('');
}
$('#eds').addEventListener('change', e => {
  const ed = e.target.value;
  if (e.target.checked) { SHOWN.push(ed); SHOWN.sort((a, b) => EDS.indexOf(a) - EDS.indexOf(b)); }
  else if (SHOWN.length > 1) SHOWN = SHOWN.filter(x => x !== ed);
  store.set('eds', SHOWN.join(','));
  drawEds(); route().then(() => drawNav($('#filter').value.trim()));
});
$('#cmt').onclick = () => { SHOW_COMM = !SHOW_COMM; store.set('comm', SHOW_COMM ? '1' : '0'); $('#cmt').classList.toggle('on', SHOW_COMM); route(); };
const applySize = () => document.documentElement.style.setProperty('--fs', store.get('fs', '18') + 'px');
$('#smaller').onclick = () => { store.set('fs', Math.max(13, +store.get('fs', '18') - 1)); applySize(); };
$('#bigger').onclick = () => { store.set('fs', Math.min(28, +store.get('fs', '18') + 1)); applySize(); };
const applyTheme = () => { document.documentElement.dataset.theme = store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); };
$('#theme').onclick = () => { store.set('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
$('#navbtn').onclick = () => { $('#nav').classList.toggle('hidden'); store.set('nav', $('#nav').classList.contains('hidden') ? '0' : '1'); };
$('#lang').innerHTML = Object.entries(I.langs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#lang').onchange = e => { LANG = e.target.value; store.set('lang', LANG); applyStatic(); drawNav($('#filter').value.trim()); route(); };
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = $('#q').value.trim(); if (v) location.hash = '#/search?q=' + encodeURIComponent(v); } });
$('#filter').addEventListener('input', e => drawNav(e.target.value.trim()));
$('#expall').onclick = () => { NUMS.forEach(n => { if ((D.props[n].groups || []).length) openNodes.add(n); }); store.set('open', JSON.stringify([...openNodes])); drawNav(''); };
$('#colall').onclick = () => { openNodes.clear(); store.set('open', '[]'); drawNav(''); };
$('#tree').addEventListener('click', e => {
  const tw = e.target.closest('[data-tw]');
  if (tw && tw.dataset.tw) {
    const n = tw.dataset.tw;
    openNodes.has(n) ? openNodes.delete(n) : openNodes.add(n);
    store.set('open', JSON.stringify([...openNodes]));
    tw.textContent = openNodes.has(n) ? '▾' : '▸';
    document.querySelector(`[data-sub="${CSS.escape(n)}"]`).classList.toggle('open', openNodes.has(n));
    return;
  }
  const tn = e.target.closest('.tn');
  if (!tn) return;
  const cur = (document.querySelector('#tabs a.on') || {}).dataset;
  const tab = cur ? cur.tab : 'p';
  const n = tn.dataset.n;
  location.hash = tab === 'tree' ? '#/tree?at=' + n : tab === 'seq' ? '#/seq?at=' + n : tab === 'map' ? '#/map?at=' + n : '#/p/' + n;
  if (innerWidth < 900) $('#nav').classList.add('hidden');
});

/* сноски: всплывают при наведении */
const pop = $('#pop');
document.addEventListener('mouseover', e => {
  const a = e.target.closest('sup.fn a');
  if (!a) return;
  const sec = a.dataset.sec && (D.app[a.dataset.ed] || []).find(s => s.id === a.dataset.sec);
  const note = sec ? sec.notes[a.dataset.fn] : (D.notes[a.dataset.ed] || {})[a.dataset.fn];
  pop.innerHTML = note ? MD.render(note, {fig: figFor(a.dataset.ed), fn: lab => `<sup>${esc(lab)}</sup>`}) : `<i>${t('note.none')}</i>`;
  pop.style.display = 'block';
  const r = a.getBoundingClientRect();
  pop.style.left = Math.min(innerWidth - pop.offsetWidth - 10, Math.max(8, r.left - 20)) + 'px';
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + 'px';
});
document.addEventListener('mouseout', e => { if (e.target.closest('sup.fn a')) pop.style.display = 'none'; });

/* клавиши */
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
  const at = CUR ? '?at=' + CUR : '';
  if (e.key === 't') { location.hash = '#/tree' + at; return; }
  if (e.key === 's') { location.hash = '#/seq' + at; return; }
  if (e.key === 'm') { location.hash = '#/map' + at; return; }
  if (e.key === 'p' && CUR) { location.hash = '#/p/' + CUR; return; }
  const onProp = /^#\/p\//.test(location.hash);
  if (!onProp || !CUR) return;
  const i = POS.get(CUR);
  if (e.key === 'ArrowRight' && NUMS[i + 1]) location.hash = '#/p/' + NUMS[i + 1];
  if (e.key === 'ArrowLeft' && NUMS[i - 1]) location.hash = '#/p/' + NUMS[i - 1];
  if (e.key === 'ArrowUp' && D.props[CUR].parent) { e.preventDefault(); location.hash = '#/p/' + D.props[CUR].parent; }
});

/* запуск */
$('#lang').value = LANG;
applyStatic(); applySize(); applyTheme();
if (store.get('nav', '1') === '0') $('#nav').classList.add('hidden');
$('#cmt').classList.toggle('on', SHOW_COMM);
drawEds();
window.addEventListener('hashchange', route);
ensure(SHOWN).then(() => { drawNav(''); route(); });
