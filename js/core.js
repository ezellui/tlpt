/* core.js — общее: настройки, язык интерфейса, данные в памяти, отрисовка текста. */
"use strict";
const I = window.I18N, MD = window.TLPmd;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const store = {
  get(k, d) { try { const v = localStorage.getItem('tlp-' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tlp-' + k, v); } catch (e) {} },
  json(k, d) { try { const v = JSON.parse(store.get(k, 'null')); return v === null ? d : v; } catch (e) { return d; } }
};

/* ---------- язык интерфейса ---------- */
let LANG = store.get('lang', (navigator.language || 'ru').slice(0, 2));
if (!I.langs[LANG]) LANG = 'en';
const plural = {};
function t(key, params) {
  const e = I.dict[key];
  if (!e) { console.warn('i18n: нет ключа', key); return key; }
  let v = e[LANG] !== undefined ? e[LANG] : (console.warn('i18n: нет перевода', key, LANG), e.ru);
  params = params || {};
  if (typeof v === 'object') {
    const pr = plural[LANG] || (plural[LANG] = new Intl.PluralRules(LANG));
    const f = pr.select(params.n || 0);
    v = v[f] !== undefined ? v[f] : v.other !== undefined ? v.other : v.many;
  }
  return v.replace(/\{(\w+)\}/g, (m, k) => params[k] !== undefined ? params[k] : m);
}
function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(n => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  document.documentElement.lang = LANG;
}

/* ---------- данные в памяти ----------
   D.editions[id]  — из манифеста;  D.props[num] = {parent, groups, refs, text:{ed}, page:{ed}}
   D.notes[ed], D.front[ed], D.comments[ed] — заполняются при загрузке редакции. */
const MANIFEST = TLP.get('manifest'), TREE = TLP.get('tree');
const D = {editions: {}, props: {}, notes: {}, front: {}, comments: {}, app: {}, figs: {}, figures: TREE.figures};
MANIFEST.editions.forEach(e => { D.editions[e.id] = e; });
TREE.nums.forEach(n => { const p = TREE.props[n] || {}; D.props[n] = {parent: p.parent || null, groups: p.groups || [], refs: p.refs || [], refsrc: p.refsrc || {}, text: {}, page: {}}; });
const EDS = MANIFEST.editions.map(e => e.id);
const LOADED = new Set();

function cmpNum(a, b) {           // десятичный порядок: 2.01 < 2.011 < 2.012 < 2.0121 < 2.013
  const [ia, da = ''] = a.split('.'), [ib, db = ''] = b.split('.');
  if (ia !== ib) return ia - ib;
  return da < db ? -1 : da > db ? 1 : 0;
}
const NUMS = TREE.nums.slice().sort(cmpNum);
const POS = new Map(NUMS.map((n, i) => [n, i]));
const CHILDREN = n => (D.props[n].groups || []).flat();
const DESC = {};
for (let i = NUMS.length - 1; i >= 0; i--) { const n = NUMS[i]; DESC[n] = CHILDREN(n).reduce((s, c) => s + 1 + DESC[c], 0); }
const REFS_IN = {};
NUMS.forEach(n => (D.props[n].refs || []).forEach(r => (REFS_IN[r] = REFS_IN[r] || []).push(n)));
const COMM = {};                 // номер -> комментарии, где он последний в «пачке»
function ancestors(n) { const a = []; let p = D.props[n].parent; while (p) { a.unshift(p); p = D.props[p].parent; } return a; }

async function ensure(eds) {
  const need = eds.filter(e => !LOADED.has(e) && D.editions[e]);
  await Promise.all(need.map(async ed => {
    const x = await TLP.load('ed/' + ed, D.editions[ed].file);
    for (const n in x.texts) if (D.props[n]) D.props[n].text[ed] = x.texts[n];
    for (const n in x.pages) if (D.props[n]) D.props[n].page[ed] = x.pages[n];
    D.notes[ed] = x.notes || {}; D.front[ed] = x.front || {}; D.comments[ed] = x.comments || [];
    D.app[ed] = x.apparatus || []; D.figs[ed] = x.figs || {};
    D.comments[ed].forEach(c => { const last = c.covers[c.covers.length - 1]; (COMM[last] = COMM[last] || []).push(Object.assign({ed}, c)); });
    LOADED.add(ed);
  }));
}

/* ---------- состояние ---------- */
let SHOWN = store.get('eds', 'de1961,ru2023').split(',').filter(e => D.editions[e]);
if (!SHOWN.length) SHOWN = [EDS[EDS.length - 1]];
let SHOW_COMM = store.get('comm', '1') === '1';
let CUR = null;
let HL = null;                   // подсветка найденного (скомпилированный запрос)

/* ---------- отрисовка текста ---------- */
function figFor(ed) {
  return (name, alt) => {
    const svg = (D.figs[ed] || {})[name];
    return svg ? `<span class="vec" role="img" aria-label="${esc(alt || name)}">${svg}</span>` : `[${esc(name)}]`;
  };
}
function fnFor(ed) {
  return lab => `<sup class="fn"><a data-ed="${ed}" data-fn="${esc(lab)}">${esc(lab.replace(/^p\d+$/, '*'))}</a></sup>`;
}
function renderMd(md, ed) {
  let h = MD.render(md, {fig: figFor(ed), fn: fnFor(ed)});
  if (HL) h = highlightHtml(h, HL, 'mark');
  return h;
}
function firstLine(n, ed) {
  for (const e of [ed, ...SHOWN, ...EDS]) { const tx = D.props[n].text[e]; if (tx) return MD.plain(tx).slice(0, 140); }
  return '';
}
const lead = () => SHOWN.find(e => D.editions[e].lang === LANG) || SHOWN[0];
function cite(n, ed) { return D.editions[ed].cite.replace('{p}', D.props[n].page[ed] || '?'); }
function gridCols(k) { return `grid-template-columns:repeat(${k},minmax(0,1fr))`; }
function edHead(ed, n) {
  const e = D.editions[ed], pg = n ? D.props[n].page[ed] : null;
  return `<div class="edh"><span>${esc(e.short)}</span>${pg ? `<span>${t('prop.page', {p: pg})}</span>` : ''}</div>`;
}

/* ---------- свёртка для поиска (как в HWPh, плюс ё = е) ---------- */
const DROP = new Set('´′`˜¨᾿῾῀΄΅');
function foldChar(c) {
  if (DROP.has(c)) return '';
  if (c === 'ß') return 'ss';
  if (c === 'ё' || c === 'Ё') return 'е';
  return c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
function foldMap(s) { let o = '', idx = [], i = 0; for (const c of s) { const f = foldChar(c); o += f; for (let k = 0; k < f.length; k++) idx.push(i); i += c.length; } idx.push(s.length); return [o, idx]; }
const fold = s => foldMap(s)[0];

/* подсветка внутри текстовых узлов HTML (без захода в формулы KaTeX) */
function highlightHtml(html, cq, tag, cls) {
  const open = tag === 'mark' ? '<mark>' : `<span class="${cls}">`, close = tag === 'mark' ? '</mark>' : '</span>';
  let depthKatex = 0;
  return html.replace(/(<[^>]+>)|([^<]+)/g, (m, tg, txt) => {
    if (tg) {
      if (depthKatex) { if (/^<span[\s>]/.test(tg)) depthKatex++; else if (tg === '</span>') depthKatex--; }
      else if (/^<span class="katex/.test(tg)) depthKatex = 1;
      return tg;
    }
    if (depthKatex) return txt;
    const [f, idx] = foldMap(txt); let out = '', last = 0;
    cq.all.lastIndex = 0; let r;
    while ((r = cq.all.exec(f))) {
      if (!r[0].length) { cq.all.lastIndex++; continue; }
      const a = idx[r.index], b = idx[r.index + r[0].length];
      out += txt.slice(last, a) + open + txt.slice(a, b) + close; last = b;
    }
    return out + txt.slice(last);
  });
}

function toast(msg) { const el = $('#toast'); el.textContent = msg; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { el.style.display = 'none'; }, 1500); }
function copyText(s) {
  const done = () => toast(t('prop.copied'));
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(done, fallback); else fallback();
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  a.download = name; a.click();
}
