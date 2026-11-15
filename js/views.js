/* views.js — оглавление и виды: положение, дерево (как в 2023), по порядку, вводные тексты,
   «О текстах», поиск. После каждой отрисовки вызывается decorate() (work.js): пометки и фильтры. */
"use strict";
const view = $('#view');

/* ---------- левое оглавление ---------- */
const openNodes = new Set(store.json('open', []));
function navNode(n, depth) {
  const kids = D.props[n].groups || [];
  const has = kids.length > 0;
  let h = `<div class="tn" data-n="${n}" style="padding-left:${6 + depth * 12}px"><span class="tw" data-tw="${has ? n : ''}">${has ? (openNodes.has(n) ? '▾' : '▸') : ''}</span><span class="no">${n}</span><span class="tx">${esc(firstLine(n, lead()).slice(0, 80))}</span></div>`;
  if (has) {
    h += `<div class="tsub${openNodes.has(n) ? ' open' : ''}" data-sub="${n}">`;
    kids.forEach(g => g.forEach(c => { h += navNode(c, depth + 1); }));
    h += '</div>';
  }
  return h;
}
function drawNav(filter) {
  const tr = $('#tree');
  if (filter) {
    const cq = compileQuery(filter);
    const list = NUMS.filter(n => n.startsWith(filter) || (cq.pos.length && SHOWN.some(e => D.props[n].text[e] && matches(cq, D.props[n].text[e]))));
    tr.innerHTML = list.slice(0, 400).map(n => `<div class="tn" data-n="${n}"><span class="tw"></span><span class="no">${n}</span><span class="tx">${esc(firstLine(n, lead()).slice(0, 80))}</span></div>`).join('');
  } else {
    tr.innerHTML = NUMS.filter(n => !D.props[n].parent).map(n => navNode(n, 0)).join('');
  }
  markNav();
}
function markNav() {
  document.querySelectorAll('.tn.cur').forEach(x => x.classList.remove('cur'));
  if (!CUR) return;
  const el = document.querySelector(`.tn[data-n="${CSS.escape(CUR)}"]`);
  if (el) { el.classList.add('cur'); const r = el.getBoundingClientRect(), p = $('#tree').getBoundingClientRect(); if (r.top < p.top || r.bottom > p.bottom) el.scrollIntoView({block: 'center'}); }
}
function revealInNav(n) {
  let changed = false;
  ancestors(n).forEach(a => { if (!openNodes.has(a)) { openNodes.add(a); changed = true; } });
  if (changed) { store.set('open', JSON.stringify([...openNodes])); if (!$('#filter').value) drawNav(''); }
  markNav();
}

/* ---------- общие куски ---------- */
function cellHtml(n, ed, withHead) {
  const tx = D.props[n].text[ed];
  const body = tx ? renderMd(tx, ed) : `<p class="miss">[${t('prop.missing')}]</p>`;
  return `<div class="cell" data-n="${n}" data-ed="${ed}" lang="${D.editions[ed].lang}">${withHead ? edHead(ed, n) : ''}<div class="body">${body}</div></div>`;
}
function commentsHtml(n, cls) {
  if (!SHOW_COMM) return '';
  return (COMM[n] || []).map(c => {
    const multi = c.covers.length > 1;
    const head = (D.editions[c.ed].comment_label || t('prop.comment')) + (multi ? ' ' + t('prop.comment_to', {r: c.covers[0] + '–' + c.covers[c.covers.length - 1]}) : '');
    return `<div class="comment${multi ? ' multi' : ''} ${cls || ''}" lang="${D.editions[c.ed].lang}"><div class="ch">${esc(head)}</div>${renderMd(c.text, c.ed)}</div>`;
  }).join('');
}
function railList(arr, label, href, srcOf) {
  if (!arr || !arr.length) return '';
  return `<div><h4>${href ? `<a href="${href}" title="${esc(t('list.open'))}">${label}</a>` : label}</h4><ul>${arr.map(n => `<li><a class="no" href="#/p/${n}">${n}</a><span class="tx">${srcOf ? srcOf(n) : ''}${esc(firstLine(n, lead()))}</span></li>`).join('')}</ul></div>`;
}
/* источник ссылки from → to: текст трактата (в каких редакциях) и/или комментаторы; «из диапазона» */
function refSrc(from, to) {
  const x = (D.props[from].refsrc || {})[to];
  if (!x) return '';
  const tags = [];
  if (x.t) {
    const all = EDS.every(e => x.t.includes(e));
    tags.push(`<span class="rsrc t" title="${esc(all ? t('ref.text_all') : t('ref.text_in', {e: x.t.map(e => D.editions[e].short).join(', ')}))}">${t('ref.text')}${all ? '' : '*'}</span>`);
  }
  (x.c || []).forEach(e => tags.push(`<span class="rsrc c" title="${esc(D.editions[e].comment_label || t('prop.comment'))}">${esc({ru2005: t('ref.by_ru2005'), ru1994: t('ref.by_ru1994')}[e] || D.editions[e].short)}</span>`));
  if (x.range) tags.push(`<span class="rsrc r" title="${esc(t('ref.range_t'))}">${t('ref.range')}</span>`);
  return tags.join('');
}
function colHead() { return `<div class="colhead cols" style="${gridCols(SHOWN.length)}">${SHOWN.map(ed => `<div>${esc(D.editions[ed].title)}</div>`).join('')}</div>`; }

