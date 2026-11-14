/* terms.js — сводка терминов: как передан немецкий термин в каждой редакции.
   Данные (data/terms.js) считает build_terms.py: соответствия найдены статистически по
   положениям (номер — общий ключ редакций), у каждого варианта — число положений. */
"use strict";
const TERMS = TLP.get('terms') || {terms: [], targets: []};
function termCq(rx) {
  return {all: new RegExp('(?<![\\p{L}\\p{N}])(?:' + rx + ')(?![\\p{L}\\p{N}])', 'gu')};
}
async function showTerms(idx, filter) {
  CUR = null; markNav();
  const eds = TERMS.targets.filter(e => D.editions[e]);
  if (idx === undefined || idx === null || idx === '') {
    const f = (filter || '').trim().toLowerCase();
    const rows = TERMS.terms.map((r, i) => [r, i]).filter(([r]) => !f || r.de.toLowerCase().includes(f) ||
      Object.values(r.render).some(list => list.some(x => x.form.includes(f))));
    view.innerHTML = `<div class="page terms"><h2>${t('terms.title')}</h2><p class="help">${t('terms.note')}</p>
      <div class="opts"><input id="tfilter" type="search" value="${esc(filter || '')}" placeholder="${t('terms.filter_ph')}"></div>
      <table><thead><tr><th>${esc(D.editions[TERMS.de].short)}</th><th>№</th><th title="${esc(t('terms.idx_col_title'))}">${t('terms.idx_col')}</th>${eds.map(e => `<th>${esc(D.editions[e].short)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(([r, i]) => `<tr><td class="de"><a class="t" href="#/terms/${i}">${esc(r.de)}</a></td><td>${r.props.length}</td><td class="ix">${r.index ? `<span title="${esc(r.index.head)}">${Math.round(r.index.overlap * 100)}%</span>` : ''}</td>${eds.map(e =>
        `<td>${(r.render[e] || []).map((x, k) => `<span class="r${k === 0 ? ' main' : ''}" title="${esc(t('terms.cand_title', {n: x.n, all: x.all, s: x.score}))}">${esc(x.form)} <small>${x.n}</small></span>`).join('')}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
    const inp = $('#tfilter');
    inp.addEventListener('input', () => { clearTimeout(inp._t); inp._t = setTimeout(() => { history.replaceState(null, '', '#/terms?f=' + encodeURIComponent(inp.value)); showTerms(null, inp.value); $('#tfilter').focus(); $('#tfilter').setSelectionRange(9e9, 9e9); }, 250); });
    view.scrollTop = 0;
    return;
  }
  const r = TERMS.terms[+idx];
  if (!r) { location.hash = '#/terms'; return; }
  const cols = [TERMS.de, ...eds.filter(e => SHOWN.includes(e))];
  await ensure(cols);
  const cqs = {[TERMS.de]: termCq(r.rx)};
  eds.forEach(e => { const q = (r.render[e] || []).map(x => x.q).join(' '); if (q) cqs[e] = compileQuery(q); });
  const cell = (n, ed) => {
    const tx = D.props[n].text[ed];
    let h = tx ? MD.render(tx, {fig: figFor(ed), fn: fnFor(ed)}) : `<p class="miss">[${t('prop.missing')}]</p>`;
    if (tx && cqs[ed] && cqs[ed].all) h = highlightHtml(h, cqs[ed], 'mark');
    return `<div class="cell" data-n="${n}" data-ed="${ed}" lang="${D.editions[ed].lang}"><div class="body">${h.replace(/^<p>/, `<p><a class="n" href="#/p/${n}">${n}</a>`)}</div></div>`;
  };
  view.innerHTML = `<div class="page terms"><p class="crumbs"><a href="#/terms">${t('terms.title')}</a><span class="sep">›</span><b>${esc(r.de)}</b></p>
    <div class="termhead">${esc(t('terms.in_props', {n: r.props.length}))} · ${eds.map(e => `${esc(D.editions[e].short)}: ${(r.render[e] || []).map(x => `<b>${esc(x.form)}</b> ${x.n}`).join(', ') || '—'}`).join(' · ')}</div>
    ${r.index ? `<div class="termidx">${t('terms.idx', {head: esc(r.index.head), k: r.index.k, n: r.index.n})}${r.index.only_index.length ? ' ' + t('terms.idx_only') + ' ' + r.index.only_index.map(n => `<a href="#/p/${n}">${n}</a>`).join(', ') : ''} · <a href="#/app/en1961/index">${t('terms.idx_link')}</a></div>` : ''}
    <p class="help">${t('terms.cols_hint')}</p>
    <div class="colhead cols" style="${gridCols(cols.length)}">${cols.map(e => `<div>${esc(D.editions[e].short)}</div>`).join('')}</div>
    ${r.props.map(n => `<div class="row" style="${gridCols(cols.length)}">${cols.map(e => cell(n, e)).join('')}</div>`).join('')}</div>`;
  decorate(view);
  view.scrollTop = 0;
}