/* ---------- положение ---------- */
function showProp(n) {
  if (!D.props[n]) { view.innerHTML = `<div class="page narrow"><p>${esc(t('err.no_prop', {n}))}</p></div>`; return; }
  CUR = n; revealInNav(n); store.set('last', n);
  const p = D.props[n], i = POS.get(n);
  const prev = NUMS[i - 1], next = NUMS[i + 1];
  const crumbs = ancestors(n).map(a => `<a href="#/p/${a}" title="${esc(firstLine(a, lead()))}">${a}</a><span class="sep">›</span>`).join('') + `<b>${n}</b>`;
  const groups = (p.groups || []).map((g, gi) => (p.groups.length > 1 ? `<div class="gl">${t('prop.group', {g: gi + 1})}: ${g[0]}${g.length > 1 ? '–' + g[g.length - 1] : ''}</div>` : '') +
    `<ul>${g.map(c => `<li><a class="no" href="#/p/${c}">${c}</a><span class="tx">${esc(firstLine(c, lead()))}</span></li>`).join('')}</ul>`).join('');
  const sib = branchOf(n).filter(x => x !== n);
  document.title = `${n} — ${t('app.title')}`;
  view.innerHTML = `<div class="page">
    <div class="crumbs" title="${esc(t('prop.ancestors'))}">${crumbs}</div>
    <div class="prop-head"><span class="pnum">${n}</span>
      <span class="ednote">${DESC[n] ? esc(t('prop.descendants', {n: DESC[n]})) : ''}</span>
      <div class="acts"><a href="#/tree?at=${n}">${t('prop.open_tree')}</a><a href="#/map?at=${n}">${t('prop.open_map')}</a>
        <button id="toset">${t('work.to_set')}</button><button id="copy">${t('prop.copy')}</button></div></div>
    ${cfBar()}
    <div class="cols" style="${gridCols(SHOWN.length)}">${SHOWN.map(ed => cellHtml(n, ed, true)).join('')}</div>
    ${commentsHtml(n)}
    ${noteBox(n)}
    <div class="rail">
      ${groups ? `<div><h4><a href="#/p/${n}/kids" title="${esc(t('list.open'))}">${t('prop.children')}</a></h4>${groups}</div>` : ''}
      ${railList(sib, t('prop.siblings'), `#/p/${n}/branch`)}
      ${railList(p.refs, t('prop.refs'), `#/p/${n}/refs`, x => refSrc(n, x))}
      ${railList(REFS_IN[n], t('prop.refs_in'), `#/p/${n}/refsin`, x => refSrc(x, n))}
      ${setsOf(n)}
    </div>
    <div class="pager"><span>${prev ? `<a href="#/p/${prev}">← ${prev} ${t('prop.prev')}</a>` : ''}</span>
      <span>${p.parent ? `<a href="#/p/${p.parent}">↑ ${p.parent}</a>` : ''}</span>
      <span>${next ? `<a href="#/p/${next}">${t('prop.next')} ${next} →</a>` : ''}</span></div>
  </div>`;
  $('#copy').onclick = () => copyProp(n);
  $('#toset').onclick = e => setMenu(e.target, [n]);
  wireNoteBox(n); wireCfBar();
  view.scrollTop = 0;
  decorate(view);
  scrollToMark();
}
/* ветвь положения: его группа у родителя (для 1–7 — сами корни) */
function branchOf(n) {
  const p = D.props[n];
  return p.parent ? (D.props[p.parent].groups.find(g => g.includes(n)) || [n]) : NUMS.filter(x => !D.props[x].parent);
}

/* ---------- перечни положения отдельной страницей: комментарии, ветвь, ссылки ---------- */
function showList(n, kind) {
  if (!D.props[n]) { showProp(n); return; }
  CUR = n; revealInNav(n);
  const p = D.props[n];
  let head = [], groups = [];
  if (kind === 'kids') { head = [n]; groups = (p.groups || []).map((g, gi) => [p.groups.length > 1 ? t('prop.group', {g: gi + 1}) : '', g]); }
  else if (kind === 'branch') { head = p.parent ? [p.parent] : []; groups = [['', branchOf(n)]]; }
  else if (kind === 'refs') { head = [n]; groups = [['', p.refs || []]]; }
  else { head = [n]; groups = [['', REFS_IN[n] || []]]; }
  const title = {kids: 'prop.children', branch: 'prop.siblings', refs: 'prop.refs', refsin: 'prop.refs_in'}[kind];
  const tabs = [['kids', (p.groups || []).length], ['branch', 1], ['refs', (p.refs || []).length], ['refsin', (REFS_IN[n] || []).length]]
    .filter(([k, c]) => c).map(([k]) => k === kind ? `<b>${t({kids: 'prop.children', branch: 'prop.siblings', refs: 'prop.refs', refsin: 'prop.refs_in'}[k])}</b>`
      : `<a href="#/p/${n}/${k}">${t({kids: 'prop.children', branch: 'prop.siblings', refs: 'prop.refs', refsin: 'prop.refs_in'}[k])}</a>`).join(' · ');
  document.title = `${n} — ${t(title)} — ${t('app.title')}`;
  let h = `<div class="page"><div class="crumbs"><a href="#/p/${n}">← ${n}</a></div>
    <h2>${t(title)}: <a href="#/p/${n}">${n}</a></h2><div class="listtabs">${tabs}</div>${cfBar()}${colHead()}`;
  head.forEach(x => { h += rowHtml(x, 'rep', false); });
  groups.forEach(([label, g]) => {
    if (label) h += `<div class="gl">${esc(label)}: ${g[0]}${g.length > 1 ? '–' + g[g.length - 1] : ''}</div>`;
    g.forEach(x => {
      if (kind === 'refs' || kind === 'refsin') h += `<div class="refline">${kind === 'refs' ? `${n} → ${x}` : `${x} → ${n}`} ${kind === 'refs' ? refSrc(n, x) : refSrc(x, n)}</div>`;
      h += rowHtml(x, x === n && kind === 'branch' ? 'cur' : '', true);
    });
  });
  view.innerHTML = h + '</div>';
  wireCfBar(); decorate(view);
  view.scrollTop = 0;
}
function copyProp(n) {
  copyText(SHOWN.filter(ed => D.props[n].text[ed]).map(ed => `${n} ${MD.plain(D.props[n].text[ed])}\n— ${cite(n, ed)}`).join('\n\n'));
}

/* ---------- дерево как в 2023: корень 1–7, раздел, для каждой группы детей — повтор узла и члены ---------- */
function layout() {
  const ev = [];
  const roots = NUMS.filter(n => !D.props[n].parent);
  ev.push({k: 'root', items: roots});
  const walk = (n, firstUnderSection) => {
    (D.props[n].groups || []).forEach((g, gi) => {
      ev.push({k: 'block', n, g, rep: !(firstUnderSection && gi === 0)});
      g.forEach(m => { if ((D.props[m].groups || []).length) walk(m, false); });
    });
  };
  roots.forEach(r => { if ((D.props[r].groups || []).length) { ev.push({k: 'section', n: r}); walk(r, true); } });
  return ev;
}
const LAYOUT = layout();
function rowHtml(n, cls, withComments) {
  const cells = SHOWN.map(ed => {
    const tx = D.props[n].text[ed];
    const body = tx ? renderMd(tx, ed) : `<p class="miss">[${t('prop.missing')}]</p>`;
    const num = `<a class="n" href="#/p/${n}">${n}</a>`;
    return `<div class="cell" data-n="${n}" data-ed="${ed}" lang="${D.editions[ed].lang}"><div class="body">${/^<p>/.test(body) ? body.replace(/^<p>/, '<p>' + num) : num + body}</div></div>`;
  }).join('');
  return `<div class="row ${cls || ''}" id="r-${cls === 'rep' ? 'h' : 'm'}-${n.replace(/\./g, '_')}" style="${gridCols(SHOWN.length)}">${cells}</div>` +
    (withComments ? commentsHtml(n, 'inrow') : '');
}
function scrollToRow(at) {
  const id = at.replace(/\./g, '_');
  const el = document.getElementById('r-h-' + id) || document.getElementById('r-m-' + id) || document.getElementById('r-s-' + at);
  if (el) { el.classList.add('cur'); el.scrollIntoView({block: 'start'}); view.scrollTop -= 40; }
}
function showTree(at) {
  if (at) CUR = at; markNav();
  let h = `<div class="page"><h2>${t('view.tree')}</h2><div class="tree-note">${t('tree.note')}</div>${cfBar()}${colHead()}`;
  for (const e of LAYOUT) {
    if (e.k === 'root') { h += `<div class="sec"><span>${t('tree.root')}</span></div>`; e.items.forEach(n => { h += rowHtml(n, '', true); }); }
    else if (e.k === 'section') {
      const cells = SHOWN.map(ed => { const tx = D.props[e.n].text[ed]; return `<div class="cell" lang="${D.editions[ed].lang}">${tx ? renderMd(tx.split(/\n\n/)[0], ed) : ''}</div>`; }).join('');
      h += `<div class="sec row" id="r-s-${e.n}" style="${gridCols(SHOWN.length)}">${cells.replace(/<p>/g, `<p><span class="n">${e.n}.</span>`)}</div>`;
    } else {
      if (e.rep) h += rowHtml(e.n, 'rep', false);
      e.g.forEach(m => { h += rowHtml(m, '', true); });
    }
  }
  view.innerHTML = h + '</div>';
  wireCfBar(); decorate(view);
  if (at) scrollToRow(at); else view.scrollTop = 0;
}
function showSeq(at) {
  let h = `<div class="page"><h2>${t('view.seq')}</h2>${cfBar()}${colHead()}`;
  NUMS.forEach(n => { h += rowHtml(n, '', true); });
  view.innerHTML = h + '</div>';
  wireCfBar(); decorate(view);
  const id = at || CUR;
  if (id) scrollToRow(id); else view.scrollTop = 0;
}

/* ---------- вводные тексты, «О текстах» ---------- */
function showFront() {
  CUR = null; markNav();
  let h = `<div class="page"><div class="cols" style="${gridCols(SHOWN.length)}">`;
  SHOWN.forEach(ed => {
    const f = D.front[ed] || {};
    let c = `<div class="cell" lang="${D.editions[ed].lang}">${edHead(ed)}`;
    if (!f.dedication && !f.motto && !(f.preface || []).length) c += `<p class="miss">${t('front.none')}</p>`;
    if (f.dedication) c += `<h3>${t('front.dedication')}</h3>${renderMd(f.dedication, ed)}`;
    if (f.motto) c += `<h3>${t('front.motto')}</h3>${renderMd(f.motto.replace(/\n/g, '  \n'), ed)}`;
    if ((f.preface || []).length) c += `<h3>${f.preface_title ? renderMd(f.preface_title, ed).replace(/^<p>|<\/p>$/g, '') : t('front.preface')}</h3>${f.preface.map(x => renderMd(x, ed)).join('')}`;
    if ((f.comment || []).length && SHOW_COMM) c += `<div class="comment"><div class="ch">${t('front.comment')}</div>${f.comment.map(x => renderMd(x, ed)).join('')}</div>`;
    h += c + '</div>';
  });
  view.innerHTML = h + '</div></div>';
  view.scrollTop = 0;
}
function showAbout() {
  CUR = null; markNav();
  const last = store.get('last', '');
  let h = `<div class="page narrow about"><h2>${t('about.title')}</h2><p>${t('about.p1')}</p>
    <p class="start"><a class="btn" href="#/p/1">${t('about.begin')}</a>
    ${last && last !== '1' && D.props[last] ? `<a class="btn" href="#/p/${last}">${esc(t('about.cont', {n: last}))}</a>` : ''}
    <a class="btn" href="#/map?mode=tree">${t('about.overview')}</a></p>
    <h3>${t('about.parts')}</h3><dl class="parts">`;
  [['#/p/1', 'view.prop', 'about.d.prop'], ['#/tree', 'view.tree', 'about.d.tree'], ['#/seq', 'view.seq', 'about.d.seq'],
   ['#/map', 'view.map', 'about.d.map'], ['#/terms', 'view.terms', 'about.d.terms'], ['#/app', 'nav.app', 'about.d.app'],
   ['#/front', 'nav.front', 'about.d.front'], ['#/work', 'view.work', 'about.d.work']].forEach(([href, k, d]) => {
    h += `<dt><a href="${href}">${t(k)}</a></dt><dd>${t(d)}</dd>`;
  });
  h += `</dl><h3>${t('about.eds')}</h3>`;
  EDS.forEach(ed => {
    const e = D.editions[ed];
    h += `<h4>${esc(e.title)}</h4><div class="ednote">${MD.render(e.note.replace(/^> ?/gm, ''), {})}</div>`;
    if (e.missing.length) h += `<p class="ednote">${esc(t('about.missing', {list: e.missing.join(', ')}))}</p>`;
  });
  h += `<p class="help">${t('about.keys')}</p><p class="help">${t('search.help')}</p><p class="help">${t('about.built', {d: MANIFEST.built})}</p></div>`;
  view.innerHTML = h; view.scrollTop = 0;
}

/* ---------- поиск ---------- */
let SEARCH_ALL = store.get('sall', '0') === '1';
let SEARCH_COMM = store.get('scomm', '1') === '1';
async function showSearch(q, setId) {
  CUR = null; markNav();
  $('#q').value = q;
  if (/^[1-7](\.\d+)?$/.test(q.trim())) { location.replace('#/p/' + q.trim()); return; }
  const eds = SEARCH_ALL ? EDS : SHOWN;
  await ensure(eds);
  const cq = compileQuery(q);
  const only = setId ? new Set((setById(setId) || {nums: []}).nums) : null;
  const hits = [];
  if (cq.pos.length) {
    NUMS.forEach(n => { if (only && !only.has(n)) return; eds.forEach(ed => { const tx = D.props[n].text[ed]; if (tx && matches(cq, tx)) hits.push({n, ed, tx}); }); });
    if (SEARCH_COMM) eds.forEach(ed => (D.comments[ed] || []).forEach(c => {
      if (only && !c.covers.some(x => only.has(x))) return;
      if (matches(cq, c.text)) hits.push({n: c.covers[c.covers.length - 1], ed, tx: c.text, comm: c.covers});
    }));
  }
  hits.sort((a, b) => cmpNum(a.n, b.n) || EDS.indexOf(a.ed) - EDS.indexOf(b.ed));
  const sets = WORK.sets.map(s => `<option value="${s.id}" ${s.id === setId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  let h = `<div class="page narrow"><div class="opts">
    <label><input type="checkbox" id="sall" ${SEARCH_ALL ? 'checked' : ''}> ${t('search.all_eds')}</label>
    <label><input type="checkbox" id="scomm" ${SEARCH_COMM ? 'checked' : ''}> ${t('search.in_comments')}</label>
    ${sets ? `<label>${t('search.in_set')} <select id="sset"><option value="">—</option>${sets}</select></label>` : ''}
    ${hits.length ? `<a href="#" id="hits2set">${t('search.to_set')}</a>` : ''}</div>
    <p class="help">${t('search.help')}</p>
    <h3>${hits.length ? esc(t('search.results', {n: hits.length})) : t('search.none')}</h3><ul class="hits">`;
  hits.slice(0, 1500).forEach(x => {
    h += `<li><div class="meta"><a href="#/p/${x.n}?q=${encodeURIComponent(q)}"><b>${x.n}</b></a> · ${esc(D.editions[x.ed].short)}${x.comm ? ' · ' + t('search.hit_comment') + ' ' + esc(t('prop.comment_to', {r: x.comm.length > 1 ? x.comm[0] + '–' + x.comm[x.comm.length - 1] : x.comm[0]})) : ''}</div>
      <div lang="${D.editions[x.ed].lang}">${snippet(x.tx, cq)}</div></li>`;
  });
  view.innerHTML = h + '</ul></div>';
  const rerun = () => showSearch(q, $('#sset') ? $('#sset').value : '');
  $('#sall').onchange = e => { SEARCH_ALL = e.target.checked; store.set('sall', SEARCH_ALL ? '1' : '0'); rerun(); };
  $('#scomm').onchange = e => { SEARCH_COMM = e.target.checked; store.set('scomm', SEARCH_COMM ? '1' : '0'); rerun(); };
  if ($('#sset')) $('#sset').onchange = rerun;
  if ($('#hits2set')) $('#hits2set').onclick = e => { e.preventDefault(); setMenu(e.target, [...new Set(hits.map(x => x.n))]); };
  view.scrollTop = 0;
}
function scrollToMark() { const m = view.querySelector('mark'); if (m) { m.classList.add('cur'); m.scrollIntoView({block: 'center'}); } }
